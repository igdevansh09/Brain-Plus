import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";
import { ToastProvider } from "../context/ToastContext";

// --- IMPORT FIREBASE CONFIG FIRST ---
import "../config/firebaseConfig"; // Ensure Firebase is initialized

// --- REFACTOR START: Modular Imports ---
import {
  getMessaging,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
// --- REFACTOR END ---

import {
  NotificationListener,
  requestUserPermission,
} from "../utils/notificationService";
import NotificationManager from "../components/NotificationManager";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
import { ThemeProvider } from "../context/ThemeContext";

// --- REFACTOR START: Modular Background Handler ---
// 1. Initialize instance
const messaging = getMessaging();

// 2. Use the functional syntax: setBackgroundMessageHandler(instance, callback)
setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  console.log("Message handled in the background!", remoteMessage);
});
// --- REFACTOR END ---

const InitialLayout = () => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // --- Notifications Setup ---
  useEffect(() => {
    let unsubscribe;
    const setupNotifications = async () => {
      const hasPermission = await requestUserPermission();
      if (hasPermission) {
        unsubscribe = NotificationListener();
      }
    };
    setupNotifications();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "(admin)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const inStudentGroup = segments[0] === "(student)";

    if (user && userRole) {
      if (userRole === "admin" && !inAdminGroup) {
        router.replace("/(admin)/admindashboard");
      } else if (userRole === "teacher" && !inTeacherGroup) {
        router.replace("/(teacher)/teacherdashboard");
      } else if (userRole === "student" && !inStudentGroup) {
        router.replace("/(student)/studentdashboard");
      }
    } else if (!user) {
      if (inAdminGroup || inTeacherGroup || inStudentGroup) {
        router.replace("/");
      }
    }
  }, [user, userRole, loading, segments]);

  if (loading) {
    return <AnimatedSplashScreen />;
  }

  return (
    <ToastProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login_options" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(guest)" />
      </Stack>
      {/* Placed after Stack to ensure it overlays on top if it has UI */}
      <NotificationManager />
    </ToastProvider>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <InitialLayout />
      </ThemeProvider>
    </AuthProvider>
  );
}
 
