import { authStore } from '../stores/authStore.js';
import { router } from '../router.js';

export function renderLogin() {
  const main = document.createElement('main');
  main.className = 'main-auth';

  let isSubmitting = false;
  let errorMessage = '';

  const formData = {
    email: '',
    password: ''
  };

  const render = () => {
    main.innerHTML = `
      <h1 class="main-title-auth">Login</h1>
      <section class="auth-card">
        <form class="auth-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" required ${isSubmitting ? 'disabled' : ''} value="${formData.email}" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" required ${isSubmitting ? 'disabled' : ''} value="${formData.password}" />
          </div>
          ${errorMessage ? `<p class="error-message">${errorMessage}</p>` : ''}
          <button type="submit" class="login-submit-btn" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p class="redirect-text">Don't have an account? <a href="#/register" data-link>Register</a></p>
      </section>
    `;

    const emailInput = main.querySelector('#email');
    const passwordInput = main.querySelector('#password');
    emailInput.addEventListener('input', (event) => {
      formData.email = event.target.value;
    });
    passwordInput.addEventListener('input', (event) => {
      formData.password = event.target.value;
    });

    const form = main.querySelector('.auth-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorMessage = '';

      const email = formData.email.trim();
      const password = formData.password;

      if (!email || !password) {
        errorMessage = 'Please fill in all fields.';
        render();
        return;
      }

      isSubmitting = true;
      render();

      try {
        await authStore.loginWithEmail({
          email,
          password
        });
        router.navigateTo('/');
      } catch (error) {
        if (error?.code === 'auth/invalid-credential') {
          errorMessage = 'Invalid email or password.';
        } else if (String(error?.code || '').startsWith('auth/requests-from-referer-')) {
          errorMessage = 'Login is blocked for this URL.';
        } else {
          errorMessage = 'Unable to log in. Please try again.';
        }
      } finally {
        isSubmitting = false;
        render();
      }
    });
  };

  render();
  return main;
}
