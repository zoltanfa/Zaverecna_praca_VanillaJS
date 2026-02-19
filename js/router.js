class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
    
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-link]');
      if (link) {
        e.preventDefault();
        this.navigateTo(link.getAttribute('href'));
      }
    });
  }

  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    
    const params = {};
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      });
    }

    let matchedRoute = null;
    let routeParams = {};

    for (const routePath in this.routes) {
      const pattern = this.pathToRegex(routePath);
      const match = path.match(pattern);
      
      if (match) {
        matchedRoute = routePath;
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

  pathToRegex(path) {
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:(\w+)/g, '([^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  getParamNames(path) {
    const matches = path.match(/:(\w+)/g);
    return matches ? matches.map(m => m.slice(1)) : [];
  }

  navigateTo(path) {
    window.location.hash = path;
  }

  goBack() {
    window.history.back();
  }
}

export const router = new Router();