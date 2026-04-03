import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Booking, DiningEvent, UserProfile } from "../../types";
import { format, parseISO } from "date-fns";
import { Search, X, Loader2, Calendar, User, Mail, Users, DollarSign } from "lucide-react";

const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
          eventTitle: eventSnap.exists() ? (eventSnap.data() as DiningEvent).title : "Unknown Event"
        };
      }));
      
      setBookings(enrichedBookings);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking? This will refund the credits to the user.")) {
      return;
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
        body: JSON.stringify({ bookingId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel booking");
      }
      
      // The UI will update automatically via onSnapshot
    } catch (err: any) {
      alert(err.message || "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.eventTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Manage Bookings</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Search by email or event..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 transition-colors w-full md:w-64"
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

      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">User</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Event</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Details</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Booking Date</th>
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
            ) : filteredBookings.map(booking => (
              <tr key={booking.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <Mail className="w-3 h-3 mr-2 text-neutral-400" />
                    <span className="text-neutral-900 font-medium">{booking.userEmail}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
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
                  {format(parseISO(booking.createdAt), "MMM dd, yyyy")}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleCancelBooking(booking.id)}
                    disabled={cancellingId === booking.id}
                    className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                  >
                    {cancellingId === booking.id ? "Cancelling..." : "Cancel"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filteredBookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBookings;
