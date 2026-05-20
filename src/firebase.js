import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// We will replace this part with your actual keys from Google in a minute!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);