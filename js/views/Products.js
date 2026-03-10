import { products, subscribeProducts } from '../data/products.js';
import { createProductCard } from '../components/ProductCard.js';
import { searchStore } from '../stores/searchStore.js';

export function renderProducts(route) {
  const main = document.createElement('main');
  main.className = 'main-products';
  
  let selectedCategories = [];
  
  if (route.query.category) {
    selectedCategories = [route.query.category];
  }
  
  const render = () => {
    const availableCategories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const searchTerm = searchStore.getSearchTerm().toLowerCase();
    let filtered = products;
    
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product => selectedCategories.includes(product.category));
    }
    
    if (searchTerm) {
      filtered = filtered
        .map((product) => ({
          product,
          score: searchStore.getSearchScore(product, searchTerm)
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.product);
    }
    
    main.innerHTML = `
      <h1 class="main-title-products">All Products</h1>
      <div class="content">
        <aside class="filters">
          <h2 class="filters-title">Filter by Category</h2>
          <div class="filter-options"></div>
        </aside>
        <div class="products-section">
          <div class="product-grid"></div>
        </div>
      </div>
    `;
    
    const filterOptions = main.querySelector('.filter-options');
    availableCategories.forEach(category => {
      const label = document.createElement('label');
      label.className = 'filter-option';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = category;
      checkbox.checked = selectedCategories.includes(category);
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedCategories.push(category);
        } else {
          selectedCategories = selectedCategories.filter(c => c !== category);
        }
        render();
      });
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(category));
      filterOptions.appendChild(label);
    });
    
    const grid = main.querySelector('.product-grid');
    filtered.forEach(product => {
      grid.appendChild(createProductCard(product));
    });
  };
  
  render();
  
  searchStore.subscribe(() => render());
  subscribeProducts(() => render());
  
  return main;
}