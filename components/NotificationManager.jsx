import React, { useEffect, useState } from "react";
// 1. MODULAR IMPORT: Import functions directly
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import CustomAlert from "./CustomAlert";

const NotificationManager = () => {
  const router = useRouter();
  const { userRole } = useAuth();

  // 2. INITIALIZE INSTANCE
  const messaging = getMessaging();

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    data: null,
  });

  useEffect(() => {
    // 1. Request Permission (Modular)
    const checkPermission = async () => {
      // Pass the messaging instance to the function
      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log("Authorization status:", authStatus);
      }
    };

    checkPermission();

    // 2. Foreground Listener (Modular)
    const unsubscribe = onMessage(messaging, async (remoteMessage) => {
      setAlertConfig({
        visible: true,
        title: remoteMessage.notification?.title || "New Notification",
        message: remoteMessage.notification?.body || "You have a new update.",
        data: remoteMessage.data,
      });
    });

    // 3. Background Listener (Modular)
    onNotificationOpenedApp(messaging, (remoteMessage) => {
      console.log("App opened from background:", remoteMessage);
      handleNotificationClick(remoteMessage.data);
    });

    // 4. Quit State Listener (Modular)
    getInitialNotification(messaging).then((remoteMessage) => {
      if (remoteMessage) {
        console.log("App opened from quit state:", remoteMessage);
        setTimeout(() => handleNotificationClick(remoteMessage.data), 1000);
      }
    });

    return unsubscribe;
  }, []);

  const handleNotificationClick = (data) => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));

    if (!data) return;

    switch (data.type) {
      case "global_notice":
        if (userRole === "teacher") router.push("/(teacher)/teacherdashboard");
        else router.push("/(student)/studentdashboard");
        break;

      case "class_notice":
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
        if (userRole === "teacher") router.push("/(teacher)/teacherdashboard");
        else if (userRole === "admin") router.push("/(admin)/admindashboard");
        else router.push("/(student)/studentdashboard");
    }
  };

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
 
