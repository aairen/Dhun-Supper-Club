import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";
import { handleFirestoreError, OperationType } from "../lib/firestore";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isMember: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Listen to profile changes
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        // Check if profile exists, if not create it
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            credits: 0,
            role: "user",
            membershipProgress: 0,
            membershipYear: 0,
            notificationPrefs: {
              confirmations: true,
              reminders: true,
            },
          };
          try {
            await setDoc(userDocRef, newProfile);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
          }
        }

        const unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            const currentYear = new Date().getFullYear();
            
            // Reset membership progress if it's a new year
            if (data.membershipYear !== currentYear && data.membershipProgress > 0) {
              await updateDoc(userDocRef, { membershipProgress: 0, membershipYear: currentYear, role: data.role === 'member' ? 'user' : data.role });
            }

            // Membership Auto-Update: Spend 20+ credits -> Member
            if (data.membershipProgress >= 20 && data.role === 'user') {
              try {
                await updateDoc(userDocRef, { role: 'member', membershipYear: currentYear });
              } catch (err) {
                console.error("Membership update error:", err);
              }
            } else if (data.role === 'member' && data.membershipYear < currentYear) {
              // Revert to Guest if membership expired
              try {
                await updateDoc(userDocRef, { role: 'user' });
              } catch (err) {
                console.error("Membership downgrade error:", err);
              }
            } else if (data.membershipProgress < 20 && data.role === 'member' && data.membershipYear === currentYear) {
              // Revert to Guest if progress falls below 20
              try {
                await updateDoc(userDocRef, { role: 'user' });
              } catch (err) {
                console.error("Membership downgrade error:", err);
              }
            }

            setProfile(data);
            console.log("Profile updated:", data.uid, "Role:", data.role);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile fetch error:", error);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isAdmin = profile?.role === "admin";
  const isMember = profile?.role === "member";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isMember }}>
      {children}
    </AuthContext.Provider>
  );
};
