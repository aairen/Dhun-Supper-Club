import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { UserProfile } from "../../types";
import { Search, X, Loader2, User, Mail, Shield, ShieldAlert, DollarSign, Calendar } from "lucide-react";

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleAdmin = async (targetUid: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    const confirmMsg = newRole === "admin" 
      ? "Are you sure you want to make this user an admin?" 
      : "Are you sure you want to remove admin privileges from this user?";
    
    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(targetUid);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid, role: newRole })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }
      
      // The UI will update automatically via onSnapshot
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.firstName + " " + u.lastName).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif text-neutral-900 uppercase tracking-widest">Manage Users</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Search by name or email..."
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
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Role</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Credits</th>
              <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Membership</th>
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
            ) : filteredUsers.map(user => (
              <tr key={user.uid} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center mr-3">
                      <User className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div>
                      <span className="text-neutral-900 font-medium block">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-xs text-neutral-400 flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {user.email}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full",
                    user.role === "admin" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  <div className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {user.credits}
                  </div>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {user.membershipYear || "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleToggleAdmin(user.uid, user.role)}
                    disabled={updatingId === user.uid}
                    className={cn(
                      "text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50",
                      user.role === "admin" ? "text-red-600 hover:text-red-800" : "text-neutral-900 hover:text-neutral-600"
                    )}
                  >
                    {updatingId === user.uid ? "Updating..." : user.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 italic">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default AdminUsers;
