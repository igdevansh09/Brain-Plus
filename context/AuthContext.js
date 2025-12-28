import React, { createContext, useContext, useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getFCMToken } from "../utils/notificationService";

const AuthContext = createContext();

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
        // We check the token claims first. If it's an admin, we skip Firestore checks.
        const idTokenResult = await currentUser.getIdTokenResult();

        if (idTokenResult.claims.role === "admin") {
          console.log("AuthContext: Admin Access Granted");
          setUserRole("admin");
          setLoading(false);
          return; // STOP HERE for Admins
        }

        // --- 2. STUDENT/TEACHER CHECK (Firestore) ---
        // Only runs if NOT an admin
        const userDoc = await firestore()
          .collection("users")
          .doc(currentUser.uid)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();

          // Strict verification check for Students/Teachers
          if (userData?.verified === true) {
            setUserRole(userData?.role || null);
            saveTokenToDatabase(currentUser.uid);
          } else {
            // Document exists but not verified
            setUserRole(null);
          }
        } else {
          // No document found (Fresh registration)
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
