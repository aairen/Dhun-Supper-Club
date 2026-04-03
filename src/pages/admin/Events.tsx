import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { DiningEvent } from "../../types";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Calendar, Clock, Users, DollarSign, X } from "lucide-react";

const AdminEvents = () => {
  const [events, setEvents] = useState<DiningEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateTime: "",
    capacity: 20,
    type: "curated" as DiningEvent["type"],
    creditsPerPerson: 1,
  });

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("dateTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiningEvent[]);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addDoc(collection(db, "events"), {
        ...formData,
        bookedSeats: 0,
        createdAt: new Date().toISOString(),
      });
      setSuccess("Event created successfully");
      setFormData({
        title: "",
        description: "",
        dateTime: "",
        capacity: 20,
        type: "curated",
        creditsPerPerson: 1,
      });
      setShowAdd(false);
    } catch (err: any) {
      setError(err.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "events", eventId));
      } catch (err: any) {
        alert(err.message || "Failed to delete event");
      }
    }
  };

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

      {showAdd && (
        <div className="bg-white border border-neutral-200 p-8 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-300">
          <button 
            onClick={() => setShowAdd(false)}
            className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-xl font-serif text-neutral-900 uppercase tracking-widest mb-6">New Event</h2>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Title</label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                placeholder="Event Title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Type</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              >
                <option value="thali">Thali</option>
                <option value="curated">Curated</option>
                <option value="brunch">Brunch</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors min-h-[100px]"
                placeholder="Event description..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Date & Time</label>
              <input 
                type="datetime-local" 
                required
                value={formData.dateTime}
                onChange={e => setFormData({...formData, dateTime: e.target.value})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Capacity</label>
              <input 
                type="number" 
                required
                min="1"
                value={formData.capacity}
                onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Credits Per Person</label>
              <input 
                type="number" 
                required
                min="0"
                value={formData.creditsPerPerson}
                onChange={e => setFormData({...formData, creditsPerPerson: parseInt(e.target.value)})}
                className="w-full bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Event"}
              </button>
            </div>
          </form>
          
          {error && <p className="mt-4 text-red-600 text-xs font-bold uppercase tracking-widest">{error}</p>}
          {success && <p className="mt-4 text-green-600 text-xs font-bold uppercase tracking-widest">{success}</p>}
        </div>
      )}

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
                  <span className="font-serif text-neutral-900 block">{event.title}</span>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">{event.type}</span>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-2" />
                    {format(parseISO(event.dateTime), "MMM dd, yyyy")}
                  </div>
                  <div className="flex items-center mt-1">
                    <Clock className="w-3 h-3 mr-2" />
                    {format(parseISO(event.dateTime), "h:mm a")}
                  </div>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-2" />
                    {event.bookedSeats || 0} / {event.capacity}
                  </div>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  <div className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-2" />
                    {event.creditsPerPerson}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(event.id)}
                    className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEvents;
