import {
  runTransaction,
  doc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { DiningEvent } from "../types";

export type BookEventInput = {
  uid: string;
  eventId: string;
  numPeople: number;
  existingBookingId: string | null;
  eventData: DiningEvent;
};

/**
 * Books or updates a reservation entirely in Firestore (no Express).
 * Mirrors server /api/book-event logic; deploy updated firestore.rules with the repo.
 */
export async function bookEventInFirestore(input: BookEventInput): Promise<void> {
  const { uid, eventId, numPeople, existingBookingId, eventData } = input;
  const userRef = doc(db, "users", uid);
  const eventRef = doc(db, "events", eventId);

  await runTransaction(db, async (transaction) => {
    const uSnap = await transaction.get(userRef);
    let eSnap = await transaction.get(eventRef);

    if (!uSnap.exists()) throw new Error("User not found");

    let eventDataToUse: Record<string, unknown> | null = eSnap.exists()
      ? (eSnap.data() as Record<string, unknown>)
      : null;

    if (!eSnap.exists()) {
      const { id: _omit, ...eventFields } = eventData;
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
        const ed = existingSnap.data();
        if (ed.userId !== uid) throw new Error("Invalid booking");
        previousCredits = ed.totalCredits as number;
        previousNumPeople = ed.numPeople as number;
        transaction.delete(existingBookingRef);
      }
    }

    const cPer =
      typeof eventDataToUse.creditsPerPerson === "number"
        ? eventDataToUse.creditsPerPerson
        : 0;
    const cap =
      typeof eventDataToUse.capacity === "number" ? eventDataToUse.capacity : 0;
    const booked =
      typeof eventDataToUse.bookedSeats === "number" ? eventDataToUse.bookedSeats : 0;

    const totalCredits = cPer * numPeople;
    const creditDifference = totalCredits - previousCredits;
    const uData = uSnap.data();
    const currentCredits = typeof uData.credits === "number" ? uData.credits : 0;

    if (currentCredits < creditDifference) throw new Error("Insufficient credits");

    const seatsChange = numPeople - previousNumPeople;
    if (booked + seatsChange > cap) throw new Error("Insufficient capacity");

    const bookingRef = doc(collection(db, "bookings"));
    transaction.set(bookingRef, {
      userId: uid,
      eventId,
      numPeople,
      totalCredits,
      createdAt: serverTimestamp(),
    });

    const prevProgress =
      typeof uData.membershipProgress === "number" ? uData.membershipProgress : 0;

    transaction.update(userRef, {
      credits: currentCredits - creditDifference,
      membershipProgress: prevProgress + creditDifference,
    });

    transaction.update(eventRef, {
      bookedSeats: booked + seatsChange,
    });

    const transRef = doc(collection(db, "transactions"));
    transaction.set(transRef, {
      userId: uid,
      amount: 0,
      creditsIssued: -creditDifference,
      type: "booking",
      timestamp: serverTimestamp(),
      bookingId: bookingRef.id,
      eventId,
    });
  });
}
