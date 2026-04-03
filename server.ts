import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { differenceInDays, parseISO, startOfDay, format } from "date-fns";
import { Resend } from "resend";
import fs from "fs";

dotenv.config();

// Log environment variables for debugging (redacted for security where appropriate)
console.log("[ENV CHECK] VITE_FIREBASE_PROJECT_ID:", process.env.VITE_FIREBASE_PROJECT_ID || "Not Set");
console.log("[ENV CHECK] VITE_FIREBASE_FIRESTORE_DATABASE_ID:", process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "Not Set");
console.log("[ENV CHECK] APP_URL:", process.env.APP_URL || "Not Set");

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)",
};

// Helper to check for placeholder values
const isPlaceholder = (val: string | undefined) => {
  if (!val) return true;
  const upper = val.toUpperCase();
  return upper.includes("YOUR_") || upper.includes("MY_") || upper === "TODO";
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
console.log(`[RESEND STATUS] ${resend ? "Initialized" : "Not Initialized (Missing API Key)"}`);

async function sendEmailHelper({ to, subject, body, type }: { to: string; subject: string; body: string; type: string }) {
  console.log(`[EMAIL ATTEMPT] To: ${to}, Subject: ${subject}, Type: ${type}`);
  try {
    if (resend) {
      console.log(`[RESEND ATTEMPT] Sending via Resend...`);
      const { data, error } = await resend.emails.send({
        from: "Dhun Supper Club <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: body,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error };
      }

      console.log(`[EMAIL SENT VIA RESEND] To: ${to}, Subject: ${subject}, ID: ${data?.id}`);
      return { success: true, id: data?.id };
    } else {
      console.log(`[EMAIL SIMULATED] To: ${to}, Subject: ${subject}, Type: ${type}`);
      return { success: true, message: "Simulated" };
    }
  } catch (err) {
    console.error("Email helper error:", err);
    return { success: false, error: err };
  }
}

const getAppUrl = (req: express.Request) => {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL;
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}`;
};

// Lazy Firebase Admin initialization
let adminApp: admin.app.App | null = null;
let db: any = null;

async function getDb() {
  if (!adminApp) {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    
    try {
      // If projectId is a placeholder or missing, let it auto-discover
      if (isPlaceholder(projectId)) {
        console.log(`[FIREBASE ADMIN] Initializing with AUTO-DISCOVERY (Project ID was placeholder or missing)`);
        adminApp = admin.initializeApp();
      } else {
        console.log(`[FIREBASE ADMIN] Initializing with projectId: ${projectId}`);
        adminApp = admin.initializeApp({ projectId });
      }
      console.log(`[FIREBASE ADMIN] Initialized successfully`);
    } catch (err: any) {
      if (err.code === 'app/duplicate-app') {
        adminApp = admin.app();
        console.log(`[FIREBASE ADMIN] Using existing app`);
      } else {
        console.error(`[FIREBASE ADMIN] Initialization failed:`, err);
        throw err;
      }
    }
  }

  if (!db) {
    // In Cloud Run, the default database is used if no ID is provided
    let dbId = firebaseConfig.firestoreDatabaseId;
    
    // Normalize dbId: treat "(default)" or placeholders as undefined
    if (dbId === "(default)" || isPlaceholder(dbId)) {
      dbId = undefined;
    }

    console.log(`[FIREBASE ADMIN] Getting Firestore for database: ${dbId || "(default)"}`);
    try {
      db = getFirestore(adminApp!, dbId);
      console.log(`[FIREBASE ADMIN] Firestore instance obtained`);
    } catch (err) {
      console.error(`[FIREBASE ADMIN] Failed to get Firestore:`, err);
      throw err;
    }
  }
  return db;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2023-10-16" as any,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON parsing
  app.use(express.json());

  // Verify Stripe Checkout Session (Alternative to webhooks for dev/demo)
  app.get("/api/verify-checkout-session", async (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Session ID is required" });
    }

    try {
      let session: any;
      
      if (sessionId.startsWith("mock_")) {
        // Handle mock session for demo/testing
        const mockData = JSON.parse(Buffer.from(sessionId.replace("mock_", ""), "base64").toString());
        session = {
          id: sessionId,
          payment_status: "paid",
          amount_total: mockData.totalAmount * 100,
          metadata: {
            userId: mockData.userId,
            credits: mockData.credits.toString(),
            bonus: mockData.bonus.toString()
          }
        };
      } else {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      }

      if (session.payment_status === "paid") {
        const { userId, credits, bonus } = session.metadata || {};

        if (userId && credits) {
          const db = await getDb();
          const userRef = db.collection("users").doc(userId);
          const totalCredits = parseInt(credits) + (parseInt(bonus || "0"));

          // Check if this session has already been processed to avoid double-crediting
          const processedRef = db.collection("processed_sessions").doc(sessionId);
          const processedSnap = await processedRef.get();

          if (!processedSnap.exists) {
            await db.runTransaction(async (transaction: any) => {
              const uSnap = await transaction.get(userRef);
              if (!uSnap.exists) throw new Error("User not found");
              
              const currentCredits = uSnap.data().credits || 0;
              transaction.update(userRef, {
                credits: currentCredits + totalCredits
              });

              // Mark session as processed
              transaction.set(processedRef, {
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                userId,
                totalCredits
              });

              // Log transaction
              const transRef = db.collection("transactions").doc();
              transaction.set(transRef, {
                userId,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                creditsIssued: totalCredits,
                type: "purchase",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                stripeSessionId: session.id
              });
            });

            return res.json({ success: true, creditsAdded: totalCredits });
          } else {
            return res.json({ success: true, message: "Session already processed" });
          }
        }
      }

      res.json({ success: false, message: "Payment not confirmed" });
    } catch (error: any) {
      console.error("Session verification error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Webhook
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, credits, bonus } = session.metadata || {};

      if (userId && credits) {
        try {
          const db = await getDb();
          const userRef = db.collection("users").doc(userId);
          const totalCredits = parseInt(credits) + (parseInt(bonus || "0"));

          // Check if this session has already been processed to avoid double-crediting
          const processedRef = db.collection("processed_sessions").doc(session.id);
          const processedSnap = await processedRef.get();

          if (!processedSnap.exists) {
            await db.runTransaction(async (transaction: any) => {
              const uSnap = await transaction.get(userRef);
              if (!uSnap.exists) throw new Error("User not found");
              
              const currentCredits = uSnap.data().credits || 0;
              transaction.update(userRef, {
                credits: currentCredits + totalCredits
              });

              // Mark session as processed
              transaction.set(processedRef, {
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                userId,
                totalCredits
              });

              // Log transaction
              const transRef = db.collection("transactions").doc();
              transaction.set(transRef, {
                userId,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                creditsIssued: totalCredits,
                type: "purchase",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                stripeSessionId: session.id
              });
            });

            console.log(`[STRIPE WEBHOOK] Credits added to user ${userId}: ${totalCredits}`);
          } else {
            console.log(`[STRIPE WEBHOOK] Session ${session.id} already processed`);
          }
        } catch (error) {
          console.error("Error updating user credits from webhook:", error);
        }
      }
    }

    res.json({ received: true });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Send Email Route
  app.post("/api/send-email", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await getDb();
      await adminApp!.auth().verifyIdToken(idToken);
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { to, subject, body, type } = req.body;
    const result = await sendEmailHelper({ to, subject, body, type });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  // Reminder Cron Route
  app.post("/api/cron/reminders", async (req, res) => {
    const cronSecret = req.headers["x-cron-secret"];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const db = await getDb();
      const now = new Date();
      const bookingsSnapshot = await db.collection("bookings").get();
      
      let sentCount = 0;

      for (const bDoc of bookingsSnapshot.docs) {
        const booking = bDoc.data();
        const bookingId = bDoc.id;
        
        // Fetch event
        const eDoc = await db.collection("events").doc(booking.eventId).get();
        if (!eDoc.exists) continue;
        const event = eDoc.data();
        if (!event) continue;

        // Fetch user profile for notification prefs
        const uDoc = await db.collection("users").doc(booking.userId).get();
        if (!uDoc.exists) continue;
        const user = uDoc.data();
        if (!user || user.notificationPrefs?.reminders === false) continue;

        const eventDate = parseISO(event.dateTime);
        const daysUntil = differenceInDays(startOfDay(eventDate), startOfDay(now));
        
        const remindersSent = booking.remindersSent || {};
        let shouldSend = false;
        let timeFrame = "";
        let reminderKey = "";

        if (daysUntil === 14 && !remindersSent.twoWeeks) {
          shouldSend = true;
          timeFrame = "in 2 weeks";
          reminderKey = "twoWeeks";
        } else if (daysUntil === 7 && !remindersSent.oneWeek) {
          shouldSend = true;
          timeFrame = "in 1 week";
          reminderKey = "oneWeek";
        } else if (daysUntil === 0 && !remindersSent.dayOf) {
          shouldSend = true;
          timeFrame = "today";
          reminderKey = "dayOf";
        }

        if (shouldSend) {
          console.log(`[REMINDER SENT] To: ${user.email}, Event: ${event.title}, Timeframe: ${timeFrame}`);
          
          await sendEmailHelper({
            to: user.email,
            subject: `Reminder: ${event.title} is ${timeFrame}`,
            body: `
              <div style="font-family: serif; color: #171717; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
                <h1 style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-size: 24px; margin-bottom: 40px;">Experience Reminder</h1>
                <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px;">Hello ${user.firstName},</p>
                <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 24px;">
                  This is a reminder that your experience <strong>${event.title}</strong> is ${timeFrame}.
                </p>
                <div style="background-color: #f9f9f9; padding: 24px; margin-bottom: 32px;">
                  <p style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373;">Details</p>
                  <p style="margin: 0 0 8px; font-size: 16px;"><strong>Date & Time:</strong> ${format(parseISO(event.dateTime), "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>
                <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 40px;">
                  We are excited to see you soon.
                </p>
              </div>
            `,
            type: "reminder"
          });

          // Update booking
          await db.collection("bookings").doc(bookingId).update({
            [`remindersSent.${reminderKey}`]: true
          });
          sentCount++;
        }
      }

      res.json({ success: true, sentCount });
    } catch (error: any) {
      console.error("Cron error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { credits, userId, bonus, totalAmount, eventId, numPeople } = req.body;

    // Check if Stripe is configured
    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_mock";

    const appUrl = getAppUrl(req);
    const queryParams = new URLSearchParams();
    queryParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    if (eventId) queryParams.set("eventId", eventId);
    if (numPeople) queryParams.set("numPeople", numPeople.toString());

    const successUrl = `${appUrl}/dashboard?${queryParams.toString()}`;

    if (isMock) {
      // Return a mock session ID that encodes the purchase data
      const mockData = { userId, credits, bonus, totalAmount };
      const mockSessionId = `mock_${Buffer.from(JSON.stringify(mockData)).toString("base64")}`;
      
      const mockQueryParams = new URLSearchParams();
      mockQueryParams.set("session_id", mockSessionId);
      if (eventId) mockQueryParams.set("eventId", eventId);
      if (numPeople) mockQueryParams.set("numPeople", numPeople.toString());
      
      return res.json({ id: mockSessionId, url: `${appUrl}/dashboard?${mockQueryParams.toString()}` });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${credits} Dhun Credits`,
                description: bonus > 0 ? `Includes ${bonus} bonus credits` : undefined,
              },
              unit_amount: Math.round(totalAmount * 100), // Amount in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: `${appUrl}/buy-credits`,
        metadata: {
          userId,
          credits: credits.toString(),
          bonus: bonus.toString(),
          type: "credit_purchase",
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reminder Job
  const startReminderJob = async () => {
    console.log("Starting reminder job...");
    const db = await getDb();
    
    setInterval(async () => {
      try {
        const now = new Date();
        const bookingsSnap = await db.collection("bookings").get();
        
        for (const bDoc of bookingsSnap.docs) {
          const booking = bDoc.data();
          const eventSnap = await db.collection("events").doc(booking.eventId).get();
          
          if (!eventSnap.exists) continue;
          
          const event = eventSnap.data();
          const eventDate = parseISO(event.dateTime);
          const diffDays = differenceInDays(startOfDay(eventDate), startOfDay(now));
          
          const remindersSent = booking.remindersSent || {};
          let timeFrame = "";
          let reminderKey = "";

          if (diffDays === 14 && !remindersSent.twoWeeks) {
            timeFrame = "in 2 weeks";
            reminderKey = "twoWeeks";
          } else if (diffDays === 7 && !remindersSent.oneWeek) {
            timeFrame = "in 1 week";
            reminderKey = "oneWeek";
          } else if (diffDays === 0 && !remindersSent.dayOf) {
            timeFrame = "today";
            reminderKey = "dayOf";
          }

          if (reminderKey) {
            // Fetch User
            const userSnap = await db.collection("users").doc(booking.userId).get();
            if (!userSnap.exists) continue;
            const userProfile = userSnap.data();

            // Send Reminder
            console.log(`[REMINDER] Sending ${reminderKey} reminder to ${userProfile.email} for ${event.title}`);
            
            await sendEmailHelper({
              to: userProfile.email,
              subject: `Reminder: ${event.title} is ${timeFrame}`,
              body: `
                <div style="font-family: serif; color: #171717; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
                  <h1 style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-size: 24px; margin-bottom: 40px;">Experience Reminder</h1>
                  <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px;">Hello ${userProfile.firstName},</p>
                  <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 24px;">
                    This is a reminder that your experience <strong>${event.title}</strong> is ${timeFrame}.
                  </p>
                  <div style="background-color: #f9f9f9; padding: 24px; margin-bottom: 32px;">
                    <p style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373;">Details</p>
                    <p style="margin: 0 0 8px; font-size: 16px;"><strong>Date & Time:</strong> ${format(parseISO(event.dateTime), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                  <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 40px;">
                    We are excited to see you soon.
                  </p>
                </div>
              `,
              type: "reminder"
            });
            
            // Update Booking
            await bDoc.ref.update({
              [`remindersSent.${reminderKey}`]: true
            });
          }
        }
      } catch (error) {
        console.error("Error in reminder job:", error);
      }
    }, 1000 * 60 * 60); // Run every hour
  };

  startReminderJob();

  // Admin API: Delete Event and Refund
  app.post("/api/admin/delete-event", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      console.log(`[ADMIN API] delete-event attempt by ${decodedToken.email} (${decodedToken.uid})`);
      
      // Verify caller is admin
      let callerSnap;
      try {
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid}:`, fsErr);
        throw fsErr;
      }
      
      const callerData = callerSnap.data();
      const isAdmin = callerSnap.exists && (callerData?.role?.toLowerCase() === "admin");

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const { eventId } = req.body;
      if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
      }

      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await eventRef.get();
      if (!eventSnap.exists) {
        return res.status(404).json({ error: "Event not found" });
      }

      // 1. Find all bookings for this event
      const bookingsSnap = await db.collection("bookings").where("eventId", "==", eventId).get();
      
      await db.runTransaction(async (transaction: any) => {
        // 2. Refund each booking
        for (const bDoc of bookingsSnap.docs) {
          const bookingData = bDoc.data();
          const userRef = db.collection("users").doc(bookingData.userId);
          const uSnap = await transaction.get(userRef);
          
          if (uSnap.exists) {
            const currentCredits = uSnap.data().credits || 0;
            transaction.update(userRef, {
              credits: currentCredits + bookingData.totalCredits
            });

            // Log refund transaction
            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
              userId: bookingData.userId,
              amount: 0,
              creditsIssued: bookingData.totalCredits,
              type: "refund",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              bookingId: bDoc.id,
              eventId: eventId,
              reason: "Event deleted by admin"
            });
          }
          
          // Delete booking
          transaction.delete(bDoc.ref);
        }

        // 3. Delete the event
        transaction.delete(eventRef);
      });

      res.json({ success: true, message: `Event deleted and ${bookingsSnap.size} bookings refunded` });
    } catch (error: any) {
      console.error("Admin delete-event error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Delete ALL Events and Refund
  app.post("/api/admin/delete-all-events", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      console.log(`[ADMIN API] delete-all-events attempt by ${decodedToken.email} (${decodedToken.uid})`);
      
      // Verify caller is admin
      let callerSnap;
      try {
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid}:`, fsErr);
        throw fsErr;
      }
      
      const callerData = callerSnap.data();
      const isAdmin = callerSnap.exists && (callerData?.role?.toLowerCase() === "admin");

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const eventsSnap = await db.collection("events").get();
      const bookingsSnap = await db.collection("bookings").get();

      let refundCount = 0;
      for (const bDoc of bookingsSnap.docs) {
        const bookingData = bDoc.data();
        const userRef = db.collection("users").doc(bookingData.userId);
        
        await db.runTransaction(async (transaction: any) => {
          const uSnap = await transaction.get(userRef);
          if (uSnap.exists) {
            const currentCredits = uSnap.data().credits || 0;
            transaction.update(userRef, {
              credits: currentCredits + bookingData.totalCredits
            });

            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
              userId: bookingData.userId,
              amount: 0,
              creditsIssued: bookingData.totalCredits,
              type: "refund",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              bookingId: bDoc.id,
              eventId: bookingData.eventId,
              reason: "All events cleared by admin"
            });
          }
          transaction.delete(bDoc.ref);
        });
        refundCount++;
      }

      const batch = db.batch();
      eventsSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      res.json({ success: true, message: `All ${eventsSnap.size} events deleted and ${refundCount} bookings refunded` });
    } catch (error: any) {
      console.error("Admin delete-all-events error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Set User Role
  app.post("/api/admin/set-role", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      console.log(`[ADMIN API] set-role attempt by ${decodedToken.email} (${decodedToken.uid})`);
      
      // Verify caller is admin
      let callerSnap;
      try {
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid}:`, fsErr);
        throw fsErr;
      }
      
      const callerData = callerSnap.data();
      const isAdmin = callerSnap.exists && (callerData?.role?.toLowerCase() === "admin");

      if (!isAdmin) {
        console.log(`[ADMIN CHECK FAILED] User ${decodedToken.email} (${decodedToken.uid}) is not an admin. Role found: ${callerData?.role}`);
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const { targetUid, role } = req.body;
      if (!targetUid || !role) {
        return res.status(400).json({ error: "Target UID and role are required" });
      }

      const targetRef = db.collection("users").doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        return res.status(404).json({ error: "Target user not found" });
      }

      await targetRef.update({ role });
      res.json({ success: true, message: `User role updated to ${role}` });
    } catch (error: any) {
      console.error("Admin set-role error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Cancel Booking
  app.post("/api/admin/cancel-booking", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      console.log(`[ADMIN API] cancel-booking attempt by ${decodedToken.email} (${decodedToken.uid})`);
      
      // Verify caller is admin
      let callerSnap;
      try {
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid}:`, fsErr);
        throw fsErr;
      }
      
      const callerData = callerSnap.data();
      const isAdmin = callerSnap.exists && (callerData?.role?.toLowerCase() === "admin");

      if (!isAdmin) {
        console.log(`[ADMIN CHECK FAILED] User ${decodedToken.email} (${decodedToken.uid}) is not an admin. Role found: ${callerData?.role}`);
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const { bookingId } = req.body;
      if (!bookingId) {
        return res.status(400).json({ error: "Booking ID is required" });
      }

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const bookingData = bookingSnap.data();
      const userRef = db.collection("users").doc(bookingData.userId);
      const eventRef = db.collection("events").doc(bookingData.eventId);

      await db.runTransaction(async (transaction: any) => {
        const uSnap = await transaction.get(userRef);
        const eSnap = await transaction.get(eventRef);
        
        if (!uSnap.exists) throw new Error("User not found");
        
        // 1. Delete booking
        transaction.delete(bookingRef);
        
        // 2. Refund credits
        const currentCredits = uSnap.data().credits || 0;
        transaction.update(userRef, {
          credits: currentCredits + bookingData.totalCredits
        });

        // 3. Update event booked seats
        if (eSnap.exists) {
          const currentBooked = eSnap.data().bookedSeats || 0;
          transaction.update(eventRef, {
            bookedSeats: Math.max(0, currentBooked - bookingData.numPeople)
          });
        }

        // 4. Log refund transaction
        const transRef = db.collection("transactions").doc();
        transaction.set(transRef, {
          userId: bookingData.userId,
          amount: 0,
          creditsIssued: bookingData.totalCredits,
          type: "refund",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          bookingId: bookingId,
          eventId: bookingData.eventId
        });
      });

      res.json({ success: true, message: "Booking cancelled and credits refunded" });
    } catch (error: any) {
      console.error("Admin cancel-booking error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
