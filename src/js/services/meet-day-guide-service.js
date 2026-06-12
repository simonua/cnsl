/**
 * Selects and safely renders personalized near-term meet guidance.
 * Combines annual matchup, pool, and recurring host-team facts without DOM access.
 */
if (typeof globalThis.MeetDayGuideService === 'undefined') {
  const MEET_HEAT_NOTICE_MAX_LANES = 6;
  const PAYMENT_METHOD_LABELS = Object.freeze({
    cash: 'cash',
    credit: 'credit',
    other: 'other listed methods',
    paypal: 'PayPal',
    venmo: 'Venmo'
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
     * Selects a favorite-team dual meet within the configured inclusive look-ahead window.
     * @param {Object|null} team - Favorite team
     * @param {Array} meets - Published meets
     * @param {Date} referenceDate - Current Eastern wall-clock date
     * @returns {{ meet: Object, dayOffset: number }|null} Relevant meet and relative day
     * @private
     */
    static findRelevantMeet(team, meets, referenceDate) {
      if (!team || !Array.isArray(meets) || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;

      const today = new Date(referenceDate);
      today.setHours(0, 0, 0, 0);
      const dayOffsets = new Map(Array.from(
        { length: globalThis.MY_MEET_DAY_LOOKAHEAD_DAYS + 1 },
        (_, dayOffset) => {
          const date = new Date(today);
          date.setDate(today.getDate() + dayOffset);
          return [MeetDayGuideService.formatDateKey(date), dayOffset];
        }
      ));
      const meet = meets.find(candidate => {
        const hasDualMatchup = Boolean(candidate && (candidate.home_team || candidate.homeTeam) && (candidate.visiting_team || candidate.awayTeam));
        return hasDualMatchup
          && dayOffsets.has(candidate.date)
          && globalThis.PreferencesService.meetIncludesFavoriteTeam(candidate, team);
      });
      return meet ? { meet, dayOffset: dayOffsets.get(meet.date) } : null;
    }

    /**
     * Builds personalized meet-day guidance from annual records.
     * @param {Object|null} team - Favorite team
     * @param {Array} teams - Published teams
     * @param {Array} meets - Published meets
     * @param {Array} pools - Published pools
     * @param {Date} referenceDate - Current Eastern wall-clock date
     * @returns {Object|null} Display-ready guidance or null outside the display window
     */
    static getGuide(team, teams, meets, pools, referenceDate = new Date()) {
      const publishedTeams = Array.isArray(teams) ? teams : [];
      const publishedPools = Array.isArray(pools) ? pools : [];
      const relevantMeet = MeetDayGuideService.findRelevantMeet(team, meets, referenceDate);
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
     * Formats a warm-up window or start time.
     * @param {Object|null} roleGuide - Role-specific host guidance
     * @returns {string} Warm-up guidance
     * @private
     */
    static formatWarmups(roleGuide) {
      const warmups = roleGuide?.warmups;
      if (warmups?.start && warmups?.end) {
        return `${MeetDayGuideService.formatClockTime(warmups.start)} to ${MeetDayGuideService.formatClockTime(warmups.end)}`;
      }
      const start = warmups?.start || roleGuide?.warmupsStartAt;
      return start ? `Start at ${MeetDayGuideService.formatClockTime(start)}` : '';
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
      if (generalGuide?.parkingLocation) lines.push(`Please park ${generalGuide.parkingLocation}.`);
      lines.push(...(generalGuide?.parkingNotes || []));
      if (roleGuide?.parkingLocation) lines.push(`Team parking is ${roleGuide.parkingLocation}.`);
      if (roleGuide?.reservedParking) lines.push(roleGuide.reservedParking);
      return lines;
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
      if (concessions.opensAt) lines.push(`Concessions open at ${MeetDayGuideService.formatClockTime(concessions.opensAt)}.`);
      if (concessions.paymentMethods?.length) {
        const paymentMethods = concessions.paymentMethods.map(method => PAYMENT_METHOD_LABELS[method] || method).join(', ');
        const smallBills = concessions.smallBillsPreferred ? ' and prefer small bills' : '';
        lines.push(`We accept ${paymentMethods}${smallBills}.`);
      } else if (concessions.smallBillsPreferred) {
        lines.push('Small bills are preferred.');
      }
      if (concessions.denominationsNotAccepted?.length) {
        lines.push(`Please be aware that we cannot accept ${concessions.denominationsNotAccepted.map(value => `$${value} bills`).join(', ')}.`);
      }
      if (concessions.dietaryOptions?.length) {
        lines.push(`Dietary options: ${concessions.dietaryOptions.map(option => `${option.type}${option.availability === 'by-request' ? ' by request' : ` (${option.availability})`}`).join(', ')}`);
      }
      if (concessions.notes?.length) lines.push(...concessions.notes);
      return lines;
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
      const matchup = guide.role === globalThis.MeetTeamRole.HOME
        ? `${homeName} host ${visitingName}`
        : `${visitingName} visit ${homeName}`;
      const meetTime = globalThis.TeamAgendaDisplay.getMeetDisplayTime(meet, guide.team);
      const locationName = pool?.name ? `${pool.name} Pool` : meet.location;
      const locationLink = pool?.id
        ? globalThis.generatePoolsPageLink(pool.id, locationName)
        : globalThis.HtmlSafety.escapeHtml(locationName);
      const safePoolAddress = globalThis.HtmlSafety.escapeHtml(guide.poolAddress);
      const course = globalThis.formatPoolCourseLabel(pool);
      const courseLabel = course && pool?.laneCount && pool.laneCount <= MEET_HEAT_NOTICE_MAX_LANES
        ? `${course} (may mean more heats & longer meet time)`
        : course;
      const arrivalTime = roleGuide?.arrivalTime ? MeetDayGuideService.formatClockTime(roleGuide.arrivalTime) : '';
      const arrivalPrimary = arrivalTime
        ? `Arrive by ${arrivalTime}`
        : roleGuide?.arrivalGuidance ? 'Arrive early' : roleGuide ? 'Arrival time not provided' : '';
      const arrivalDetail = roleGuide?.arrivalGuidance
        || (roleGuide ? 'Please allow enough time to get settled before warm-ups.' : '');
      const setupLines = [];
      if (roleGuide?.familySetupLocation) setupLines.push(`Please set up ${roleGuide.familySetupLocation}.`);
      const concessions = generalGuide?.concessions;
      const helpfulNotes = [...(generalGuide?.poolsideConditions || []), ...(generalGuide?.helpfulNotes || []), ...(roleGuide?.helpfulNotes || [])];
      const volunteerMessage = guide.role === globalThis.MeetTeamRole.HOME
        ? 'Home meets depend on volunteers. Please check your team signup and help fill any open role.'
        : 'Swim meets depend on volunteers from both teams. Please check your team signup for any open role.';
      const dayPillClass = guide.dayLabel === 'Today'
        ? ' upcoming-day-pill--today'
        : guide.dayLabel === 'Tomorrow' ? ' upcoming-day-pill--tomorrow' : '';

      return `
        <div class="my-meet-day__summary">
          <span class="my-meet-day__role my-meet-day__role--${guide.role}">${roleLabel}</span>
          <p class="my-meet-day__matchup"><strong>${globalThis.HtmlSafety.escapeHtml(matchup)}</strong></p>
          <p class="my-meet-day__schedule"><time datetime="${globalThis.HtmlSafety.escapeHtml(guide.date)}">${globalThis.HtmlSafety.escapeHtml(dateLabel)}</time><span class="upcoming-day-pill${dayPillClass}">${globalThis.HtmlSafety.escapeHtml(guide.dayLabel.toLowerCase())}</span><span class="my-meet-day__meet-time">${globalThis.HtmlSafety.escapeHtml(meetTime)}</span></p>
        </div>
        <section class="my-meet-day__timing" aria-labelledby="myMeetDayKeyTimes">
          <h3 id="myMeetDayKeyTimes">Key times</h3>
          <dl>
            ${MeetDayGuideService.renderTimingFact('Team arrival', arrivalPrimary, arrivalDetail)}
            ${MeetDayGuideService.renderTimingFact('Warm-ups', MeetDayGuideService.formatWarmups(roleGuide), '')}
          </dl>
        </section>
        <dl class="my-meet-day__facts">
          ${MeetDayGuideService.renderFact('Where', [locationLink, safePoolAddress], true)}
          ${MeetDayGuideService.renderFact('Pool', [courseLabel])}
          ${MeetDayGuideService.renderFact('Parking', MeetDayGuideService.getParkingLines(generalGuide, roleGuide))}
          ${MeetDayGuideService.renderFact('Team setup', setupLines)}
          ${MeetDayGuideService.renderFact('Check-in', MeetDayGuideService.getCheckInLines(roleGuide))}
          ${MeetDayGuideService.renderFact('Clerk of course', [roleGuide?.clerkGuidance])}
          ${MeetDayGuideService.renderFact('Concessions', MeetDayGuideService.getConcessionLines(concessions))}
          ${MeetDayGuideService.renderFact('Food', [concessions?.foodItems?.join(', ')])}
          ${MeetDayGuideService.renderFact('Drinks', [concessions?.drinkItems?.join(', ')])}
          ${MeetDayGuideService.renderFact('Good to know', helpfulNotes)}
        </dl>
        <p class="my-meet-day__volunteer"><strong>Volunteer reminder:</strong> ${globalThis.HtmlSafety.escapeHtml(volunteerMessage)}</p>
      `;
    }
  }

  globalThis.MeetDayGuideService = MeetDayGuideService;
}
