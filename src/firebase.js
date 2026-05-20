import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwEo4E5ZtWaqW9A6sJDktSrCbvrg8fNK8",
  authDomain: "field-expense-pro.firebaseapp.com",
  projectId: "field-expense-pro",
  storageBucket: "field-expense-pro.firebasestorage.app",
  messagingSenderId: "78205797187",
  appId: "1:78205797187:web:c70fc2520760bcfaaba5f6"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);