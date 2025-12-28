import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeAuth,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
} from "firebase/auth";
import { firebaseConfig } from "../config/firebaseConfig";

export const createUserWithoutLoggingOut = async (email, password) => {
  const secondaryApp = initializeApp(
    firebaseConfig,
    `SecondaryApp-${Date.now()}`
  );

  const secondaryAuth = initializeAuth(secondaryApp, {
    persistence: inMemoryPersistence,
  });

  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    return userCredential.user.uid;
  } catch (error) {
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
};
export default createUserWithoutLoggingOut;