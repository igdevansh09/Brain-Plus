import React, { useEffect, useState } from "react";
import messaging from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "./CustomAlert";

const NotificationManager = () => {
  const router = useRouter();
  const { userRole } = useAuth(); // Get current role (student/teacher/admin)

  // Local state to control the Custom Alert
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    data: null,
  });

  useEffect(() => {
    // 1. Request Permission (iOS / Android 13+)
    const requestPermission = async () => {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log("Authorization status:", authStatus);
      }
    };

    requestPermission();

    // 2. Foreground Listener (App is Open) -> SHOW CUSTOM ALERT
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      setAlertConfig({
        visible: true,
        title: remoteMessage.notification?.title || "New Notification",
        message: remoteMessage.notification?.body || "You have a new update.",
        data: remoteMessage.data,
      });
    });

    // 3. Background Listener (App Minimized) -> DIRECT NAVIGATION
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log("App opened from background:", remoteMessage);
      handleNotificationClick(remoteMessage.data);
    });

    // 4. Quit State Listener (App Closed) -> DIRECT NAVIGATION
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log("App opened from quit state:", remoteMessage);
          // Small delay ensures router is mounted
          setTimeout(() => handleNotificationClick(remoteMessage.data), 1000);
        }
      });

    return unsubscribe;
  }, []);

  const handleNotificationClick = (data) => {
    // Close alert if open
    setAlertConfig((prev) => ({ ...prev, visible: false }));

    if (!data) return;

    // Safety: Ensure we don't route if role doesn't match context (optional but good for production)
    // For now, we assume tokens are correctly managed by AuthContext.

    switch (data.type) {
      case "global_notice":
        // Both students and teachers can view global notices
        if (userRole === "teacher") router.push("/(teacher)/teacherdashboard");
        else router.push("/(student)/studentdashboard");
        break;

      case "class_notice":
        // Students go to dashboard to see class updates
        router.push("/(student)/studentdashboard");
        break;

      case "homework":
        router.push("/(student)/homeworkscreen");
        break;

      case "materials":
        router.push("/(student)/classnotes");
        break;

      case "fees":
        router.push("/(student)/studentfees");
        break;

      case "salary":
        router.push("/(teacher)/teachersalary");
        break;

      default:
        // Safe Fallback
        if (userRole === "teacher") router.push("/(teacher)/teacherdashboard");
        else if (userRole === "admin") router.push("/(admin)/admindashboard");
        else router.push("/(student)/studentdashboard");
    }
  };

  // Render the CustomAlert component when visible
  return (
    <CustomAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      confirmText="View"
      type="info"
      onConfirm={() => handleNotificationClick(alertConfig.data)}
      onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
    />
  );
};

export default NotificationManager;
