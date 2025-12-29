import React, { useEffect, useState } from "react";
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

// --- SILENCE FIREBASE WARNINGS ---
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "This method is deprecated",
  "Fetching token claims for", // Optional: silence your own logs if needed
]);

// Background Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("Message handled in the background!", remoteMessage);
});

const InitialLayout = () => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

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
  useEffect(() => {
    if (loading) return;
    // Run routing logic, then mark layout as ready to render screens
    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "(admin)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const inStudentGroup = segments[0] === "(student)";

    const inProtectedRoute = inAdminGroup || inTeacherGroup || inStudentGroup;

    if (user && userRole) {
      // --- LOGGED IN & AUTHORIZED ---

      if (userRole === "admin" && !inAdminGroup) {
        router.replace("/(admin)/admindashboard");
      } else if (userRole === "teacher" && !inTeacherGroup) {
        router.replace("/(teacher)/teacherdashboard");
      } else if (userRole === "student" && !inStudentGroup) {
        router.replace("/(student)/studentdashboard");
      }
    } else {
      // --- NOT LOGGED IN / NOT VERIFIED ---
      if (inProtectedRoute) {
        router.replace("/");
      }
    }
    setReady(true);
  }, [user, userRole, loading, segments]);

  if (loading || !ready) {
    return (
      <View className="flex-1 bg-[#282C34] justify-center items-center">
        <ActivityIndicator size="large" color="#f49b33" />
      </View>
    );
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
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}
