class SearchStore {
  constructor() {
    this.searchTerm = '';
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.searchTerm));
  }

  setSearchTerm(term) {
    this.searchTerm = term;
    this.notify();
  }

  getSearchTerm() {
    return this.searchTerm;
  }

  clearSearch() {
    this.searchTerm = '';
    this.notify();
  }

  normalizeText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  getProductSearchFields(product) {
    const name = this.normalizeText(product.name);
    const description = this.normalizeText(product.description);
    const attributes = this.normalizeText([
      product.category,
      product.subcategory,
      product.brand,
      product.model,
      product.socket,
      product.format,
      product.wattage,
      product.size,
      ...(Array.isArray(product.formFactors) ? product.formFactors : [])
    ].filter(Boolean).join(' '));

    return {
      name,
      description,
      attributes,
      all: `${name} ${description} ${attributes}`.trim()
    };
  }

  buildQueryTokens(query) {
    return this.normalizeText(query)
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  getSearchScore(product, query) {
    const tokens = this.buildQueryTokens(query);

    if (tokens.length === 0) {
      return 0;
    }

    const fields = this.getProductSearchFields(product);
    const phrase = tokens.join(' ');
    let score = 0;

    if (fields.name === phrase) {
      score += 300;
    } else if (fields.name.includes(phrase)) {
      score += 120;
    }

    for (const token of tokens) {
      if (!fields.all.includes(token)) {
        return 0;
      }

      if (fields.name.startsWith(token)) {
        score += 45;
      }

      if (fields.name.includes(token)) {
        score += 30;
      }

      if (fields.attributes.includes(token)) {
        score += 15;
      }

      if (fields.description.includes(token)) {
        score += 8;
      }
    }

    return score;
  }

  matchesFullTextSearch(product, query) {
    return this.getSearchScore(product, query) > 0;
  }
}

export const searchStore = new SearchStore();