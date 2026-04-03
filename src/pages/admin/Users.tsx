import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { UserProfile } from "../../types";
import { Search, X, Loader2, User, Mail, Shield, ShieldAlert, DollarSign, Calendar, MoreVertical, UserPlus, UserMinus } from "lucide-react";
import { cn } from "../../lib/utils";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AlertModal } from "../../components/AlertModal";

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: UserProfile } | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ uid: string; currentRole: string } | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; variant: "error" | "info" | "success" }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "info",
  });

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleContextMenu = (e: React.MouseEvent, user: UserProfile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, user });
  };

  const handleToggleAdmin = async (targetUid: string, currentRole: string) => {
    setRoleTarget({ uid: targetUid, currentRole });
    setShowRoleModal(true);
  };

  const confirmToggleAdmin = async () => {
    if (!roleTarget) return;
    const { uid: targetUid, currentRole } = roleTarget;
    const newRole = currentRole === "admin" ? "user" : "admin";
    
    setShowRoleModal(false);
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
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: err.message || "Failed to update role",
        variant: "error",
      });
    } finally {
      setUpdatingId(null);
      setRoleTarget(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.firstName + " " + u.lastName).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <ConfirmationModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        onConfirm={confirmToggleAdmin}
        title="Update User Role"
        message={roleTarget?.currentRole === "admin" 
          ? "Are you sure you want to remove admin privileges from this user?" 
          : "Are you sure you want to make this user an admin?"}
        confirmText="Update Role"
        variant={roleTarget?.currentRole === "admin" ? "danger" : "info"}
        isLoading={!!updatingId}
      />
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />
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
        {/* Mobile Card Layout */}
        <div className="md:hidden divide-y divide-neutral-100">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <div 
                key={user.uid} 
                className="p-4 space-y-2"
                onContextMenu={(e) => handleContextMenu(e, user)}
              >
                <div className="flex justify-between items-center">
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
                  <span className={cn(
                    "px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full",
                    user.role === "admin" ? "bg-red-100 text-red-600" : 
                    user.role === "member" ? "bg-neutral-900 text-white" : 
                    "bg-neutral-100 text-neutral-600"
                  )}>
                    {user.role === "admin" ? "Admin" : user.role === "member" ? "Member" : "User"}
                  </span>
                </div>
                <div className="flex items-center text-xs text-neutral-500 gap-4">
                  <div className="flex items-center">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {user.credits} credits
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {user.membershipYear || "N/A"}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-neutral-400 italic">No users found.</div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">User</th>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Role</th>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Credits</th>
                <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-neutral-400">Membership Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
                <tr 
                  key={user.uid} 
                  className="hover:bg-neutral-50 transition-colors cursor-context-menu"
                  onContextMenu={(e) => handleContextMenu(e, user)}
                >
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
                      user.role === "admin" ? "bg-red-100 text-red-600" : 
                      user.role === "member" ? "bg-neutral-900 text-white" : 
                      "bg-neutral-100 text-neutral-600"
                    )}>
                      {user.role === "admin" ? "Admin" : user.role === "member" ? "Member" : "User"}
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
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-400 italic">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white border border-neutral-200 shadow-xl rounded-lg py-2 w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-neutral-100 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Actions</p>
            <p className="text-xs font-medium text-neutral-900 truncate">{contextMenu.user.firstName} {contextMenu.user.lastName}</p>
          </div>
          
          <button
            onClick={() => {
              handleToggleAdmin(contextMenu.user.uid, contextMenu.user.role);
              setContextMenu(null);
            }}
            disabled={updatingId === contextMenu.user.uid || contextMenu.user.uid === auth.currentUser?.uid}
            className={cn(
              "w-full flex items-center px-4 py-2 text-sm transition-colors hover:bg-neutral-50 disabled:opacity-50",
              contextMenu.user.role === "admin" ? "text-red-600" : "text-neutral-700"
            )}
          >
            {contextMenu.user.role === "admin" ? (
              <>
                <UserMinus className="w-4 h-4 mr-2" />
                Remove Admin
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Make Admin
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
