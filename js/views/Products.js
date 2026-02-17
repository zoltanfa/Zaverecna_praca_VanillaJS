// Products View
import { products } from '../data/products.js';
import { createProductCard } from '../components/ProductCard.js';
import { searchStore } from '../stores/searchStore.js';

export function renderProducts(route) {
  const main = document.createElement('main');
  main.className = 'main';
  
  const availableCategories = [
    'CPU',
    'GPU', 
    'Motherboard',
    'RAM',
    'Storage',
    'PSU',
    'Case'
  ];
  
  let selectedCategories = [];
  
  // Check if category was passed in query
  if (route.query.category) {
    selectedCategories = [route.query.category];
  }
  
  const render = () => {
    const searchTerm = searchStore.getSearchTerm().toLowerCase();
    let filtered = products;
    
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product => selectedCategories.includes(product.category));
    }
    
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm)
      );
    }
    
    main.innerHTML = `
      <h1 class="main-title">All Products</h1>
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
    
    // Render category filters
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
    
    // Render products
    const grid = main.querySelector('.product-grid');
    filtered.forEach(product => {
      grid.appendChild(createProductCard(product));
    });
  };
  
  render();
  
  // Re-render when search changes
  searchStore.subscribe(() => render());
  
  return main;
}