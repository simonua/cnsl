/**
 * Selects and safely renders personalized near-term meet guidance.
 * Combines annual matchup, pool, and recurring host-team facts without DOM access.
 */
if (typeof globalThis.MeetDayGuideService === 'undefined') {
  const CASH_BILL_MAXIMUM_DENOMINATION = 20;
  const CASH_BILL_PREFERRED_DENOMINATIONS = Object.freeze([5, 1]);
  const CONCESSION_GROUP_PRESENTATION = Object.freeze({
    Drinks: 'cup-soda',
    Meals: 'utensils',
    Snacks: 'cookie'
  });
  const PAYMENT_METHOD_ASSET_BASE_URL = 'assets/images/payment-methods';
  const PAYMENT_METHOD_PRESENTATION = Object.freeze({
    [globalThis.PaymentMethod.CASH]: Object.freeze({ label: 'cash', visualLabel: 'Cash', iconName: 'banknote' }),
    [globalThis.PaymentMethod.CREDIT]: Object.freeze({ label: 'credit', visualLabel: 'Credit' }),
    [globalThis.PaymentMethod.OTHER]: Object.freeze({ label: 'other listed methods', visualLabel: 'Other methods' }),
    [globalThis.PaymentMethod.PAYPAL]: Object.freeze({
      assetPath: `${PAYMENT_METHOD_ASSET_BASE_URL}/paypal-monogram-full-color.png`,
      height: 60,
      label: 'PayPal',
      width: 50
    }),
    [globalThis.PaymentMethod.VENMO]: Object.freeze({
      assetPath: `${PAYMENT_METHOD_ASSET_BASE_URL}/venmo-wordmark-blue.png`,
      height: 36,
      label: 'Venmo',
      width: 190
    })
  });

  /** Selects and renders meet-day guidance for a favorite team. */
  class MeetDayGuideService {
    /**
     * Formats a local calendar date as an ISO date key.
     * @param {Date} date - Calendar date
     * @returns {string} ISO date key
     * @private
     */
    static formatDateKey(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    /**
     * Resolves a published team label to its annual team record.
     * @param {Array} teams - Published teams
     * @param {string} label - Meet team label
     * @returns {Object|null} Matching team or null
     * @private
     */
    static findTeam(teams, label) {
      return teams.find(team => globalThis.PreferencesService.teamMatchesLabel(team, label)) || null;
    }

    /**
     * Resolves a published meet location to its annual pool record.
     * @param {Array} pools - Published pools
     * @param {string} location - Meet location
     * @returns {Object|null} Matching pool or null
     * @private
     */
    static findPool(pools, location) {
      const poolId = globalThis.getPoolIdFromLocation(location, pools);
      return pools.find(pool => pool.id === poolId) || null;
    }

    /**
     * Formats a pool address from a model or annual record.
     * @param {Object|null} pool - Published pool
     * @returns {string} Display address
     * @private
     */
    static getPoolAddress(pool) {
      if (!pool) return '';
      const location = pool.location || {};
      const cityAndState = [location.city, location.state].filter(Boolean).join(', ');
      const locality = [cityAndState, location.zip].filter(Boolean).join(' ');
      const modeledAddress = [location.street, locality].filter(Boolean).join(', ');
      return modeledAddress || pool.address || '';
    }

    /**
     * Selects the next non-concluded favorite-team dual meet within an optional inclusive look-ahead window.
     * @param {Object|null} team - Favorite team
     * @param {Array} meets - Published meets
     * @param {Date} referenceDate - Current Eastern wall-clock date
     * @param {number|null} maxDayOffset - Optional maximum calendar-day offset
     * @returns {{ meet: Object, dayOffset: number }|null} Relevant meet and relative day
     * @private
     */
    static findRelevantMeet(team, meets, referenceDate, maxDayOffset = null) {
      if (!team || !Array.isArray(meets) || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;

      const validMaxDayOffset = Number.isInteger(maxDayOffset) && maxDayOffset >= 0 ? maxDayOffset : null;
      const easternTimeInfo = {
        date: MeetDayGuideService.formatDateKey(referenceDate),
        isValid: true,
        minutes: (referenceDate.getHours() * 60) + referenceDate.getMinutes()
      };
      const candidates = meets.filter(candidate => {
        const hasDualMatchup = Boolean(candidate && (candidate.home_team || candidate.homeTeam) && (candidate.visiting_team || candidate.awayTeam));
        return hasDualMatchup && globalThis.PreferencesService.meetIncludesFavoriteTeam(candidate, team);
      }).sort((left, right) => left.date.localeCompare(right.date));

      for (const meet of candidates) {
        const meetDate = globalThis.TimeUtils.parseDateOnly(meet.date);
        const dayOffset = globalThis.TimeUtils.getRelativeFutureDayOffset(meetDate, referenceDate);
        if (dayOffset === null || (validMaxDayOffset !== null && dayOffset > validMaxDayOffset)) continue;
        if (typeof meet.getLiveStatus === 'function'
          && meet.getLiveStatus(easternTimeInfo) === globalThis.MeetLiveStatus.CONCLUDED) continue;
        return { meet, dayOffset };
      }
      return null;
    }

    /**
     * Builds personalized meet-day guidance from annual records.
     * @param {Object|null} team - Favorite team
     * @param {Array} teams - Published teams
     * @param {Array} meets - Published meets
     * @param {Array} pools - Published pools
     * @param {Date} referenceDate - Current Eastern wall-clock date
     * @param {number|null} maxDayOffset - Optional maximum calendar-day offset
     * @returns {Object|null} Display-ready guidance or null outside the display window
     */
    static getGuide(team, teams, meets, pools, referenceDate = new Date(), maxDayOffset = null) {
      const publishedTeams = Array.isArray(teams) ? teams : [];
      const publishedPools = Array.isArray(pools) ? pools : [];
      const relevantMeet = MeetDayGuideService.findRelevantMeet(team, meets, referenceDate, maxDayOffset);
      if (!relevantMeet) return null;

      const { meet } = relevantMeet;
      const homeLabel = meet.home_team || meet.homeTeam;
      const visitingLabel = meet.visiting_team || meet.awayTeam;
      const role = globalThis.PreferencesService.teamMatchesLabel(team, homeLabel)
        ? globalThis.MeetTeamRole.HOME
        : globalThis.MeetTeamRole.AWAY;
      const homeTeam = MeetDayGuideService.findTeam(publishedTeams, homeLabel);
      const visitingTeam = MeetDayGuideService.findTeam(publishedTeams, visitingLabel);
      const pool = MeetDayGuideService.findPool(publishedPools, meet.location);
      const hostGuide = (homeTeam?.homeMeetGuides || []).find(guide => guide.poolId === pool?.id) || null;
      const roleGuide = role === globalThis.MeetTeamRole.HOME ? hostGuide?.homeTeam : hostGuide?.visitingTeam;
      const relativeDayLabel = globalThis.TimeUtils.formatRelativeFutureDay(
        globalThis.TimeUtils.parseDateOnly(meet.date),
        referenceDate
      );

      return {
        date: meet.date,
        dayLabel: relativeDayLabel.charAt(0).toUpperCase() + relativeDayLabel.slice(1),
        generalGuide: hostGuide?.general || null,
        homeTeam,
        meet,
        pool,
        poolAddress: MeetDayGuideService.getPoolAddress(pool),
        role,
        roleGuide: roleGuide || null,
        team,
        visitingTeam
      };
    }

    /**
     * Formats a 24-hour guide time for visitors.
     * @param {string} value - Time in HH:mm format
     * @returns {string} Twelve-hour display time or the original value
     * @private
     */
    static formatClockTime(value) {
      return globalThis.Meet.formatClockTime(value) || String(value || '');
    }

    /**
     * Formats a published warm-up start time.
     * @param {Object|null} roleGuide - Role-specific host guidance
     * @returns {string} Warm-up guidance
     * @private
     */
    static formatWarmups(roleGuide) {
      return roleGuide?.warmupTime
        ? `Start at ${MeetDayGuideService.formatClockTime(roleGuide.warmupTime)}`
        : '';
    }

    /**
     * Formats parking guidance from general and role-specific facts.
     * @param {Object|null} generalGuide - General host guidance
     * @param {Object|null} roleGuide - Role-specific host guidance
     * @returns {string[]} Parking guidance lines
     * @private
     */
    static getParkingLines(generalGuide, roleGuide) {
      const lines = [];
      if (generalGuide?.parkingLocation) lines.push(`Park ${generalGuide.parkingLocation}.`);
      lines.push(...(generalGuide?.parkingNotes || []));
      if (roleGuide?.parkingLocation) lines.push(`Team parking is ${roleGuide.parkingLocation}.`);
      if (roleGuide?.reservedParking) lines.push(roleGuide.reservedParking);
      return lines;
    }

    /**
     * Returns unique canonical payment methods from published concession data.
     * @param {Object|null} concessions - Published concessions guidance
     * @returns {PaymentMethodValue[]} Canonical methods in source order
     * @private
     */
    static getPaymentMethods(concessions) {
      return globalThis.PaymentMethod.filterValid(concessions?.paymentMethods);
    }

    /**
     * Formats payment-method labels as a natural-language list.
     * @param {string[]} labels - Payment-method labels in display order
     * @returns {string} Labels joined with a final "and"
     * @private
     */
    static formatPaymentMethods(labels) {
      if (labels.length < 2) return labels[0] || '';
      if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
      return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
    }

    /**
     * Formats concessions guidance as concise visitor-facing sentences.
     * @param {Object|null} concessions - Published concessions guidance
     * @returns {string[]} Concessions guidance lines
     * @private
     */
    static getConcessionLines(concessions) {
      if (!concessions) return [];

      const lines = [];
      const canonicalPaymentMethods = MeetDayGuideService.getPaymentMethods(concessions);
      if (canonicalPaymentMethods.length) {
        const paymentMethods = MeetDayGuideService.formatPaymentMethods(
          canonicalPaymentMethods.map(method => PAYMENT_METHOD_PRESENTATION[method].label)
        );
        lines.push(`We accept ${paymentMethods}.`);
      }
      if (canonicalPaymentMethods.includes(globalThis.PaymentMethod.CASH)) {
        const preferredBills = MeetDayGuideService.formatPaymentMethods(
          CASH_BILL_PREFERRED_DENOMINATIONS.map(value => `$${value}`)
        );
        lines.push(`Use bills of $${CASH_BILL_MAXIMUM_DENOMINATION} or less; ${preferredBills} bills are especially helpful.`);
      }
      const unavailableBills = MeetDayGuideService.formatPaymentMethods(
        concessions.denominationsNotAccepted?.map(value => `$${value} bills`) || []
      );
      if (unavailableBills) {
        lines.push(`We cannot accept ${unavailableBills}.`);
      }
      if (concessions.opensAt) lines.push(`Concessions open at ${MeetDayGuideService.formatClockTime(concessions.opensAt)}.`);
      if (concessions.dietaryOptions?.length) {
        lines.push(`Dietary options: ${concessions.dietaryOptions.map(option => `${option.type}${option.availability === 'by-request' ? ' by request' : ` (${option.availability})`}`).join(', ')}`);
      }
      if (concessions.notes?.length) lines.push(...concessions.notes);
      return lines;
    }

    /**
     * Renders one canonical payment method as decorative visual reinforcement.
     * @param {PaymentMethodValue} method - Canonical payment method
     * @returns {string} Payment-method markup or an empty string
     * @private
     */
    static renderPaymentMethod(method) {
      const presentation = PAYMENT_METHOD_PRESENTATION[method];
      if (!presentation) return '';
      if (presentation.assetPath) {
        return `<span class="my-meet-day__payment-method my-meet-day__payment-method--brand"><img class="my-meet-day__payment-logo my-meet-day__payment-logo--${method}" src="${presentation.assetPath}" alt="" width="${presentation.width}" height="${presentation.height}"></span>`;
      }

      const icon = presentation.iconName
        ? globalThis.IconCatalog.render(presentation.iconName, 'my-meet-day__payment-icon')
        : '';
      return `<span class="my-meet-day__payment-method">${icon}<span>${globalThis.HtmlSafety.escapeHtml(presentation.visualLabel)}</span></span>`;
    }

    /**
     * Renders canonical payment methods as a decorative visual row.
     * @param {*} methods - Candidate payment-method collection
     * @returns {string} Payment-method row or an empty string
     * @private
     */
    static renderPaymentMethods(methods) {
      const methodMarkup = globalThis.PaymentMethod.filterValid(methods)
        .map(method => MeetDayGuideService.renderPaymentMethod(method))
        .join('');
      return methodMarkup
        ? `<div class="my-meet-day__payment-methods" aria-hidden="true">${methodMarkup}</div>`
        : '';
    }

    /**
     * Formats role-specific swimmer and volunteer check-in instructions.
     * @param {Object|null} roleGuide - Role-specific host guidance
     * @returns {string[]} Check-in guidance lines
     * @private
     */
    static getCheckInLines(roleGuide) {
      const lines = [];
      if (roleGuide?.checkInGuidance) lines.push(roleGuide.checkInGuidance);
      if (roleGuide?.swimmerCheckInLocation) lines.push(`Swimmers check in ${roleGuide.swimmerCheckInLocation}.`);
      if (roleGuide?.volunteerCheckInLocation) lines.push(`Volunteers check in ${roleGuide.volunteerCheckInLocation}.`);
      return lines;
    }

    /**
     * Renders one definition-list fact when it has content.
     * @param {string} label - Fact label
     * @param {string[]} lines - Fact lines
     * @param {boolean} valuesAreHtml - Whether values are already safe HTML
     * @returns {string} Fact HTML
     * @private
     */
    static renderFact(label, lines, valuesAreHtml = false) {
      const visibleLines = lines.filter(Boolean);
      if (visibleLines.length === 0) return '';
      const values = visibleLines.map(value => valuesAreHtml ? value : globalThis.HtmlSafety.escapeHtml(value));
      return `<div class="my-meet-day__fact"><dt>${globalThis.HtmlSafety.escapeHtml(label)}</dt><dd>${values.join('<br>')}</dd></div>`;
    }

    /**
     * Renders guidance lines as a semantic bulleted fact.
     * @param {string} label - Guidance label
     * @param {string[]} lines - Guidance items
     * @returns {string} Guidance fact HTML or an empty string
     * @private
     */
    static renderGuidanceFact(label, lines) {
      const items = lines
        .filter(Boolean)
        .map(line => `<li>${globalThis.HtmlSafety.escapeHtml(line)}</li>`)
        .join('');
      if (!items) return '';
      return `<div class="my-meet-day__fact"><dt>${globalThis.HtmlSafety.escapeHtml(label)}</dt><dd><ul class="my-meet-day__guidance-list">${items}</ul></dd></div>`;
    }

    /**
     * Renders one semantically grouped concessions menu category.
     * @param {string} label - Menu category label
     * @param {string[]|undefined} items - Published menu items
     * @returns {string} Menu category HTML or an empty string
     * @private
     */
    static renderConcessionGroup(label, items) {
      if (!Array.isArray(items) || items.length === 0) return '';
      const icon = CONCESSION_GROUP_PRESENTATION[label]
        ? globalThis.IconCatalog.render(CONCESSION_GROUP_PRESENTATION[label], 'my-meet-day__concessions-icon')
        : '';
      const itemMarkup = items
        .map(item => `<li>${globalThis.HtmlSafety.escapeHtml(item)}</li>`)
        .join('');
      return `<div class="my-meet-day__concessions-group"><strong>${icon}${globalThis.HtmlSafety.escapeHtml(label)}</strong><ul class="my-meet-day__concessions-items">${itemMarkup}</ul></div>`;
    }

    /**
     * Renders the concessions details and semantic menu groups as one emphasized fact.
     * @param {Object|null} concessions - Published concessions guidance
     * @returns {string} Concessions fact HTML or an empty string
     * @private
     */
    static renderConcessions(concessions) {
      if (!concessions) return '';

      const detailLines = MeetDayGuideService.getConcessionLines(concessions);
      const paymentMethods = MeetDayGuideService.getPaymentMethods(concessions);
      const hasPaymentMethods = paymentMethods.length > 0;
      const paymentIntroduction = hasPaymentMethods ? detailLines[0] : '';
      const supportingLines = hasPaymentMethods ? detailLines.slice(1) : detailLines;
      const supportingDetails = supportingLines
        .map(line => globalThis.HtmlSafety.escapeHtml(line))
        .join('<br>');
      const menuGroups = [
        MeetDayGuideService.renderConcessionGroup('Meals', concessions.mealItems),
        MeetDayGuideService.renderConcessionGroup('Snacks', concessions.snackItems),
        MeetDayGuideService.renderConcessionGroup('Food', concessions.foodItems),
        MeetDayGuideService.renderConcessionGroup('Drinks', concessions.drinkItems)
      ].filter(Boolean).join('');
      if (!paymentIntroduction && !supportingDetails && !menuGroups) return '';

      const introductionMarkup = paymentIntroduction
        ? `<p class="my-meet-day__concessions-details"><strong>${globalThis.HtmlSafety.escapeHtml(paymentIntroduction)}</strong></p>`
        : '';
      const paymentMethodsMarkup = MeetDayGuideService.renderPaymentMethods(paymentMethods);
      const supportingMarkup = supportingDetails
        ? `<p class="my-meet-day__concessions-details my-meet-day__concessions-details--supporting">${supportingDetails}</p>`
        : '';
      const menuMarkup = menuGroups ? `<div class="my-meet-day__concessions-menu">${menuGroups}</div>` : '';
      return `<div class="my-meet-day__fact my-meet-day__fact--concessions"><dt>Concessions</dt><dd>${introductionMarkup}${paymentMethodsMarkup}${supportingMarkup}${menuMarkup}</dd></div>`;
    }

    /**
     * Renders one prominent meet timing fact when it has content.
     * @param {string} label - Timing label
     * @param {string} primary - Primary timing instruction
     * @param {string} detail - Supporting timing guidance
     * @returns {string} Timing fact HTML
     * @private
     */
    static renderTimingFact(label, primary, detail) {
      if (!primary) return '';
      const safeDetail = detail ? `<span>${globalThis.HtmlSafety.escapeHtml(detail)}</span>` : '';
      return `<div class="my-meet-day__timing-item"><dt>${globalThis.HtmlSafety.escapeHtml(label)}</dt><dd><strong>${globalThis.HtmlSafety.escapeHtml(primary)}</strong>${safeDetail}</dd></div>`;
    }

    /**
     * Renders safe meet-day guidance markup.
     * @param {Object|null} guide - Display-ready guidance
     * @returns {string} Meet-day HTML or an empty string
     */
    static renderGuide(guide) {
      if (!guide) return '';

      const { generalGuide, meet, pool, roleGuide } = guide;
      const roleLabel = guide.role === globalThis.MeetTeamRole.HOME ? 'Home meet' : 'Away meet';
      const homeName = guide.homeTeam?.shortName || guide.homeTeam?.name || meet.home_team || meet.homeTeam;
      const visitingName = guide.visitingTeam?.shortName || guide.visitingTeam?.name || meet.visiting_team || meet.awayTeam;
      const meetDate = new Date(`${guide.date}T12:00:00`);
      const dateLabel = meetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long' });
      const matchup = `${visitingName} @ ${homeName}`;
      const meetTime = globalThis.TeamAgendaDisplay.getMeetDisplayTime(meet, guide.team);
      const locationName = pool?.name ? `${pool.name} Pool` : meet.location;
      const locationLink = pool?.id
        ? globalThis.generatePoolsPageLink(pool.id, locationName)
        : globalThis.HtmlSafety.escapeHtml(locationName);
      const directionsLink = pool
        ? globalThis.generatePoolDirectionsLink(pool, locationName)
        : '';
      const safePoolAddress = globalThis.HtmlSafety.escapeHtml(guide.poolAddress);
      const arrivalTime = roleGuide?.arrivalTime ? MeetDayGuideService.formatClockTime(roleGuide.arrivalTime) : '';
      const arrivalPrimary = arrivalTime
        ? `Arrive by ${arrivalTime}`
        : roleGuide?.arrivalGuidance ? 'Arrive early' : roleGuide ? 'Arrival time not provided' : '';
      const arrivalDetail = roleGuide?.arrivalGuidance
        || (roleGuide ? 'Allow enough time to get settled before warm-ups.' : '');
      const relayCheckInDeadline = typeof meet.getRelayCheckInDeadlineDisplayTime === 'function'
        ? meet.getRelayCheckInDeadlineDisplayTime()
        : MeetDayGuideService.formatClockTime(meet.timingWindow?.relayCheckInDeadline);
      const firstSwimTime = typeof meet.getFirstSwimDisplayTime === 'function'
        ? meet.getFirstSwimDisplayTime()
        : MeetDayGuideService.formatClockTime(meet.timingWindow?.firstSwimTime);
      const setupLines = [];
      if (roleGuide?.familySetupLocation) setupLines.push(`Set up ${roleGuide.familySetupLocation}.`);
      const concessions = generalGuide?.concessions;
      const helpfulNotes = [...(generalGuide?.poolsideConditions || []), ...(generalGuide?.helpfulNotes || []), ...(roleGuide?.helpfulNotes || [])];
      const isHomeMeet = guide.role === globalThis.MeetTeamRole.HOME;
      const volunteerLead = isHomeMeet
        ? 'Home meets depend on volunteers.'
        : 'Swim meets depend on volunteers from both teams.';
      const volunteerDetail = isHomeMeet
        ? 'Check your team signup and help fill any open role.'
        : 'Check your team signup for any open role.';
      const volunteerMarkup = `${isHomeMeet ? `<strong>${globalThis.HtmlSafety.escapeHtml(volunteerLead)}</strong>` : globalThis.HtmlSafety.escapeHtml(volunteerLead)} ${globalThis.HtmlSafety.escapeHtml(volunteerDetail)}`;
      const dayPillClass = guide.dayLabel === 'Today'
        ? ' upcoming-day-pill--today'
        : guide.dayLabel === 'Tomorrow' ? ' upcoming-day-pill--tomorrow' : '';

      return `
        <div class="my-meet-day__summary">
          <span class="my-meet-day__role my-meet-day__role--${guide.role}">${roleLabel}</span>
          <p class="my-meet-day__matchup"><strong>${globalThis.HtmlSafety.escapeHtml(matchup)}</strong></p>
          <p class="my-meet-day__location">${locationLink}</p>
          ${directionsLink ? `<p class="my-meet-day__directions">${directionsLink}</p>` : ''}
          <p class="my-meet-day__schedule"><span class="my-meet-day__schedule-details"><time datetime="${globalThis.HtmlSafety.escapeHtml(guide.date)}">${globalThis.HtmlSafety.escapeHtml(dateLabel)}</time><span class="my-meet-day__meet-time">${globalThis.HtmlSafety.escapeHtml(meetTime)}</span></span><span class="upcoming-day-pill${dayPillClass}">${globalThis.HtmlSafety.escapeHtml(guide.dayLabel.toLowerCase())}</span></p>
        </div>
        <section class="my-meet-day__timing" aria-label="Key times">
          <dl>
            ${MeetDayGuideService.renderTimingFact('Team arrival', arrivalPrimary, arrivalDetail)}
            ${MeetDayGuideService.renderTimingFact('Warm-ups', MeetDayGuideService.formatWarmups(roleGuide), '')}
            ${MeetDayGuideService.renderTimingFact('Relay check-in', relayCheckInDeadline ? `By ${relayCheckInDeadline}` : '', '')}
            ${MeetDayGuideService.renderTimingFact('First swim', firstSwimTime ? `Starts at ${firstSwimTime}` : '', '')}
          </dl>
        </section>
        <dl class="my-meet-day__facts">
          ${MeetDayGuideService.renderFact('Where', [locationLink, safePoolAddress], true)}
          ${MeetDayGuideService.renderGuidanceFact('Parking', MeetDayGuideService.getParkingLines(generalGuide, roleGuide))}
          ${MeetDayGuideService.renderGuidanceFact('Team setup', setupLines)}
          ${MeetDayGuideService.renderGuidanceFact('Check-in', MeetDayGuideService.getCheckInLines(roleGuide))}
          ${MeetDayGuideService.renderGuidanceFact('Clerk of course', [roleGuide?.clerkGuidance])}
          ${MeetDayGuideService.renderConcessions(concessions)}
          ${MeetDayGuideService.renderGuidanceFact('Good to know', helpfulNotes)}
          <div class="my-meet-day__fact my-meet-day__fact--volunteer"><dt>Volunteer reminder</dt><dd>${volunteerMarkup}</dd></div>
        </dl>
      `;
    }
  }

  globalThis.MeetDayGuideService = MeetDayGuideService;
}
