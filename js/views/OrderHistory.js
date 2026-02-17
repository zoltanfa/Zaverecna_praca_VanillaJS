// OrderHistory View
const ORDER_STORAGE_KEY = 'orderHistory';

function loadOrders() {
  try {
    const savedOrders = localStorage.getItem(ORDER_STORAGE_KEY);
    return savedOrders ? JSON.parse(savedOrders) : [];
  } catch (error) {
    console.error('Failed to load order history:', error);
    return [];
  }
}

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

export function renderOrderHistory() {
  const main = document.createElement('main');
  main.className = 'main';
  
  const orders = loadOrders();
  
  if (orders.length === 0) {
    main.innerHTML = `
      <h1 class="main-title">Order History</h1>
      <div class="empty-state">
        <p>You have no previous orders.</p>
        <a href="#/products" class="shop-link" data-link>Start Shopping</a>
      </div>
    `;
  } else {
    main.innerHTML = `
      <h1 class="main-title">Order History</h1>
      <div class="orders-list"></div>
    `;
    
    const ordersList = main.querySelector('.orders-list');
    
    orders.forEach(order => {
      const orderCard = document.createElement('article');
      orderCard.className = 'order-card';
      
      orderCard.innerHTML = `
        <div class="order-header">
          <div>
            <h2 class="order-title">Order #${order.id}</h2>
            <p class="order-date">${formatOrderDate(order.date)}</p>
          </div>
          <div class="order-total">${order.total.toFixed(2)} €</div>
        </div>

        <div class="order-customer">
          <p><strong>Name:</strong> ${order.customerName}</p>
          <p><strong>Email:</strong> ${order.email}</p>
          <p><strong>Address:</strong> ${order.address}</p>
        </div>

        <div class="order-items">
          ${order.items.map(item => `
            <div class="order-item">
              <span>${item.name} x ${item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)} €</span>
            </div>
          `).join('')}
        </div>
      `;
      
      ordersList.appendChild(orderCard);
    });
  }
  
  return main;
}