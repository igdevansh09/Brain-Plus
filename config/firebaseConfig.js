import app from "@react-native-firebase/app";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage"; 
import messaging from "@react-native-firebase/messaging";

const db = firestore();
const authInstance = auth();
const storageInstance = storage();
const messagingInstance = messaging();

export {
  db,
  authInstance as auth,
  storageInstance as storage,
  messagingInstance as messaging,
};
export default app;
