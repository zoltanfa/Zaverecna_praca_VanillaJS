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
}

export const searchStore = new SearchStore();