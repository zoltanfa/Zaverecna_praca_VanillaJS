import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { db } from '../firebase.js';

export const products = [];

const listeners = new Set();
let loadProductsPromise = null;

function normalizeProductId(rawId) {
  const numericId = Number(rawId);
  return Number.isNaN(numericId) ? rawId : numericId;
}

function mapProductFromDoc(docSnapshot) {
  const data = docSnapshot.data();
  const rawId = data.id ?? docSnapshot.id;

  return {
    ...data,
    id: normalizeProductId(rawId)
  };
}

function replaceProducts(nextProducts) {
  products.splice(0, products.length, ...nextProducts);
}

export function subscribeProducts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyProductsUpdated() {
  listeners.forEach((listener) => listener(products));
}

export async function loadProductsFromDatabase(forceRefresh = false) {
  if (forceRefresh) {
    loadProductsPromise = null;
  }

  if (loadProductsPromise) {
    return loadProductsPromise;
  }

  loadProductsPromise = (async () => {
    try {
      const productsQuery = query(collection(db, 'products'), orderBy('id', 'asc'));
      const snapshot = await getDocs(productsQuery);

      if (snapshot.empty) {
        replaceProducts([]);
        notifyProductsUpdated();
        return;
      }

      const databaseProducts = snapshot.docs.map(mapProductFromDoc);
      replaceProducts(databaseProducts);
      notifyProductsUpdated();
    } catch (error) {
      console.error('Failed to load products from Firestore:', error);
      loadProductsPromise = null;
      if (products.length === 0) {
        replaceProducts([]);
        notifyProductsUpdated();
      }
    }
  })();

  return loadProductsPromise;
}
