import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DiningEvent, Booking, BlogPost, ContactMessage, Transaction } from "../types";
import { format, parseISO } from "date-fns";
import { 
  Calendar, 
  Users, 
  BookOpen, 
  MessageSquare, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Clock,
  LayoutDashboard
} from "lucide-react";
import { cn } from "../lib/utils";

const Admin = () => {
  const location = useLocation();

  const adminLinks = [
    { name: "Overview", path: "/admin", icon: LayoutDashboard },
    { name: "Events", path: "/admin/events", icon: Calendar },
    { name: "Reservations", path: "/admin/reservations", icon: Users },
    { name: "Blog", path: "/admin/blog", icon: BookOpen },
    { name: "Messages", path: "/admin/messages", icon: MessageSquare },
    { name: "Transactions", path: "/admin/transactions", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200 hidden lg:block">
        <div className="p-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-8">Admin Console</h2>
          <nav className="space-y-2">
            {adminLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-all rounded-md",
                  location.pathname === link.path ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"
                )}
              >
                <link.icon className="w-4 h-4 mr-3" />
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Admin Content */}
      <main className="flex-grow p-8">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/events" element={<AdminEvents />} />
          <Route path="/reservations" element={<AdminReservations />} />
          <Route path="/blog" element={<AdminBlog />} />
          <Route path="/messages" element={<AdminMessages />} />
          <Route path="/transactions" element={<AdminTransactions />} />
        </Routes>
      </main>
    </div>
  );
};

const AdminOverview = () => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Stats cards placeholder */}
        {[
          { label: "Total Revenue", value: "$12,450", icon: DollarSign },
          { label: "Active Members", value: "48", icon: Star },
          { label: "Bookings (July)", value: "156", icon: Users },
          { label: "Unread Messages", value: "4", icon: MessageSquare },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-neutral-900" />
            </div>
            <span className="text-2xl font-serif text-neutral-900">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminEvents = () => {
  const [events, setEvents] = useState<DiningEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("dateTime", "asc"));
    return onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiningEvent[]);
    });
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Manage Events</h1>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-neutral-900 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </button>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Event</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Date</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Capacity</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Credits</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.map(event => (
              <tr key={event.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-serif text-neutral-900">{event.title}</span>
                  <span className="block text-[10px] text-neutral-400 uppercase tracking-widest mt-1">{event.type}</span>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  {format(parseISO(event.dateTime), "MMM dd, yyyy • h:mm a")}
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  {event.bookedSeats || 0} / {event.capacity}
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  {event.creditsPerPerson}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-3">
                    <button className="text-neutral-400 hover:text-neutral-900 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button 
                      onClick={() => deleteDoc(doc(db, "events", event.id))}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Placeholder components for other admin routes
const AdminReservations = () => <div className="text-neutral-400 italic">Reservations Calendar View - Coming Soon</div>;
const AdminBlog = () => <div className="text-neutral-400 italic">Blog CMS - Coming Soon</div>;
const AdminMessages = () => <div className="text-neutral-400 italic">Messaging Console - Coming Soon</div>;
const AdminTransactions = () => <div className="text-neutral-400 italic">Full Transaction History - Coming Soon</div>;

const Star = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default Admin;
