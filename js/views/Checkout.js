import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
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
  let currentStep = 1;

  const pickupPoints = [
    'Z-BOX Bratislava Central',
    'Packeta Košice - Hlavná 12',
    'Parcel Locker Žilina - Aupark',
    'Packeta Nitra - Mlyny'
  ];

  const formData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    deliveryMethod: 'home',
    pickupPoint: '',
    paymentMethod: 'card',
    cardName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  };

  const PHONE_REGEX = /^\+?(?:[0-9]|\s|\(|\)|-){7,20}$/;
  const CARD_NUMBER_REGEX = /^\d{16}$/;
  const EXPIRY_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;
  const CVV_REGEX = /^\d{3,4}$/;

  const setCheckoutError = (message) => {
    checkoutError = message;
    return false;
  };

  const getDeliveryLabel = () => (formData.deliveryMethod === 'home'
    ? 'Home Delivery'
    : formData.deliveryMethod === 'pickup'
      ? 'Pickup at Store'
      : 'Pickup Point');

  const getPaymentLabel = () => (formData.paymentMethod === 'card'
    ? 'Card'
    : formData.paymentMethod === 'cash'
      ? (formData.deliveryMethod === 'pickup' ? 'Cash at Pickup' : 'Cash on Delivery')
      : formData.paymentMethod === 'bankTransfer'
        ? 'Bank Transfer'
        : 'Google Pay');

  const isValidPhoneNumber = (value) => PHONE_REGEX.test(String(value || '').trim());

  const isCardExpired = (expiryValue) => {
    const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiryValue);
    if (!expiryMatch) {
      return true;
    }

    const expiryMonth = Number(expiryMatch[1]);
    const expiryYear = 2000 + Number(expiryMatch[2]);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth);
  };

  const applyDeliveryRules = () => {
    if (formData.deliveryMethod === 'pickupPoint' && formData.paymentMethod === 'cash') {
      formData.paymentMethod = 'card';
    }

    if (formData.deliveryMethod !== 'pickupPoint') {
      formData.pickupPoint = '';
    }
  };

  const validateCardFields = () => {
    const normalizedCardNumber = String(formData.cardNumber || '').replace(/\s+/g, '');
    if (!CARD_NUMBER_REGEX.test(normalizedCardNumber)) {
      return setCheckoutError('Card number must contain exactly 16 digits.');
    }

    const normalizedExpiryDate = String(formData.expiryDate || '').trim();
    if (!EXPIRY_REGEX.test(normalizedExpiryDate)) {
      return setCheckoutError('Expiry date must be in MM/YY format.');
    }

    if (isCardExpired(normalizedExpiryDate)) {
      return setCheckoutError('Card is expired.');
    }

    if (!CVV_REGEX.test(String(formData.cvv || '').trim())) {
      return setCheckoutError('CVV must be 3 or 4 digits.');
    }

    return true;
  };

  const validateCheckoutBeforeSubmit = () => {
    if (!isValidPhoneNumber(formData.phone)) {
      return setCheckoutError('Enter a valid phone number.');
    }

    if (formData.paymentMethod === 'card') {
      return validateCardFields();
    }

    return true;
  };

  const validateCurrentStep = () => {
    checkoutError = '';

    const form = main.querySelector('.checkout-form');
    if (form && !form.reportValidity()) {
      return false;
    }

    const stepValidators = {
      1: () => isValidPhoneNumber(formData.phone) || setCheckoutError('Enter a valid phone number.'),
      2: () => formData.deliveryMethod !== 'pickupPoint' || !!formData.pickupPoint || setCheckoutError('Select a pickup point.'),
      3: () => formData.paymentMethod !== 'card' || validateCardFields(),
      4: () => true
    };

    return (stepValidators[currentStep] || (() => true))();
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

    const deliveryLabel = getDeliveryLabel();
    const paymentLabel = getPaymentLabel();

    const order = {
      userId: authStore.currentUser.uid,
      createdAt: serverTimestamp(),
      status: 'Created',
      customerName: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      address: `${formData.address}, ${formData.city}, ${formData.postalCode}, ${formData.country}`,
      deliveryMethod: formData.deliveryMethod,
      deliveryLabel,
      pickupPoint: formData.deliveryMethod === 'pickupPoint' ? formData.pickupPoint : null,
      paymentMethod: formData.paymentMethod,
      paymentLabel,
      items: validatedItems,
      total: recomputedTotal
    };

    await addDoc(collection(db, 'orders'), order);
  };

  const nextStep = () => {
    if (!validateCurrentStep()) {
      render();
      return;
    }

    if (currentStep < 4) {
      currentStep += 1;
      render();
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      currentStep -= 1;
      render();
    }
  };

  const editOrder = () => {
    currentStep = 3;
    render();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    checkoutError = '';

    if (!validateCheckoutBeforeSubmit()) {
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
    const textFields = [
      'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode', 'country',
      'cardName', 'cardNumber', 'expiryDate', 'cvv'
    ];

    textFields.forEach((field) => {
      const input = main.querySelector(`#${field}`);
      if (!input) {
        return;
      }

      input.value = formData[field] || '';
      input.addEventListener('input', (event) => {
        formData[field] = event.target.value;
      });
    });

    const pickupPointSelect = main.querySelector('#pickupPointName');
    if (pickupPointSelect) {
      pickupPointSelect.value = formData.pickupPoint;
      pickupPointSelect.addEventListener('change', (event) => {
        formData.pickupPoint = event.target.value;
      });
    }

    main.querySelectorAll('input[name="deliveryMethod"]').forEach((radio) => {
      radio.checked = radio.value === formData.deliveryMethod;
      radio.addEventListener('change', (event) => {
        formData.deliveryMethod = event.target.value;
        applyDeliveryRules();
        render();
      });
    });

    main.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
      radio.checked = radio.value === formData.paymentMethod;
      radio.addEventListener('change', (event) => {
        formData.paymentMethod = event.target.value;
        render();
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
        ${checkoutError ? `<p class="checkout-error">${checkoutError}</p>` : ''}

        <div class="step-indicator" aria-label="Checkout steps">
          <div class="step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}">
            <span class="step-number">1</span>
            <span class="step-text">Details</span>
          </div>
          <div class="step-line ${currentStep > 1 ? 'active' : ''}"></div>
          <div class="step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}">
            <span class="step-number">2</span>
            <span class="step-text">Delivery</span>
          </div>
          <div class="step-line ${currentStep > 2 ? 'active' : ''}"></div>
          <div class="step-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}">
            <span class="step-number">3</span>
            <span class="step-text">Payment</span>
          </div>
          <div class="step-line ${currentStep > 3 ? 'active' : ''}"></div>
          <div class="step-item ${currentStep === 4 ? 'active' : ''}">
            <span class="step-number">4</span>
            <span class="step-text">Recap</span>
          </div>
        </div>

        <form class="checkout-form">
          ${currentStep === 1 ? `
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
                <input id="phone" type="tel" pattern="^\\+?(?:[0-9]|\\s|\\(|\\)|-){7,20}$" title="Enter a valid phone number" required ${isProcessing ? 'disabled' : ''} />
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

          <div class="form-actions">
            <button type="button" class="cancel-btn go-cart-btn" ${isProcessing ? 'disabled' : ''}>Back to Cart</button>
            <button type="button" class="submit-btn next-step-btn" ${cartItems.length === 0 ? 'disabled' : ''}>Continue to Delivery</button>
          </div>
          ` : ''}

          ${currentStep === 2 ? `
          <section class="form-section">
            <h2>Delivery Method</h2>
            <div class="radio-group">
              <div class="radio-option">
                <input id="homeDelivery" name="deliveryMethod" type="radio" value="home" ${isProcessing ? 'disabled' : ''} />
                <label for="homeDelivery">Home Delivery</label>
              </div>
              <div class="radio-option">
                <input id="pickup" name="deliveryMethod" type="radio" value="pickup" ${isProcessing ? 'disabled' : ''} />
                <label for="pickup">Pickup at Store</label>
              </div>
              <div class="radio-option">
                <input id="pickupPoint" name="deliveryMethod" type="radio" value="pickupPoint" ${isProcessing ? 'disabled' : ''} />
                <label for="pickupPoint">Pickup Point</label>
              </div>
            </div>

            ${formData.deliveryMethod === 'pickupPoint' ? `
            <div class="pickup-point-field">
              <label for="pickupPointName">Pickup Point *</label>
              <select id="pickupPointName" ${isProcessing ? 'disabled' : ''} required>
                <option value="" disabled ${!formData.pickupPoint ? 'selected' : ''}>Select pickup point</option>
                ${pickupPoints.map((point) => `<option value="${point}">${point}</option>`).join('')}
              </select>
            </div>
            ` : ''}
          </section>

          <div class="form-actions">
            <button type="button" class="cancel-btn prev-step-btn" ${isProcessing ? 'disabled' : ''}>Back</button>
            <button type="button" class="submit-btn next-step-btn" ${cartItems.length === 0 ? 'disabled' : ''}>Continue to Payment</button>
          </div>
          ` : ''}

          ${currentStep === 3 ? `
          <section class="form-section">
            <h2>Payment Method</h2>
            <div class="radio-group">
              <div class="radio-option">
                <input id="cardPayment" name="paymentMethod" type="radio" value="card" ${isProcessing ? 'disabled' : ''} />
                <label for="cardPayment">Card</label>
              </div>
              ${formData.deliveryMethod !== 'pickupPoint' ? `
              <div class="radio-option">
                <input id="cashPayment" name="paymentMethod" type="radio" value="cash" ${isProcessing ? 'disabled' : ''} />
                <label for="cashPayment">${formData.deliveryMethod === 'pickup' ? 'Cash at Pickup' : 'Cash on Delivery'}</label>
              </div>
              ` : ''}
              <div class="radio-option">
                <input id="googlePayPayment" name="paymentMethod" type="radio" value="googlePay" ${isProcessing ? 'disabled' : ''} />
                <label for="googlePayPayment">Google Pay</label>
              </div>
              <div class="radio-option">
                <input id="bankTransferPayment" name="paymentMethod" type="radio" value="bankTransfer" ${isProcessing ? 'disabled' : ''} />
                <label for="bankTransferPayment">Bank Transfer</label>
              </div>
            </div>
          </section>

          ${formData.paymentMethod === 'googlePay' ? `
          <section class="form-section">
            <h2>Google Pay</h2>
            <div class="payment-note">
              <p>You can complete this payment securely with Google Pay after placing the order.</p>
            </div>
          </section>
          ` : ''}

          ${formData.paymentMethod === 'bankTransfer' ? `
          <section class="form-section">
            <h2>Bank Transfer Details</h2>
            <div class="payment-note">
              <p>After placing your order, transfer the total amount to:</p>
              <p><strong>Recipient:</strong> PC Shop s.r.o.</p>
              <p><strong>Bank:</strong> Tatra banka</p>
              <p><strong>IBAN:</strong> SK12 1100 0000 0029 4874 0012</p>
              <p><strong>Amount:</strong> ${cartStore.totalPrice.toFixed(2)} €</p>
              <p><strong>Variable symbol / Reference:</strong> Your order ID (shown after confirmation)</p>
              <p><strong>Payment deadline:</strong> within 3 days from placing the order</p>
              <p><strong>Processing:</strong> Your order will be processed after payment is received.</p>
            </div>
          </section>
          ` : ''}

          ${formData.paymentMethod === 'card' ? `
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
          ` : ''}

          <div class="form-actions">
            <button type="button" class="cancel-btn prev-step-btn" ${isProcessing ? 'disabled' : ''}>Back</button>
            <button type="button" class="submit-btn next-step-btn" ${cartItems.length === 0 ? 'disabled' : ''}>Review Order</button>
          </div>
          ` : ''}

          ${currentStep === 4 ? `
          <section class="form-section">
            <h2>Order Recap</h2>
            <div class="order-summary">
              <div class="summary-info recap-grid">
                <div class="recap-card">
                  <h3>Personal Information</h3>
                  <p>${formData.firstName} ${formData.lastName}</p>
                  <p>${formData.email}</p>
                  <p>${formData.phone}</p>
                </div>

                <div class="recap-card">
                  <h3>Shipping Address</h3>
                  <p>${formData.address}</p>
                  <p>${formData.city}, ${formData.postalCode}</p>
                  <p>${formData.country}</p>
                </div>

                <div class="recap-card">
                  <h3>Delivery & Payment</h3>
                  <p><strong>Delivery:</strong> ${getDeliveryLabel()}</p>
                  ${formData.deliveryMethod === 'pickupPoint' ? `<p><strong>Pickup point:</strong> ${formData.pickupPoint}</p>` : ''}
                  <p><strong>Payment:</strong> ${getPaymentLabel()}</p>
                </div>
              </div>

              <div class="recap-items">
                <h3>Items</h3>
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
              </div>
            </div>
          </section>

          <div class="form-actions">
            <button type="button" class="cancel-btn edit-order-btn" ${isProcessing ? 'disabled' : ''}>Back</button>
            <button type="submit" class="submit-btn" ${isProcessing || cartItems.length === 0 ? 'disabled' : ''}>
              ${isProcessing ? 'Processing...' : 'Confirm & Place Order'}
            </button>
          </div>
          ` : ''}
        </form>
      </div>
    `;

    applyDeliveryRules();
    bindInputs();

    main.querySelector('.checkout-form').addEventListener('submit', handleSubmit);
    main.querySelector('.go-cart-btn')?.addEventListener('click', () => {
      router.navigateTo('/cart');
    });

    main.querySelector('.next-step-btn')?.addEventListener('click', () => {
      nextStep();
    });

    main.querySelector('.prev-step-btn')?.addEventListener('click', () => {
      previousStep();
    });

    main.querySelector('.edit-order-btn')?.addEventListener('click', () => {
      editOrder();
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
