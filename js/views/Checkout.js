import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { cartStore } from '../stores/cartStore.js';
import { router } from '../router.js';
import { db } from '../firebase.js';
import { loadProductsFromDatabase } from '../data/products.js';
import { authStore } from '../stores/authStore.js';

const CHECKOUT_PROCESSING_DELAY_MS = 2000;
const CHECKOUT_REDIRECT_DELAY_MS = 2000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function renderCheckout() {
  const main = document.createElement('main');
  main.className = 'main-checkout';

  let isSubmitted = false;
  let isProcessing = false;
  let checkoutError = '';

  const formData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: ''
  };

  const prefillCheckoutFromProfile = async () => {
    await authStore.waitForAuthInit();

    if (!authStore.currentUser) {
      return;
    }

    const firebaseUser = authStore.currentUser;
    const profile = await authStore.getUserProfile(firebaseUser.uid);
    const [firstName = '', ...lastNameParts] = String(firebaseUser.displayName || '').split(' ');

    formData.firstName = profile?.firstName || firstName;
    formData.lastName = profile?.lastName || lastNameParts.join(' ');
    formData.email = profile?.email || firebaseUser.email || '';
    formData.phone = profile?.phone || '';
    formData.address = profile?.address || '';
    formData.city = profile?.city || '';
    formData.postalCode = profile?.postalCode || '';
    formData.country = profile?.country || '';
  };

  const reserveStockForOrder = async () => {
    const cartItems = cartStore.getCart();

    return runTransaction(db, async (transaction) => {
      const productRefs = cartItems.map((cartItem) => ({
        cartItem,
        productRef: doc(db, 'products', String(cartItem.id))
      }));

      const productSnapshots = [];
      for (const entry of productRefs) {
        const productSnapshot = await transaction.get(entry.productRef);
        productSnapshots.push({
          ...entry,
          productSnapshot
        });
      }

      const validatedItems = [];
      let recomputedTotal = 0;
      const stockUpdates = [];

      for (const { cartItem, productRef, productSnapshot } of productSnapshots) {
        if (!productSnapshot.exists()) {
          throw new Error(`${cartItem.name} is no longer available.`);
        }

        const productData = productSnapshot.data();
        const currentStock = productData?.stock;
        const currentPrice = Number(productData?.price);

        if (Number.isNaN(currentPrice)) {
          throw new Error(`Product price is invalid for ${cartItem.name}.`);
        }

        validatedItems.push({
          id: cartItem.id,
          name: cartItem.name,
          price: currentPrice,
          quantity: cartItem.quantity
        });
        recomputedTotal += currentPrice * cartItem.quantity;

        if (typeof currentStock === 'number') {
          if (currentStock < cartItem.quantity) {
            throw new Error(`Not enough stock for ${cartItem.name}. Available: ${currentStock}.`);
          }

          stockUpdates.push({
            productRef,
            nextStock: currentStock - cartItem.quantity
          });
        }
      }

      for (const stockUpdate of stockUpdates) {
        transaction.update(stockUpdate.productRef, {
          stock: stockUpdate.nextStock
        });
      }

      return {
        validatedItems,
        recomputedTotal: Number(recomputedTotal.toFixed(2))
      };
    });
  };

  const saveOrder = async ({ validatedItems, recomputedTotal }) => {
    await authStore.waitForAuthInit();

    if (!authStore.currentUser) {
      throw new Error('You must be logged in to place an order.');
    }

    const order = {
      userId: authStore.currentUser.uid,
      createdAt: serverTimestamp(),
      status: 'Created',
      customerName: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      address: `${formData.address}, ${formData.city}, ${formData.postalCode}, ${formData.country}`,
      deliveryMethod: 'home',
      deliveryLabel: 'Home Delivery',
      paymentMethod: 'card',
      paymentLabel: 'Card',
      pickupPoint: null,
      items: validatedItems,
      total: recomputedTotal
    };

    await addDoc(collection(db, 'orders'), order);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    checkoutError = '';

    const form = main.querySelector('.checkout-form');
    if (!form.checkValidity()) {
      return;
    }

    isProcessing = true;
    render();

    await delay(CHECKOUT_PROCESSING_DELAY_MS);

    try {
      const checkoutValidation = await reserveStockForOrder();
      await saveOrder(checkoutValidation);
      await loadProductsFromDatabase(true);

      isSubmitted = true;
      isProcessing = false;
      render();

      setTimeout(() => {
        cartStore.clearCart();
        router.navigateTo('/');
      }, CHECKOUT_REDIRECT_DELAY_MS);
    } catch (error) {
      console.error('Failed to place order:', error);
      checkoutError = error?.message || 'Failed to place order. Please try again.';
      isProcessing = false;
      render();
    }
  };

  const bindInputs = () => {
    Object.keys(formData).forEach((key) => {
      const input = main.querySelector(`#${key}`);
      if (!input) {
        return;
      }

      input.value = formData[key];
      input.addEventListener('input', (event) => {
        formData[key] = event.target.value;
      });
    });
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

    const cartItems = cartStore.getCart();

    main.innerHTML = `
      <h1 class="main-title-checkout">Checkout</h1>
      <div class="checkout-container">
        ${checkoutError ? `<p class="checkout-warning">${checkoutError}</p>` : ''}
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
            <h2>Order Summary</h2>
            <div class="order-summary">
              ${cartItems.length === 0 ? `
                <div class="empty-cart-message">
                  <p>Your cart is empty. <a href="#/products" data-link>Continue shopping</a></p>
                </div>
              ` : `
                ${cartItems.map((item) => `
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
            <button type="submit" class="submit-btn" ${isProcessing || cartItems.length === 0 ? 'disabled' : ''}>
              ${isProcessing ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    `;

    bindInputs();

    main.querySelector('.checkout-form').addEventListener('submit', handleSubmit);
    main.querySelector('.cancel-btn').addEventListener('click', () => {
      router.navigateTo('/cart');
    });
  };

  prefillCheckoutFromProfile()
    .catch((error) => {
      console.error('Failed to prefill checkout form:', error);
    })
    .finally(() => {
      render();
    });

  return main;
}
