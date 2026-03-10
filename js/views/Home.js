import { products, subscribeProducts } from '../data/products.js';
import { createProductCard } from '../components/ProductCard.js';
import { searchStore } from '../stores/searchStore.js';

export function renderHome() {
  const main = document.createElement('main');
  main.className = 'main-home';
  
  const render = () => {
    const searchTerm = searchStore.getSearchTerm().toLowerCase();
    let featuredProducts = products.filter(product => [1, 2, 6, 11, 16, 21].includes(product.id));
    
    if (searchTerm) {
      featuredProducts = featuredProducts
        .map((product) => ({
          product,
          score: searchStore.getSearchScore(product, searchTerm)
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.product);
    }
    
    main.innerHTML = `
      <h1 class="main-title-home">Welcome to PC Component Shop</h1>
      <p class="main-description">Find the best PC components for your build.</p>
      <section class="featured-section">
        <h2 class="section-title">Featured Products</h2>
        <div class="product-grid"></div>
      </section>
    `;
    
    const grid = main.querySelector('.product-grid');
    featuredProducts.forEach(product => {
      grid.appendChild(createProductCard(product));
    });
  };
  
  render();
  
  searchStore.subscribe(() => render());
  subscribeProducts(() => render());
  
  return main;
}