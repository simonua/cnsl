/**
 * Owns pool calendar button and date-picker browser interactions.
 * Routes delegated pool-card events into the schedule navigation actions supplied by the directory controller.
 */

if (typeof globalThis.PoolCalendarControls === 'undefined') {
  class PoolCalendarControls {
    static handleClick(event, actions) {
      const target = event.target;
      const disclosureButton = target.closest('[data-pool-card-action="toggle"]');
      if (disclosureButton) return actions.toggleCard(disclosureButton);

      const poolCard = target.closest('[data-pool-card]');
      const cardToggle = poolCard && poolCard.querySelector('[data-pool-card-action="toggle"]');
      if (cardToggle && (cardToggle.getAttribute('aria-expanded') !== 'true' || target.closest('[data-pool-card-header]'))) return actions.toggleCard(cardToggle);

      const navigation = target.closest('.pool-week-navigation');
      if (!navigation) return;
      const poolId = navigation.dataset.poolId;
      if (target.classList.contains('prev-week')) return actions.previousWeek(poolId);
      if (target.classList.contains('next-week')) return actions.nextWeek(poolId);
      if (target.classList.contains('today-btn')) return actions.today(poolId);
      if (target.classList.contains('calendar-btn')) PoolCalendarControls.showPicker(target, navigation);
    }

    static handleChange(event, actions) {
      const picker = event.target;
      if (!picker.classList.contains('week-picker')) return;
      const navigation = picker.closest('.pool-week-navigation');
      if (!navigation) return;
      actions.selectedWeek(navigation.dataset.poolId, picker.value);
      picker.hidden = true;
      const button = navigation.querySelector('.calendar-btn');
      if (button) {
        button.setAttribute('aria-expanded', 'false');
        button.focus();
      }
    }

    static showPicker(button, navigation) {
      const picker = navigation.querySelector('.week-picker');
      if (!picker) return;
      const buttonRect = button.getBoundingClientRect();
      const navigationRect = navigation.getBoundingClientRect();
      picker.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      picker.style.left = `${buttonRect.left - navigationRect.left}px`;
      picker.style.top = `${buttonRect.bottom - navigationRect.top + 5}px`;
      picker.classList.add('active');
      picker.click();
      if (picker.showPicker) picker.showPicker(); else picker.focus();
    }
  }

  globalThis.PoolCalendarControls = PoolCalendarControls;
}
