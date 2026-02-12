// Simple Hash-based Router for SPA navigation
class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    
    // Listen to hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
    
    // Intercept link clicks for smoother navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-link]');
      if (link) {
        e.preventDefault();
        this.navigateTo(link.getAttribute('href'));
      }
    });
  }

  // Register a route
  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  // Handle route changes
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    // Parse query parameters
    const params = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      });
    }

    // Match route with dynamic segments (e.g., /product/:id)
    let matchedRoute = null;
    let routeParams = {};

    for (const routePath in this.routes) {
      const pattern = this.pathToRegex(routePath);
      const match = path.match(pattern);
      
      if (match) {
        matchedRoute = routePath;
        // Extract dynamic parameters
        const paramNames = this.getParamNames(routePath);
        paramNames.forEach((name, index) => {
          routeParams[name] = match[index + 1];
        });
        break;
      }
    }

    if (matchedRoute) {
      this.currentRoute = path;
      this.routes[matchedRoute]({ params: routeParams, query: params });
    } else if (this.routes[path]) {
      this.currentRoute = path;
      this.routes[path]({ params: routeParams, query: params });
    } else {
      console.warn('No route found for:', path);
      this.navigateTo('/');
    }
  }

  // Convert route path to regex pattern
  pathToRegex(path) {
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:(\w+)/g, '([^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  // Extract parameter names from route path
  getParamNames(path) {
    const matches = path.match(/:(\w+)/g);
    return matches ? matches.map(m => m.slice(1)) : [];
  }

  // Navigate to a new route
  navigateTo(path) {
    window.location.hash = path;
  }

  // Navigate back
  goBack() {
    window.history.back();
  }
}

// Export singleton instance
export const router = new Router();