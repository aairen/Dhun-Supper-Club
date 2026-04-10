import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, writeBatch } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Booking, DiningEvent, UserProfile } from "../../types";
import { format, parseISO, isBefore } from "date-fns";
import { cn } from "../../lib/utils";
import { Search, X, Loader2, Calendar, User, Mail, Users, DollarSign, Eraser, ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AlertModal } from "../../components/AlertModal";
import { Modal } from "../../components/Modal";

const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"event" | "list">("event");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DiningEvent | null>(null);
  const [selectedEventForPopup, setSelectedEventForPopup] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<any>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [newNumPeople, setNewNumPeople] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [tempEventForPopup, setTempEventForPopup] = useState<any | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: "error" | "info" | "success" }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      
      // Fetch related data
      const enrichedBookings = await Promise.all(bookingsData.map(async (booking) => {
        const [userSnap, eventSnap] = await Promise.all([
          getDoc(doc(db, "users", booking.userId)),
          getDoc(doc(db, "events", booking.eventId))
        ]);
        
        return {
          ...booking,
          userEmail: userSnap.exists() ? (userSnap.data() as UserProfile).email : "Unknown User",
          eventTitle: eventSnap.exists() ? (eventSnap.data() as DiningEvent).title : "Unknown Event",
          event: eventSnap.exists() ? ({ id: eventSnap.id, ...eventSnap.data() } as DiningEvent) : null
        };
      }));
      
      setBookings(enrichedBookings);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleClearBookings = async () => {
    setShowClearModal(true);
  };

  const confirmClearBookings = async () => {
    setShowClearModal(false);
    setClearing(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/clear-all-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear bookings");
      }

      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "All bookings cleared and refunded successfully.",
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to clear bookings",
        variant: "error",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setTempEventForPopup(selectedEventForPopup);
    setSelectedEventForPopup(null);
    setBookingToCancel(bookingId);
    setShowCancelModal(true);
  };

  const handleEditBooking = (booking: any) => {
    setTempEventForPopup(selectedEventForPopup);
    setSelectedEventForPopup(null);
    setBookingToEdit(booking);
    setNewNumPeople(booking.numPeople);
    setAdminMessage("");
    setIsEditModalOpen(true);
  };

  const confirmEditBooking = async () => {
    if (!bookingToEdit) return;
    setIsEditing(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/edit-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ bookingId: bookingToEdit.id, numPeople: newNumPeople, adminMessage: adminMessage })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to edit booking");
      }
      
      setIsEditModalOpen(false);
      if (tempEventForPopup) {
        setSelectedEventForPopup(tempEventForPopup);
        setTempEventForPopup(null);
      }
      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "Booking updated successfully.",
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to edit booking",
        variant: "error",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const confirmCancelBooking = async (message?: string) => {
    if (!bookingToCancel) return;
    const bookingId = bookingToCancel;
    setShowCancelModal(false);
    if (tempEventForPopup) {
      setSelectedEventForPopup(tempEventForPopup);
      setTempEventForPopup(null);
    }
    setCancellingId(bookingId);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/cancel-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ bookingId, adminMessage: message })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel booking");
      }
      
      // The UI will update automatically via onSnapshot
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to cancel booking",
        variant: "error",
      });
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: "createdAt"; direction: "asc" | "desc" }>({ key: "createdAt", direction: "desc" });

  const sortedBookings = useMemo(() => {
    const sortableBookings = [...bookings];
    sortableBookings.sort((a, b) => {
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const aValue = aDate.getTime();
      const bValue = bDate.getTime();
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sortableBookings;
  }, [bookings, sortConfig]);

  const bookingsByEvent = useMemo(() => {
    const eventsMap = new Map<string, any>();
    bookings.forEach(booking => {
      if (!booking.event || !booking.event.published) return;
      if (!eventsMap.has(booking.eventId)) {
        eventsMap.set(booking.eventId, {
          event: booking.event,
          bookings: []
        });
      }
      eventsMap.get(booking.eventId).bookings.push(booking);
    });
    return Array.from(eventsMap.values()).sort((a, b) => 
      new Date(a.event.dateTime).getTime() - new Date(b.event.dateTime).getTime()
    );
  }, [bookings]);

  const requestSort = (key: "createdAt") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const safeFormatDate = (date: any) => {
    try {
      const d = date?.toDate ? date.toDate() : parseISO(date);
      return format(d, "MMM dd, yyyy h:mm a");
    } catch (e) {
      return "Invalid Date";
    }
  };

  const isEventActive = (event: DiningEvent) => {
    try {
      return !isBefore(parseISO(event.dateTime), new Date());
    } catch (e) {
      return false;
    }
  };

  const isEventPast = (event: DiningEvent) => {
    try {
      return isBefore(parseISO(event.dateTime), new Date());
    } catch (e) {
      return false;
    }
  };

  const activeBookings = sortedBookings.filter(b => b.event && isEventActive(b.event));
  const pastBookings = sortedBookings.filter(b => b.event && isEventPast(b.event));

  const filteredActiveBookings = activeBookings.filter(b => 
    b.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.eventTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPastBookings = pastBookings.filter(b => 
    b.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.eventTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={confirmClearBookings}
        title="Clear All Bookings"
        message="Are you sure you want to delete ALL bookings? This will reset all event booked seats to 0."
        confirmText="Clear All"
        variant="danger"
        isLoading={clearing}
      />
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={(message) => confirmCancelBooking(message)}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This will refund the credits to the user."
        confirmText="Cancel Booking"
        variant="danger"
        isLoading={!!cancellingId}
        showAdminMessage={true}
      />
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Edit Booking"
      >
        {bookingToEdit && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-900">Editing booking for {bookingToEdit.userEmail}</p>
            <div className="flex items-center gap-4">
              <label className="text-xs font-bold uppercase tracking-widest">Number of People:</label>
              <input 
                type="number"
                min={1}
                max={bookingToEdit.numPeople - 1}
                value={newNumPeople}
                onChange={(e) => setNewNumPeople(parseInt(e.target.value))}
                className="w-20 p-2 border border-neutral-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Admin Message (Optional)</label>
              <textarea 
                value={adminMessage}
                onChange={e => setAdminMessage(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                placeholder="Add a message for the user..."
              />
            </div>
            <button 
              onClick={confirmEditBooking}
              disabled={isEditing}
              className="w-full bg-neutral-900 text-white py-2 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {isEditing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </Modal>
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Manage Bookings</h1>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex bg-neutral-100 p-1">
            <button 
              onClick={() => setView("event")}
              className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all", view === "event" ? "bg-white shadow-sm" : "text-neutral-500")}
            >
              Event View
            </button>
            <button 
              onClick={() => setView("list")}
              className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all", view === "list" ? "bg-white shadow-sm" : "text-neutral-500")}
            >
              List View
            </button>
          </div>
          <button 
            onClick={handleClearBookings}
            disabled={clearing}
            className="border border-amber-200 text-amber-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-50 transition-all flex items-center disabled:opacity-50"
            title="Clear all bookings and reset event seats"
          >
            <Eraser className="w-3 h-3 mr-2" />
            Clear Bookings
          </button>
        </div>
        
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Search by email or event..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors w-full"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {view === "event" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookingsByEvent.map(({ event, bookings }) => (
            <div 
              key={event.id} 
              className="bg-white border border-neutral-200 p-6 shadow-sm hover:border-neutral-900 transition-all cursor-pointer"
              onClick={() => setSelectedEventForPopup({ event, bookings })}
            >
              <h3 className="text-lg font-serif text-neutral-900 mb-2">{event.title}</h3>
              <p className="text-xs text-neutral-500 mb-4">{format(parseISO(event.dateTime), "MMM dd, yyyy h:mm a")}</p>
              <div className="flex items-center justify-between text-sm text-neutral-900">
                <span>{bookings.length} Bookings</span>
                <span className="font-bold">{bookings.reduce((sum, b) => sum + b.numPeople, 0)} People</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-neutral-100 w-full">
            {loading ? (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
              </div>
            ) : (
              <>
                {filteredActiveBookings.map(booking => (
                  <div key={booking.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start w-full">
                      <div className="font-medium text-neutral-900">{booking.userEmail}</div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditBooking(booking)}
                          className="text-neutral-400 hover:text-neutral-900 transition-colors p-2"
                          title="Edit Booking"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                          title="Cancel Booking"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div 
                      className="text-sm font-serif text-neutral-900 cursor-pointer hover:text-neutral-600"
                      onClick={() => {
                        setSelectedEvent(booking.event);
                        setSelectedBooking(booking);
                        setIsEventModalOpen(true);
                      }}
                    >
                      {booking.eventTitle}
                    </div>
                    <div className="flex items-center text-xs text-neutral-500 gap-4">
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {booking.numPeople}
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="w-3 h-3 mr-1" />
                        {booking.totalCredits}
                      </div>
                      <div>{safeFormatDate(booking.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {filteredActiveBookings.length === 0 && (
                  <div className="p-6 text-center text-neutral-400 italic">No active bookings found.</div>
                )}
                {filteredPastBookings.length > 0 && (
                  <>
                    <div className="p-4 bg-neutral-50 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Past Bookings</div>
                    {filteredPastBookings.map(booking => (
                      <div key={booking.id} className="p-4 space-y-2 opacity-60">
                        <div className="font-medium text-neutral-900">{booking.userEmail}</div>
                        <div className="text-sm font-serif text-neutral-900">{booking.eventTitle}</div>
                        <div className="flex items-center text-xs text-neutral-500 gap-4">
                          <div className="flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            {booking.numPeople}
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {booking.totalCredits}
                          </div>
                          <div>{safeFormatDate(booking.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">User</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Event</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Details</th>
                  <th 
                    className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-900 transition-colors"
                    onClick={() => requestSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Booking Time
                      {sortConfig.key === "createdAt" && (sortConfig.direction === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredActiveBookings.map(booking => (
                      <tr key={booking.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Mail className="w-3 h-3 mr-2 text-neutral-400" />
                            <span className="text-neutral-900 font-medium">{booking.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div 
                            className="flex items-center cursor-pointer hover:text-neutral-600" 
                            onClick={() => {
                              setSelectedEvent(booking.event);
                              setSelectedBooking(booking);
                              setIsEventModalOpen(true);
                            }}
                          >
                            <Calendar className="w-3 h-3 mr-2 text-neutral-400" />
                            <span className="text-neutral-900 font-serif">{booking.eventTitle}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          <div className="flex items-center">
                            <Users className="w-3 h-3 mr-2" />
                            {booking.numPeople} {booking.numPeople === 1 ? "person" : "people"}
                          </div>
                          <div className="flex items-center mt-1">
                            <DollarSign className="w-3 h-3 mr-2" />
                            {booking.totalCredits} credits
                          </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          {safeFormatDate(booking.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => handleEditBooking(booking)}
                              className="text-neutral-400 hover:text-neutral-900 transition-colors p-2"
                              title="Edit Booking"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={cancellingId === booking.id}
                              className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                              title="Cancel Booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredActiveBookings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                          No active bookings found.
                        </td>
                      </tr>
                    )}
                    {filteredPastBookings.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="px-6 py-4 bg-neutral-50 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Past Bookings</td>
                        </tr>
                        {filteredPastBookings.map(booking => (
                          <tr key={booking.id} className="hover:bg-neutral-50 transition-colors opacity-60">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-2 text-neutral-400" />
                                <span className="text-neutral-900 font-medium">{booking.userEmail}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div 
                                className="flex items-center cursor-pointer hover:text-neutral-600" 
                                onClick={() => {
                                  setSelectedEvent(booking.event);
                                  setSelectedBooking(booking);
                                  setIsEventModalOpen(true);
                                }}
                              >
                                <Calendar className="w-3 h-3 mr-2 text-neutral-400" />
                                <span className="text-neutral-900 font-serif">{booking.eventTitle}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-neutral-500">
                              <div className="flex items-center">
                                <Users className="w-3 h-3 mr-2" />
                                {booking.numPeople} {booking.numPeople === 1 ? "person" : "people"}
                              </div>
                              <div className="flex items-center mt-1">
                                <DollarSign className="w-3 h-3 mr-2" />
                                {booking.totalCredits} credits
                              </div>
                            </td>
                            <td className="px-6 py-4 text-neutral-500">
                              {safeFormatDate(booking.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-right">
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal 
        isOpen={!!selectedEventForPopup} 
        onClose={() => setSelectedEventForPopup(null)} 
        title={selectedEventForPopup?.event.title || "Event Details"}
      >
        {selectedEventForPopup && (
          <div className="space-y-4">
            {selectedEventForPopup.event.imageUrl && (
              <img src={selectedEventForPopup.event.imageUrl} alt={selectedEventForPopup.event.title} className="w-full h-48 object-cover" />
            )}
            <p><strong>Date:</strong> {format(parseISO(selectedEventForPopup.event.dateTime), "MMM dd, yyyy")}</p>
            <p><strong>Time:</strong> {format(parseISO(selectedEventForPopup.event.dateTime), "h:mm a")}</p>
            <div className="space-y-2">
              <h4 className="font-bold">Bookings:</h4>
              {selectedEventForPopup.bookings.map((booking: any) => (
                <div key={booking.id} className="flex justify-between items-center p-2 border border-neutral-100">
                  <div className="flex flex-col">
                    <span>{booking.userEmail}</span>
                    <span className="text-xs text-neutral-500 mt-1 md:hidden ml-4">{booking.numPeople} people</span>
                    <span className="text-xs text-neutral-500 mt-1 hidden md:inline">({booking.numPeople} people)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditBooking(booking)} className="text-neutral-400 hover:text-neutral-900"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleCancelBooking(booking.id)} className="text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
      <Modal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        title="Event Details"
      >
        {selectedEvent && selectedBooking && (
          <div className="space-y-4">
            <p><strong>Name:</strong> {selectedEvent.title}</p>
            <p><strong>Date:</strong> {format(parseISO(selectedEvent.dateTime), "MMM dd, yyyy")}</p>
            <p><strong>Time:</strong> {format(parseISO(selectedEvent.dateTime), "h:mm a")}</p>
            <p><strong>Number of People:</strong> {selectedBooking.numPeople}</p>
            <p><strong>Credits Spent:</strong> {selectedBooking.totalCredits}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminBookings;
