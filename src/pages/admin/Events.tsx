import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, getDocs, writeBatch, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../../firebase";
import { DiningEvent } from "../../types";
import { format, parseISO, addDays, startOfMonth, isBefore } from "date-fns";
import { Plus, Trash2, Calendar, Clock, Users, DollarSign, X, Image as ImageIcon, Upload, ChevronUp, ChevronDown, RefreshCw, Database, Eraser, Pencil, Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { generateAutoEvents } from "../../lib/eventUtils";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AlertModal } from "../../components/AlertModal";

type SortConfig = {
  key: "dateTime" | "capacity" | "type";
  direction: "asc" | "desc";
};

const AdminEvents = () => {
  const [events, setEvents] = useState<DiningEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "dateTime", direction: "asc" });

  const [showClearModal, setShowClearModal] = useState(false);
  const [showPopulateModal, setShowPopulateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllPastModal, setShowDeleteAllPastModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: "error" | "info" | "success" }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  const [editingEvent, setEditingEvent] = useState<DiningEvent | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dateTime: "",
    capacity: 20,
    type: "curated" as DiningEvent["type"],
    creditsPerPerson: 1,
    imageUrl: "",
    published: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const getEventImage = (event: DiningEvent) => {
    const eventImages = {
      thali: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0247572113.firebasestorage.app/o/thali.jpeg?alt=media&token=3bb5f1a1-e860-49f2-b529-ea30754c03fb",
      brunch: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0247572113.firebasestorage.app/o/brunch.jpeg?alt=media&token=059b839f-8056-4173-9490-fda9e7f78e01",
      curated: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0247572113.firebasestorage.app/o/curated.jpeg?alt=media&token=a2ec3e8a-0876-490f-b0a8-0ee217b6be05",
      "hands-on": "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0247572113.firebasestorage.app/o/hands_on.jpeg?alt=media&token=5422e301-e59f-4e3a-a1ab-1aeaf825c153"
    };
    return (event.imageUrl && event.imageUrl !== "") ? event.imageUrl : (eventImages[event.type] || eventImages.curated);
  };

  useEffect(() => {
    const q = query(collection(db, "events"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiningEvent[]);
    });
    return () => unsubscribe();
  }, []);

  const sortedEvents = useMemo(() => {
    const sortableEvents = [...events];
    sortableEvents.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (sortConfig.key === "dateTime") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortConfig.key === "capacity") {
        // Sort by open seats: capacity - bookedSeats
        aValue = (a.capacity || 0) - (a.bookedSeats || 0);
        bValue = (b.capacity || 0) - (b.bookedSeats || 0);
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sortableEvents;
  }, [events, sortConfig]);

  const activeEvents = sortedEvents.filter(e => !isBefore(parseISO(e.dateTime), new Date()));
  const pastEvents = sortedEvents.filter(e => isBefore(parseISO(e.dateTime), new Date()));

  const requestSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: SortConfig["key"] }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const handleDeleteAllPastEvents = async () => {
    setShowDeleteAllPastModal(true);
  };

  const confirmDeleteAllPastEvents = async () => {
    setShowDeleteAllPastModal(false);
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/delete-all-past-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete past events");
      }

      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "All past events deleted successfully.",
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to delete past events",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearModal(true);
  };

  const confirmClearAll = async () => {
    setShowClearModal(false);
    setClearing(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/delete-all-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear events");
      }

      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "All events cleared and bookings refunded successfully.",
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to clear events",
        variant: "error",
      });
    } finally {
      setClearing(false);
    }
  };

  const handlePopulateWeek = async () => {
    setShowPopulateModal(true);
  };

  const confirmPopulateWeek = async () => {
    setShowPopulateModal(false);
    setPopulating(true);
    try {
      let startDate = new Date();
      
      if (events.length > 0) {
        // Find the latest event
        const latestEvent = [...events].sort((a, b) => 
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        )[0];
        startDate = addDays(new Date(latestEvent.dateTime), 1);
      } else {
        // If no events, start from the beginning of the current month
        startDate = startOfMonth(new Date());
      }

      const endDate = addDays(startDate, 6);
      const nextWeekEvents = generateAutoEvents(startDate, endDate);
      
      if (nextWeekEvents.length === 0) {
        setAlertConfig({
          isOpen: true,
          title: "Info",
          message: "No events to generate for this week.",
          variant: "info",
        });
        return;
      }

      const batch = writeBatch(db);
      nextWeekEvents.forEach((event) => {
        const { id, ...eventData } = event;
        const eventRef = doc(collection(db, "events"));
        batch.set(eventRef, {
          ...eventData,
          createdAt: new Date().toISOString(),
          imageUrl: "",
          published: false,
        });
      });
      
      await batch.commit();
      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: `Successfully populated ${nextWeekEvents.length} events for the week of ${format(startDate, "MMM dd")}.`,
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to populate events",
        variant: "error",
      });
    } finally {
      setPopulating(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const storageRef = ref(storage, `events/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      if (editingEvent) {
        const updateData = { ...formData, imageUrl };
        await updateDoc(doc(db, "events", editingEvent.id), updateData);
        setSuccess("Event updated successfully");
      } else {
        await addDoc(collection(db, "events"), {
          ...formData,
          imageUrl,
          bookedSeats: 0,
          createdAt: new Date().toISOString(),
        });
        setSuccess("Event created successfully");
      }
      
      setFormData({
        title: "",
        description: "",
        dateTime: "",
        capacity: 20,
        type: "curated",
        creditsPerPerson: 1,
        imageUrl: "",
        published: false,
      });
      setEditingEvent(null);
      setImageFile(null);
      setImagePreview(null);
      setShowAdd(false);
    } catch (err: any) {
      setError(err.message || `Failed to ${editingEvent ? "update" : "create"} event`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: DiningEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      dateTime: event.dateTime,
      capacity: event.capacity,
      type: event.type,
      creditsPerPerson: event.creditsPerPerson,
      imageUrl: event.imageUrl || "",
      published: event.published || false,
    });
    setImagePreview(getEventImage(event));
    setShowAdd(true);
  };

  const togglePublish = async (event: DiningEvent) => {
    try {
      await updateDoc(doc(db, "events", event.id), {
        published: !event.published
      });
    } catch (err) {
      console.error("Error toggling publish status:", err);
    }
  };

  const handleDelete = async (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    const event = events.find(e => e.id === eventToDelete);
    const isPast = event ? isBefore(parseISO(event.dateTime), new Date()) : false;
    
    setShowDeleteModal(false);
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/delete-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ eventId: eventToDelete })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }
      
      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: isPast ? "Event deleted. No refunds were issued." : "Event deleted and bookings refunded successfully.",
        variant: "success",
      });
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to delete event",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setEventToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={confirmClearAll}
        title="Clear All Events"
        message="Are you sure you want to delete ALL events? This will also refund all associated bookings. This cannot be undone."
        confirmText="Clear All"
        variant="danger"
        isLoading={clearing}
      />
      <ConfirmationModal
        isOpen={showPopulateModal}
        onClose={() => setShowPopulateModal(false)}
        onConfirm={confirmPopulateWeek}
        title="Populate Events"
        message="This will populate the database with the next week of events. Continue?"
        confirmText="Populate"
        variant="info"
        isLoading={populating}
      />
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? All associated bookings will be refunded. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={loading}
      />
      <ConfirmationModal
        isOpen={showDeleteAllPastModal}
        onClose={() => setShowDeleteAllPastModal(false)}
        onConfirm={confirmDeleteAllPastEvents}
        title="Delete All Past Events"
        message="Are you sure you want to delete ALL past events? This cannot be undone."
        confirmText="Delete All"
        variant="danger"
        isLoading={loading}
      />
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Manage Events</h1>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={handleClearAll}
            disabled={clearing || events.length === 0}
            className="border border-red-200 text-red-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3 mr-2", clearing && "animate-spin")} />
            Clear All Events
          </button>
          <button 
            onClick={handlePopulateWeek}
            disabled={populating}
            className="border border-neutral-200 text-neutral-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center disabled:opacity-50"
          >
            <Database className={cn("w-3 h-3 mr-2", populating && "animate-pulse")} />
            Populate 1 Week
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-neutral-900 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAdd(false);
                setEditingEvent(null);
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white p-8 max-w-2xl w-full shadow-2xl border border-neutral-200 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => {
                  setShowAdd(false);
                  setEditingEvent(null);
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-serif text-neutral-900 uppercase tracking-widest mb-6">
                {editingEvent ? "Edit Event" : "New Event"}
              </h2>
              
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
                    <option value="hands-on">Hands-On Cooking</option>
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

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Published</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, published: !formData.published})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors flex items-center px-1",
                        formData.published ? "bg-green-600 justify-end" : "bg-neutral-200 justify-start"
                      )}
                    >
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </button>
                    <span className="ml-3 text-sm font-bold uppercase tracking-widest text-neutral-900">
                      {formData.published ? "Published" : "Unpublished"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Event Picture</label>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 h-24 bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-neutral-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center px-4 py-2 bg-white border border-neutral-200 text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-neutral-50 transition-colors">
                        <Upload className="w-4 h-4 mr-2" />
                        {imagePreview ? "Change Image" : "Upload Image"}
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                      </label>
                      {imagePreview && (
                        <button 
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                            setFormData(prev => ({ ...prev, imageUrl: "" }));
                          }}
                          className="ml-4 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-2">Recommended: 16:9 aspect ratio, max 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-neutral-900 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
                  >
                    {loading ? (editingEvent ? "Updating..." : "Creating...") : (editingEvent ? "Update Event" : "Create Event")}
                  </button>
                </div>
              </form>
              
              {error && <p className="mt-4 text-red-600 text-xs font-bold uppercase tracking-widest">{error}</p>}
              {success && <p className="mt-4 text-green-600 text-xs font-bold uppercase tracking-widest">{success}</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
        {/* Mobile Card Layout */}
        <div className="md:hidden divide-y divide-neutral-100 w-full">
          {activeEvents.length > 0 ? (
            activeEvents.map(event => (
              <div key={event.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 flex-shrink-0 overflow-hidden">
                    <img src={getEventImage(event)} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer hover:text-neutral-600" onClick={() => handleEdit(event)}>
                    <div className="font-serif text-neutral-900 text-sm truncate">{event.title}</div>
                    <div className="text-[10px] text-neutral-400 uppercase tracking-widest">{event.type}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => togglePublish(event)}
                      className={cn(
                        "p-2 transition-colors",
                        event.published ? "text-green-600 hover:text-green-800" : "text-neutral-400 hover:text-neutral-900"
                      )}
                      title={event.published ? "Unpublish Event" : "Publish Event"}
                    >
                      {event.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => handleEdit(event)}
                      className="text-neutral-400 hover:text-neutral-900 transition-colors p-2"
                      title="Edit Event"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(event.id)}
                      className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center text-xs text-neutral-500 gap-4">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(parseISO(event.dateTime), "MMM dd, yyyy")}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {format(parseISO(event.dateTime), "h:mm a")}
                  </div>
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-1" />
                    {event.bookedSeats || 0} / {event.capacity}
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {event.creditsPerPerson}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-neutral-400 italic">No active events found.</div>
          )}
          
          {pastEvents.length > 0 && (
            <>
              <div className="p-4 bg-neutral-50 font-bold uppercase tracking-widest text-[10px] text-neutral-400 flex justify-between items-center">
                <span>Past Events</span>
                <button onClick={handleDeleteAllPastEvents} className="text-red-600 hover:text-red-800">Delete All</button>
              </div>
              {pastEvents.map(event => (
                <div key={event.id} className="p-4 space-y-3 opacity-60 grayscale">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 flex-shrink-0 overflow-hidden">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-neutral-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-neutral-900 truncate">{event.title}</div>
                      <div className="text-[10px] text-neutral-400 uppercase tracking-widest">{event.type}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDelete(event.id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-neutral-500 gap-4">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(parseISO(event.dateTime), "MMM dd, yyyy")}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {event.bookedSeats || 0} / {event.capacity}
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {event.creditsPerPerson}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Event</th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-900 transition-colors"
                  onClick={() => requestSort("type")}
                >
                  <div className="flex items-center">
                    Type
                    <SortIcon column="type" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-900 transition-colors"
                  onClick={() => requestSort("dateTime")}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon column="dateTime" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 cursor-pointer hover:text-neutral-900 transition-colors"
                  onClick={() => requestSort("capacity")}
                >
                  <div className="flex items-center">
                    Open Seats
                    <SortIcon column="capacity" />
                  </div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Credits</th>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeEvents.map(event => (
                <tr key={event.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center cursor-pointer hover:text-neutral-600" onClick={() => handleEdit(event)}>
                      <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 mr-4 flex-shrink-0 overflow-hidden">
                        <img src={getEventImage(event)} alt={event.title} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-serif text-neutral-900 block">{event.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest">{event.type}</span>
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
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => togglePublish(event)}
                        className={cn(
                          "p-2 transition-colors",
                          event.published ? "text-green-600 hover:text-green-800" : "text-neutral-400 hover:text-neutral-900"
                        )}
                        title={event.published ? "Unpublish Event" : "Publish Event"}
                      >
                        {event.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleEdit(event)}
                        className="text-neutral-400 hover:text-neutral-900 transition-colors p-2"
                        title="Edit Event"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(event.id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pastEvents.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="px-6 py-4 bg-neutral-50 font-bold uppercase tracking-widest text-[10px] text-neutral-400">
                      <div className="flex justify-between items-center">
                        <span>Past Events</span>
                        <button onClick={handleDeleteAllPastEvents} className="text-red-600 hover:text-red-800">Delete All Past Events</button>
                      </div>
                    </td>
                  </tr>
                  {pastEvents.map(event => (
                    <tr key={event.id} className="hover:bg-neutral-50 transition-colors opacity-60 grayscale">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 mr-4 flex-shrink-0 overflow-hidden">
                            <img src={getEventImage(event)} alt={event.title} className="w-full h-full object-cover" />
                          </div>
                          <span className="font-serif text-neutral-900 block">{event.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-widest">{event.type}</span>
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
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => handleDelete(event.id)}
                            className="text-neutral-400 hover:text-red-600 transition-colors p-2"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 italic">
                    No events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminEvents;
