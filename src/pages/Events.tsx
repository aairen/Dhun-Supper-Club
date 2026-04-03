import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";
import { DiningEvent, Booking } from "../types";
import { format, parseISO, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, Users, Star, ArrowRight, Filter, X, Info, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../components/AuthProvider";

const Events = () => {
  const { user, isMember } = useAuth();
  const [events, setEvents] = useState<DiningEvent[]>([]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<string[]>([]);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("dateTime", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DiningEvent[];
      
      setEvents(firestoreEvents);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserBookings([]);
      return;
    }

    const q = query(collection(db, "bookings"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      setUserBookings(bookings);
    });

    return () => unsubscribe();
  }, [user]);

  const getAvailabilityStatus = (event: DiningEvent) => {
    const remaining = event.capacity - event.bookedSeats;
    if (remaining <= 0) return "Sold Out";
    if (remaining < event.capacity * 0.25) return "Selling Fast";
    return "Available";
  };

  const filteredEvents = events.filter(event => {
    const status = getAvailabilityStatus(event);
    const isSoldOut = status === "Sold Out";
    
    if (showAvailableOnly && isSoldOut) return false;
    
    if (filters.length === 0) return true;
    return filters.some(f => event.type.toLowerCase() === f.toLowerCase());
  });

  const toggleFilter = (type: string) => {
    setFilters(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Events...</div>;

  return (
    <div className="bg-white min-h-screen py-16 md:py-24 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl font-serif text-neutral-900 mb-4 uppercase tracking-widest">Upcoming Experiences</h1>
          <p className="text-neutral-500 font-light max-w-2xl mx-auto text-sm md:text-base">
            Secure your seat at our table. Each event is a unique exploration of flavor and tradition.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {["Thali", "Brunch", "Curated", "Hands-On"].map((type) => (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className={cn(
                    "px-4 md:px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center space-x-2",
                    filters.includes(type) 
                      ? "bg-neutral-900 text-white border-neutral-900" 
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900"
                  )}
                >
                  <span>{type}</span>
                  {filters.includes(type) && <X className="w-3 h-3" />}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-neutral-200 mx-2 hidden sm:block" />
            <button
              onClick={() => setShowAvailableOnly(!showAvailableOnly)}
              className={cn(
                "px-4 md:px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center space-x-2 self-start sm:self-auto",
                showAvailableOnly 
                  ? "bg-green-600 text-white border-green-600" 
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900"
              )}
            >
              <span>Available Only</span>
              {showAvailableOnly && <X className="w-3 h-3" />}
            </button>
          </div>
          
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
            Showing {filteredEvents.length} upcoming events
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => {
            const status = getAvailabilityStatus(event);
            const isSoldOut = status === "Sold Out";
            const userBooking = userBookings.find(b => b.eventId === event.id);
            const daysUntilEvent = differenceInDays(parseISO(event.dateTime), new Date());
            const isSpecial = daysUntilEvent <= 5 && !isSoldOut;
            const canEdit = daysUntilEvent >= 14;
            
            // Image mapping for event types
            const eventImages: Record<string, string> = {
              thali: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&q=80&w=800",
              brunch: "https://images.unsplash.com/photo-1513442542250-854d436a73f2?auto=format&fit=crop&q=80&w=800",
              curated: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=800",
              "hands-on": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800"
            };
            
            return (
              <motion.div 
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group border border-neutral-100 bg-white hover:border-neutral-900 transition-all duration-500 flex flex-col"
              >
                <div className="aspect-video overflow-hidden relative bg-neutral-100">
                  <img 
                    src={eventImages[event.type] || eventImages.curated}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                    {userBooking && (
                      <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-green-500 text-white">
                        Reserved
                      </span>
                    )}
                    {(!userBooking || isSoldOut) && (
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full",
                        isSoldOut ? "bg-red-500 text-white" : 
                        status === "Selling Fast" ? "bg-amber-500 text-white" : "bg-neutral-900 text-white"
                      )}>
                        {status}
                      </span>
                    )}
                    {isSpecial && !isSoldOut && (
                      <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-indigo-600 text-white">
                        Special
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[10px] text-neutral-400 uppercase tracking-widest mb-4">
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

                  <h3 className="text-xl font-serif text-neutral-900 mb-3 uppercase tracking-wider">{event.title}</h3>
                  
                  {isSpecial && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded relative overflow-hidden">
                      <div className="flex items-center justify-between relative z-10">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                          Member Special
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-serif text-indigo-700 font-bold">
                            {event.creditsPerPerson - 1} Credits
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100/30 -rotate-45 translate-x-8 -translate-y-8" />
                    </div>
                  )}

                  <p className="text-sm text-neutral-500 font-light leading-relaxed mb-8 flex-grow">
                    {event.description}
                  </p>

                  {userBooking ? (
                    canEdit ? (
                      <Link 
                        to={`/booking/${event.id}`}
                        className="w-full bg-neutral-900 text-white py-3 text-center text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center group"
                      >
                        Edit Reservation
                        <ArrowRight className="ml-2 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    ) : (
                      <Link 
                        to={`/reservation/${userBooking.id}`}
                        className="w-full border border-neutral-900 text-neutral-900 py-3 text-center text-xs font-bold uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-all flex items-center justify-center group"
                      >
                        View Reservation Details
                        <Info className="ml-2 w-3 h-3" />
                      </Link>
                    )
                  ) : !isSoldOut ? (
                    <Link 
                      to={`/booking/${event.id}`}
                      className="w-full bg-neutral-900 text-white py-3 text-center text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center group"
                    >
                      Reserve Seat
                      <ArrowRight className="ml-2 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <div className="w-full bg-neutral-100 text-neutral-400 py-3 text-center text-xs font-bold uppercase tracking-widest cursor-not-allowed">
                      Sold Out
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Events;

