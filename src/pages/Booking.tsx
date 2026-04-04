import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, updateDoc, increment, setDoc, query, where, getDocs, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../components/AuthProvider";
import { DiningEvent, Booking as BookingType } from "../types";
import { format, parseISO, differenceInDays } from "date-fns";
import { motion } from "motion/react";
import { ShoppingBag, AlertCircle, CheckCircle, ArrowLeft, CreditCard, Plus, Minus, Calendar, Users, Star, Info, ArrowRight, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { generateAutoEvents } from "../lib/eventUtils";
import { Link } from "react-router-dom";
import { sendEmail, emailTemplates } from "../lib/email";
import { bookEventInFirestore } from "../lib/bookEventClient";

const Booking = () => {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const { profile, user, isMember } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<DiningEvent | null>(null);
  const [existingBooking, setExistingBooking] = useState<BookingType | null>(null);
  const [numPeople, setNumPeople] = useState(() => {
    const val = parseInt(searchParams.get("numPeople") || "1");
    return isNaN(val) ? 1 : val;
  });
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const autoBookingAttempted = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId || !user) return;
      
      // Fetch Event
      const docRef = doc(db, "events", eventId);
      const docSnap = await getDoc(docRef);
      let eventData: DiningEvent | null = null;
      
      if (docSnap.exists()) {
        eventData = { id: docSnap.id, ...docSnap.data() } as DiningEvent;
      } else {
        const autoEvents = generateAutoEvents();
        const found = autoEvents.find(e => e.id === eventId);
        if (found) eventData = found;
      }
      setEvent(eventData);

      // Fetch Existing Booking
      const q = query(collection(db, "bookings"), where("userId", "==", user.uid), where("eventId", "==", eventId));
      const bSnap = await getDocs(q);
      if (!bSnap.empty) {
        const bData = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as BookingType;
        setExistingBooking(bData);
        if (!searchParams.get("numPeople")) {
          setNumPeople(bData.numPeople);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [eventId, user, searchParams]);

  const rawDays = event ? differenceInDays(parseISO(event.dateTime), new Date()) : 0;
  const daysUntilEvent = isNaN(rawDays) ? 0 : rawDays;
  const canEditFreely = daysUntilEvent >= 14;
  const isSpecial = event ? (daysUntilEvent <= 5 && (event.capacity - (event.bookedSeats || 0) > 0)) : false;
  const effectiveCreditsPerPerson = event ? (isSpecial && isMember ? event.creditsPerPerson - 1 : event.creditsPerPerson) : 0;

  const totalCredits = isNaN(effectiveCreditsPerPerson * numPeople) ? 0 : effectiveCreditsPerPerson * numPeople;
  const currentTotalCredits = existingBooking ? existingBooking.totalCredits : 0;
  const creditDifference = totalCredits - currentTotalCredits;
  const missingCredits = Math.max(0, creditDifference - (profile?.credits || 0));
  const hasEnoughCredits = missingCredits === 0;

  const handleBooking = async () => {
    if (!user || !profile || !hasEnoughCredits || !event) return;
    
    // Restriction for late edits
    if (!canEditFreely && existingBooking && numPeople < existingBooking.numPeople) {
      setError("Within 14 days of the event, you can only add more guests to your reservation.");
      return;
    }

    setBookingLoading(true);
    setError("");

    try {
      await bookEventInFirestore({
        uid: user.uid,
        eventId: event.id,
        numPeople,
        existingBookingId: existingBooking?.id ?? null,
        eventData: event,
      });

      // Send confirmation email if enabled
      if (profile.notificationPrefs?.confirmations !== false) {
        const template = existingBooking 
          ? emailTemplates.confirmation(
              profile.firstName || "Guest",
              `Updated: ${event.title}`,
              format(parseISO(event.dateTime), "MMM dd, yyyy 'at' h:mm a"),
              numPeople,
              totalCredits
            )
          : emailTemplates.confirmation(
              profile.firstName || "Guest",
              event.title,
              format(parseISO(event.dateTime), "MMM dd, yyyy 'at' h:mm a"),
              numPeople,
              totalCredits
            );
            
        await sendEmail({
          to: user.email || "",
          subject: template.subject,
          body: template.body,
          type: "confirmation",
        });
      }

      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("success") === "true" && profile && hasEnoughCredits && !success && !bookingLoading && !autoBookingAttempted.current && event) {
      autoBookingAttempted.current = true;
      handleBooking();
    }
  }, [searchParams, profile, hasEnoughCredits, success, bookingLoading, event]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900 transition-colors duration-300">Loading Experience...</div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900 transition-colors duration-300">Experience not found.</div>;

  return (
    <div className="min-h-screen bg-neutral-50 py-12 md:py-24 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4">
        <button 
          onClick={() => navigate("/events")}
          className="flex items-center text-sm text-neutral-500 hover:text-neutral-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Event Details */}
          <div className="space-y-6 md:space-y-8">
            <div className="aspect-square bg-neutral-200 overflow-hidden">
              <img 
                src={event.type === 'thali' 
                  ? "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=800"
                  : event.type === 'brunch'
                    ? "https://images.unsplash.com/photo-1513442542250-854d436a73f2?auto=format&fit=crop&q=80&w=800"
                    : "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=800"
                }
                alt={event.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-neutral-900 mb-2 uppercase tracking-wider">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[10px] text-neutral-400 uppercase tracking-widest mb-6">
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(parseISO(event.dateTime), "MMM dd, yyyy")}
                </div>
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(parseISO(event.dateTime), "h:mm a")}
                </div>
                <div className="flex items-center">
                  <Star className="w-3 h-3 mr-1" />
                  {event.creditsPerPerson} Credits
                </div>
              </div>
              <p className="text-sm md:text-base text-neutral-500 font-light leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>

          {/* Booking Form */}
          <div className="bg-white border border-neutral-200 p-6 md:p-8 shadow-sm h-fit">
            <h2 className="text-lg md:text-xl font-serif mb-6 md:mb-8 uppercase tracking-widest text-neutral-900">
              {existingBooking ? "Edit Reservation" : "Reservation Details"}
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Number of Guests</label>
                <div className="flex items-center justify-between bg-neutral-50 p-4 border border-neutral-100">
                  <button 
                    onClick={() => setNumPeople(Math.max(!canEditFreely && existingBooking ? existingBooking.numPeople : 1, numPeople - 1))}
                    disabled={!canEditFreely && existingBooking && numPeople <= existingBooking.numPeople}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <span className="text-3xl font-serif text-neutral-900">{numPeople}</span>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest">{numPeople === 1 ? 'Guest' : 'Guests'}</p>
                  </div>
                  <button 
                    onClick={() => setNumPeople(Math.min(event.capacity - ((event.bookedSeats || 0) - (existingBooking?.numPeople || 0)), numPeople + 1))}
                    className="w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 hover:bg-neutral-900 hover:text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {!canEditFreely && existingBooking && (
                  <p className="text-[10px] text-amber-600 uppercase tracking-widest font-bold">
                    Note: You can only add more guests at this stage.
                  </p>
                )}
              </div>

              <div className="pt-6 border-t border-neutral-100 space-y-4">
                <div className="space-y-1">
                  {isSpecial && isMember && (
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest block">
                      Special Member Pricing
                    </span>
                  )}
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-neutral-500">Credits per person</span>
                    <div className="text-right flex items-center space-x-2">
                      {isSpecial && isMember ? (
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-indigo-600">{event.creditsPerPerson - 1}</span>
                          <span className="relative inline-block text-neutral-500">
                            {event.creditsPerPerson}
                            <span className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/70 -rotate-[35deg] origin-center"></span>
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-neutral-900">{event.creditsPerPerson}</span>
                      )}
                    </div>
                  </div>
                </div>
                {existingBooking && (
                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Previous Total</span>
                    <span>{currentTotalCredits}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-serif">
                  <span className="text-neutral-900">Total Credits ({effectiveCreditsPerPerson} × {numPeople})</span>
                  <span className="text-neutral-900">{totalCredits}</span>
                </div>
              </div>

              {success ? (
                <div className="bg-green-50 text-green-700 p-4 rounded flex items-center">
                  <CheckCircle className="w-5 h-5 mr-3" />
                  Reservation {existingBooking ? "updated" : "confirmed"}! Redirecting...
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  {hasEnoughCredits ? (
                    <div className="space-y-4">
                      <button
                        onClick={handleBooking}
                        disabled={bookingLoading || (existingBooking && numPeople === existingBooking.numPeople)}
                        className="w-full bg-neutral-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
                      >
                        {bookingLoading ? "Processing..." : existingBooking ? "Update Reservation" : "Confirm Reservation"}
                      </button>
                      
                      <div className="flex items-start space-x-2 text-[10px] text-neutral-400 uppercase tracking-widest leading-relaxed">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <p>Reservations cannot be canceled or refunded within 14 days of the event.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-amber-50 border border-amber-100 p-4 text-amber-800 text-sm rounded">
                        <div className="flex items-start">
                          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <p>
                            You need <span className="font-bold">{missingCredits} more credits</span> for this experience.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <Link 
                          to={`/buy-credits?missing=${missingCredits}&eventId=${event.id}&numPeople=${numPeople}`}
                          className="w-full bg-neutral-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Buy and Book
                        </Link>
                        
                        <div className="flex items-start space-x-2 text-[10px] text-neutral-400 uppercase tracking-widest leading-relaxed">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <p>Reservations cannot be canceled or refunded within 14 days of the event.</p>
                        </div>

                        <button 
                          onClick={() => navigate("/events")}
                          className="w-full border border-neutral-200 text-neutral-500 py-4 font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-center text-neutral-400 uppercase tracking-widest">
                        Each credit is $10
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 text-xs rounded">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;

