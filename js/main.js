import { router } from './router.js';
import { createHeader } from './components/Header.js';
import { createFooter } from './components/Footer.js';
import { renderHome } from './views/Home.js';
import { renderProducts } from './views/Products.js';
import { renderProductDetail } from './views/ProductDetail.js';
import { renderCart } from './views/Cart.js';
import { renderCheckout } from './views/Checkout.js';
import { renderOrderHistory } from './views/OrderHistory.js';

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
});

router.addRoute('/orders', (route) => {
  contentContainer.innerHTML = '';
  contentContainer.appendChild(renderOrderHistory(route));
});

router.handleRoute();