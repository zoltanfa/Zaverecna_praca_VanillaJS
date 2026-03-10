import { cartStore } from '../stores/cartStore.js';

export function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  const isAvailable = cartStore.isProductAvailable(product);
  const stockLabel = isAvailable ? 'In stock' : 'Out of stock';
  
  card.innerHTML = `
    <a href="#/product/${product.id}" class="product-link" data-link>
      <img src="${product.image}" alt="${product.name}" class="product-image" />
      <h3 class="product-title">${product.name}</h3>
    </a>
    <div class="product-footer">
      <p class="product-price">${product.price.toFixed(2)} €</p>
      <p class="stock-status ${isAvailable ? '' : 'out-of-stock'}">${stockLabel}</p>
      <button class="add-to-cart-btn-card" ${isAvailable ? '' : 'disabled'}>${isAvailable ? '🛒 Add to Cart' : 'Unavailable'}</button>
    </div>
  `;
  
  const addButton = card.querySelector('.add-to-cart-btn-card');
  addButton.addEventListener('click', () => {
    cartStore.addToCart(product);
  });
  
  return card;
}