// ProductDetail View
import { products } from '../data/products.js';
import { cartStore } from '../stores/cartStore.js';
import { router } from '../router.js';

export function renderProductDetail(route) {
  const main = document.createElement('main');
  main.className = 'main';
  
  const productId = parseInt(route.params.id);
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    main.innerHTML = '<p>Product not found.</p>';
    return main;
  }
  
  main.innerHTML = `
    <div class="product-detail">
      <img src="${product.image}" alt="${product.name}" class="product-detail-image" />
      <div class="product-detail-info">
        <h1 class="product-detail-title">${product.name}</h1>
        <p class="product-detail-price">${product.price} €</p>
        <p class="product-detail-description">${product.description}</p>
        <button class="add-to-cart-btn">🛒 Add to Cart</button>
        <button class="category-btn">Show ${product.category} Products</button>
      </div>
    </div>
  `;
  
  // Add to cart button
  const addButton = main.querySelector('.add-to-cart-btn');
  addButton.addEventListener('click', () => {
    cartStore.addToCart(product);
  });
  
  // Category button
  const categoryButton = main.querySelector('.category-btn');
  categoryButton.addEventListener('click', () => {
    router.navigateTo(`/products?category=${product.category}`);
  });
  
  return main;
}
