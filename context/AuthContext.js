import React, { createContext, useContext, useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getFCMToken } from "../utils/notificationService";

const AuthContext = createContext();

// *** FIX: Enable Firestore Offline Persistence ***
// This must be called before any Firestore operations
const enableOfflinePersistence = () => {
  try {
    // Enable persistence with default settings
    // Note: This is automatically enabled in React Native Firebase
    // but we explicitly set it for clarity
    firestore().settings({
      persistence: true, // Enable offline persistence
      cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED, // Optional: unlimited cache
    });
    console.log("✅ Firestore offline persistence enabled");
  } catch (error) {
    // This will fail if persistence is already enabled
    // or if called after the first Firestore operation
    console.log(
      "Firestore persistence already enabled or error:",
      error.message
    );
  }
};

// Enable persistence immediately
enableOfflinePersistence();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveTokenToDatabase = async (uid) => {
    try {
      const token = await getFCMToken();
      if (token) {
        await firestore()
          .collection("users")
          .doc(uid)
          .set({ fcmToken: token }, { merge: true });
      }
    } catch (e) {
      console.log("Token Save Error:", e);
    }
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        // --- 1. ADMIN CHECK (Priority) ---
        const idTokenResult = await currentUser.getIdTokenResult();

        if (idTokenResult.claims.role === "admin") {
          console.log("✅ Admin Access Granted");
          setUserRole("admin");
          setLoading(false);
          return;
        }

        // --- 2. STUDENT/TEACHER CHECK (Firestore with offline support) ---
        const userDoc = await firestore()
          .collection("users")
          .doc(currentUser.uid)
          .get({ source: "default" }); // Will use cache if offline

        if (userDoc.exists) {
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

        // *** FIX: If offline, try to get cached role ***
        try {
          const cachedDoc = await firestore()
            .collection("users")
            .doc(currentUser.uid)
            .get({ source: "cache" });

          if (cachedDoc.exists) {
            const userData = cachedDoc.data();
            if (userData?.verified === true) {
              console.log("✅ Using cached user data (offline mode)");
              setUserRole(userData?.role || null);
            }
          }
        } catch (cacheError) {
          console.log("No cached data available");
          setUserRole(null);
        }
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
