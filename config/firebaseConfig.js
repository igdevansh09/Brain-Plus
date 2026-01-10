import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";
import { getMessaging } from "@react-native-firebase/messaging";

// React Native Firebase initializes the default app natively.
// However, using getApp() is the modular way to retrieve it.
const app = getApp();

const db = getFirestore(app);
const authInstance = getAuth(app);
const storageInstance = getStorage(app);
const messagingInstance = getMessaging(app);

export {
  db,
  authInstance as auth,
  storageInstance as storage,
  messagingInstance as messaging,
};
export default app;
