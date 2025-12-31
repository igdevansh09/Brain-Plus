import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator, LogBox } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";
import { ToastProvider } from "../context/ToastContext";
import messaging from "@react-native-firebase/messaging";
import {
  NotificationListener,
  requestUserPermission,
} from "../utils/notificationService";
import NotificationManager from "../components/NotificationManager";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";

// Ignore Firebase Deprecation Warnings
LogBox.ignoreLogs([
  "This method is deprecated",
  "Method called was",
  "Please use `getApp()` instead",
  "Please see migration guide for more details",
]);

// Background Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("Message handled in the background!", remoteMessage);
});

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

  // --- Routing Logic ---
  // --- Routing Logic ---
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "(admin)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const inStudentGroup = segments[0] === "(student)";

    // Check if user is on the landing page or login options
    const inPublicArea =
      segments.length === 0 ||
      segments[0] === "index" ||
      segments[0] === "login_options";

    if (user && userRole) {
      // --- LOGGED IN ---

      // 1. Admin Redirect
      if (userRole === "admin" && !inAdminGroup) {
        router.replace("/(admin)/admindashboard");
      }
      // 2. Teacher Redirect
      else if (userRole === "teacher" && !inTeacherGroup) {
        router.replace("/(teacher)/teacherdashboard");
      }
      // 3. Student Redirect
      else if (userRole === "student" && !inStudentGroup) {
        router.replace("/(student)/studentdashboard");
      }
    } else if (!user) {
      // --- NOT LOGGED IN ---
      // If they are in a protected area, kick them out
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
      <NotificationManager />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login_options" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(teacher)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(guest)" />
      </Stack>
    </ToastProvider>
  );
};;

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}
