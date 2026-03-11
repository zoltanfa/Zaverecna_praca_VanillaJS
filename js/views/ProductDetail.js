import { products } from '../data/products.js';
import { cartStore } from '../stores/cartStore.js';
import { router } from '../router.js';

export function renderProductDetail(route) {
  const main = document.createElement('main');
  main.className = 'main-product-detail';
  
  const productId = parseInt(route.params.id);
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    main.innerHTML = '<p>Product not found.</p>';
    return main;
  }
  
  const isAvailable = cartStore.isProductAvailable(product);

  main.innerHTML = `
    <div class="product-detail">
      <img src="${product.image}" alt="${product.name}" class="product-detail-image" />
      <div class="product-detail-info">
        <h1 class="product-detail-title">${product.name}</h1>
        <p class="product-detail-price">${product.price.toFixed(2)} €</p>
        <p class="stock-status ${isAvailable ? '' : 'out-of-stock'}">${isAvailable ? 'In stock' : 'Out of stock'}</p>
        <p class="product-detail-description">${product.description}</p>
        <button class="add-to-cart-btn-detail" ${isAvailable ? '' : 'disabled'}>${isAvailable ? '🛒 Add to Cart' : 'Unavailable'}</button>
        <button class="category-btn">Show ${product.category} Products</button>
      </div>
    </div>
  `;
  
  const addButton = main.querySelector('.add-to-cart-btn-detail');
  addButton.addEventListener('click', () => {
    cartStore.addToCart(product);
  });
  
  const categoryButton = main.querySelector('.category-btn');
  categoryButton.addEventListener('click', () => {
    router.navigateTo(`/products?category=${product.category}`);
  });
  
  return main;
}