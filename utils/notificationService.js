import messaging from "@react-native-firebase/messaging";
import { PermissionsAndroid, Platform, Alert } from "react-native";

// 1. Request Permission (Required for iOS & Android 13+)
export const requestUserPermission = async () => {
  if (Platform.OS === "ios") {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } else if (Platform.OS === "android" && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // Android < 33 has permission by default
};

// 2. Get the FCM Token (The "Address")
export const getFCMToken = async () => {
  try {
    // Check if we already have permission
    const hasPermission = await messaging().hasPermission();
    if (
      hasPermission === messaging.AuthorizationStatus.AUTHORIZED ||
      hasPermission === messaging.AuthorizationStatus.PROVISIONAL ||
      hasPermission === 1
    ) {
      // 1 is Authorized on Android
      const token = await messaging().getToken();
      console.log("FCM Token:", token);
      return token;
    } else {
      // Try requesting it
      const granted = await requestUserPermission();
      if (granted) {
        const token = await messaging().getToken();
        console.log("FCM Token:", token);
        return token;
      }
    }
    console.log("Notification permission denied");
    return null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

// 3. Listeners (Foreground)
export const NotificationListener = () => {
  // Assume user is in the app
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    Alert.alert(
      remoteMessage.notification?.title || "New Message",
      remoteMessage.notification?.body || ""
    );
  });
  return unsubscribe;
};
