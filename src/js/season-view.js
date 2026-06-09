/**
 * Selects seasonal or off-season content before route-specific rendering begins.
 */

(function initializeSeasonView() {
  const seasonEndDate = document.documentElement.dataset.seasonEndDate;
  const isOffSeason = globalThis.SeasonService.isOffSeason(seasonEndDate);
  globalThis.cnslSeasonState = Object.freeze({ isOffSeason });

  document.documentElement.classList.toggle('is-off-season', isOffSeason);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-off-season-content]').forEach(element => {
      element.hidden = !isOffSeason;
    });
    document.querySelectorAll('[data-seasonal-content]').forEach(element => {
      element.hidden = isOffSeason;
    });
  });
})();
