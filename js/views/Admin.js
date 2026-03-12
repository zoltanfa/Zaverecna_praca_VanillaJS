import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { products, loadProductsFromDatabase } from '../data/products.js';
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
const USER_ROLE_OPTIONS = ['customer', 'admin'];

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

const escapeHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderAdmin() {
  const main = document.createElement('main');
  main.className = 'main-admin';

  let isLoading = true;
  let isSavingProduct = false;
  let isSavingCategory = false;
  let isSavingOrder = false;
  let isSavingUser = false;
  let adminError = '';
  let adminSuccess = '';

  let categories = [];
  let newCategoryName = '';
  let editingCategoryId = '';
  let editingCategoryName = '';
  let orders = [];
  let users = [];
  let selectedUserOrdersUid = '';
  let selectedUserOrderId = '';
  let editingProductId = null;
  let showCategoryManagement = false;
  let showProductManagement = false;
  let showUserManagement = false;

  const productForm = {
    id: null,
    name: '',
    price: 0,
    stock: 0,
    category: '',
    subcategory: '',
    brand: '',
    model: '',
    socket: '',
    size: null,
    format: '',
    wattage: null,
    formFactorsText: '',
    image: '',
    description: ''
  };

  const resetMessages = () => {
    adminError = '';
    adminSuccess = '';
  };

  const resetProductForm = () => {
    editingProductId = null;
    Object.assign(productForm, {
      id: null,
      name: '',
      price: 0,
      stock: 0,
      category: categories[0]?.name || '',
      subcategory: '',
      brand: '',
      model: '',
      socket: '',
      size: null,
      format: '',
      wattage: null,
      formFactorsText: '',
      image: '',
      description: ''
    });
  };

  const getNextProductId = () => {
    if (products.length === 0) {
      return 1;
    }

    return Math.max(...products.map((product) => Number(product.id) || 0)) + 1;
  };

  const toCategoryId = (name) => String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const loadCategories = async () => {
    const snapshot = await getDocs(collection(db, 'categories'));
    const fromCollection = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (fromCollection.length > 0) {
      categories = fromCollection.sort((a, b) => a.name.localeCompare(b.name));
      return;
    }

    const inferredCategories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    categories = inferredCategories.map((name) => ({ id: toCategoryId(name), name }));
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

    users = snapshot.docs
      .map((userDoc) => ({
        uid: userDoc.id,
        ...userDoc.data()
      }))
      .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
  };

  const refreshAdminData = async () => {
    await loadProductsFromDatabase(true);
    await loadCategories();
    await loadOrders();
    await loadUsers();
  };

  const ensureCategoryExists = async (name) => {
    const categoryId = toCategoryId(name);
    if (!categoryId) return;
    await setDoc(doc(db, 'categories', categoryId), {
      name,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
  };

  const getUserOrderCount = (uid) => orders.filter((o) => o.userId === uid).length;

  const getOrderItemsCount = (order) => {
    if (!order?.items?.length) return 0;
    return order.items.reduce((count, item) => count + (Number(item.quantity) || 0), 0);
  };

  const getOrderItemImage = (item) => {
    const product = products.find((p) => p.id === item.id);
    return product?.image || '';
  };

  const bindSectionToggleEvents = () => {
    main.querySelector('.toggle-category-btn')?.addEventListener('click', () => {
      showCategoryManagement = !showCategoryManagement;
      render();
    });

    main.querySelector('.toggle-product-btn')?.addEventListener('click', () => {
      showProductManagement = !showProductManagement;
      render();
    });

    main.querySelector('.toggle-user-btn')?.addEventListener('click', () => {
      showUserManagement = !showUserManagement;
      render();
    });
  };

  const bindCategoryManagementEvents = () => {
    const newCatInput = main.querySelector('.new-category-input');
    if (newCatInput) {
      newCatInput.addEventListener('input', (e) => { newCategoryName = e.target.value; });
    }

    main.querySelector('.add-category-btn')?.addEventListener('click', async () => {
      resetMessages();
      const categoryName = newCategoryName.trim();
      if (!categoryName) {
        adminError = 'Category name is required.';
        render();
        return;
      }
      isSavingCategory = true;
      render();
      try {
        await ensureCategoryExists(categoryName);
        newCategoryName = '';
        await loadCategories();
        adminSuccess = 'Category created.';
      } catch (error) {
        console.error('Failed to add category:', error);
        adminError = 'Unable to create category.';
      } finally {
        isSavingCategory = false;
        render();
      }
    });

    main.querySelectorAll('.start-edit-category-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const categoryId = btn.getAttribute('data-id');
        const category = categories.find((entry) => entry.id === categoryId);
        if (!category) {
          return;
        }

        editingCategoryId = category.id;
        editingCategoryName = category.name;
        render();
      });
    });

    main.querySelector('.cancel-category-btn')?.addEventListener('click', () => {
      editingCategoryId = '';
      editingCategoryName = '';
      render();
    });

    const editCatInput = main.querySelector('.edit-category-input');
    if (editCatInput) {
      editCatInput.addEventListener('input', (e) => { editingCategoryName = e.target.value; });
    }

    main.querySelector('.save-category-btn')?.addEventListener('click', async () => {
      resetMessages();
      const newName = editingCategoryName.trim();
      if (!editingCategoryId || !newName) {
        adminError = 'Category name is required.';
        render();
        return;
      }
      const existingCategory = categories.find((c) => c.id === editingCategoryId);
      if (!existingCategory) {
        adminError = 'Category no longer exists.';
        render();
        return;
      }
      isSavingCategory = true;
      render();
      try {
        const oldName = existingCategory.name;
        const newCategoryId = toCategoryId(newName);
        await setDoc(doc(db, 'categories', newCategoryId), {
          name: newName,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
        if (newCategoryId !== editingCategoryId) {
          await deleteDoc(doc(db, 'categories', editingCategoryId));
        }
        if (oldName !== newName) {
          const productsQuery = query(collection(db, 'products'), where('category', '==', oldName));
          const productsSnapshot = await getDocs(productsQuery);
          const batch = writeBatch(db);
          productsSnapshot.docs.forEach((pDoc) => {
            batch.update(pDoc.ref, { category: newName });
          });
          if (!productsSnapshot.empty) {
            await batch.commit();
          }
        }
        editingCategoryId = '';
        editingCategoryName = '';
        await refreshAdminData();
        adminSuccess = 'Category updated.';
      } catch (error) {
        console.error('Failed to update category:', error);
        adminError = 'Unable to update category.';
      } finally {
        isSavingCategory = false;
        render();
      }
    });

    main.querySelectorAll('.delete-category-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        resetMessages();
        const catId = btn.getAttribute('data-id');
        const category = categories.find((entry) => entry.id === catId);
        if (!category) {
          adminError = 'Category no longer exists.';
          render();
          return;
        }

        const catName = category.name;
        const hasProducts = products.some((p) => p.category === catName);
        if (hasProducts) {
          adminError = 'Cannot delete category that is used by products.';
          render();
          return;
        }
        isSavingCategory = true;
        render();
        try {
          await deleteDoc(doc(db, 'categories', catId));
          await loadCategories();
          adminSuccess = 'Category deleted.';
        } catch (error) {
          console.error('Failed to delete category:', error);
          adminError = 'Unable to delete category.';
        } finally {
          isSavingCategory = false;
          render();
        }
      });
    });
  };

  const bindProductManagementEvents = () => {
    main.querySelector('.reset-product-btn')?.addEventListener('click', () => {
      resetMessages();
      resetProductForm();
      render();
    });

    main.querySelectorAll('.edit-product-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const productId = Number(btn.getAttribute('data-id'));
        const product = products.find((p) => Number(p.id) === productId);
        if (!product) return;
        editingProductId = product.id;
        Object.assign(productForm, {
          id: product.id,
          name: product.name || '',
          price: product.price || 0,
          stock: typeof product.stock === 'number' ? product.stock : 0,
          category: product.category || '',
          subcategory: product.subcategory || '',
          brand: product.brand || '',
          model: product.model || '',
          socket: product.socket || '',
          size: typeof product.size === 'number' ? product.size : null,
          format: product.format || '',
          wattage: typeof product.wattage === 'number' ? product.wattage : null,
          formFactorsText: Array.isArray(product.formFactors) ? product.formFactors.join(', ') : '',
          image: product.image || '',
          description: product.description || ''
        });
        render();
      });
    });

    main.querySelectorAll('.delete-product-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        resetMessages();
        isSavingProduct = true;
        render();
        try {
          const productId = btn.getAttribute('data-id');
          await deleteDoc(doc(db, 'products', String(productId)));
          await refreshAdminData();
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

    main.querySelector('.save-product-btn')?.addEventListener('click', async () => {
      resetMessages();
      const name = main.querySelector('#prod-name').value.trim();
      const category = main.querySelector('#prod-category').value;
      const image = main.querySelector('#prod-image').value.trim();
      const price = Number(main.querySelector('#prod-price').value);
      const stock = Number(main.querySelector('#prod-stock').value);
      const subcategory = main.querySelector('#prod-subcategory').value.trim();
      const brand = main.querySelector('#prod-brand').value.trim();
      const model = main.querySelector('#prod-model').value.trim();
      const socket = main.querySelector('#prod-socket').value.trim();
      const sizeVal = main.querySelector('#prod-size').value;
      const format = main.querySelector('#prod-format').value.trim();
      const wattageVal = main.querySelector('#prod-wattage').value;
      const formFactorsText = main.querySelector('#prod-formfactors').value;
      const description = main.querySelector('#prod-description').value.trim();

      if (!name || !category || !image) {
        adminError = 'Name, category, and image are required.';
        render();
        return;
      }
      if (price < 0 || stock < 0) {
        adminError = 'Price and stock cannot be negative.';
        render();
        return;
      }
      isSavingProduct = true;
      render();
      try {
        const id = editingProductId || getNextProductId();
        const payload = {
          id,
          name,
          price,
          stock,
          category,
          subcategory,
          brand,
          model,
          socket,
          image,
          description,
          updatedAt: serverTimestamp()
        };
        if (sizeVal !== '' && sizeVal !== null) {
          payload.size = Number(sizeVal);
        }
        if (wattageVal !== '' && wattageVal !== null) {
          payload.wattage = Number(wattageVal);
        }
        if (format) {
          payload.format = format;
        }
        const formFactors = formFactorsText.split(',').map((s) => s.trim()).filter(Boolean);
        if (formFactors.length > 0) {
          payload.formFactors = formFactors;
        }
        await setDoc(doc(db, 'products', String(id)), {
          ...payload,
          createdAt: serverTimestamp()
        }, { merge: true });
        await ensureCategoryExists(category);
        await refreshAdminData();
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
  };

  const bindUserManagementEvents = () => {
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

    main.querySelectorAll('.toggle-user-orders-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-uid');
        selectedUserOrderId = '';
        selectedUserOrdersUid = selectedUserOrdersUid === uid ? '' : uid;
        render();
      });
    });

    main.querySelectorAll('.toggle-order-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        selectedUserOrderId = selectedUserOrderId === orderId ? '' : orderId;
        render();
      });
    });

    main.querySelectorAll('.order-status-select').forEach((select) => {
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
              adminError = `Invalid status transition: ${currentStatus} -> ${nextStatus}.`;
              isSavingOrder = false;
              render();
              return;
            }
          }
          if (nextStatus === 'Cancelled' && currentStatus !== 'Cancelled') {
            await cancelOrderWithRestock({ orderId, cancellableStatuses: ['Created', 'Processed'] });
            await loadProductsFromDatabase(true);
          } else {
            await updateDoc(doc(db, 'orders', orderId), {
              status: nextStatus,
              updatedAt: serverTimestamp()
            });
          }
          if (order) {
            order.status = nextStatus;
          }
          adminSuccess = 'Order status updated.';
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

  const render = () => {
    if (isLoading) {
      main.innerHTML = '<p>Loading admin data...</p>';
      return;
    }

    const selectedUserEntry = selectedUserOrdersUid
      ? users.find((u) => u.uid === selectedUserOrdersUid) || null
      : null;
    const selectedUserOrders = selectedUserOrdersUid
      ? orders.filter((o) => o.userId === selectedUserOrdersUid)
      : [];

    main.innerHTML = `
      <h1 class="main-title-admin">Admin Panel</h1>
      <p class="main-description">Role: <strong>${escapeHtml(authStore.currentUserRole || 'unknown')}</strong></p>
      ${adminSuccess ? `<p class="status success">${escapeHtml(adminSuccess)}</p>` : ''}
      ${adminError ? `<p class="status error">${escapeHtml(adminError)}</p>` : ''}

      <section class="panel">
        <h2>Management Sections</h2>
        <div class="row">
          <button class="btn ${!showCategoryManagement ? 'muted ' : ''}toggle-category-btn">
            ${showCategoryManagement ? 'Hide Category Management' : 'Show Category Management'}
          </button>
          <button class="btn ${!showProductManagement ? 'muted ' : ''}toggle-product-btn">
            ${showProductManagement ? 'Hide Product Management' : 'Show Product Management'}
          </button>
          <button class="btn ${!showUserManagement ? 'muted ' : ''}toggle-user-btn">
            ${showUserManagement ? 'Hide User Management' : 'Show User Management'}
          </button>
        </div>
      </section>

      ${showCategoryManagement ? `
      <section class="panel">
        <h2>Categories</h2>
        <div class="row">
          <input class="input new-category-input" type="text" placeholder="New category name" value="${escapeHtml(newCategoryName)}" />
          <button class="btn add-category-btn" ${isSavingCategory ? 'disabled' : ''}>Add Category</button>
        </div>
        <div class="list">
          ${categories.map((category) => `
            <div class="list-item">
              ${editingCategoryId === category.id ? `
                <input class="input edit-category-input" type="text" value="${escapeHtml(editingCategoryName)}" />
                <button class="btn save-category-btn" data-id="${escapeHtml(category.id)}" ${isSavingCategory ? 'disabled' : ''}>Save</button>
                <button class="btn muted cancel-category-btn">Cancel</button>
              ` : `
                <span>${escapeHtml(category.name)}</span>
                <div class="actions">
                  <button class="btn muted start-edit-category-btn" data-id="${escapeHtml(category.id)}">Edit</button>
                  <button class="btn danger delete-category-btn" data-id="${escapeHtml(category.id)}" ${isSavingCategory ? 'disabled' : ''}>Delete</button>
                </div>
              `}
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      ${showProductManagement ? `
      <section class="panel">
        <h2>${editingProductId ? `Edit Product #${editingProductId}` : 'Create Product'}</h2>
        <div class="grid">
          <input class="input" id="prod-id" type="text" placeholder="Product ID" value="${editingProductId || getNextProductId()}" readonly />
          <input class="input" id="prod-name" type="text" placeholder="Name" value="${escapeHtml(productForm.name)}" />
          <input class="input" id="prod-price" type="number" min="0" step="0.01" placeholder="Price" value="${productForm.price}" />
          <input class="input" id="prod-stock" type="number" min="0" step="1" placeholder="Stock" value="${productForm.stock}" />
          <select class="input" id="prod-category">
            <option value="" disabled ${!productForm.category ? 'selected' : ''}>Select category</option>
            ${categories.map((cat) => `<option value="${escapeHtml(cat.name)}" ${productForm.category === cat.name ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`).join('')}
          </select>
          <input class="input" id="prod-subcategory" type="text" placeholder="Subcategory" value="${escapeHtml(productForm.subcategory)}" />
          <input class="input" id="prod-brand" type="text" placeholder="Brand" value="${escapeHtml(productForm.brand)}" />
          <input class="input" id="prod-model" type="text" placeholder="Model" value="${escapeHtml(productForm.model)}" />
          <input class="input" id="prod-socket" type="text" placeholder="Socket" value="${escapeHtml(productForm.socket)}" />
          <input class="input" id="prod-size" type="number" min="0" placeholder="Size" value="${productForm.size ?? ''}" />
          <input class="input" id="prod-format" type="text" placeholder="Format" value="${escapeHtml(productForm.format)}" />
          <input class="input" id="prod-wattage" type="number" min="0" placeholder="Wattage" value="${productForm.wattage ?? ''}" />
          <input class="input" id="prod-formfactors" type="text" placeholder="Form factors (comma separated)" value="${escapeHtml(productForm.formFactorsText)}" />
          <input class="input wide" id="prod-image" type="text" placeholder="Image URL" value="${escapeHtml(productForm.image)}" />
          <textarea class="input wide" id="prod-description" rows="4" placeholder="Description">${escapeHtml(productForm.description)}</textarea>
        </div>
        <div class="row">
          <button class="btn save-product-btn" ${isSavingProduct ? 'disabled' : ''}>Save Product</button>
          <button class="btn muted reset-product-btn">Reset</button>
        </div>
      </section>
      <section class="panel">
        <h2>Products</h2>
        <div class="list">
          ${products.map((product) => `
            <div class="list-item">
              <div>
                <strong>#${product.id}</strong> ${escapeHtml(product.name)}
                <small class="meta">${escapeHtml(product.category)} | ${Number(product.price).toFixed(2)} EUR | stock: ${typeof product.stock === 'number' ? product.stock : 'N/A'}</small>
              </div>
              <div class="actions">
                <button class="btn muted edit-product-btn" data-id="${product.id}">Edit</button>
                <button class="btn danger delete-product-btn" data-id="${product.id}" ${isSavingProduct ? 'disabled' : ''}>Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      ${showUserManagement ? `
      <section class="panel">
        <h2>Users</h2>
        <div class="list">
          ${users.map((user) => `
            <div class="list-item">
              <div>
                <strong>${escapeHtml(((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.uid)}</strong>
                <small class="meta">${escapeHtml(user.email || user.uid)} | orders: ${getUserOrderCount(user.uid)}</small>
              </div>
              <div class="actions wrap-actions">
                <select class="input compact role-select" data-uid="${escapeHtml(user.uid)}" ${isSavingUser ? 'disabled' : ''}>
                  ${USER_ROLE_OPTIONS.map((role) => `<option value="${role}" ${(user.role || 'customer') === role ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
                <button class="btn muted toggle-user-orders-btn" data-uid="${escapeHtml(user.uid)}">
                  ${selectedUserOrdersUid === user.uid ? 'Hide Orders' : 'View Orders'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        ${selectedUserEntry ? `
        <div class="sub-panel">
          <h3>Orders For ${escapeHtml(selectedUserEntry.email || selectedUserEntry.uid)}</h3>
          ${selectedUserOrders.length === 0 ? `
            <div class="empty-note">No orders for this account.</div>
          ` : `
            <div class="list order-list">
              ${selectedUserOrders.map((order) => `
                <div class="list-item order-list-item">
                  <div class="adm-order-summary">
                    <strong class="adm-order-id">#${escapeHtml(order.id)}</strong>
                    <small class="meta adm-order-summary-line">${Number(order.total || 0).toFixed(2)} EUR | ${formatOrderDate(order.createdAt)}</small>
                    <small class="meta">Items: ${getOrderItemsCount(order)}</small>
                  </div>
                  <div class="actions wrap-actions">
                    <button class="btn muted toggle-order-detail-btn" data-order-id="${escapeHtml(order.id)}">
                      ${selectedUserOrderId === order.id ? 'Hide Details' : 'Show Details'}
                    </button>
                    <select class="input compact order-status-select" data-id="${escapeHtml(order.id)}" ${isSavingOrder ? 'disabled' : ''}>
                      ${ORDER_STATUS_OPTIONS.map((status) => `<option value="${status}" ${(order.status || 'Created') === status ? 'selected' : ''}>${status}</option>`).join('')}
                    </select>
                  </div>
                  ${selectedUserOrderId === order.id ? `
                  <div class="adm-order-detail-block">
                    <div class="adm-detail-grid">
                      <p><strong>Name:</strong> ${escapeHtml(order.customerName || '—')}</p>
                      <p><strong>Email:</strong> ${escapeHtml(order.email || '—')}</p>
                      <p><strong>Address:</strong> ${escapeHtml(order.address || '—')}</p>
                      <p><strong>Delivery:</strong> ${escapeHtml(order.deliveryLabel || order.deliveryMethod || '—')}</p>
                      <p><strong>Payment:</strong> ${escapeHtml(order.paymentLabel || order.paymentMethod || '—')}</p>
                      ${order.pickupPoint ? `<p><strong>Pickup point:</strong> ${escapeHtml(order.pickupPoint)}</p>` : ''}
                    </div>
                    <div class="adm-order-items-list">
                      ${(order.items || []).map((item) => `
                        <div class="adm-order-item-row">
                          <div class="adm-order-item-main">
                            ${getOrderItemImage(item) ? `<img src="${escapeHtml(getOrderItemImage(item))}" alt="${escapeHtml(item.name)}" class="order-item-image" />` : ''}
                            <div>
                              <strong>${escapeHtml(item.name)}</strong>
                              <small class="meta">Qty: ${Number(item.quantity) || 0}</small>
                            </div>
                          </div>
                          <span>${(Number(item.price || 0) * (Number(item.quantity) || 0)).toFixed(2)} EUR</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>
        ` : ''}
      </section>
      ` : ''}
    `;

    bindSectionToggleEvents();

    if (showCategoryManagement) {
      bindCategoryManagementEvents();
    }

    if (showProductManagement) {
      bindProductManagementEvents();
    }

    if (showUserManagement) {
      bindUserManagementEvents();
    }
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
