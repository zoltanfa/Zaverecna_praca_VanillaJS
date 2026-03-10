import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5P5805NMxyiGZW1YWI4xH0g22pC-_gBI',
  authDomain: 'zaverecnapracavue.firebaseapp.com',
  projectId: 'zaverecnapracavue',
  storageBucket: 'zaverecnapracavue.firebasestorage.app',
  messagingSenderId: '613295577067',
  appId: '1:613295577067:web:74e890d61f2d0f53196bae'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export { firebaseApp, auth, db };
