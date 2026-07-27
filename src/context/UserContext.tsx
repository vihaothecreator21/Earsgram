import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string;
  spotify?: {
    isConnected: boolean;
    email?: string | null;
    id?: string;
    connectedAt?: string;
  };
}

interface UserContextType {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();

      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);

      unsubscribeSnapshot = onSnapshot(userRef, async (snapshot) => {
        if (!snapshot.exists()) {
          const newUser: UserProfile = {
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.email?.split("@")[0] ?? "New User",
            avatarUrl: null,
            spotify: {
              isConnected: false,
            },
          };
          await setDoc(userRef, newUser);
        } else {
          setUserProfile(snapshot.data() as UserProfile);
        }
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!firebaseUser) return;

    const userRef = doc(db, "users", firebaseUser.uid);
    await updateDoc(userRef, data);
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <UserContext.Provider
      value={{ firebaseUser, userProfile, loading, updateUserProfile, logout }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used inside UserProvider");
  }
  return context;
};