import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { differenceInDays, parseISO, startOfDay, format, isBefore } from "date-fns";

dotenv.config();
//Fix for permission denied
const serviceAccountKey = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || '{}');

// Log environment variables for debugging (redacted for security where appropriate)
console.log("[ENV CHECK] VITE_FIREBASE_PROJECT_ID:", process.env.VITE_FIREBASE_PROJECT_ID || "Not Set");
console.log("[ENV CHECK] VITE_FIREBASE_FIRESTORE_DATABASE_ID:", process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "Not Set");
console.log("[ENV CHECK] APP_URL:", process.env.APP_URL || "Not Set");

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)",
};

console.log("[ENV CHECK] Resolved projectId:", firebaseConfig.projectId);

if (!firebaseConfig.projectId) {
  console.error("[FATAL] VITE_FIREBASE_PROJECT_ID is not set. Exiting.");
  process.exit(1);
}

// Helper to check for placeholder values
const isPlaceholder = (val: string | undefined) => {
  if (!val) return true;
  const upper = val.toUpperCase();
  return upper.includes("YOUR_") || upper.includes("MY_") || upper === "TODO";
};

// Helper to check if user is admin (including bootstrap logic)
const isUserAdmin = (decodedToken: any, callerSnap: any) => {
  const callerData = callerSnap.data();
  const isAdminRole = callerSnap.exists && (callerData?.role?.toLowerCase() === "admin");
  return isAdminRole;
};

