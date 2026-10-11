// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC3nu8VAa78Dto8GrpludU43mO5CBpmRUU",
  authDomain: "billing-355b9.firebaseapp.com",
  projectId: "billing-355b9",
  storageBucket: "billing-355b9.firebasestorage.app",
  messagingSenderId: "1089706882826",
  appId: "1:1089706882826:web:497f79be32aa7c7c5c6cf3"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
