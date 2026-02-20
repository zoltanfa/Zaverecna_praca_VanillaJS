import { cartStore } from '../stores/cartStore.js';
import { router } from '../router.js';

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

function saveOrders(orders) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  } catch (error) {
    console.error('Failed to save order history:', error);
  }
}

export function renderCheckout() {
  const main = document.createElement('main');
  main.className = 'main-checkout';
  
  let isSubmitted = false;
  let isProcessing = false;
  
  const formData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    cardName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  };
  
  const render = () => {
    if (isSubmitted) {
      main.innerHTML = `
        <h1 class="main-title-checkout">Checkout</h1>
        <div class="success-message">
          <h2>Order Placed Successfully!</h2>
          <p>Thank you for your purchase. Redirecting to home page...</p>
        </div>
      `;
      return;
    }
    
    main.innerHTML = `
      <h1 class="main-title-checkout">Checkout</h1>
      <div class="checkout-container">
        <form class="checkout-form">
          <section class="form-section">
            <h2>Personal Information</h2>
            <div class="form-grid">
              <div class="form-group">
                <label for="firstName">First Name *</label>
                <input id="firstName" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="lastName">Last Name *</label>
                <input id="lastName" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="email">Email *</label>
                <input id="email" type="email" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="phone">Phone Number *</label>
                <input id="phone" type="tel" required ${isProcessing ? 'disabled' : ''} />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2>Shipping Address</h2>
            <div class="form-grid">
              <div class="form-group">
                <label for="address">Street Address *</label>
                <input id="address" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="city">City *</label>
                <input id="city" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="postalCode">Postal Code *</label>
                <input id="postalCode" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="country">Country *</label>
                <input id="country" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2>Payment Information</h2>
            <div class="form-grid">
              <div class="form-group full-width">
                <label for="cardName">Cardholder Name *</label>
                <input id="cardName" type="text" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group full-width">
                <label for="cardNumber">Card Number *</label>
                <input id="cardNumber" type="text" maxlength="16" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="expiryDate">Expiry Date (MM/YY) *</label>
                <input id="expiryDate" type="text" maxlength="5" required ${isProcessing ? 'disabled' : ''} />
              </div>
              <div class="form-group">
                <label for="cvv">CVV *</label>
                <input id="cvv" type="text" maxlength="3" required ${isProcessing ? 'disabled' : ''} />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2>Order Summary</h2>
            <div class="order-summary">
              ${cartStore.getCart().length === 0 ? `
                <div class="empty-cart-message">
                  <p>Your cart is empty. <a href="#/products">Continue shopping</a></p>
                </div>
              ` : `
                ${cartStore.getCart().map(item => `
                  <div class="summary-item">
                    <span>${item.name} x ${item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                `).join('')}
                <div class="summary-total">
                  <strong>Total:</strong>
                  <strong>${cartStore.totalPrice.toFixed(2)} €</strong>
                </div>
              `}
            </div>
          </section>

          <div class="form-actions">
            <button type="button" class="cancel-btn" ${isProcessing ? 'disabled' : ''}>Back to Cart</button>
            <button type="submit" class="submit-btn" ${isProcessing || cartStore.getCart().length === 0 ? 'disabled' : ''}>
              ${isProcessing ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    `;
    
    Object.keys(formData).forEach(key => {
      const input = main.querySelector(`#${key}`);
      if (input) {
        input.value = formData[key];
        input.addEventListener('input', (e) => {
          formData[key] = e.target.value;
        });
      }
    });
    
    const form = main.querySelector('.checkout-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!form.checkValidity()) {
        return;
      }
      
      isProcessing = true;
      render();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const orders = loadOrders();
      const order = {
        id: Date.now(),
        date: new Date().toISOString(),
        customerName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        address: `${formData.address}, ${formData.city}, ${formData.postalCode}, ${formData.country}`,
        items: cartStore.getCart().map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total: cartStore.totalPrice
      };
      
      orders.unshift(order);
      saveOrders(orders);
      
      isSubmitted = true;
      isProcessing = false;
      render();
      
      setTimeout(() => {
        cartStore.clearCart();
        router.navigateTo('/');
      }, 2000);
    });
    
    const backBtn = main.querySelector('.cancel-btn');
    backBtn.addEventListener('click', () => {
      router.navigateTo('/cart');
    });
  };
  
  render();
  
  return main;
}