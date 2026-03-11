import { authStore } from '../stores/authStore.js';

function normalizeProfileData(rawData) {
  return {
    firstName: String(rawData.firstName || '').trim(),
    lastName: String(rawData.lastName || '').trim(),
    email: String(rawData.email || '').trim().toLowerCase(),
    phone: String(rawData.phone || '').trim(),
    address: String(rawData.address || '').trim(),
    city: String(rawData.city || '').trim(),
    postalCode: String(rawData.postalCode || '').trim(),
    country: String(rawData.country || '').trim()
  };
}

function isValidProfile(profile) {
  return Object.values(profile).every(Boolean);
}

export function renderProfile() {
  const main = document.createElement('main');
  main.className = 'main-auth main-auth-profile';

  let isSubmitting = false;
  let errorMessage = '';
  let successMessage = '';
  let showPasswordSection = false;

  const formData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: ''
  };

  const passwordData = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  };

  const fillProfileData = async () => {
    await authStore.waitForAuthInit();

    const user = authStore.currentUser;
    if (!user) {
      return;
    }

    const profile = await authStore.getUserProfile(user.uid);
    const fallbackName = user.displayName || '';
    const parts = fallbackName.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');

    formData.firstName = profile?.firstName || firstName;
    formData.lastName = profile?.lastName || lastName;
    formData.email = user.email || profile?.email || '';
    formData.phone = profile?.phone || '';
    formData.address = profile?.address || '';
    formData.city = profile?.city || '';
    formData.postalCode = profile?.postalCode || '';
    formData.country = profile?.country || '';
  };

  const render = () => {
    main.innerHTML = `
      <h1 class="main-title-auth">My Profile</h1>
      <section class="auth-card profile-card">
        <form class="auth-form profile-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">First Name</label>
              <input id="firstName" type="text" required value="${formData.firstName}" ${isSubmitting ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label for="lastName">Last Name</label>
              <input id="lastName" type="text" required value="${formData.lastName}" ${isSubmitting ? 'disabled' : ''} />
            </div>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" required value="${formData.email}" ${isSubmitting ? 'disabled' : ''} />
          </div>

          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input id="phone" type="text" required value="${formData.phone}" ${isSubmitting ? 'disabled' : ''} />
          </div>

          <div class="form-group">
            <label for="address">Street Address</label>
            <input id="address" type="text" required value="${formData.address}" ${isSubmitting ? 'disabled' : ''} />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="city">City</label>
              <input id="city" type="text" required value="${formData.city}" ${isSubmitting ? 'disabled' : ''} />
            </div>
            <div class="form-group">
              <label for="postalCode">Postal Code</label>
              <input id="postalCode" type="text" required value="${formData.postalCode}" ${isSubmitting ? 'disabled' : ''} />
            </div>
          </div>

          <div class="form-group">
            <label for="country">Country</label>
            <input id="country" type="text" required value="${formData.country}" ${isSubmitting ? 'disabled' : ''} />
          </div>

          <button type="button" class="toggle-password-btn" ${isSubmitting ? 'disabled' : ''}>
            ${showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
          </button>

          ${showPasswordSection ? `
            <h2 class="section-title">Change Password</h2>
            <div class="form-group">
              <label for="currentPassword">Current Password</label>
              <input id="currentPassword" type="password" ${isSubmitting ? 'disabled' : ''} value="${passwordData.currentPassword}" />
            </div>
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input id="newPassword" type="password" ${isSubmitting ? 'disabled' : ''} value="${passwordData.newPassword}" />
            </div>
            <div class="form-group">
              <label for="confirmNewPassword">Confirm New Password</label>
              <input id="confirmNewPassword" type="password" ${isSubmitting ? 'disabled' : ''} value="${passwordData.confirmNewPassword}" />
            </div>
          ` : ''}

          ${errorMessage ? `<p class="error-message">${errorMessage}</p>` : ''}
          ${successMessage ? `<p class="profile-success-message">${successMessage}</p>` : ''}

          <button type="submit" class="profile-submit-btn" ${isSubmitting ? 'disabled' : ''}>
            ${isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>
    `;

    for (const fieldName of Object.keys(formData)) {
      const input = main.querySelector(`#${fieldName}`);
      if (input) {
        input.addEventListener('input', (event) => {
          formData[fieldName] = event.target.value;
        });
      }
    }

    for (const fieldName of Object.keys(passwordData)) {
      const input = main.querySelector(`#${fieldName}`);
      if (input) {
        input.addEventListener('input', (event) => {
          passwordData[fieldName] = event.target.value;
        });
      }
    }

    const togglePasswordBtn = main.querySelector('.toggle-password-btn');
    togglePasswordBtn.addEventListener('click', () => {
      showPasswordSection = !showPasswordSection;

      if (!showPasswordSection) {
        passwordData.currentPassword = '';
        passwordData.newPassword = '';
        passwordData.confirmNewPassword = '';
      }

      render();
    });

    const form = main.querySelector('.profile-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorMessage = '';
      successMessage = '';

      const normalizedProfile = normalizeProfileData(formData);
      if (!isValidProfile(normalizedProfile)) {
        errorMessage = 'Please fill in all fields.';
        render();
        return;
      }

      const wantsPasswordChange = showPasswordSection
        && (passwordData.currentPassword || passwordData.newPassword || passwordData.confirmNewPassword);

      if (wantsPasswordChange) {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
          errorMessage = 'Fill in all password fields to change your password.';
          render();
          return;
        }

        if (passwordData.newPassword.length < 6) {
          errorMessage = 'Password must have at least 6 characters.';
          render();
          return;
        }

        if (passwordData.newPassword !== passwordData.confirmNewPassword) {
          errorMessage = "Passwords don't match.";
          render();
          return;
        }
      }

      isSubmitting = true;
      render();

      try {
        const user = authStore.currentUser;

        if (!user) {
          throw new Error('User not authenticated.');
        }

        await authStore.saveUserProfile(user.uid, normalizedProfile);

        if (normalizedProfile.email !== String(user.email || '').toLowerCase()) {
          await authStore.changeUserEmail(normalizedProfile.email);
        }

        successMessage = 'Profile updated successfully.';

        if (wantsPasswordChange) {
          await authStore.changeUserPassword({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
          });
          successMessage = 'Profile updated successfully.';

          passwordData.currentPassword = '';
          passwordData.newPassword = '';
          passwordData.confirmNewPassword = '';
        }
      } catch (error) {
        if (error?.code === 'auth/email-already-in-use') {
          errorMessage = 'This email is already in use.';
        } else if (error?.code === 'auth/requires-recent-login') {
          errorMessage = 'Please log in again before changing sensitive account details.';
        } else if (error?.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (error?.code === 'auth/too-many-requests') {
          errorMessage = 'Too many attempts. Please wait and try again.';
        } else if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
          errorMessage = 'Current password is incorrect.';
        } else {
          errorMessage = 'Unable to update profile. Please try again.';
        }
      } finally {
        isSubmitting = false;
        render();
      }
    });
  };

  fillProfileData().finally(() => render());
  return main;
}
