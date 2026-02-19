import { cartStore } from '../stores/cartStore.js';

export function renderCart() {
  const main = document.createElement('main');
  main.className = 'main-cart';
  
  const render = () => {
    const cart = cartStore.getCart();
    
    main.innerHTML = `
      <h1 class="main-title-cart">Shopping Cart</h1>
      ${cart.length === 0 ? `
        <div class="empty-cart">
          <p>Your cart is empty.</p>
          <a href="#/products" class="shop-link" data-link>Continue Shopping</a>
        </div>
      ` : `
        <div class="cart-content">
          <div class="cart-items"></div>
          <div class="cart-summary">
            <div class="summary-row">
              <span>Total Items:</span>
              <span>${cartStore.totalItems}</span>
            </div>
            <div class="summary-row total">
              <span>Total Price:</span>
              <span>${cartStore.totalPrice.toFixed(2)} €</span>
            </div>
            <div class="cart-actions">
              <button class="clear-cart-btn">Clear Cart</button>
              <a href="#/checkout" class="checkout-btn" data-link>Proceed to Checkout</a>
            </div>
          </div>
        </div>
      `}
    `;
    
    if (cart.length > 0) {
      const cartItems = main.querySelector('.cart-items');
      
      cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        cartItem.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="cart-item-image" />
          <div class="cart-item-details">
            <h3 class="cart-item-title">${item.name}</h3>
            <p class="cart-item-price">${item.price.toFixed(2)} €</p>
          </div>
          <div class="cart-item-controls">
            <div class="quantity-controls">
              <button class="quantity-btn minus-btn">-</button>
              <span class="quantity">${item.quantity}</span>
              <button class="quantity-btn plus-btn">+</button>
            </div>
            <p class="item-total">${(item.price * item.quantity).toFixed(2)} €</p>
            <button class="remove-btn">Remove</button>
          </div>
        `;
        
        const minusBtn = cartItem.querySelector('.minus-btn');
        const plusBtn = cartItem.querySelector('.plus-btn');
        const removeBtn = cartItem.querySelector('.remove-btn');
        
        minusBtn.addEventListener('click', () => {
          cartStore.updateQuantity(item.id, item.quantity - 1);
        });
        
        plusBtn.addEventListener('click', () => {
          cartStore.updateQuantity(item.id, item.quantity + 1);
        });
        
        removeBtn.addEventListener('click', () => {
          cartStore.removeFromCart(item.id);
        });
        
        cartItems.appendChild(cartItem);
      });
      
      const clearBtn = main.querySelector('.clear-cart-btn');
      clearBtn.addEventListener('click', () => {
        cartStore.clearCart();
      });
    }
  };
  
  render();
  
  cartStore.subscribe(() => render());
  
  return main;
}