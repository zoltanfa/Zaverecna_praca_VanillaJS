import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

class AuthStore {
  constructor() {
    this.currentUser = null;
    this.currentUserRole = 'guest';
    this.authInitialized = false;
    this.listeners = new Set();
    this.authInitPromise = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener({
      currentUser: this.currentUser,
      currentUserRole: this.currentUserRole,
      isAdmin: this.isAdmin
    }));
  }

  get isAdmin() {
    return this.currentUserRole === 'admin';
  }

  normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  async syncProfileEmailWithAuth(user) {
    if (!user) {
      return;
    }

    const authEmail = this.normalizeEmail(user.email);
    if (!authEmail) {
      return;
    }

    const profileRef = doc(db, 'profiles', user.uid);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) {
      return;
    }

    const profileEmail = this.normalizeEmail(snapshot.data()?.email);
    if (profileEmail === authEmail) {
      return;
    }

    await updateDoc(profileRef, {
      email: authEmail,
      updatedAt: serverTimestamp()
    });
  }

  async loadCurrentUserRole(user) {
    if (!user) {
      this.currentUserRole = 'guest';
      return;
    }

    const profile = await this.getUserProfile(user.uid);
    this.currentUserRole = profile?.role || 'customer';
  }

  initAuth() {
    if (this.authInitPromise) {
      return this.authInitPromise;
    }

    this.authInitPromise = new Promise((resolve) => {
      let didResolve = false;

      onAuthStateChanged(auth, async (user) => {
        this.currentUser = user;

        try {
          await this.syncProfileEmailWithAuth(user);
          await this.loadCurrentUserRole(user);
        } catch (error) {
          console.error('Auth sync failed:', error);
        }

        this.authInitialized = true;
        this.notify();

        if (!didResolve) {
          didResolve = true;
          resolve();
        }
      });
    });

    return this.authInitPromise;
  }

  async waitForAuthInit() {
    if (this.authInitialized) {
      return;
    }

    await this.initAuth();
  }

  async registerWithEmail({ firstName, lastName, email, password }) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      await updateProfile(user, { displayName: fullName });
    }

    await setDoc(doc(db, 'profiles', user.uid), {
      firstName,
      lastName,
      email,
      role: 'customer',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
      country: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return user;
  }

  async loginWithEmail({ email, password }) {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
  }

  async logout() {
    await signOut(auth);
  }

  async getUserProfile(uid) {
    const snapshot = await getDoc(doc(db, 'profiles', uid));

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  async saveUserProfile(uid, payload) {
    const userDocRef = doc(db, 'profiles', uid);
    const existingSnapshot = await getDoc(userDocRef);

    if (existingSnapshot.exists()) {
      const existingRole = existingSnapshot.data()?.role || 'customer';

      await updateDoc(userDocRef, {
        ...payload,
        role: existingRole,
        updatedAt: serverTimestamp()
      });

      if (auth.currentUser && auth.currentUser.uid === uid) {
        this.currentUserRole = existingRole;
        this.notify();
      }

      return;
    }

    await setDoc(userDocRef, {
      ...payload,
      role: 'customer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (auth.currentUser && auth.currentUser.uid === uid) {
      this.currentUserRole = 'customer';
      this.notify();
    }
  }

  async refreshCurrentUserRole() {
    await this.loadCurrentUserRole(auth.currentUser);
    this.notify();
  }

  async changeUserEmail(newEmail) {
    if (!auth.currentUser) {
      throw new Error('No authenticated user.');
    }

    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
  }

  async changeUserPassword({ currentPassword, newPassword }) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('No authenticated user.');
    }

    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }
}

export const authStore = new AuthStore();
