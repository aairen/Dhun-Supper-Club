import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const createNotification = async (userId: string, title: string, body: string) => {
  console.log(`[NOTIFICATION] Creating notification for ${userId}: ${title}`);
  if (!userId) {
    console.error(`[NOTIFICATION] Error: userId is missing!`);
    return;
  }
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      title,
      body,
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log(`[NOTIFICATION] Created successfully`);
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

export const formatPeople = (n: number) => n === 1 ? "1 person" : `${n} people`;
