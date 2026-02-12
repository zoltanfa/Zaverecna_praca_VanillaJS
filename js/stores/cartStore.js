// Cart Store - Manages shopping cart state with localStorage persistence
class CartStore {
  constructor() {
    this.STORAGE_KEY = 'cart';
    this.cart = this.loadFromStorage();
    this.listeners = new Set();
  }

  // Load cart from localStorage
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      return [];
    }
  }

  // Save cart to localStorage
  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cart));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }

  // Subscribe to cart changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of cart changes
  notify() {
    this.listeners.forEach(listener => listener(this.cart));
  }

  // Add product to cart
  addToCart(product) {
    const existingItemIndex = this.cart.findIndex(item => item.id === product.id);
    
    if (existingItemIndex > -1) {
      this.cart[existingItemIndex].quantity += 1;
    } else {
      this.cart.push({
        ...product,
        quantity: 1
      });
    }
    
    this.saveToStorage();
    this.notify();
  }

  // Remove product from cart
  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.saveToStorage();
    this.notify();
  }

  // Update product quantity
  updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }
    
    const item = this.cart.find(item => item.id === productId);
    if (item) {
      item.quantity = quantity;
      this.saveToStorage();
      this.notify();
    }
  }

  // Clear entire cart
  clearCart() {
    this.cart = [];
    this.saveToStorage();
    this.notify();
  }

  // Get total number of items
  get totalItems() {
    return this.cart.reduce((total, item) => total + item.quantity, 0);
  }

  // Get total price
  get totalPrice() {
    return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  // Get cart items
  getCart() {
    return this.cart;
  }
}

// Export singleton instance
export const cartStore = new CartStore();