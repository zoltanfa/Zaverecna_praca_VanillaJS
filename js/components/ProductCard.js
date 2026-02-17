// ProductCard Component
import { cartStore } from '../stores/cartStore.js';

export function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  
  card.innerHTML = `
    <a href="#/product/${product.id}" class="product-link" data-link>
      <img src="${product.image}" alt="${product.name}" class="product-image" />
      <h3 class="product-title">${product.name}</h3>
    </a>
    <div class="product-footer">
      <p class="product-price">${product.price} €</p>
      <button class="add-to-cart-btn-card">🛒 Add to Cart</button>
    </div>
  `;
  
  // Add event listener for add to cart button
  const addButton = card.querySelector('.add-to-cart-btn-card');
  addButton.addEventListener('click', () => {
    cartStore.addToCart(product);
  });
  
  return card;
}