import React, { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { auth, db } from "../firebase";
import { 
  updateEmail, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  deleteUser
} from "firebase/auth";
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Moon, 
  Sun, 
  Trash2, 
  Save, 
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2
} from "lucide-react";
import { cn } from "../lib/utils";

const SettingsPage = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Profile State
  const [profileData, setProfileData] = useState({
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    email: profile?.email || "",
  });

  // Password State
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState({
    confirmations: profile?.notificationPrefs?.confirmations ?? true,
    reminders: profile?.notificationPrefs?.reminders ?? true,
  });

  // Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      });

      // Update Email if changed
      if (profileData.email !== user.email) {
        // This usually requires re-auth, but we'll try
        await updateEmail(user, profileData.email);
        await updateDoc(doc(db, "users", user.uid), { email: profileData.email });
      }

      setSuccess("Profile updated successfully");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (passwordData.new !== passwordData.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordData.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordData.new);
      setPasswordData({ current: "", new: "", confirm: "" });
      setSuccess("Password updated successfully");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotification = async (key: "confirmations" | "reminders") => {
    if (!user) return;
    const newVal = !notifications[key];
    setNotifications(prev => ({ ...prev, [key]: newVal }));
    
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`notificationPrefs.${key}`]: newVal
      });
    } catch (err) {
      console.error("Error updating notifications:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmEmail !== user.email) return;
    setLoading(true);
    setError(null);

    try {
      // Re-authenticate if necessary
      if (deletePassword) {
        const credential = EmailAuthProvider.credential(user.email!, deletePassword);
        await reauthenticateWithCredential(user, credential);
      }

      // 1. Delete all user bookings and update event capacity
      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      const { increment } = await import("firebase/firestore");
      
      for (const bDoc of querySnapshot.docs) {
        const booking = bDoc.data();
        const eventRef = doc(db, "events", booking.eventId);
        
        // Decrement bookedSeats
        try {
          await updateDoc(eventRef, {
            bookedSeats: increment(-booking.numPeople)
          });
        } catch (err) {
          console.error("Error updating event capacity during account deletion:", err);
        }
        
        // Delete booking
        await deleteDoc(bDoc.ref);
      }

      // 2. Delete from Firestore user profile
      await deleteDoc(doc(db, "users", user.uid));

      // 3. Delete from Auth
      await deleteUser(user);
      
      // 4. Explicit logout
      await auth.signOut();
      
      // 5. Redirect to homepage
      window.location.href = "/";
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setError("For security reasons, please enter your password to re-authenticate.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-neutral-900 uppercase tracking-widest">Settings</h1>
          <p className="text-neutral-500 font-light mt-2">Manage your account preferences and security.</p>
        </div>

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-green-50 border border-green-100 text-green-700 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        <div className="space-y-8">
          {/* Profile Section */}
          <section className="bg-white border border-neutral-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-neutral-100 pb-4">
              <User className="w-5 h-5 text-neutral-400" />
              <h2 className="text-lg font-serif uppercase tracking-widest text-neutral-900">Profile Management</h2>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">First Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-neutral-900 outline-none transition-all text-sm"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Last Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-neutral-900 outline-none transition-all text-sm"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    readOnly
                    className="w-full pl-10 pr-4 py-2 border border-neutral-200 bg-neutral-50 text-neutral-500 outline-none transition-all text-sm cursor-not-allowed"
                    value={profileData.email}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>

          {/* Password Section */}
          <section className="bg-white border border-neutral-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-neutral-100 pb-4">
              <Lock className="w-5 h-5 text-neutral-400" />
              <h2 className="text-lg font-serif uppercase tracking-widest text-neutral-900">Password Management</h2>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    required
                    className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-neutral-900 outline-none transition-all text-sm"
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">New Password</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    required
                    className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-neutral-900 outline-none transition-all text-sm"
                    value={passwordData.new}
                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Confirm New Password</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    required
                    className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-neutral-900 outline-none transition-all text-sm"
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-neutral-900 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                Update Password
              </button>
            </form>
          </section>

          {/* Preferences Section */}
          <div className="grid grid-cols-1 gap-8">
            <section className="bg-white border border-neutral-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-8 border-b border-neutral-100 pb-4">
                <Bell className="w-5 h-5 text-neutral-400" />
                <h2 className="text-lg font-serif uppercase tracking-widest text-neutral-900">Notifications</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Booking Confirmations</p>
                    <p className="text-xs text-neutral-500">Receive emails when you book an event.</p>
                  </div>
                  <button 
                    onClick={() => handleToggleNotification("confirmations")}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      notifications.confirmations ? "bg-neutral-900" : "bg-neutral-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      notifications.confirmations ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Event Reminders</p>
                    <p className="text-xs text-neutral-500">Receive reminders before your experiences.</p>
                  </div>
                  <button 
                    onClick={() => handleToggleNotification("reminders")}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      notifications.reminders ? "bg-neutral-900" : "bg-neutral-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      notifications.reminders ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Account Deletion */}
          <section className="bg-red-50 border border-red-100 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-serif uppercase tracking-widest text-red-600">Account Deletion</h2>
            </div>
            <p className="text-sm text-red-700 mb-6">
              All credits in your account will be permanently deleted and cannot be recovered.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-600 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
            >
              Delete Account
            </button>
          </section>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white p-8 max-w-md w-full shadow-2xl border border-neutral-200"
            >
              <h3 className="text-xl font-serif text-neutral-900 mb-4 uppercase tracking-widest">Delete Account</h3>
              <p className="text-neutral-500 font-light leading-relaxed mb-6">
                This action is permanent and cannot be undone. All your credits, reservations, and history will be lost.
              </p>
              <div className="space-y-4 mb-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Type <span className="text-neutral-900 font-bold">{user?.email}</span> to confirm
                </p>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-red-600 outline-none transition-all text-sm"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                />
                <input
                  type="password"
                  className="w-full px-4 py-2 border border-neutral-200 bg-transparent focus:border-red-600 outline-none transition-all text-sm"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password to re-authenticate"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-neutral-100 text-neutral-900 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmEmail !== user?.email || !deletePassword || loading}
                  className="flex-1 bg-red-600 text-white py-3 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
              {error && <p className="text-red-600 text-xs mt-4">{error}</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
