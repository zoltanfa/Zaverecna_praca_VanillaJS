// Footer Component
export function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  
  footer.innerHTML = `
    <div class="footer-container">
      <p>&copy; 2026 PC Shop. All rights reserved.</p>
    </div>
  `;
  
  return footer;
}
