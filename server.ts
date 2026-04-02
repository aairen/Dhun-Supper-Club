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

dotenv.config();

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
  if (!db) {
    const firebaseConfig = JSON.parse(
      await import("fs/promises").then((fs) => fs.readFile("./firebase-applet-config.json", "utf-8"))
    );

    if (!adminApp) {
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
    db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
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

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
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

          await db.runTransaction(async (transaction: any) => {
            const uSnap = await transaction.get(userRef);
            if (!uSnap.exists) throw new Error("User not found");
            
            const currentCredits = uSnap.data().credits || 0;
            transaction.update(userRef, {
              credits: currentCredits + totalCredits
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
