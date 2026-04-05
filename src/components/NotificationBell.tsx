import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, deleteDoc } from "firebase/firestore";
import { useAuth } from "./AuthProvider";

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const n of unreadNotifications) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }
  };

  const toggleDropdown = () => {
    if (showDropdown) {
      markAllAsRead();
    }
    setShowDropdown(!showDropdown);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (showDropdown) {
          markAllAsRead();
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown, notifications]);

  useEffect(() => {
    if (!user) return;
    console.log(`[BELL] Fetching notifications for user: ${user.uid}`);
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[BELL] Fetched ${data.length} notifications`);
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const clearAll = async () => {
    for (const n of notifications) {
      await deleteDoc(doc(db, "notifications", n.id));
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={toggleDropdown} className="relative p-2">
        <Bell className="w-5 h-5 text-neutral-900" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full" />
        )}
      </button>
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 shadow-lg z-50">
          <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
            <span className="font-bold uppercase text-xs tracking-widest">Notifications</span>
            <button onClick={clearAll} className="text-[10px] text-neutral-500 hover:text-red-600 uppercase tracking-widest">Clear All</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`p-4 border-b border-neutral-100 ${n.read ? 'opacity-50' : ''}`}>
                  <div className="font-bold text-xs">{n.title}</div>
                  <div className="text-xs text-neutral-600" dangerouslySetInnerHTML={{ __html: n.body }} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
