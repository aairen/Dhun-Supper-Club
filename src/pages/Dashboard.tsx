import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, increment, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../components/AuthProvider";
import { Booking, DiningEvent } from "../types";
import { format, parseISO, isAfter, isBefore, addDays, differenceInDays, startOfDay } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, CreditCard, Star, Clock, AlertCircle, XCircle, ChevronRight, Users } from "lucide-react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { generateAutoEvents } from "../lib/eventUtils";
import { AlertModal } from "../components/AlertModal";
import { apiUrl, readResponseJson } from "../lib/apiBase";

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: "error" | "info" | "success" }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const eventId = searchParams.get("eventId");
    const numPeople = searchParams.get("numPeople");

    if (sessionId && user) {
      const verifySession = async () => {
        setVerifyingPayment(true);
        try {
          const response = await fetch(
            apiUrl(`/api/verify-checkout-session?sessionId=${encodeURIComponent(sessionId)}`),
          );
          const data = await readResponseJson<{
            success?: boolean;
            creditsAdded?: number;
          }>(response);
          if (data.success) {
            if (data.creditsAdded) {
              setPaymentSuccess(data.creditsAdded);
            }
            
            // If we were in a "Buy and Book" flow, redirect back to booking
            if (eventId && numPeople) {
              setTimeout(() => {
                navigate(`/booking/${eventId}?success=true&numPeople=${numPeople}&purchased=${data.creditsAdded}`);
              }, 2000);
            } else {
              // Clear the search params so we don't keep verifying
              setSearchParams({});
            }
          }
        } catch (error) {
          console.error("Error verifying session:", error);
        } finally {
          setVerifyingPayment(false);
        }
      };
      verifySession();
    }
  }, [searchParams, user, setSearchParams, navigate]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "bookings"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const autoEvents = generateAutoEvents();
      const bookingData = await Promise.all(snapshot.docs.map(async (bDoc) => {
        const data = bDoc.data() as Booking;
        const id = bDoc.id;
        
        // Fetch event details
        let event: DiningEvent | undefined;
        const eDoc = await getDoc(doc(db, "events", data.eventId));
        if (eDoc.exists()) {
          event = { id: eDoc.id, ...eDoc.data() } as DiningEvent;
        } else {
          event = autoEvents.find(e => e.id === data.eventId);
        }

        return { ...data, id, event };
      }));

      // Sort by event date (earliest first)
      setBookings(bookingData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCancelClick = (booking: Booking) => {
    if (!booking.event) return;
    const eventDate = startOfDay(parseISO(booking.event.dateTime));
    const today = startOfDay(new Date());
    const daysUntilEvent = differenceInDays(eventDate, today);
    
    if (daysUntilEvent < 14) {
      setShowCancelModal(true);
      return;
    }

    setSelectedBooking(booking);
    setShowConfirmCancelModal(true);
  };

  const performCancel = async (booking: Booking) => {
    if (!user) return;
    setCancellingId(booking.id);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const bookingRef = doc(db, "bookings", booking.id);
        const eventRef = doc(db, "events", booking.eventId);

        // 1. READS FIRST
        const bSnap = await transaction.get(bookingRef);
        const uSnap = await transaction.get(userRef);
        const eSnap = await transaction.get(eventRef);

        if (!bSnap.exists()) {
          throw new Error("Booking no longer exists");
        }
        if (!uSnap.exists()) {
          throw new Error("User profile not found");
        }

        const bData = bSnap.data() as Booking;
        const uData = uSnap.data();
        const currentProgress = uData.membershipProgress || 0;
        const newProgress = currentProgress - bData.totalCredits;

        // 2. WRITES SECOND
        // Return credits and subtract from membership progress
        const userUpdate: any = {
          credits: increment(bData.totalCredits),
          membershipProgress: increment(-bData.totalCredits),
        };

        // Revert to Guest if progress falls below 20
        if (newProgress < 20 && uData.role === 'member') {
          userUpdate.role = 'user';
        }

        transaction.update(userRef, userUpdate);

        // 3. Update event capacity
        if (eSnap.exists()) {
          transaction.update(eventRef, {
            bookedSeats: increment(-bData.numPeople),
          });
        }

        // 4. Delete booking
        transaction.delete(bookingRef);
      });
    } catch (err) {
      console.error("Cancellation error:", err);
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: "Failed to cancel reservation. Please try again.",
        variant: "error",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const upcoming = bookings
    .filter(b => b.event && isAfter(parseISO(b.event.dateTime), new Date()))
    .sort((a, b) => parseISO(a.event!.dateTime).getTime() - parseISO(b.event!.dateTime).getTime());
  const past = bookings
    .filter(b => b.event && isBefore(parseISO(b.event.dateTime), new Date()))
    .sort((a, b) => parseISO(b.event!.dateTime).getTime() - parseISO(a.event!.dateTime).getTime());

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-neutral-50 py-12 md:py-24 transition-colors duration-300">
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {paymentSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <CreditCard className="w-4 h-4" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Payment Successful! {paymentSuccess} credits added to your wallet.</span>
            </div>
            <button onClick={() => setPaymentSuccess(null)} className="text-emerald-800 hover:opacity-50">
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {verifyingPayment && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center space-x-3"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-800 border-t-transparent" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Verifying your payment...</span>
          </motion.div>
        )}

        {/* Membership Explanation Modal */}
        <AnimatePresence>
          {showMembershipModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMembershipModal(false)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white p-6 md:p-8 max-w-md w-full shadow-2xl border border-neutral-200"
              >
                <h3 className="text-xl font-serif text-neutral-900 mb-6 uppercase tracking-widest">Membership</h3>
                
                <div className="space-y-6 mb-8">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">How to become a member</h4>
                    <p className="text-sm text-neutral-600 font-light leading-relaxed">
                      Spend 20 or more credits on dining experiences within a single calendar year to unlock Member status.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Retention</h4>
                    <p className="text-sm text-neutral-600 font-light leading-relaxed">
                      Once earned, your membership remains valid for the remainder of the current year and the entire following calendar year.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-50 border border-neutral-100">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-relaxed">
                      Members enjoy exclusive pricing on select events and early access to new experience releases.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowMembershipModal(false)}
                  className="w-full bg-neutral-900 text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCancelModal(false)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white p-6 md:p-8 max-w-md w-full shadow-2xl border border-neutral-200"
              >
                <h3 className="text-xl font-serif text-neutral-900 mb-4 uppercase tracking-widest">Policy Notice</h3>
                <p className="text-sm md:text-base text-neutral-500 font-light leading-relaxed mb-8">
                  This reservation is within the next 14 days and cannot be cancelled. In the event of an emergency cancellation, please{" "}
                  <Link to="/contact" className="text-neutral-900 font-bold border-b border-neutral-900 hover:text-neutral-600 hover:border-neutral-600 transition-all">
                    contact us
                  </Link>.
                </p>
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="w-full bg-neutral-900 text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmCancelModal && selectedBooking && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmCancelModal(false)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white p-6 md:p-8 max-w-md w-full shadow-2xl border border-neutral-200"
              >
                <h3 className="text-xl font-serif text-neutral-900 mb-4 uppercase tracking-widest text-red-600">Cancel Reservation?</h3>
                <p className="text-sm md:text-base text-neutral-500 font-light leading-relaxed mb-8">
                  Are you sure you would like to cancel your reservation for <span className="text-neutral-900 font-medium">{selectedBooking.event?.title}</span>? 
                  The <span className="text-neutral-900 font-medium">{selectedBooking.totalCredits} credits</span> will be returned to your wallet.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setShowConfirmCancelModal(false)}
                    className="flex-1 bg-neutral-100 text-neutral-900 py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all"
                  >
                    Keep Booking
                  </button>
                  <button 
                    onClick={() => {
                      setShowConfirmCancelModal(false);
                      performCancel(selectedBooking);
                    }}
                    className="flex-1 bg-red-600 text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 md:p-8 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-neutral-400">Wallet Balance</h3>
              <CreditCard className="w-4 h-4 text-neutral-900" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-serif text-neutral-900">{profile?.credits || 0} Credits</span>
              <Link to="/buy-credits" className="text-[10px] md:text-xs font-bold uppercase tracking-widest border-b border-neutral-900 text-neutral-900 pb-1 hover:text-neutral-500 hover:border-neutral-500 transition-all">
                Buy More
              </Link>
            </div>
          </div>

          <div 
            onClick={() => setShowMembershipModal(true)}
            className="bg-white p-6 md:p-8 border border-neutral-200 shadow-sm cursor-pointer hover:border-neutral-900 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-neutral-400 group-hover:text-neutral-900 transition-colors">Membership Status</h3>
              <Star className={cn("w-4 h-4", profile?.role === 'member' ? "text-amber-500 fill-current" : "text-neutral-900")} />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-serif text-neutral-900 uppercase tracking-widest">
                {profile?.role === 'member' ? 'Member' : 'Guest'}
              </span>
              {profile?.role !== 'member' && (
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
                  {profile?.membershipProgress || 0} / 20 Credits Spent
                </span>
              )}
            </div>
            {profile?.role !== 'member' && (
              <div className="mt-4 h-1 bg-neutral-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-neutral-900 transition-all duration-1000" 
                  style={{ width: `${Math.min(100, ((profile?.membershipProgress || 0) / 20) * 100)}%` }}
                />
              </div>
            )}
            <div className="mt-4 flex items-center text-[10px] text-neutral-400 uppercase tracking-widest group-hover:text-neutral-900 transition-colors">
              <span>View details</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-neutral-400">Upcoming Events</h3>
              <Calendar className="w-4 h-4 text-neutral-900" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-serif text-neutral-900">{upcoming.length} Reservations</span>
              <Link to="/events" className="text-[10px] md:text-xs font-bold uppercase tracking-widest border-b border-neutral-900 text-neutral-900 pb-1 hover:text-neutral-500 hover:border-neutral-500 transition-all">
                Book New
              </Link>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="space-y-12">
          {/* Upcoming */}
          <section>
            <h2 className="text-lg md:text-xl font-serif mb-6 uppercase tracking-widest text-neutral-900">Upcoming Reservations</h2>
            {upcoming.length === 0 ? (
              <div className="bg-white border border-neutral-200 p-8 md:p-12 text-center">
                <p className="text-sm md:text-base text-neutral-400 font-light italic mb-6">No upcoming reservations found.</p>
                <Link to="/events" className="bg-neutral-900 text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all">
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {upcoming.map(booking => {
                  const daysUntilEvent = booking.event ? differenceInDays(parseISO(booking.event.dateTime), new Date()) : 0;
                  const canCancel = daysUntilEvent >= 14;

                  return (
                    <div key={booking.id} className="bg-white border border-neutral-200 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-100 overflow-hidden flex-shrink-0">
                          <img 
                            src={booking.event?.type === 'thali' 
                              ? "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=200"
                              : booking.event?.type === 'brunch'
                                ? "https://images.unsplash.com/photo-1513442542250-854d436a73f2?auto=format&fit=crop&q=80&w=200"
                                : "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=200"
                            }
                            alt={booking.event?.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h4 className="text-base md:text-lg font-serif text-neutral-900 uppercase tracking-wider">{booking.event?.title}</h4>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 md:gap-4 text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
                            <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {format(parseISO(booking.event!.dateTime), "MMM dd")}</span>
                            <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {format(parseISO(booking.event!.dateTime), "h:mm a")}</span>
                            <span className="flex items-center"><Users className="w-3 h-3 mr-1" /> {booking.numPeople} {booking.numPeople === 1 ? 'Person' : 'People'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-left md:text-right md:mr-4">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Total Credits</p>
                          <p className="text-base md:text-lg font-serif text-neutral-900">{booking.totalCredits}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {canCancel ? (
                            <Link 
                              to={`/booking/${booking.eventId}`}
                              className="px-4 md:px-6 py-2 text-[10px] text-center font-bold uppercase tracking-widest bg-neutral-900 text-white hover:bg-neutral-800 transition-all min-w-[120px] md:min-w-[140px]"
                            >
                              Edit
                            </Link>
                          ) : (
                            <Link 
                              to={`/reservation/${booking.id}`}
                              className="px-4 md:px-6 py-2 text-[10px] text-center font-bold uppercase tracking-widest border border-neutral-200 text-neutral-900 hover:bg-neutral-50 transition-all min-w-[120px] md:min-w-[140px]"
                            >
                              Details
                            </Link>
                          )}
                          <button 
                            onClick={() => handleCancelClick(booking)}
                            disabled={cancellingId === booking.id}
                            className={cn(
                              "px-4 md:px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 min-w-[120px] md:min-w-[140px]",
                              "border-red-100 text-red-600 hover:bg-red-50"
                            )}
                          >
                            {cancellingId === booking.id ? "..." : "Cancel"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past */}
          <section>
            <h2 className="text-lg md:text-xl font-serif mb-6 uppercase tracking-widest text-neutral-400">Past Experiences</h2>
            <div className="grid grid-cols-1 gap-4 opacity-60">
              {past.map(booking => (
                <div key={booking.id} className="bg-white border border-neutral-200 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 grayscale">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-neutral-100 overflow-hidden flex-shrink-0">
                      <img 
                        src={booking.event?.type === 'thali' 
                          ? "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=200"
                          : booking.event?.type === 'brunch'
                            ? "https://images.unsplash.com/photo-1513442542250-854d436a73f2?auto=format&fit=crop&q=80&w=200"
                            : "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=200"
                        }
                        alt={booking.event?.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm md:text-base font-serif text-neutral-900 uppercase tracking-wider">{booking.event?.title}</h4>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
                        {format(parseISO(booking.event!.dateTime), "MMM dd, yyyy")} • {booking.numPeople} People
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Credits Spent</p>
                    <p className="text-sm md:text-base font-serif text-neutral-900">{booking.totalCredits}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
