import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";
import { ToastProvider } from "../context/ToastContext";

// --- IMPORT FIREBASE CONFIG FIRST ---
import "../config/firebaseConfig";

// --- MODULAR FIREBASE MESSAGING ---
import {
  getMessaging,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";

import {
  NotificationListener,
  requestUserPermission,
} from "../utils/notificationService";
import NotificationManager from "../components/NotificationManager";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
import { ThemeProvider } from "../context/ThemeContext";

// --- BACKGROUND HANDLER ---
const messaging = getMessaging();
setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  console.log("Message handled in the background!", remoteMessage);
});

const InitialLayout = () => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false); // New state to prevent redirect flash

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

  // --- AUTH NAVIGATION LOGIC ---
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "(admin)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const inStudentGroup = segments[0] === "(student)";

    if (user && userRole) {
      // User is logged in - Redirect to their specific dashboard
      // The `isReady` check ensures we don't show the Stack until we are sure

      if (userRole === "admin" && !inAdminGroup) {
        router.replace("/(admin)/admindashboard");
      } else if (userRole === "teacher" && !inTeacherGroup) {
        router.replace("/(teacher)/teacherdashboard");
      } else if (userRole === "student" && !inStudentGroup) {
        router.replace("/(student)/studentdashboard");
      } else {
        // We are in the correct place
        setIsReady(true);
      }
    } else if (!user) {
      // User is NOT logged in
      if (inAdminGroup || inTeacherGroup || inStudentGroup) {
        router.replace("/"); // Send to Welcome/Login Screen
      } else {
        setIsReady(true); // We are at Login/Welcome, so it's safe to render
      }
    }
  }, [user, userRole, loading, segments]);

  // --- RENDER LOGIC ---

  // 1. Show Splash if Firebase is still checking (loading)
  // 2. Show Splash if we are redirecting (isReady is false)
  if (loading || !isReady) {
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
