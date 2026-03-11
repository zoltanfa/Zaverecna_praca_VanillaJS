import { products, subscribeProducts } from '../data/products.js';
import { createProductCard } from '../components/ProductCard.js';
import { searchStore } from '../stores/searchStore.js';

export function renderProducts(route) {
  const main = document.createElement('main');
  main.className = 'main-products';

  let selectedCategory = route.query.category || '';
  let selectedSubcategories = [];
  let selectedBrands = [];
  let selectedSockets = [];
  let selectedGpuModels = [];
  let selectedRamSizes = [];
  let selectedStorageFormats = [];
  let selectedPsuWattages = [];
  let selectedCaseFormFactors = [];
  let selectedSort = 'oldest';
  let currentPage = 1;
  let selectedMinPrice = 0;
  let selectedMaxPrice = 0;

  const socketCategories = ['CPU', 'Motherboard'];
  const gpuCategory = 'GPU';
  const ramCategory = 'RAM';
  const storageCategory = 'Storage';
  const psuCategory = 'PSU';
  const caseCategory = 'Case';

  const getProductSubcategory = (product) => product.subcategory;
  const getProductBrand = (product) => product.brand || String(product.name || '').split(' ')[0];
  const getGpuModelDesignation = (product) => product.model;
  const getRamSize = (product) => product.size;
  const getStorageFormat = (product) => product.format;
  const getPsuWattage = (product) => product.wattage;
  const getCaseFormFactors = (product) => (Array.isArray(product.formFactors) ? product.formFactors : []);

  const uniqueValues = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))];

  const productsPerPage = () => {
    const width = window.innerWidth;

    if (width <= 480) {
      return 6;
    }

    if (width <= 768) {
      return 8;
    }

    if (width < 1095) {
      return 8;
    }

    return 9;
  };

  const getMinAvailablePrice = () => {
    if (products.length === 0) {
      return 0;
    }

    return Math.floor(Math.min(...products.map((product) => Number(product.price) || 0)));
  };

  const getMaxAvailablePrice = () => {
    if (products.length === 0) {
      return 0;
    }

    return Math.ceil(Math.max(...products.map((product) => Number(product.price) || 0)));
  };

  const syncPriceRange = () => {
    const minPrice = getMinAvailablePrice();
    const maxPrice = getMaxAvailablePrice();

    if (selectedMinPrice === 0 && selectedMaxPrice === 0) {
      selectedMinPrice = minPrice;
      selectedMaxPrice = maxPrice;
      return;
    }

    if (selectedMinPrice < minPrice || selectedMinPrice > maxPrice) {
      selectedMinPrice = minPrice;
    }

    if (selectedMaxPrice > maxPrice || selectedMaxPrice < minPrice) {
      selectedMaxPrice = maxPrice;
    }

    if (selectedMinPrice > selectedMaxPrice) {
      selectedMinPrice = selectedMaxPrice;
    }
  };

  const getAvailableSubcategories = () => {
    if (!selectedCategory) {
      return [];
    }

    const categoryFilteredProducts = products.filter((product) => product.category === selectedCategory);
    return uniqueValues(categoryFilteredProducts.map(getProductSubcategory));
  };

  const getAvailableBrands = () => {
    if (!selectedCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === selectedCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    return uniqueValues(filtered.map(getProductBrand));
  };

  const getAvailableGpuModels = () => {
    if (selectedCategory !== gpuCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === gpuCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.map(getGpuModelDesignation));
  };

  const getAvailableRamSizes = () => {
    if (selectedCategory !== ramCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === ramCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.map(getRamSize)).sort((a, b) => a - b);
  };

  const getAvailableStorageFormats = () => {
    if (selectedCategory !== storageCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === storageCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.map(getStorageFormat));
  };

  const getAvailablePsuWattages = () => {
    if (selectedCategory !== psuCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === psuCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.map(getPsuWattage)).sort((a, b) => a - b);
  };

  const getAvailableCaseFormFactors = () => {
    if (selectedCategory !== caseCategory) {
      return [];
    }

    let filtered = products.filter((product) => product.category === caseCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.flatMap(getCaseFormFactors));
  };

  const getAvailableSockets = () => {
    if (!socketCategories.includes(selectedCategory)) {
      return [];
    }

    let filtered = products.filter((product) => socketCategories.includes(product.category));
    filtered = filtered.filter((product) => product.category === selectedCategory);

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    return uniqueValues(filtered.map((product) => product.socket));
  };

  const syncFilterSelections = () => {
    const availableSubcategories = getAvailableSubcategories();
    selectedSubcategories = selectedSubcategories.filter((subcategory) => availableSubcategories.includes(subcategory));

    const availableBrands = getAvailableBrands();
    selectedBrands = selectedBrands.filter((brand) => availableBrands.includes(brand));

    const availableGpuModels = getAvailableGpuModels();
    selectedGpuModels = selectedGpuModels.filter((model) => availableGpuModels.includes(model));

    const availableRamSizes = getAvailableRamSizes();
    selectedRamSizes = selectedRamSizes.filter((size) => availableRamSizes.includes(size));

    const availableStorageFormats = getAvailableStorageFormats();
    selectedStorageFormats = selectedStorageFormats.filter((format) => availableStorageFormats.includes(format));

    const availablePsuWattages = getAvailablePsuWattages();
    selectedPsuWattages = selectedPsuWattages.filter((wattage) => availablePsuWattages.includes(wattage));

    const availableCaseFormFactors = getAvailableCaseFormFactors();
    selectedCaseFormFactors = selectedCaseFormFactors.filter((formFactor) => availableCaseFormFactors.includes(formFactor));

    const availableSockets = getAvailableSockets();
    selectedSockets = selectedSockets.filter((socket) => availableSockets.includes(socket));

    return {
      availableSubcategories,
      availableBrands,
      availableGpuModels,
      availableRamSizes,
      availableStorageFormats,
      availablePsuWattages,
      availableCaseFormFactors,
      availableSockets
    };
  };

  const toggleArrayValue = (array, value, enabled) => {
    if (enabled) {
      if (!array.includes(value)) {
        array.push(value);
      }
      return array;
    }

    return array.filter((item) => item !== value);
  };

  const getFilteredProducts = (searchTerm) => {
    let filtered = products;

    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    if (selectedSubcategories.length > 0) {
      filtered = filtered.filter((product) => selectedSubcategories.includes(getProductSubcategory(product)));
    }

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(getProductBrand(product)));
    }

    if (selectedGpuModels.length > 0) {
      filtered = filtered.filter((product) => {
        if (product.category !== gpuCategory) {
          return true;
        }
        return selectedGpuModels.includes(getGpuModelDesignation(product));
      });
    }

    if (selectedRamSizes.length > 0) {
      filtered = filtered.filter((product) => {
        if (product.category !== ramCategory) {
          return true;
        }
        return selectedRamSizes.includes(getRamSize(product));
      });
    }

    if (selectedStorageFormats.length > 0) {
      filtered = filtered.filter((product) => {
        if (product.category !== storageCategory) {
          return true;
        }
        return selectedStorageFormats.includes(getStorageFormat(product));
      });
    }

    if (selectedPsuWattages.length > 0) {
      filtered = filtered.filter((product) => {
        if (product.category !== psuCategory) {
          return true;
        }
        return selectedPsuWattages.includes(getPsuWattage(product));
      });
    }

    if (selectedCaseFormFactors.length > 0) {
      filtered = filtered.filter((product) => {
        if (product.category !== caseCategory) {
          return true;
        }

        return selectedCaseFormFactors.some((formFactor) => getCaseFormFactors(product).includes(formFactor));
      });
    }

    if (selectedSockets.length > 0) {
      filtered = filtered.filter((product) => {
        if (!socketCategories.includes(product.category)) {
          return true;
        }
        return selectedSockets.includes(product.socket);
      });
    }

    if (searchTerm) {
      filtered = filtered.filter((product) => searchStore.matchesFullTextSearch(product, searchTerm));
    }

    filtered = filtered.filter((product) => {
      const price = Number(product.price) || 0;
      return price >= selectedMinPrice && price <= selectedMaxPrice;
    });

    return filtered;
  };

  const getSortedProducts = (filteredProducts, searchTerm) => {
    const sorted = [...filteredProducts];
    const hasSearch = searchTerm.trim().length > 0;

    if (hasSearch) {
      const scoredProducts = sorted.map((product) => ({
        product,
        score: searchStore.getSearchScore(product, searchTerm)
      }));

      scoredProducts.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (selectedSort === 'price-asc') {
          return a.product.price - b.product.price;
        }

        if (selectedSort === 'price-desc') {
          return b.product.price - a.product.price;
        }

        if (selectedSort === 'newest') {
          return b.product.id - a.product.id;
        }

        return a.product.id - b.product.id;
      });

      return scoredProducts.map((entry) => entry.product);
    }

    if (selectedSort === 'newest') {
      return sorted.reverse();
    }

    if (selectedSort === 'oldest') {
      return sorted;
    }

    if (selectedSort === 'price-asc') {
      return sorted.sort((a, b) => a.price - b.price);
    }

    if (selectedSort === 'price-desc') {
      return sorted.sort((a, b) => b.price - a.price);
    }

    return sorted;
  };

  const render = () => {
    syncPriceRange();

    const availableCategories = uniqueValues(products.map((product) => product.category));
    const searchTerm = searchStore.getSearchTerm();

    const {
      availableSubcategories,
      availableBrands,
      availableGpuModels,
      availableRamSizes,
      availableStorageFormats,
      availablePsuWattages,
      availableCaseFormFactors,
      availableSockets
    } = syncFilterSelections();

    const filteredProducts = getFilteredProducts(searchTerm);
    const sortedProducts = getSortedProducts(filteredProducts, searchTerm);
    const totalPages = Math.max(1, Math.ceil(sortedProducts.length / productsPerPage()));

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    const start = (currentPage - 1) * productsPerPage();
    const end = start + productsPerPage();
    const paginatedProducts = sortedProducts.slice(start, end);
    const isSocketFilterVisible = socketCategories.includes(selectedCategory);
    const isGpuModelFilterVisible = selectedCategory === gpuCategory;
    const isRamSizeFilterVisible = selectedCategory === ramCategory;
    const isStorageFormatFilterVisible = selectedCategory === storageCategory;
    const isPsuWattageFilterVisible = selectedCategory === psuCategory;
    const isCaseFormFactorFilterVisible = selectedCategory === caseCategory;
    const minAvailablePrice = getMinAvailablePrice();
    const maxAvailablePrice = getMaxAvailablePrice();

    main.innerHTML = `
      <h1 class="main-title-products">All Products</h1>
      <div class="content">
        <aside class="filters">
          <h2 class="filters-title">Category</h2>
          <div class="filter-options js-category-options"></div>
          <div class="js-conditional-filters"></div>
          <h2 class="filters-title">Price</h2>
          <div class="price-filter">
            <label class="price-label">Min: ${selectedMinPrice.toFixed(2)} €</label>
            <input type="range" min="${minAvailablePrice}" max="${selectedMaxPrice}" step="1" value="${selectedMinPrice}" class="price-slider js-min-price" />
            <label class="price-label">Max: ${selectedMaxPrice.toFixed(2)} €</label>
            <input type="range" min="${selectedMinPrice}" max="${maxAvailablePrice}" step="1" value="${selectedMaxPrice}" class="price-slider js-max-price" />
            <p class="price-value">${selectedMinPrice.toFixed(2)} € - ${selectedMaxPrice.toFixed(2)} €</p>
          </div>
        </aside>
        <div class="products-section">
          <div class="sort-row">
            <label for="sort-select" class="sort-label">Sort by:</label>
            <select id="sort-select" class="sort-select js-sort-select">
              <option value="newest" ${selectedSort === 'newest' ? 'selected' : ''}>Newest</option>
              <option value="oldest" ${selectedSort === 'oldest' ? 'selected' : ''}>Oldest</option>
              <option value="price-asc" ${selectedSort === 'price-asc' ? 'selected' : ''}>Least expensive</option>
              <option value="price-desc" ${selectedSort === 'price-desc' ? 'selected' : ''}>Most expensive</option>
            </select>
          </div>
          <div class="product-grid js-product-grid"></div>
          <div class="pagination js-pagination" ${sortedProducts.length === 0 ? 'style="display:none"' : ''}></div>
        </div>
      </div>
    `;

    const categoryOptions = main.querySelector('.js-category-options');
    const conditionalFilters = main.querySelector('.js-conditional-filters');
    const productGrid = main.querySelector('.js-product-grid');
    const pagination = main.querySelector('.js-pagination');
    const sortSelect = main.querySelector('.js-sort-select');
    const minPriceInput = main.querySelector('.js-min-price');
    const maxPriceInput = main.querySelector('.js-max-price');

    const createCheckboxFilterGroup = (title, values, selectedValues, formatter = (value) => value) => {
      if (!values || values.length === 0) {
        return;
      }

      const heading = document.createElement('h2');
      heading.className = 'filters-title';
      heading.textContent = title;
      conditionalFilters.appendChild(heading);

      const options = document.createElement('div');
      options.className = 'filter-options';

      values.forEach((value) => {
        const label = document.createElement('label');
        label.className = 'filter-option';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = String(value);
        input.checked = selectedValues.includes(value);
        input.addEventListener('change', (event) => {
          const checked = event.target.checked;

          if (title === 'Subcategory') {
            selectedSubcategories = toggleArrayValue(selectedSubcategories, value, checked);
          } else if (title === 'Brand') {
            selectedBrands = toggleArrayValue(selectedBrands, value, checked);
          } else if (title === 'GPU Model') {
            selectedGpuModels = toggleArrayValue(selectedGpuModels, value, checked);
          } else if (title === 'RAM Size') {
            selectedRamSizes = toggleArrayValue(selectedRamSizes, value, checked);
          } else if (title === 'Format') {
            selectedStorageFormats = toggleArrayValue(selectedStorageFormats, value, checked);
          } else if (title === 'PSU Wattage') {
            selectedPsuWattages = toggleArrayValue(selectedPsuWattages, value, checked);
          } else if (title === 'Case Form Factor') {
            selectedCaseFormFactors = toggleArrayValue(selectedCaseFormFactors, value, checked);
          } else if (title === 'Socket') {
            selectedSockets = toggleArrayValue(selectedSockets, value, checked);
          }

          currentPage = 1;
          render();
        });

        label.appendChild(input);
        label.appendChild(document.createTextNode(formatter(value)));
        options.appendChild(label);
      });

      conditionalFilters.appendChild(options);
    };

    const allCategoriesLabel = document.createElement('label');
    allCategoriesLabel.className = 'filter-option';
    const allCategoriesInput = document.createElement('input');
    allCategoriesInput.type = 'radio';
    allCategoriesInput.name = 'main-category';
    allCategoriesInput.value = '';
    allCategoriesInput.checked = selectedCategory === '';
    allCategoriesInput.addEventListener('change', () => {
      selectedCategory = '';
      selectedSubcategories = [];
      selectedBrands = [];
      selectedSockets = [];
      selectedGpuModels = [];
      selectedRamSizes = [];
      selectedStorageFormats = [];
      selectedPsuWattages = [];
      selectedCaseFormFactors = [];
      currentPage = 1;
      render();
    });
    allCategoriesLabel.appendChild(allCategoriesInput);
    allCategoriesLabel.appendChild(document.createTextNode('All Categories'));
    categoryOptions.appendChild(allCategoriesLabel);

    availableCategories.forEach((category) => {
      const label = document.createElement('label');
      label.className = 'filter-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'main-category';
      input.value = category;
      input.checked = selectedCategory === category;

      input.addEventListener('change', () => {
        selectedCategory = category;
        selectedSubcategories = [];
        selectedBrands = [];
        selectedSockets = [];
        selectedGpuModels = [];
        selectedRamSizes = [];
        selectedStorageFormats = [];
        selectedPsuWattages = [];
        selectedCaseFormFactors = [];
        currentPage = 1;
        render();
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(category));
      categoryOptions.appendChild(label);
    });

    if (selectedCategory) {
      createCheckboxFilterGroup('Subcategory', availableSubcategories, selectedSubcategories);
      createCheckboxFilterGroup('Brand', availableBrands, selectedBrands);
    }

    if (isGpuModelFilterVisible) {
      createCheckboxFilterGroup('GPU Model', availableGpuModels, selectedGpuModels);
    }

    if (isRamSizeFilterVisible) {
      createCheckboxFilterGroup('RAM Size', availableRamSizes, selectedRamSizes, (size) => `${size} GB`);
    }

    if (isStorageFormatFilterVisible) {
      createCheckboxFilterGroup('Format', availableStorageFormats, selectedStorageFormats);
    }

    if (isPsuWattageFilterVisible) {
      createCheckboxFilterGroup('PSU Wattage', availablePsuWattages, selectedPsuWattages, (wattage) => `${wattage} W`);
    }

    if (isCaseFormFactorFilterVisible) {
      createCheckboxFilterGroup('Case Form Factor', availableCaseFormFactors, selectedCaseFormFactors);
    }

    if (isSocketFilterVisible) {
      createCheckboxFilterGroup('Socket', availableSockets, selectedSockets);
    }

    sortSelect.addEventListener('change', (event) => {
      selectedSort = event.target.value;
      currentPage = 1;
      render();
    });

    minPriceInput.addEventListener('input', (event) => {
      const nextValue = Number(event.target.value);
      selectedMinPrice = nextValue;

      if (selectedMinPrice > selectedMaxPrice) {
        selectedMaxPrice = selectedMinPrice;
        maxPriceInput.value = selectedMaxPrice;
      }

      const priceLabels = main.querySelectorAll('.price-label');
      const priceValue = main.querySelector('.price-value');
      if (priceLabels.length >= 1) {
        priceLabels[0].textContent = `Min: ${selectedMinPrice.toFixed(2)} €`;
      }
      if (priceValue) {
        priceValue.textContent = `${selectedMinPrice.toFixed(2)} € - ${selectedMaxPrice.toFixed(2)} €`;
      }

      currentPage = 1;
      
      const filteredProducts = getFilteredProducts(searchStore.getSearchTerm());
      const sortedProducts = getSortedProducts(filteredProducts, searchStore.getSearchTerm());
      const totalPages = Math.max(1, Math.ceil(sortedProducts.length / productsPerPage()));
      const start = (currentPage - 1) * productsPerPage();
      const end = start + productsPerPage();
      const paginatedProducts = sortedProducts.slice(start, end);

      productGrid.innerHTML = '';
      paginatedProducts.forEach((product) => {
        productGrid.appendChild(createProductCard(product));
      });
    });

    maxPriceInput.addEventListener('input', (event) => {
      const nextValue = Number(event.target.value);
      selectedMaxPrice = nextValue;

      if (selectedMaxPrice < selectedMinPrice) {
        selectedMinPrice = selectedMaxPrice;
        minPriceInput.value = selectedMinPrice;
      }

      const priceLabels = main.querySelectorAll('.price-label');
      const priceValue = main.querySelector('.price-value');
      if (priceLabels.length >= 2) {
        priceLabels[1].textContent = `Max: ${selectedMaxPrice.toFixed(2)} €`;
      }
      if (priceValue) {
        priceValue.textContent = `${selectedMinPrice.toFixed(2)} € - ${selectedMaxPrice.toFixed(2)} €`;
      }

      currentPage = 1;

      const filteredProducts = getFilteredProducts(searchStore.getSearchTerm());
      const sortedProducts = getSortedProducts(filteredProducts, searchStore.getSearchTerm());
      const totalPages = Math.max(1, Math.ceil(sortedProducts.length / productsPerPage()));
      const start = (currentPage - 1) * productsPerPage();
      const end = start + productsPerPage();
      const paginatedProducts = sortedProducts.slice(start, end);

      productGrid.innerHTML = '';
      paginatedProducts.forEach((product) => {
        productGrid.appendChild(createProductCard(product));
      });
    });

    paginatedProducts.forEach((product) => {
      productGrid.appendChild(createProductCard(product));
    });

    if (sortedProducts.length > 0) {
      const prevButton = document.createElement('button');
      prevButton.className = 'page-btn';
      prevButton.textContent = 'Prev';
      prevButton.disabled = currentPage === 1;
      prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage -= 1;
          render();
        }
      });
      pagination.appendChild(prevButton);

      for (let page = 1; page <= totalPages; page += 1) {
        const pageButton = document.createElement('button');
        pageButton.className = 'page-btn';
        if (page === currentPage) {
          pageButton.classList.add('active');
        }
        pageButton.textContent = String(page);
        pageButton.addEventListener('click', () => {
          currentPage = page;
          render();
        });
        pagination.appendChild(pageButton);
      }

      const nextButton = document.createElement('button');
      nextButton.className = 'page-btn';
      nextButton.textContent = 'Next';
      nextButton.disabled = currentPage === totalPages;
      nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage += 1;
          render();
        }
      });
      pagination.appendChild(nextButton);
    }
  };

  const handleSearchUpdate = () => {
    currentPage = 1;
    render();
  };

  const handleProductsUpdate = () => {
    currentPage = 1;
    render();
  };

  const handleResize = () => {
    currentPage = 1;
    render();
  };

  const unsubscribeSearch = searchStore.subscribe(handleSearchUpdate);
  const unsubscribeProducts = subscribeProducts(handleProductsUpdate);

  window.addEventListener('resize', handleResize);

  const cleanup = () => {
    unsubscribeSearch();
    unsubscribeProducts();
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('hashchange', handleRouteChangeCleanup);
  };

  const handleRouteChangeCleanup = () => {
    const hash = window.location.hash.slice(1) || '/';
    if (!hash.startsWith('/products') || !main.isConnected) {
      cleanup();
    }
  };

  window.addEventListener('hashchange', handleRouteChangeCleanup);

  render();

  return main;
}