async function createNotificationAdmin(userId: string, title: string, body: string) {
  const db = await getDb();
  await db.collection("notifications").add({
    userId,
    title,
    body,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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
    const projectId = firebaseConfig.projectId; // Assuming firebaseConfig has projectId
    const serviceAccountKeyString = process.env.FIREBASE_ADMIN_SDK_KEY; // Get the secret string

    try {
      if (serviceAccountKeyString && !isPlaceholder(serviceAccountKeyString)) {
        // Attempt to initialize with explicit service account key from secret
        const serviceAccountKey = JSON.parse(serviceAccountKeyString);
        if (serviceAccountKey && serviceAccountKey.project_id === projectId) {
          console.log(`[FIREBASE ADMIN] Initializing with explicit service account key from secret...`);
          adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountKey),
            // databaseURL is often not needed for Firestore-only usage
          });
        } else {
          console.warn(`[FIREBASE ADMIN] WARNING: Service account key secret found, but project_id mismatch or invalid. Falling back.`);
          // Fall through to the next initialization logic
        }
      }

      // If adminApp is still null (e.g., no valid serviceAccountKeyString or mismatch)
      if (!adminApp) {
        if (projectId && !isPlaceholder(projectId)) {
          console.log(`[FIREBASE ADMIN] Initializing with explicit projectId: ${projectId}`);
          adminApp = admin.initializeApp({ projectId });
        } else {
          console.log(`[FIREBASE ADMIN] Initializing with default credentials (no valid projectId found or key used)...`);
          adminApp = admin.initializeApp();
        }
      }

      console.log(`[FIREBASE ADMIN] Initialized successfully. Project: ${adminApp!.options.projectId || "Default"}`);

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
    let dbId = firebaseConfig.firestoreDatabaseId; // Assuming firebaseConfig has firestoreDatabaseId
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

  // API: Book Event
  app.post("/api/book-event", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      const { eventId, numPeople, existingBookingId, eventData } = req.body;

      // 1. Get user and event
      const userRef = db.collection("users").doc(decodedToken.uid);
      const eventRef = db.collection("events").doc(eventId);
      
      await db.runTransaction(async (transaction: any) => {
        const uSnap = await transaction.get(userRef);
        let eSnap = await transaction.get(eventRef);
        
        if (!uSnap.exists) throw new Error("User not found");
        
        let eventDataToUse = eSnap.exists ? eSnap.data() : null;
        if (!eSnap.exists && eventData) {
          // Initialise the auto-event in Firestore on first booking
          const { id, ...eventFields } = eventData;
          transaction.set(eventRef, {
            ...eventFields,
            bookedSeats: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          eventDataToUse = { ...eventFields, bookedSeats: 0 };
        }
        
        if (!eventDataToUse) throw new Error("Event not found");
        
        const userData = uSnap.data();
        
        let previousCredits = 0;
        let previousNumPeople = 0;

        if (existingBookingId) {
          const existingBookingRef = db.collection("bookings").doc(existingBookingId);
          const existingSnap = await transaction.get(existingBookingRef);
          if (existingSnap.exists) {
            previousCredits = existingSnap.data().totalCredits;
            previousNumPeople = existingSnap.data().numPeople;
            transaction.delete(existingBookingRef);
          }
        }
        
        // 2. Check credits
        const totalCredits = eventDataToUse.creditsPerPerson * numPeople;
        const creditDifference = totalCredits - previousCredits;
        if (userData.credits < creditDifference) throw new Error("Insufficient credits");
        
        // 3. Check capacity
        const seatsChange = numPeople - previousNumPeople;
        if ((eventDataToUse.bookedSeats || 0) + seatsChange > eventDataToUse.capacity) throw new Error("Insufficient capacity");
        
        // 4. Create booking
        const bookingRef = db.collection("bookings").doc();
        transaction.set(bookingRef, {
          userId: decodedToken.uid,
          eventId,
          numPeople,
          totalCredits,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 5. Update user credits
        transaction.update(userRef, {
          credits: userData.credits - creditDifference
        });
        
        // 6. Update event seats
        transaction.update(eventRef, {
          bookedSeats: (eventDataToUse.bookedSeats || 0) + seatsChange
        });
        
        // 7. Log transaction
        const transRef = db.collection("transactions").doc();
        transaction.set(transRef, {
          userId: decodedToken.uid,
          amount: 0,
          creditsIssued: -creditDifference,
          type: "booking",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          bookingId: bookingRef.id,
          eventId
        });
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Booking error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Send Email Route
  app.post("/api/send-email", async (req, res) => {
    return res.status(404).json({ error: "Email service disabled" });
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


  // Admin API: Clear ALL Bookings and Refund
  app.post("/api/admin/clear-all-bookings", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      console.log(`[ADMIN API] clear-all-bookings attempt by ${decodedToken.email} (${decodedToken.uid})`);
      
      // Verify caller is admin
      let callerSnap;
      try {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.log(`[ADMIN API] Reading user ${decodedToken.uid} from project: ${projectId}`);
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid} in project ${projectId}:`, fsErr);
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const bookingsSnap = await db.collection("bookings").get();
      const eventsSnap = await db.collection("events").get();
      const eventsMap: Record<string, any> = {};
      eventsSnap.docs.forEach(doc => eventsMap[doc.id] = doc.data());

      // Group bookings by userId
      const bookingsByUser: Record<string, any[]> = {};
      bookingsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!bookingsByUser[data.userId]) bookingsByUser[data.userId] = [];
        bookingsByUser[data.userId].push({ id: doc.id, ref: doc.ref, ...data });
      });

      let refundCount = 0;
      // Process each user
      for (const userId in bookingsByUser) {
        const userBookings = bookingsByUser[userId];
        const userRef = db.collection("users").doc(userId);
        
        await db.runTransaction(async (transaction: any) => {
          const uSnap = await transaction.get(userRef);
          if (!uSnap.exists) return;

          let totalRefund = 0;
          for (const booking of userBookings) {
            totalRefund += booking.totalCredits;
            transaction.delete(booking.ref);
            
            // Log refund transaction
            const transRef = db.collection("transactions").doc();
            transaction.set(transRef, {
              userId: userId,
              amount: 0,
              creditsIssued: booking.totalCredits,
              type: "refund",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              bookingId: booking.id,
              eventId: booking.eventId,
              reason: "All bookings cleared by admin"
            });

            // Add notification
            const event = eventsMap[booking.eventId];
            const eventDate = event ? new Date(event.dateTime).toLocaleDateString() : "unknown date";
            const eventTime = event ? new Date(event.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "unknown time";

            const eventTitle = event ? event.title : "unknown event";

            const notifRef = db.collection("notifications").doc();
            transaction.set(notifRef, {
              userId: userId,
              title: "Booking Canceled",
              body: `Your reservation of <b>${eventTitle}</b> on <b>${eventDate}</b> at <b>${eventTime}</b> for <b>${booking.numPeople} ${booking.numPeople === 1 ? "person" : "people"}</b> has been canceled by an <b><span style="color:red">admin</span></b>.`,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          const currentCredits = uSnap.data().credits || 0;
          transaction.update(userRef, {
            credits: currentCredits + totalRefund
          });
        });
        refundCount += userBookings.length;
      }

      const batch = db.batch();
      eventsSnap.docs.forEach(doc => batch.update(doc.ref, { bookedSeats: 0 }));
      await batch.commit();

      res.json({ success: true, message: `All ${refundCount} bookings cleared and refunded` });
    } catch (error: any) {
      console.error("Admin clear-all-bookings error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Set Admin Claim
  app.post("/api/set-admin", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      
      // Verify requester is admin
      let callerSnap;
      try {
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const { targetUserId } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ error: "Target User ID is required" });
      }

      // Set custom claim
      await adminApp!.auth().setCustomUserClaims(targetUserId, { admin: true });
      
      // Update role in Firestore
      await db.collection("users").doc(targetUserId).update({ role: "admin" });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Admin set-admin error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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
        const projectId = adminApp!.options.projectId || "Unknown";
        console.log(`[ADMIN API] Reading user ${decodedToken.uid} from project: ${projectId}`);
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid} in project ${projectId}:`, fsErr);
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

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
      
      const eventData = eventSnap.data();
      const isPast = isBefore(parseISO(eventData.dateTime), new Date());

      await db.runTransaction(async (transaction: any) => {
        // 2. Refund each booking if event is not in the past
        if (!isPast) {
          for (const bDoc of bookingsSnap.docs) {
            const bookingData = bDoc.data();
            const userRef = db.collection("users").doc(bookingData.userId);
            const uSnap = await transaction.get(userRef);
            
            if (uSnap.exists) {
              const currentCredits = uSnap.data().credits || 0;
              transaction.update(userRef, {
                credits: currentCredits + bookingData.totalCredits
              });

              // Add notification
              const notifRef = db.collection("notifications").doc();
              transaction.set(notifRef, {
                userId: bookingData.userId,
                title: "Event Cancelled",
                body: `Your reservation for ${eventData.title} has been cancelled as the event was deleted by an admin.`,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
        }

        // 3. Delete the event
        transaction.delete(eventRef);
      });

      res.json({ success: true, message: `Event deleted${!isPast ? ` and ${bookingsSnap.size} bookings refunded` : ""}` });
    } catch (error: any) {
      console.error("Admin delete-event error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Delete ALL Past Events
  app.post("/api/admin/delete-all-past-events", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const db = await getDb();
      const decodedToken = await adminApp!.auth().verifyIdToken(idToken);
      
      // Verify caller is admin
      const callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      const now = new Date();
      const eventsSnap = await db.collection("events").get();
      const pastEvents = eventsSnap.docs.filter(doc => isBefore(parseISO(doc.data().dateTime), now));

      const batch = db.batch();
      pastEvents.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      res.json({ success: true, message: `Deleted ${pastEvents.length} past events` });
    } catch (error: any) {
      console.error("Admin delete-all-past-events error:", error);
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
        const projectId = adminApp!.options.projectId || "Unknown";
        console.log(`[ADMIN API] Reading user ${decodedToken.uid} from project: ${projectId}`);
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid} in project ${projectId}:`, fsErr);
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

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
        const projectId = adminApp!.options.projectId || "Unknown";
        console.log(`[ADMIN API] Reading user ${decodedToken.uid} from project: ${projectId}`);
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid} in project ${projectId}:`, fsErr);
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

      if (!isAdmin) {
        console.log(`[ADMIN CHECK FAILED] User ${decodedToken.email} (${decodedToken.uid}) is not an admin.`);
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
        const projectId = adminApp!.options.projectId || "Unknown";
        console.log(`[ADMIN API] Reading user ${decodedToken.uid} from project: ${projectId}`);
        callerSnap = await db.collection("users").doc(decodedToken.uid).get();
      } catch (fsErr: any) {
        const projectId = adminApp!.options.projectId || "Unknown";
        console.error(`[ADMIN API] Firestore read failed for caller ${decodedToken.uid} in project ${projectId}:`, fsErr);
        throw fsErr;
      }
      
      const isAdmin = isUserAdmin(decodedToken, callerSnap);

      if (!isAdmin) {
        console.log(`[ADMIN CHECK FAILED] User ${decodedToken.email} (${decodedToken.uid}) is not an admin.`);
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
        const currentProgress = uSnap.data().membershipProgress || 0;
        transaction.update(userRef, {
          credits: currentCredits + bookingData.totalCredits,
          membershipProgress: Math.max(0, currentProgress - bookingData.totalCredits)
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

        // 5. Notify user
        const eventData = eSnap.data();
        const eventDate = eventData ? new Date(eventData.dateTime).toLocaleDateString() : "unknown date";
        const eventTime = eventData ? new Date(eventData.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "unknown time";
        
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          userId: bookingData.userId,
          title: "Booking Canceled",
          body: `Your reservation of <b>${eventData?.title}</b> on <b>${eventDate}</b> at <b>${eventTime}</b> for <b>${bookingData.numPeople} ${bookingData.numPeople === 1 ? "person" : "people"}</b> has been canceled by an <b><span style="color:red">admin</span></b>.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      res.json({ success: true, message: "Booking cancelled and credits refunded" });
    } catch (error: any) {
      console.error("Admin cancel-booking error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/edit-booking", async (req, res) => {
    try {
      const db = await getDb();
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();
      if (userDoc.data()?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { bookingId, numPeople } = req.body;
      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();
      
      if (!bookingDoc.exists) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const booking = bookingDoc.data()!;
      if (numPeople >= booking.numPeople) {
        return res.status(400).json({ error: "Admins can only lower the number of guests" });
      }

      const eventRef = db.collection("events").doc(booking.eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        return res.status(404).json({ error: "Event not found" });
      }

      const event = eventDoc.data()!;
      const seatsChange = numPeople - booking.numPeople;
      
      const batch = db.batch();
      batch.update(eventRef, { bookedSeats: (event.bookedSeats || 0) + seatsChange });
      batch.update(bookingRef, { numPeople, totalCredits: event.creditsPerPerson * numPeople });
      
      // Return credits
      const creditDifference = (booking.numPeople - numPeople) * event.creditsPerPerson;
      const userRef = db.collection("users").doc(booking.userId);
      batch.update(userRef, { credits: admin.firestore.FieldValue.increment(creditDifference) });

      await batch.commit();
      
      // Notify user
      const eventDate = new Date(event.dateTime).toLocaleDateString();
      const eventTime = new Date(event.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      await db.collection("notifications").add({
        userId: booking.userId,
        title: "Booking Updated",
        body: `Your reservation of <b>${event.title}</b> on <b>${eventDate}</b> at <b>${eventTime}</b> has updated to <b>${numPeople} ${numPeople === 1 ? "person" : "people"}</b> by an <b><span style="color:red">admin</span></b>.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true });
    } catch (error: any) {
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
