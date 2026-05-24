/**
 * Navigation functionality for mobile menu
 */

/**
 * Closes the mobile navigation menu
 */
function closeMenu() {
  const nav = document.getElementById('navMenu');
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.getElementById('navOverlay');
  
  if (nav) {
    nav.classList.remove('active');
    nav.setAttribute('aria-hidden', 'true');
    if (overlay) {
      overlay.classList.remove('active');
    }
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Open navigation menu');
    }
  }
}

/**
 * Toggles the mobile navigation menu visibility
 */
// eslint-disable-next-line no-unused-vars
function toggleMenu() {
  const nav = document.getElementById('navMenu');
  const overlay = document.getElementById('navOverlay');
  if (nav) {
    nav.classList.toggle('active');
    
    // Update aria-expanded attribute for accessibility
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
      const isExpanded = nav.classList.contains('active');
      hamburger.setAttribute('aria-expanded', String(isExpanded));
      hamburger.setAttribute('aria-label', isExpanded ? 'Close navigation menu' : 'Open navigation menu');
      nav.setAttribute('aria-hidden', String(!isExpanded));
      if (overlay) {
        overlay.classList.toggle('active', isExpanded);
      }
    }
  }
}

/**
 * Handles sticky footer visibility based on scroll position
 */
function handleStickyFooter() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrolledToBottom = windowHeight + scrollTop >= documentHeight - 10; // 10px threshold
  
  if (scrolledToBottom) {
    footer.classList.add('visible');
  } else {
    footer.classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Close menu when clicking outside of it
  document.addEventListener('click', (event) => {
    const nav = document.getElementById('navMenu');
    const hamburger = document.querySelector('.hamburger');
    
    if (nav && nav.classList.contains('active')) {
      if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
        closeMenu();
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const hamburger = document.querySelector('.hamburger');
    const nav = document.getElementById('navMenu');
    if (event.key === 'Escape' && nav && nav.classList.contains('active')) {
      closeMenu();
      if (hamburger) hamburger.focus();
    }
  });
  
  // Initialize sticky footer
  handleStickyFooter();
  
  // Handle scroll events for sticky footer
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleStickyFooter();
        ticking = false;
      });
      ticking = true;
    }
  });
  
  // Handle resize events
  window.addEventListener('resize', handleStickyFooter);
});
