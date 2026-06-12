/**
 * Navigation functionality for mobile menu
 */

/**
 * Closes the mobile navigation menu
 * @param {boolean} restoreFocus - Whether focus should return to the menu button
 */
function closeMenu(restoreFocus = false) {
  const nav = document.getElementById('navMenu');
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.getElementById('navOverlay');
  const main = document.getElementById('mainContent');
  const footer = document.querySelector('.footer');
  const skipLink = document.querySelector('.skip-link');
  const homeLink = document.querySelector('.header a');

  if (nav) {
    nav.classList.remove('active');
    nav.setAttribute('aria-hidden', 'true');
    nav.inert = true;
    if (overlay) {
      overlay.classList.remove('active');
    }
    if (hamburger) {
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Open navigation menu');
      if (restoreFocus) {
        hamburger.focus();
      }
    }
    if (main) main.inert = false;
    if (footer) footer.inert = false;
    if (skipLink) skipLink.inert = false;
    if (homeLink) homeLink.inert = false;
  }
}

/**
 * Updates the mobile navigation offset to clear the fixed header.
 */
function updateNavigationOffset() {
  const nav = document.getElementById('navMenu');
  const header = document.querySelector('.header');
  if (!nav || !header) return;

  const headerBottom = Math.ceil(header.getBoundingClientRect().bottom);
  nav.style.setProperty('--nav-top-offset', `${headerBottom}px`);
}

/**
 * Determines whether the mobile navigation menu is expanded.
 * @param {Element|null} hamburger - Navigation menu button
 * @returns {boolean} Whether the menu is expanded
 */
function isMenuOpen(hamburger = document.querySelector('.hamburger')) {
  return hamburger?.getAttribute('aria-expanded') === 'true';
}

/**
 * Applies configured device opt-ins to experimental navigation destinations.
 * @returns {Promise<void>} Promise settled after experimental links are updated
 */
async function updateExperimentalNavigation() {
  const experimentalLinks = document.querySelectorAll('#navMenu [data-experimental-feature]');
  if (experimentalLinks.length === 0) return;

  experimentalLinks.forEach(link => {
    link.hidden = true;
  });

  try {
    const configuredFeatures = await globalThis.ExperimentalFeaturesService.load();
    const availableFeatureIds = new Set(configuredFeatures
      .filter(feature => feature.available)
      .map(feature => feature.id));
    const selectedFeatureIds = new Set(PreferencesService.get().experimentalFeatures);
    experimentalLinks.forEach(link => {
      link.hidden = !availableFeatureIds.has(link.dataset.experimentalFeature)
        || !selectedFeatureIds.has(link.dataset.experimentalFeature);
    });
  } catch (error) {
    console.error('Unable to update experimental navigation:', error);
  }
}

/**
 * Toggles the mobile navigation menu and surrounding inert state.
 */
function toggleMenu() {
  const nav = document.getElementById('navMenu');
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.getElementById('navOverlay');
  const main = document.getElementById('mainContent');
  const footer = document.querySelector('.footer');
  const skipLink = document.querySelector('.skip-link');
  const homeLink = document.querySelector('.header a');
  if (!nav || !hamburger) return;

  if (isMenuOpen(hamburger)) {
    closeMenu(true);
    return;
  }

  updateNavigationOffset();
  nav.classList.add('active');
  nav.setAttribute('aria-hidden', 'false');
  nav.inert = false;
  hamburger.classList.add('active');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Close navigation menu');
  if (overlay) overlay.classList.add('active');
  if (main) main.inert = true;
  if (footer) footer.inert = true;
  if (skipLink) skipLink.inert = true;
  if (homeLink) homeLink.inert = true;
  hamburger.focus();
}

/**
 * Keep keyboard focus on menu controls while the overlay navigation is active.
 * @param {KeyboardEvent} event - Keyboard event to handle
 */
function containMenuFocus(event) {
  const nav = document.getElementById('navMenu');
  const hamburger = document.querySelector('.hamburger');
  if (event.key !== 'Tab' || !nav || !hamburger || !isMenuOpen(hamburger)) return;

  const focusableElements = [hamburger, ...nav.querySelectorAll('a[href]')];
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (!focusableElements.includes(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : nav.querySelector('a[href]')).focus();
  } else if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
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
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.getElementById('navOverlay');
  updateNavigationOffset();
  updateExperimentalNavigation();
  if (hamburger) hamburger.addEventListener('click', toggleMenu);
  if (overlay) overlay.addEventListener('click', () => closeMenu(true));

  // Close menu when clicking outside of it
  document.addEventListener('click', (event) => {
    const nav = document.getElementById('navMenu');

    if (nav && hamburger && isMenuOpen(hamburger)) {
      if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
        closeMenu(true);
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const nav = document.getElementById('navMenu');
    if (event.key === 'Escape' && nav && isMenuOpen(hamburger)) {
      closeMenu(true);
    }
    containMenuFocus(event);
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
  window.addEventListener('resize', () => {
    updateNavigationOffset();
    handleStickyFooter();
  });
  window.addEventListener('cnsl:preferences-changed', updateExperimentalNavigation);
});
