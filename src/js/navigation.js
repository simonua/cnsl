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
    const nav = document.querySelector('nav');
    const hamburger = document.querySelector('.hamburger');
    
    if (nav && nav.classList.contains('active')) {
      if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
        nav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', false);
      }
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
