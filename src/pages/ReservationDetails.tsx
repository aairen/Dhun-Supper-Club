import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, runTransaction, increment, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../components/AuthProvider";
import { Booking as BookingType, DiningEvent } from "../types";
import { format, parseISO, differenceInDays } from "date-fns";
import { motion } from "motion/react";
import { Calendar, Clock, Users, ArrowLeft, AlertCircle, Info, Trash2, Edit3 } from "lucide-react";
import { generateAutoEvents } from "../lib/eventUtils";

const ReservationDetails = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [booking, setBooking] = useState<BookingType | null>(null);
  const [event, setEvent] = useState<DiningEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId || !user) return;
      
      try {
        const bSnap = await getDoc(doc(db, "bookings", bookingId));
        if (bSnap.exists()) {
          const bData = { id: bSnap.id, ...bSnap.data() } as BookingType;
          setBooking(bData);
          
          const eSnap = await getDoc(doc(db, "events", bData.eventId));
          if (eSnap.exists()) {
            setEvent({ id: eSnap.id, ...eSnap.data() } as DiningEvent);
          } else {
            // Fallback to auto-generated events
            const autoEvents = generateAutoEvents();
            const found = autoEvents.find(e => e.id === bData.eventId);
            if (found) {
              setEvent(found);
            } else {
              setError("Event details not found.");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching reservation:", err);
        setError("Failed to load reservation details.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, user]);

  const handleCancel = async () => {
    if (!booking || !event || !user) return;
    
    const daysUntilEvent = differenceInDays(parseISO(event.dateTime), new Date());
    if (daysUntilEvent < 14) return;

    if (!window.confirm("Are you sure you would like to cancel this reservation?")) return;

    setCancelling(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const bookingRef = doc(db, "bookings", booking.id);
        const eventRef = doc(db, "events", booking.eventId);

        // Reads
        const bSnap = await transaction.get(bookingRef);
        const uSnap = await transaction.get(userRef);
        const eSnap = await transaction.get(eventRef);

        if (!bSnap.exists()) throw new Error("Booking not found");
        
        // Writes
        const uData = uSnap.data();
        const currentProgress = uData.membershipProgress || 0;
        const newProgress = currentProgress - booking.totalCredits;

        const userUpdate: any = {
          credits: increment(booking.totalCredits),
          membershipProgress: increment(-booking.totalCredits),
        };

        // Revert to Guest if progress falls below 20
        if (newProgress < 20 && uData.role === 'member') {
          userUpdate.role = 'user';
        }

        transaction.update(userRef, userUpdate);

        if (eSnap.exists()) {
          transaction.update(eventRef, {
            bookedSeats: increment(-booking.numPeople),
          });
        }

        transaction.delete(bookingRef);
      });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900">Loading Details...</div>;
  if (!booking || !event) return <div className="min-h-screen flex items-center justify-center bg-white text-neutral-900">Reservation not found.</div>;

  const daysUntilEvent = differenceInDays(parseISO(event.dateTime), new Date());
  const canCancel = daysUntilEvent >= 14;
  const canEdit = true; // Always allow edit, but Booking page will handle restrictions

  return (
    <div className="min-h-screen bg-neutral-50 py-24">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Link 
            to="/dashboard" 
            className="flex items-center text-xs text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-widest font-bold"
          >
            <ArrowLeft className="w-3 h-3 mr-2" />
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Event Info */}
          <div className="space-y-8">
            <div className="aspect-video bg-neutral-100 overflow-hidden shadow-sm">
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
              <h1 className="text-4xl font-serif text-neutral-900 mb-4 uppercase tracking-widest">{event.title}</h1>
              <p className="text-neutral-500 font-light leading-relaxed">
                {event.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-neutral-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-neutral-900" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Date</p>
                  <p className="text-sm font-medium text-neutral-900">{format(parseISO(event.dateTime), "MMM dd, yyyy")}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-neutral-900" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Time</p>
                  <p className="text-sm font-medium text-neutral-900">{format(parseISO(event.dateTime), "h:mm a")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Summary */}
          <div className="bg-white border border-neutral-200 p-8 shadow-sm h-fit">
            <h2 className="text-xl font-serif mb-8 uppercase tracking-widest">Reservation Summary</h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between py-4 border-b border-neutral-100">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-3 text-neutral-400" />
                  <span className="text-sm text-neutral-600">Guests</span>
                </div>
                <span className="text-lg font-serif text-neutral-900">{booking.numPeople} {booking.numPeople === 1 ? 'Person' : 'People'}</span>
              </div>

              <div className="flex items-center justify-between py-4 border-b border-neutral-100">
                <div className="flex items-center">
                  <Info className="w-4 h-4 mr-3 text-neutral-400" />
                  <span className="text-sm text-neutral-600">Total Credits</span>
                </div>
                <span className="text-lg font-serif text-neutral-900">{booking.totalCredits}</span>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="pt-8 space-y-4">
                <button
                  disabled={!canEdit}
                  onClick={() => navigate(`/booking/${event.id}`)}
                  className="w-full bg-neutral-900 text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Reservation
                </button>
                
                <button
                  disabled={!canCancel || cancelling}
                  onClick={handleCancel}
                  className="w-full border border-red-100 text-red-600 py-4 font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {cancelling ? "Cancelling..." : "Cancel Reservation"}
                </button>

                {!canCancel && (
                  <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] uppercase tracking-widest leading-relaxed flex items-start gap-2">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <p>This reservation is within the next 14 days. You can still add more guests if space is available, but cancellations are no longer permitted. In the event of an emergency, please <Link to="/contact" className="font-bold border-b border-amber-800">contact us</Link>.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetails;
