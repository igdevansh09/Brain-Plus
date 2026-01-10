import React, { createContext, useContext, useEffect, useState } from "react";
// 1. Import Modular Functions
import {
  onAuthStateChanged,
  getIdTokenResult, // <--- Import this function
} from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  // Removed CACHE_SIZE_UNLIMITED as settings are handled in config or default
} from "@react-native-firebase/firestore";

// 2. Import Instances
import { auth, db } from "../config/firebaseConfig";
import { getFCMToken } from "../utils/notificationService";

const AuthContext = createContext();

// NOTE: db.settings() block removed.
// Persistence is enabled by default in React Native Firebase.
// If you need specific cache settings, use initializeFirestore in your config file.

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveTokenToDatabase = async (uid) => {
    try {
      const token = await getFCMToken();
      if (token) {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, { fcmToken: token }, { merge: true });
      }
    } catch (e) {
      console.log("Token Save Error:", e);
    }
  };

  useEffect(() => {
    // Modular Listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        // --- 1. ADMIN CHECK ---
        // FIX: Use functional syntax: getIdTokenResult(user)
        const idTokenResult = await getIdTokenResult(currentUser);

        if (idTokenResult.claims.role === "admin") {
          console.log("✅ Admin Access Granted");
          setUserRole("admin");
          setLoading(false);
          return;
        }

        // --- 2. FIRESTORE CHECK ---
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.verified === true) {
            setUserRole(userData?.role || null);
            saveTokenToDatabase(currentUser.uid);
          } else {
            setUserRole(null);
          }
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error("Auth Context Error:", error);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
