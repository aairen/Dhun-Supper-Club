import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { DiningEvent, Booking, Transaction } from "../../types";
import { DollarSign, Users, Calendar, CreditCard, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    revenue: 0,
    bookings: 0,
    events: 0,
    credits: 0
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => {
    // Basic stats
    const unsubEvents = onSnapshot(collection(db, "events"), (snap) => {
      setStats(prev => ({ ...prev, events: snap.size }));
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snap) => {
      setStats(prev => ({ ...prev, bookings: snap.size }));
    });

    const unsubTransactions = onSnapshot(collection(db, "transactions"), (snap) => {
      const txs = snap.docs.map(doc => doc.data() as Transaction);
      const revenue = txs.filter(t => t.type === "purchase").reduce((sum, t) => sum + (t.amount || 0), 0);
      const credits = txs.filter(t => t.type === "purchase").reduce((sum, t) => sum + (t.creditsIssued || 0), 0);
      setStats(prev => ({ ...prev, revenue, credits }));
    });

    // Recent bookings
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(5));
    const unsubRecent = onSnapshot(q, (snap) => {
      setRecentBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubEvents();
      unsubBookings();
      unsubTransactions();
      unsubRecent();
    };
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Revenue", value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-neutral-900" },
          { label: "Total Bookings", value: stats.bookings.toString(), icon: Users, color: "text-neutral-900" },
          { label: "Total Events", value: stats.events.toString(), icon: Calendar, color: "text-neutral-900" },
          { label: "Credits Issued", value: stats.credits.toLocaleString(), icon: CreditCard, color: "text-neutral-900" },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{stat.label}</span>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <span className="text-2xl font-serif text-neutral-900">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white border border-neutral-200 shadow-sm p-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link 
              to="/admin/events" 
              className="flex items-center justify-between p-4 border border-neutral-100 hover:border-neutral-900 transition-all group"
            >
              <span className="text-sm font-medium">Create New Event</span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </Link>
            <Link 
              to="/admin/bookings" 
              className="flex items-center justify-between p-4 border border-neutral-100 hover:border-neutral-900 transition-all group"
            >
              <span className="text-sm font-medium">Manage Bookings</span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </Link>
            <Link 
              to="/admin/users" 
              className="flex items-center justify-between p-4 border border-neutral-100 hover:border-neutral-900 transition-all group"
            >
              <span className="text-sm font-medium">Review Users</span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </Link>
            <Link 
              to="/admin/revenue" 
              className="flex items-center justify-between p-4 border border-neutral-100 hover:border-neutral-900 transition-all group"
            >
              <span className="text-sm font-medium">View Revenue</span>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <div className="bg-white border border-neutral-200 shadow-sm p-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6">Recent Bookings</h2>
          <div className="space-y-4">
            {recentBookings.length > 0 ? recentBookings.map(booking => (
              <div key={booking.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-neutral-50 rounded-full flex items-center justify-center mr-3">
                    <Users className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <span className="text-sm font-medium block">New Booking</span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest">{booking.numPeople} people • {booking.totalCredits} credits</span>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
                  {new Date(booking.createdAt).toLocaleDateString()}
                </span>
              </div>
            )) : (
              <div className="text-center py-8 text-neutral-400 italic text-sm">
                No recent bookings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default AdminOverview;
