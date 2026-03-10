import { router } from './router.js';
import { createHeader } from './components/Header.js';
import { createFooter } from './components/Footer.js';
import { renderHome } from './views/Home.js';
import { renderProducts } from './views/Products.js';
import { renderProductDetail } from './views/ProductDetail.js';
import { renderCart } from './views/Cart.js';
import { renderCheckout } from './views/Checkout.js';
import { renderOrderHistory } from './views/OrderHistory.js';
import { renderLogin } from './views/Login.js';
import { renderRegister } from './views/Register.js';
import { renderProfile } from './views/Profile.js';
import { renderAdmin } from './views/Admin.js';
import { authStore } from './stores/authStore.js';
import { loadProductsFromDatabase } from './data/products.js';

const appContainer = document.getElementById('app');

const header = createHeader();
const footer = createFooter();

const contentContainer = document.createElement('div');
contentContainer.className = 'content';

appContainer.appendChild(header);
appContainer.appendChild(contentContainer);
appContainer.appendChild(footer);

appContainer.className = 'app';

router.addRoute('/', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderHome(route));
});

router.addRoute('/products', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderProducts(route));
});

router.addRoute('/product/:id', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderProductDetail(route));
});

router.addRoute('/cart', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderCart(route));
});

router.addRoute('/checkout', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderCheckout(route));
}, { requiresAuth: true });

router.addRoute('/orders', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderOrderHistory(route));
}, { requiresAuth: true });

router.addRoute('/login', () => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderLogin());
});

router.addRoute('/register', () => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderRegister());
});

router.addRoute('/profile', () => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderProfile());
}, { requiresAuth: true });

router.addRoute('/admin', () => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderAdmin());
}, { requiresAuth: true, requiresRole: 'admin' });

router.addBeforeEach(async (to) => {
  await authStore.waitForAuthInit();

  if (to.meta.requiresAuth && !authStore.currentUser) {
    return '/login';
  }

  if ((to.path === '/login' || to.path === '/register') && authStore.currentUser) {
    return '/';
  }

  if (to.meta.requiresRole === 'admin' && !authStore.isAdmin) {
    return '/';
  }

  return true;
});

authStore.initAuth();
loadProductsFromDatabase();
router.handleRoute();