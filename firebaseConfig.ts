import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

if (
  !process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  !process.env.EXPO_PUBLIC_FIREBASE_RTDB_URL ||
  !process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  !process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  !process.env.EXPO_PUBLIC_FIREBASE_MESSENGING_SENDER_ID ||
  !process.env.EXPO_PUBLIC_FIREBASE_APP_ID
) {
  throw new Error("Missing Firebase configuration in environment variables");
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_RTDB_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSENGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const database = getDatabase(app);

export { app, auth, database };
