import { cartStore } from '../stores/cartStore.js';
import { searchStore } from '../stores/searchStore.js';
import { router } from '../router.js';
import { authStore } from '../stores/authStore.js';

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'header';
  let accountMenuOpen = false;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const closeAccountMenu = () => {
    accountMenuOpen = false;
    renderHeader();
  };

  const toggleAccountMenu = () => {
    accountMenuOpen = !accountMenuOpen;
    renderHeader();
  };

  const renderAccountDropdown = () => {
    const user = authStore.currentUser;

    if (user) {
      const adminLink = authStore.isAdmin
        ? '<a href="#/admin" class="account-link" data-link data-account-link>Admin</a>'
        : '';

      return `
        <div class="account-menu">
          <button type="button" class="account-btn" aria-label="Account menu">Account</button>
          ${accountMenuOpen ? `
            <div class="account-dropdown">
              ${adminLink}
              <a href="#/profile" class="account-link" data-link data-account-link>Profile</a>
              <button type="button" class="account-link account-action logout-btn">Logout</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="account-menu">
        <button type="button" class="account-btn" aria-label="Account menu">Account</button>
        ${accountMenuOpen ? `
          <div class="account-dropdown">
            <a href="#/login" class="account-link" data-link data-account-link>Login</a>
            <a href="#/register" class="account-link" data-link data-account-link>Register</a>
          </div>
        ` : ''}
      </div>
    `;
  };

  const renderNavLinks = () => {
    return `
        <a href="#/orders" class="nav-link" data-link>Orders</a>
        <a href="#/cart" class="nav-link cart-link" data-link>Cart</a>
        ${renderAccountDropdown()}
    `;
  };

  const renderHeader = () => {
    header.innerHTML = `
      <div class="header-container">
        <a href="#/" class="logo" data-link>PC Shop</a>
        <div class="search-container">
          <input type="text" placeholder="Search products..." class="search-input" value="${escapeHtml(searchStore.getSearchTerm())}" />
        </div>
        <nav>
          <a href="#/" class="nav-link" data-link>Home</a>
          <a href="#/products" class="nav-link" data-link>Products</a>
          ${renderNavLinks()}
        </nav>
      </div>
    `;

    const searchInput = header.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
      searchStore.setSearchTerm(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        router.navigateTo('/products');
      }
    });

    const accountButton = header.querySelector('.account-btn');
    if (accountButton) {
      accountButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleAccountMenu();
      });
    }

    header.querySelectorAll('[data-account-link]').forEach((link) => {
      link.addEventListener('click', () => {
        closeAccountMenu();
      });
    });

    const logoutButton = header.querySelector('.logout-btn');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        try {
          await authStore.logout();
          accountMenuOpen = false;
          router.navigateTo('/');
        } catch (error) {
          console.error('Logout failed:', error);
        }
      });
    }

    updateCartCount();
  };
  
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
  
  renderHeader();

  cartStore.subscribe(() => {
    updateCartCount();
  });

  authStore.subscribe(() => {
    renderHeader();
  });

  document.addEventListener('click', (event) => {
    if (!accountMenuOpen) {
      return;
    }

    if (!event.target.closest('.account-menu')) {
      closeAccountMenu();
    }
  });
  
  return header;
}