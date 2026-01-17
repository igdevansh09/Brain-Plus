import { getApp, getApps, initializeApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";
import { getFunctions } from "@react-native-firebase/functions"; // 1. Import Functions

// React Native Firebase auto-initializes via native code,
// but checking getApps() is a safe modular pattern.
let app;
if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApp();
}

// Initialize services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app); // 2. Initialize Functions

// 3. Export everything (including functions)
export { db, auth, storage, functions, app };
export default app;
 
