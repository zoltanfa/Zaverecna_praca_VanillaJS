// Header Component
import { cartStore } from '../stores/cartStore.js';
import { searchStore } from '../stores/searchStore.js';
import { router } from '../router.js';

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'header';
  
  const updateCartCount = () => {
    const cartCount = header.querySelector('.cart-count');
    const totalItems = cartStore.totalItems;
    
    if (totalItems > 0) {
      if (cartCount) {
        cartCount.textContent = totalItems;
      } else {
        const cartLink = header.querySelector('.cart-link');
        const countSpan = document.createElement('span');
        countSpan.className = 'cart-count';
        countSpan.textContent = totalItems;
        cartLink.appendChild(countSpan);
      }
    } else {
      if (cartCount) {
        cartCount.remove();
      }
    }
  };
  
  header.innerHTML = `
    <div class="header-container">
      <a href="#/" class="logo" data-link>PC Shop</a>
      <div class="search-container">
        <input type="text" placeholder="Search products..." class="search-input" value="${searchStore.getSearchTerm()}" />
      </div>
      <nav>
        <a href="#/" class="nav-link" data-link>Home</a>
        <a href="#/products" class="nav-link" data-link>Products</a>
        <a href="#/orders" class="nav-link" data-link>Orders</a>
        <a href="#/cart" class="nav-link cart-link" data-link>Cart</a>
      </nav>
    </div>
  `;
  
  // Initialize cart count
  updateCartCount();
  
  // Subscribe to cart changes
  cartStore.subscribe(() => {
    updateCartCount();
  });
  
  // Handle search input
  const searchInput = header.querySelector('.search-input');
  searchInput.addEventListener('input', (e) => {
    searchStore.setSearchTerm(e.target.value);
  });
  
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      router.navigateTo('/products');
    }
  });
  
  return header;
}