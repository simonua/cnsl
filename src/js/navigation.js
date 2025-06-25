/**
 * Navigation functionality for mobile menu
 */

/**
 * Closes the mobile navigation menu
 */
function closeMenu() {
  const nav = document.querySelector('nav');
  const hamburger = document.querySelector('.hamburger');
  
  if (nav) {
    nav.classList.remove('active');
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', false);
    }
  }
}

/**
 * Toggles the mobile navigation menu visibility
 */
function toggleMenu() {
  const nav = document.querySelector('nav');
  if (nav) {
    nav.classList.toggle('active');
    
    // Update aria-expanded attribute for accessibility
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
      const isExpanded = nav.classList.contains('active');
      hamburger.setAttribute('aria-expanded', isExpanded);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Close menu when clicking outside of it
  document.addEventListener('click', (event) => {
    const nav = document.querySelector('nav');
    const hamburger = document.querySelector('.hamburger');
    
    if (nav && nav.classList.contains('active')) {
      if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
        nav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', false);
      }
    }
  });
});
