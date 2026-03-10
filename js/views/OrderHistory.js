import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { products, loadProductsFromDatabase } from '../data/products.js';
import { db } from '../firebase.js';
import { authStore } from '../stores/authStore.js';
import { cancelOrderWithRestock } from '../stores/orderCancellation.js';

const ORDER_STATUS_STAGES = ['Created', 'Processed', 'Shipped', 'Delivered', 'Cancelled'];
const CANCELLABLE_ORDER_STATUSES = ['Created', 'Processed'];

function formatOrderDate(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  return typeof value === 'string' ? value : '';
}

function getOrderItemsCount(order) {
  if (!order?.items?.length) {
    return 0;
  }

  return order.items.reduce((count, item) => count + (item.quantity || 0), 0);
}

function getOrderItemImage(item) {
  const product = products.find((entry) => entry.id === item.id);
  return product?.image || '';
}

function getOrderStatus(order) {
  if (ORDER_STATUS_STAGES.includes(order?.status)) {
    return order.status;
  }

  return 'Created';
}

function getOrderStatusClass(order) {
  const status = getOrderStatus(order);

  if (status === 'Delivered') {
    return 'delivered';
  }

  if (status === 'Cancelled') {
    return 'cancelled';
  }

  return '';
}

function canCancelOrder(order) {
  return CANCELLABLE_ORDER_STATUSES.includes(getOrderStatus(order));
}

async function cancelOrderStatusOnly(orderId) {
  await updateDoc(doc(db, 'orders', orderId), {
    status: 'Cancelled',
    updatedAt: serverTimestamp()
  });
}

