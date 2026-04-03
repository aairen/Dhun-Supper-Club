import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

const uid = process.argv[2];

if (!uid) {
  console.error("Usage: npx tsx scripts/set-admin.ts <UID>");
  process.exit(1);
}

const adminApp = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});

const databaseId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const db = getFirestore(adminApp, databaseId === "(default)" ? undefined : databaseId);

async function setAdmin() {
  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`Error: User document with UID ${uid} does not exist.`);
      process.exit(1);
    }

    await userRef.update({
      role: "admin",
    });

    console.log(`Successfully set role: 'admin' for user ${uid}`);
    process.exit(0);
  } catch (error) {
    console.error("Error setting admin role:", error);
    process.exit(1);
  }
}

setAdmin();
