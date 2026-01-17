import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeAuth,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
} from "firebase/auth";
import app from "../config/firebaseConfig"; // Import the initialized Native App

export const createUserWithoutLoggingOut = async (email, password) => {
  // Extract the raw config (apiKey, appId, etc.) from the existing Native App
  const config = app.options;

  // Initialize a secondary Web SDK app using the same credentials
  const secondaryApp = initializeApp(config, `SecondaryApp-${Date.now()}`);

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