export function renderOrderHistory() {
  const main = document.createElement('main');
  main.className = 'main-order-history';

  let orders = [];
  let selectedOrderId = null;
  let isCancellingOrder = false;
  let cancelErrorMessage = '';
  let cancelSuccessMessage = '';

  const loadOrdersFromFirestore = async () => {
    try {
      await authStore.waitForAuthInit();

      if (!authStore.currentUser) {
        orders = [];
        return;
      }

      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', authStore.currentUser.uid)
      );

      const snapshot = await getDocs(ordersQuery);
      const mappedOrders = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        const createdAtDate = data.createdAt?.toDate?.();

        return {
          id: docSnapshot.id,
          ...data,
          date: createdAtDate ? createdAtDate.toISOString() : null,
          createdAtMs: createdAtDate ? createdAtDate.getTime() : 0
        };
      });

      orders = mappedOrders.sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      console.error('Failed to load order history:', error);
      orders = [];
    }
  };

  const openOrderDetails = (orderId) => {
    cancelErrorMessage = '';
    cancelSuccessMessage = '';
    selectedOrderId = orderId;
    render();
  };

  const closeOrderDetails = () => {
    cancelErrorMessage = '';
    cancelSuccessMessage = '';
    selectedOrderId = null;
    render();
  };

  const handleCancelOrder = async (order) => {
    if (!order || !canCancelOrder(order) || isCancellingOrder) {
      return;
    }

    cancelErrorMessage = '';
    cancelSuccessMessage = '';
    isCancellingOrder = true;
    render();

    try {
      try {
        await cancelOrderWithRestock({
          orderId: order.id,
          cancellableStatuses: CANCELLABLE_ORDER_STATUSES
        });
      } catch (error) {
        const errorCode = String(error?.code || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        const isPermissionError = errorCode.includes('permission-denied')
          || message.includes('permission')
          || message.includes('insufficient');

        if (!isPermissionError) {
          throw error;
        }

        await cancelOrderStatusOnly(order.id);
      }

      const orderEntry = orders.find((entry) => entry.id === order.id);
      if (orderEntry) {
        orderEntry.status = 'Cancelled';
      }

      cancelSuccessMessage = 'Order cancelled successfully.';
    } catch (error) {
      console.error('Failed to cancel order:', error);
      cancelErrorMessage = 'Unable to cancel order. It may no longer be cancellable.';
    } finally {
      isCancellingOrder = false;
      render();
    }
  };

  const bindListEvents = () => {
    main.querySelectorAll('.open-order').forEach((button) => {
      button.addEventListener('click', () => {
        openOrderDetails(button.getAttribute('data-id'));
      });
    });
  };

  const bindDetailEvents = (selectedOrder) => {
    const backBtn = main.querySelector('.back-btn');
    backBtn.addEventListener('click', closeOrderDetails);

    const cancelBtn = main.querySelector('.cancel-order-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        handleCancelOrder(selectedOrder);
      });
    }
  };

  const render = () => {
    const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;

    if (orders.length === 0) {
      main.innerHTML = `
        <h1 class="main-title-order-history">Order History</h1>
        <div class="empty-state">
          <p>You have no previous orders.</p>
          <a href="#/products" class="shop-link" data-link>Start Shopping</a>
        </div>
      `;
      return;
    }

    if (!selectedOrder) {
      main.innerHTML = `
        <h1 class="main-title-order-history">Order History</h1>
        <div class="orders-list">
          ${orders.map((order) => `
            <button type="button" class="order-card order-card-btn open-order" data-id="${order.id}">
              <div class="order-header">
                <div>
                  <h2 class="order-title">Order #${order.id}</h2>
                  <p class="order-date">${formatOrderDate(order.date)}</p>
                </div>
                <div class="order-total">${Number(order.total || 0).toFixed(2)} €</div>
              </div>
              <div class="order-preview">
                <span>${getOrderItemsCount(order)} items</span>
                <span class="order-status ${getOrderStatusClass(order)}">${getOrderStatus(order)}</span>
              </div>
            </button>
          `).join('')}
        </div>
      `;

      bindListEvents();
      return;
    }

    main.innerHTML = `
      <h1 class="main-title-order-history">Order History</h1>
      <div class="order-detail-view">
        <button type="button" class="back-btn">Back to Orders</button>

        <article class="order-card">
          <div class="order-header">
            <div>
              <h2 class="order-title">Order #${selectedOrder.id}</h2>
              <p class="order-date">${formatOrderDate(selectedOrder.date)}</p>
              <div class="order-date-status">
                <span class="order-status ${getOrderStatusClass(selectedOrder)}">${getOrderStatus(selectedOrder)}</span>
              </div>
            </div>
            <div class="order-total">${Number(selectedOrder.total || 0).toFixed(2)} €</div>
          </div>

          <div class="order-actions">
            ${canCancelOrder(selectedOrder)
              ? `<button type="button" class="cancel-order-btn" ${isCancellingOrder ? 'disabled' : ''}>${isCancellingOrder ? 'Cancelling...' : 'Cancel Order'}</button>`
              : ''}
            ${cancelSuccessMessage ? `<p class="order-feedback success">${cancelSuccessMessage}</p>` : ''}
            ${cancelErrorMessage ? `<p class="order-feedback error">${cancelErrorMessage}</p>` : ''}
          </div>

          <div class="order-customer">
            <p><strong>Name:</strong> ${selectedOrder.customerName || '-'}</p>
            <p><strong>Email:</strong> ${selectedOrder.email || '-'}</p>
            <p><strong>Address:</strong> ${selectedOrder.address || '-'}</p>
            <p><strong>Delivery:</strong> ${selectedOrder.deliveryLabel || selectedOrder.deliveryMethod || '-'}</p>
            <p><strong>Payment:</strong> ${selectedOrder.paymentLabel || selectedOrder.paymentMethod || '-'}</p>
            ${selectedOrder.pickupPoint ? `<p><strong>Pickup point:</strong> ${selectedOrder.pickupPoint}</p>` : ''}
          </div>

          <div class="order-items">
            ${(selectedOrder.items || []).map((item) => `
              <div class="order-item">
                <div class="order-item-main">
                  ${getOrderItemImage(item) ? `<img src="${getOrderItemImage(item)}" alt="${item.name}" class="order-item-image" />` : ''}
                  <div class="order-item-info">
                    <span>${item.name}</span>
                    <small>Qty: ${item.quantity}</small>
                  </div>
                </div>
                <span>${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} €</span>
              </div>
            `).join('')}
          </div>
        </article>
      </div>
    `;

    bindDetailEvents(selectedOrder);
  };

  Promise.all([
    loadProductsFromDatabase(),
    loadOrdersFromFirestore()
  ]).finally(() => {
    render();
  });

  return main;
}