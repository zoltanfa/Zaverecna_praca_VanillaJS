import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { products, loadProductsFromDatabase, notifyProductsUpdated } from '../data/products.js';
import { authStore } from '../stores/authStore.js';
import { cancelOrderWithRestock } from '../stores/orderCancellation.js';

const ORDER_STATUS_OPTIONS = ['Created', 'Processed', 'Shipped', 'Delivered', 'Cancelled'];
const ORDER_STATUS_TRANSITIONS = {
  Created: ['Processed', 'Cancelled'],
  Processed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: []
};

function formatOrderDate(value) {
  const parsedDate = value?.toDate?.() || (value ? new Date(value) : null);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  const hours = String(parsedDate.getHours()).padStart(2, '0');
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function renderAdmin() {
  const main = document.createElement('main');
  main.className = 'main-admin';

  let isLoading = true;
  let isSavingProduct = false;
  let isSavingOrder = false;
  let isSavingUser = false;
  let adminError = '';
  let adminSuccess = '';

  let orders = [];
  let users = [];
  let editingProductId = null;

  const productForm = {
    id: null,
    name: '',
    price: 0,
    stock: 0,
    category: '',
    image: '',
    description: ''
  };

  const resetMessages = () => {
    adminError = '';
    adminSuccess = '';
  };

  const resetProductForm = () => {
    editingProductId = null;
    productForm.id = null;
    productForm.name = '';
    productForm.price = 0;
    productForm.stock = 0;
    productForm.category = '';
    productForm.image = '';
    productForm.description = '';
  };

  const getNextProductId = () => {
    if (products.length === 0) {
      return 1;
    }

    return Math.max(...products.map((product) => Number(product.id) || 0)) + 1;
  };

  const loadOrders = async () => {
    const snapshot = await getDocs(collection(db, 'orders'));

    const mappedOrders = snapshot.docs.map((orderDoc) => {
      const data = orderDoc.data();
      const createdAtDate = data.createdAt?.toDate?.();

      return {
        id: orderDoc.id,
        ...data,
        createdAtMs: createdAtDate ? createdAtDate.getTime() : 0
      };
    });

    orders = mappedOrders.sort((a, b) => b.createdAtMs - a.createdAtMs);
  };

  const loadUsers = async () => {
    const snapshot = await getDocs(collection(db, 'profiles'));

    users = snapshot.docs.map((userDoc) => ({
      uid: userDoc.id,
      ...userDoc.data()
    }));
  };

  const refreshAdminData = async () => {
    await loadProductsFromDatabase(true);
    await loadOrders();
    await loadUsers();
  };

  const render = () => {
    if (isLoading) {
      main.innerHTML = '<main class="main-admin"><p>Loading admin data...</p></main>';
      return;
    }

    main.innerHTML = `
      <h1 class="main-title-admin">Admin Panel</h1>
      <p class="main-description">Role: <strong>${authStore.currentUserRole || 'unknown'}</strong></p>
      ${adminSuccess ? `<p class="status success">${adminSuccess}</p>` : ''}
      ${adminError ? `<p class="status error">${adminError}</p>` : ''}

      <section class="panel">
        <h2>${editingProductId ? `Edit Product #${editingProductId}` : 'Create Product'}</h2>
        <div class="grid">
          <input class="input" id="id" value="${editingProductId || getNextProductId()}" readonly />
          <input class="input" id="name" placeholder="Name" value="${productForm.name}" />
          <input class="input" id="price" type="number" min="0" step="0.01" placeholder="Price" value="${productForm.price}" />
          <input class="input" id="stock" type="number" min="0" step="1" placeholder="Stock" value="${productForm.stock}" />
          <input class="input" id="category" placeholder="Category" value="${productForm.category}" />
          <input class="input wide" id="image" placeholder="Image URL" value="${productForm.image}" />
          <textarea class="input wide" id="description" rows="4" placeholder="Description">${productForm.description}</textarea>
        </div>
        <div class="row">
          <button class="btn save-product" ${isSavingProduct ? 'disabled' : ''}>Save Product</button>
          <button class="btn muted reset-product" ${isSavingProduct ? 'disabled' : ''}>Reset</button>
        </div>
      </section>

      <section class="panel">
        <h2>Products</h2>
        <div class="list">
          ${products.map((product) => `
            <div class="list-item">
              <div>
                <strong>#${product.id}</strong> ${product.name}
                <small class="meta">${product.category} | ${Number(product.price).toFixed(2)} EUR | stock: ${typeof product.stock === 'number' ? product.stock : 'N/A'}</small>
              </div>
              <div class="actions">
                <button class="btn muted edit-product" data-id="${product.id}">Edit</button>
                <button class="btn danger delete-product" data-id="${product.id}" ${isSavingProduct ? 'disabled' : ''}>Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <h2>Users</h2>
        <div class="list">
          ${users.map((user) => `
            <div class="list-item">
              <div>
                <strong>${user.firstName || ''} ${user.lastName || ''}</strong>
                <small class="meta">${user.email || user.uid}</small>
              </div>
              <div class="actions wrap-actions">
                <select class="input compact role-select" data-uid="${user.uid}" ${isSavingUser ? 'disabled' : ''}>
                  <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>customer</option>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <h2>Orders</h2>
        <div class="list order-list">
          ${orders.map((order) => `
            <div class="list-item order-list-item">
              <div class="order-summary">
                <strong class="order-id">#${order.id}</strong>
                <small class="meta order-summary-line">${Number(order.total || 0).toFixed(2)} EUR | ${formatOrderDate(order.createdAt)}</small>
                <small class="meta">Status: ${order.status || 'Created'}</small>
              </div>
              <div class="actions wrap-actions">
                <select class="input compact order-status" data-id="${order.id}" ${isSavingOrder ? 'disabled' : ''}>
                  ${ORDER_STATUS_OPTIONS.map((status) => `<option value="${status}" ${(order.status || 'Created') === status ? 'selected' : ''}>${status}</option>`).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    main.querySelectorAll('.edit-product').forEach((button) => {
      button.addEventListener('click', () => {
        const productId = Number(button.getAttribute('data-id'));
        const product = products.find((item) => Number(item.id) === productId);
        if (!product) {
          return;
        }

        editingProductId = product.id;
        productForm.id = product.id;
        productForm.name = product.name || '';
        productForm.price = Number(product.price || 0);
        productForm.stock = typeof product.stock === 'number' ? product.stock : 0;
        productForm.category = product.category || '';
        productForm.image = product.image || '';
        productForm.description = product.description || '';
        render();
      });
    });

    main.querySelectorAll('.delete-product').forEach((button) => {
      button.addEventListener('click', async () => {
        resetMessages();
        isSavingProduct = true;
        render();

        try {
          const productId = button.getAttribute('data-id');
          await deleteDoc(doc(db, 'products', String(productId)));
          await loadProductsFromDatabase(true);
          notifyProductsUpdated();
          adminSuccess = 'Product deleted.';
        } catch (error) {
          console.error('Failed to delete product:', error);
          adminError = 'Unable to delete product.';
        } finally {
          isSavingProduct = false;
          render();
        }
      });
    });

    main.querySelector('.reset-product').addEventListener('click', () => {
      resetMessages();
      resetProductForm();
      render();
    });

    main.querySelector('.save-product').addEventListener('click', async () => {
      resetMessages();

      productForm.name = main.querySelector('#name').value.trim();
      productForm.price = Number(main.querySelector('#price').value);
      productForm.stock = Number(main.querySelector('#stock').value);
      productForm.category = main.querySelector('#category').value.trim();
      productForm.image = main.querySelector('#image').value.trim();
      productForm.description = main.querySelector('#description').value.trim();

      if (!productForm.name || !productForm.category || !productForm.image) {
        adminError = 'Name, category, and image are required.';
        render();
        return;
      }

      if (productForm.price < 0 || productForm.stock < 0) {
        adminError = 'Price and stock cannot be negative.';
        render();
        return;
      }

      isSavingProduct = true;
      render();

      try {
        const id = editingProductId || getNextProductId();

        await setDoc(doc(db, 'products', String(id)), {
          id,
          name: productForm.name,
          price: productForm.price,
          stock: productForm.stock,
          category: productForm.category,
          image: productForm.image,
          description: productForm.description,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });

        await loadProductsFromDatabase(true);
        notifyProductsUpdated();
        resetProductForm();
        adminSuccess = 'Product saved.';
      } catch (error) {
        console.error('Failed to save product:', error);
        adminError = 'Unable to save product.';
      } finally {
        isSavingProduct = false;
        render();
      }
    });

    main.querySelectorAll('.role-select').forEach((select) => {
      select.addEventListener('change', async () => {
        resetMessages();
        isSavingUser = true;
        render();

        try {
          const uid = select.getAttribute('data-uid');
          const role = select.value;

          await updateDoc(doc(db, 'profiles', uid), {
            role,
            updatedAt: serverTimestamp()
          });

          if (authStore.currentUser?.uid === uid) {
            await authStore.refreshCurrentUserRole();
          }

          adminSuccess = 'User role updated.';
          await loadUsers();
        } catch (error) {
          console.error('Failed to update role:', error);
          adminError = 'Unable to update user role.';
        } finally {
          isSavingUser = false;
          render();
        }
      });
    });

    main.querySelectorAll('.order-status').forEach((select) => {
      select.addEventListener('change', async () => {
        resetMessages();
        isSavingOrder = true;
        render();

        try {
          const orderId = select.getAttribute('data-id');
          const nextStatus = select.value;
          const order = orders.find((entry) => entry.id === orderId);
          const currentStatus = order?.status || 'Created';

          if (nextStatus !== currentStatus) {
            const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
            if (!allowed.includes(nextStatus)) {
              throw new Error(`Invalid status transition: ${currentStatus} -> ${nextStatus}`);
            }
          }

          if (nextStatus === 'Cancelled' && currentStatus !== 'Cancelled') {
            await cancelOrderWithRestock({ orderId, cancellableStatuses: ['Created', 'Processed'] });
          } else {
            await updateDoc(doc(db, 'orders', orderId), {
              status: nextStatus,
              updatedAt: serverTimestamp()
            });
          }

          adminSuccess = 'Order status updated.';
          await refreshAdminData();
        } catch (error) {
          console.error('Failed to update order status:', error);
          adminError = 'Unable to update order status.';
        } finally {
          isSavingOrder = false;
          render();
        }
      });
    });
  };

  refreshAdminData()
    .then(() => {
      isLoading = false;
      resetProductForm();
      render();
    })
    .catch((error) => {
      console.error('Failed to load admin data:', error);
      isLoading = false;
      adminError = 'Unable to load admin data.';
      render();
    });

  return main;
}
