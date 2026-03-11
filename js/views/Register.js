import { authStore } from '../stores/authStore.js';
import { router } from '../router.js';

export function renderRegister() {
  const main = document.createElement('main');
  main.className = 'main-auth main-auth-register';

  let isSubmitting = false;
  let errorMessage = '';

  const formData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  const render = () => {
    main.innerHTML = `
      <h1 class="main-title-auth">Register</h1>
      <section class="auth-card">
        <form class="auth-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">First Name</label>
              <input id="firstName" type="text" required ${isSubmitting ? 'disabled' : ''} value="${formData.firstName}" />
            </div>
            <div class="form-group">
              <label for="lastName">Last Name</label>
              <input id="lastName" type="text" required ${isSubmitting ? 'disabled' : ''} value="${formData.lastName}" />
            </div>
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" required ${isSubmitting ? 'disabled' : ''} value="${formData.email}" />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" required ${isSubmitting ? 'disabled' : ''} value="${formData.password}" />
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" type="password" required ${isSubmitting ? 'disabled' : ''} value="${formData.confirmPassword}" />
          </div>
          ${errorMessage ? `<p class="error-message">${errorMessage}</p>` : ''}
          <button type="submit" class="register-submit-btn" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p class="redirect-text">Already have an account? <a href="#/login" data-link>Login</a></p>
      </section>
    `;

    for (const fieldName of Object.keys(formData)) {
      const input = main.querySelector(`#${fieldName}`);
      if (!input) {
        continue;
      }

      input.addEventListener('input', (event) => {
        formData[fieldName] = event.target.value;
      });
    }

    const form = main.querySelector('.auth-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorMessage = '';

      const { firstName, lastName, email, password, confirmPassword } = formData;
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        errorMessage = 'Please fill in all fields.';
        render();
        return;
      }

      if (password !== confirmPassword) {
        errorMessage = 'Passwords do not match.';
        render();
        return;
      }

      if (password.length < 6) {
        errorMessage = 'Password must have at least 6 characters.';
        render();
        return;
      }

      isSubmitting = true;
      render();

      try {
        await authStore.registerWithEmail({ firstName, lastName, email, password });
        router.navigateTo('/login');
      } catch (error) {
        if (error?.code === 'auth/email-already-in-use') {
          errorMessage = 'This email is already registered.';
        } else if (String(error?.code || '').startsWith('auth/requests-from-referer-')) {
          errorMessage = 'Registration is blocked for this URL.';
        } else {
          errorMessage = 'Unable to register. Please try again.';
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
