// Search Store - Manages search state
class SearchStore {
  constructor() {
    this.searchTerm = '';
    this.listeners = new Set();
  }

  // Subscribe to search changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of search changes
  notify() {
    this.listeners.forEach(listener => listener(this.searchTerm));
  }

  // Set search term
  setSearchTerm(term) {
    this.searchTerm = term;
    this.notify();
  }

  // Get current search term
  getSearchTerm() {
    return this.searchTerm;
  }

  // Clear search
  clearSearch() {
    this.searchTerm = '';
    this.notify();
  }
}

// Export singleton instance
export const searchStore = new SearchStore();