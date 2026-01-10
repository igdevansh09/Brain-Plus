import {
  getMessaging,
  getToken,
  requestPermission,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import { PermissionsAndroid, Platform } from "react-native";

// Initialize Messaging Instance
// We define this at the top level so we can pass it to the modular functions
const messaging = getMessaging();

// 1. Request Permission (Required for iOS & Android 13+)
export const requestUserPermission = async () => {
  if (Platform.OS === "ios") {
    // Modular style: Pass the instance to the function
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    return enabled;
  } else if (Platform.OS === "android" && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // Android < 33 has permission by default
};

// 2. Get the FCM Token (Used by AuthContext)
export const getFCMToken = async () => {
  try {
    // Note: In the modular SDK, we typically just call requestPermission()
    // It will check the current status and return it without showing a prompt
    // if already determined.
    const authStatus = await requestPermission(messaging);

    if (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    ) {
      // Modular style: getToken(messagingInstance)
      const token = await getToken(messaging);
      console.log("FCM Token:", token);
      return token;
    }

    console.log("Notification permission denied");
    return null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

// 3. Notification Listener
// Kept empty as listeners are handled in components/NotificationManager.jsx
export const NotificationListener = () => {
  return () => {};
};
