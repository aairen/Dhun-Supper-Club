import { doc, runTransaction, serverTimestamp, collection, increment } from "firebase/firestore";
import { db, auth } from "../firebase";
import { createNotification, formatPeople } from "./notificationUtils";
import { format, parseISO } from "date-fns";

export async function bookEventInFirestore({
  eventId,
  numPeople,
  existingBookingId,
  eventData,
  userData
}: {
  eventId: string;
  numPeople: number;
  existingBookingId?: string | null;
  eventData: any;
  userData: any;
}) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Unauthorized");

  const userRef = doc(db, "users", userId);
  const eventRef = doc(db, "events", eventId);

  await runTransaction(db, async (transaction) => {
    const uSnap = await transaction.get(userRef);
    const eSnap = await transaction.get(eventRef);

    if (!uSnap.exists()) throw new Error("User not found");

    let eventDataToUse = eSnap.exists() ? eSnap.data() : null;
    if (!eSnap.exists() && eventData) {
      const { id, ...eventFields } = eventData;
      transaction.set(eventRef, {
        ...eventFields,
        bookedSeats: 0,
        createdAt: serverTimestamp(),
      });
      eventDataToUse = { ...eventFields, bookedSeats: 0 };
    }

    if (!eventDataToUse) throw new Error("Event not found");

    let previousCredits = 0;
    let previousNumPeople = 0;

    if (existingBookingId) {
      const existingBookingRef = doc(db, "bookings", existingBookingId);
      const existingSnap = await transaction.get(existingBookingRef);
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        previousCredits = data.totalCredits;
        previousNumPeople = data.numPeople;
        transaction.delete(existingBookingRef);
      }
    }

    const totalCredits = eventDataToUse.creditsPerPerson * numPeople;
    const creditDifference = totalCredits - previousCredits;
    if (userData.credits < creditDifference) throw new Error("Insufficient credits");

    const seatsChange = numPeople - previousNumPeople;
    if ((eventDataToUse.bookedSeats || 0) + seatsChange > eventDataToUse.capacity) throw new Error("Insufficient capacity");

    const bookingRef = doc(collection(db, "bookings"));
    transaction.set(bookingRef, {
      userId: userId,
      eventId,
      numPeople,
      totalCredits,
      createdAt: serverTimestamp()
    });

    transaction.update(userRef, {
      credits: userData.credits - creditDifference,
      membershipProgress: increment(creditDifference > 0 ? creditDifference : 0)
    });

    transaction.update(eventRef, {
      bookedSeats: (eventDataToUse.bookedSeats || 0) + seatsChange
    });

    const transRef = doc(collection(db, "transactions"));
    transaction.set(transRef, {
      userId: userId,
      amount: 0,
      creditsIssued: -creditDifference,
      type: "booking",
      timestamp: serverTimestamp(),
      bookingId: bookingRef.id,
      eventId
    });
  });
}
