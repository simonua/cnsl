// Global data manager instance for teams browser
let teamsBrowserDataManager = null;
let teamsPoolLocationIndex = new Map();
let teamsBrowserTeams = [];
let teamsBrowserEnrichmentPromise = null;
const teamDetailsHydrationPromises = new Map();
const TeamsBrowserSafety = HtmlSafety;
const AVAILABLE_TEAM_LOGOS = new Set([
  'ccc', 'cfhss', 'dsd', 'hcc', 'hd', 'kcw', 'lrm', 'obb', 'omts', 'pls', 'prp', 'prr', 'thl', 'wlw'
]);
const TEAM_DETAILS_LOADING_HTML = '<p class="team-details__loading" role="status">Loading team details...</p>';
const TEAM_DETAILS_UNAVAILABLE_HTML = '<p class="team-details__loading" role="status">Team details are unavailable. Please refresh the page to try again.</p>';
const TEAM_DETAILS_DEPENDENCIES = Object.freeze([
  'js/services/time-utils.js',
  'js/types/pool-enums.js',
  'js/types/schedule-state.js',
  'js/services/pool-period-schedule-service.js',
  'js/services/pool-link-helper.js',
  'js/services/team-schedule-service.js',
  'js/models/pool.js',
  'js/models/meet.js',
  'js/managers/pools-manager.js',
  'js/managers/meets-manager.js',
  'js/services/team-agenda-display.js'
]);
const teamsBrowserControllerSource = document.currentScript && document.currentScript.src
  ? new URL(document.currentScript.src, document.baseURI)
  : null;
const teamsBrowserAssetVersion = teamsBrowserControllerSource
  ? teamsBrowserControllerSource.searchParams.get('v')
  : '';
let teamsBrowserDependenciesPromise = null;

globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.PREPARING);

/**
 * Records a team-directory performance milestone when the Performance API is available.
 * @param {string} markName - Team milestone name
 */
function markTeamPerformance(markName) {
  if (globalThis.performance && typeof globalThis.performance.mark === 'function') {
    globalThis.performance.mark(`cnsl:teams:${markName}`);
  }
}

/**
 * Applies the controller asset version to a team-detail dependency URL.
 * @param {string} source - Relative dependency source
 * @returns {string} Versioned dependency URL or the unchanged relative source
 */
function getTeamDependencySource(source) {
  if (!teamsBrowserAssetVersion) return source;

  const dependencySource = new URL(source, document.baseURI);
  dependencySource.searchParams.set('v', teamsBrowserAssetVersion);
  return dependencySource.toString();
}

/**
 * Appends one classic team-detail dependency and resolves after it loads.
 * @param {string} source - Relative dependency source
 * @returns {Promise<void>} Promise settled when the dependency loads or fails
 */
function loadTeamDependency(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = getTeamDependencySource(source);
    script.dataset.teamDetailsDependency = source;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`Unable to load ${source}.`)), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Loads team-detail dependencies once in their classic-script order.
 * @returns {Promise<void>} Promise settled when all team-detail dependencies load
 */
function loadTeamDetailDependencies() {
  if (!teamsBrowserDependenciesPromise) {
    teamsBrowserDependenciesPromise = TEAM_DETAILS_DEPENDENCIES.reduce(
      (loadPromise, source) => loadPromise.then(() => loadTeamDependency(source)),
      Promise.resolve()
    );
  }
  return teamsBrowserDependenciesPromise;
}


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the teams browser with data manager
 * @returns {Promise<void>} Promise settled after team dependencies initialize
 */
async function initializeTeamsBrowser() {
  if (!teamsBrowserDataManager) {
    teamsBrowserDataManager = getDataManager();
    await teamsBrowserDataManager.initialize(['teams']);
    markTeamPerformance('primary-data-ready');
  }
}

/**
 * Loads pool and meet context once without blocking the initial team summaries.
 * @returns {Promise<boolean>} Promise resolving whether team-detail dependencies are available
 */
function startTeamsBrowserEnrichment() {
  if (teamsBrowserEnrichmentPromise) return teamsBrowserEnrichmentPromise;

  teamsBrowserEnrichmentPromise = loadTeamDetailDependencies().then(() => Promise.allSettled([
    teamsBrowserDataManager.initialize(['pools']),
    teamsBrowserDataManager.initialize(['meets'])
  ])).then(([poolsResult, meetsResult]) => {
    if (poolsResult.status === 'fulfilled') {
      teamsPoolLocationIndex = globalThis.createPoolLocationIndex(teamsBrowserDataManager.getPools().getAllPools());
    } else {
      console.warn('[Teams Browser] Pool links are unavailable:', poolsResult.reason);
    }
    if (meetsResult.status === 'rejected') {
      console.warn('[Teams Browser] Meet schedules are unavailable:', meetsResult.reason);
    }
    markTeamPerformance('optional-enrichment-settled');
    return true;
  }).catch(error => {
    console.warn('[Teams Browser] Team details are unavailable:', error);
    markTeamPerformance('optional-enrichment-settled');
    return false;
  });
  return teamsBrowserEnrichmentPromise;
}

/**
 * Hydrates team details that are already expanded after optional work is allowed.
 */
function hydrateExpandedTeamDetails() {
  document.querySelectorAll('.team-header__toggle[aria-expanded="true"]').forEach(toggle => {
    const teamCard = toggle.closest('.team-card');
    if (teamCard) void hydrateTeamDetails(teamCard);
  });
}

/**
 * Starts optional team-detail work after a prerendered route activates.
 */
function startTeamsBrowserActivationWork() {
  void startTeamsBrowserEnrichment();
  hydrateExpandedTeamDetails();
  handleTeamUrlParameter();
}

/**
 * Defers optional Teams work while the route is being prepared in a hidden prerender.
 */
function scheduleTeamsBrowserActivationWork() {
  if (!document.prerendering) {
    startTeamsBrowserActivationWork();
    return;
  }

  document.addEventListener('prerenderingchange', startTeamsBrowserActivationWork, { once: true });
}

/**
 * Update assistive loading feedback for the team directory.
 * @param {string} message - Status message to announce
 * @param {boolean} isBusy - Whether the directory is loading
 */
function setTeamListStatus(message, isBusy) {
  const list = document.getElementById('teamList');
  const status = document.getElementById('teamListStatus');
  if (list) list.setAttribute('aria-busy', String(isBusy));
  if (status) status.textContent = message;
}

/**
 * Find pool by name from data manager (using pool link helper)
 * @param {string} poolName - Name of the pool to find
 * @returns {Object|null} - Pool object or null if not found
 */
function findPoolByName(poolName) {
  if (!poolName || !teamsBrowserDataManager) return null;

  // Use the pool link helper to get pool data
  return getPoolDataFromLocation(poolName, teamsBrowserDataManager, teamsPoolLocationIndex);
}

/**
 * Get enhanced pool link using new pool link helper
 * @param {string} location - Pool location name
 * @param {string} [displayText] - Optional visible pool link label
 * @returns {string} - HTML link to pools.html page with pool data
 */
function getEnhancedPoolLink(location, displayText = location) {
  if (!location) return '';

  // Use the new pool link helper
  return generateEnhancedPoolLink(location, teamsBrowserDataManager, {
    preferPoolsPage: true,
    showBothLinks: false,
    displayText
  }, teamsPoolLocationIndex);
}

/**
 * Filters practice sessions to the visitor's selected practice groups.
 * @param {Array} sessions - Published practice sessions
 * @returns {Array} Visible practice sessions
 */
function getVisiblePracticeSessions(sessions) {
  return PreferencesService.filterPracticeSessions(sessions, PreferencesService.get().practiceGroups);
}

/**
 * Formats practice sessions as escaped schedule rows.
 * @param {Array} sessions - Visible practice sessions
 * @returns {string} Practice-session HTML
 */
function formatPracticeSessions(sessions) {
  return `<div class="sessions">${sessions.map(session => `
    <div class="session-item">
      <span class="session-time">${TeamsBrowserSafety.escapeHtml(session.time)}</span>
      <span class="session-group">${TeamsBrowserSafety.escapeHtml(session.group)}</span>
    </div>
  `).join('')}</div>`;
}

/**
 * Formats a collapsible practice phase.
 * @param {string} title - Phase heading
 * @param {string} dateRange - Published phase date range
 * @param {string} content - Phase body HTML
 * @param {boolean} isCurrent - Whether this is the current phase
 * @returns {string} Practice-phase HTML
 */
function formatPracticePhase(title, dateRange, content, isCurrent) {
  const currentClass = isCurrent ? ' practice-schedule__phase--current' : '';
  const currentBadge = isCurrent ? '<span class="practice-schedule__badge">Current schedule</span>' : '';
  const mobileOpen = window.matchMedia('(max-width: 48rem), (pointer: coarse)').matches ? ' open' : '';
  return `
    <details class="practice-schedule__phase${currentClass}"${mobileOpen}>
      <summary class="practice-schedule__summary">
        <span class="practice-schedule__title">${title}</span>
        <span class="practice-schedule__dates">${TeamsBrowserSafety.escapeHtml(dateRange)}</span>
        ${currentBadge}
        <span class="practice-schedule__toggle-icon" aria-hidden="true">&#9650;</span>
      </summary>
      <div class="practice-schedule__body">${content}</div>
    </details>
  `;
}

/**
 * Formats visible pre-season practice periods.
 * @param {Object} practice - Published team practice data
 * @param {boolean} isCurrent - Whether pre-season is current
 * @returns {string} Pre-season practice HTML
 */
function formatPreseasonPracticeSchedule(practice, isCurrent) {
  const publishedPeriods = Array.isArray(practice && practice.preseason) ? practice.preseason : [];
  const periods = publishedPeriods.map(period => ({
    ...period,
    sessions: getVisiblePracticeSessions(period.sessions)
  })).filter(period => period.sessions.length > 0);
  const statuses = periods.map(period => globalThis.TeamScheduleService.getPracticeRangeStatus(period.period));
  const currentPeriodIndex = isCurrent ? statuses.indexOf(PracticeRangeStatus.CURRENT) : -1;
  const upcomingPeriodIndex = currentPeriodIndex === -1 ? statuses.indexOf(PracticeRangeStatus.UPCOMING) : -1;
  if (periods.length === 0) return '';

  const content = periods.map((period, index) => {
    const status = index === currentPeriodIndex
      ? PracticeRangeStatus.CURRENT
      : index === upcomingPeriodIndex ? PracticeRangeStatus.UPCOMING : null;
    const badge = status ? `<span class="practice-period__badge">${status === PracticeRangeStatus.CURRENT ? 'Current' : 'Upcoming'} period</span>` : '';
    return `
    <div class="practice-period${status ? ` practice-period--${status}` : ''}">
      <strong>${TeamsBrowserSafety.escapeHtml(period.period)}${badge}</strong>
      <div class="practice-details">
        <div><strong>Days:</strong> ${TeamsBrowserSafety.escapeHtml(period.days)}</div>
        <div><strong>Location:</strong> ${getEnhancedPoolLink(period.location)}</div>
        ${formatPracticeSessions(period.sessions)}
      </div>
    </div>
  `;
  }).join('');
  const dateRange = `${periods[0].period.split(' - ')[0]} - ${periods[periods.length - 1].period.split(' - ')[1]}`;
  return formatPracticePhase('Pre-season practices', dateRange, content, isCurrent);
}

/**
 * Formats visible in-season morning and evening practices.
 * @param {Object} practice - Published team practice data
 * @param {boolean} isCurrent - Whether the regular season is current
 * @returns {string} In-season practice HTML
 */
function formatInSeasonPracticeSchedule(practice, isCurrent) {
  const inSeasonSchedule = practice && practice.regular;
  if (!inSeasonSchedule) return '';
  const morningPractices = Array.isArray(inSeasonSchedule.morning) ? inSeasonSchedule.morning.map(morning => ({
    ...morning,
    sessions: getVisiblePracticeSessions(morning.sessions)
  })).filter(morning => morning.sessions.length > 0) : [];
  const eveningPractices = Array.isArray(inSeasonSchedule.evening) ? inSeasonSchedule.evening.map(evening => ({
    ...evening,
    sessions: getVisiblePracticeSessions(evening.sessions)
  })).filter(evening => evening.sessions.length > 0) : [];
  if (morningPractices.length === 0 && eveningPractices.length === 0) return '';

  let content = '';
  if (morningPractices.length > 0) {
    morningPractices.forEach(morning => {
      content += '<div class="practice-period">';
      content += '<strong>Morning Practice:</strong>';
      content += '<div class="practice-details">';
      content += `<div><strong>Days:</strong> ${TeamsBrowserSafety.escapeHtml(morning.days)}</div>`;
      if (morning.location) {
        const poolLink = getEnhancedPoolLink(morning.location);
        content += `<div><strong>Location:</strong> ${poolLink}</div>`;
      }
      content += formatPracticeSessions(morning.sessions);
      content += '</div></div>';
    });
  }

  if (eveningPractices.length > 0) {
    eveningPractices.forEach(evening => {
      content += '<div class="practice-period">';
      content += `<strong>${TeamsBrowserSafety.escapeHtml(evening.day)} Evening Practice:</strong>`;
      content += '<div class="practice-details">';
      if (evening.location) {
        const poolLink = getEnhancedPoolLink(evening.location);
        content += `<div><strong>Location:</strong> ${poolLink}</div>`;
      }
      content += formatPracticeSessions(evening.sessions);
      content += '</div></div>';
    });
  }

  return formatPracticePhase('In-season practices', inSeasonSchedule.season, content, isCurrent);
}

/**
 * Formats all available practice phases for a team.
 * @param {Object} practice - Published team practice data
 * @returns {string} Practice schedule HTML
 */
function formatPracticeSchedules(practice) {
  const currentPhase = globalThis.TeamScheduleService.getCurrentPracticePhase(practice);
  const preSeasonHtml = formatPreseasonPracticeSchedule(practice, currentPhase === 'preseason');
  const inSeasonHtml = formatInSeasonPracticeSchedule(practice, currentPhase === 'regular');
  if (!preSeasonHtml && !inSeasonHtml) return '';

  return `${preSeasonHtml}${inSeasonHtml}`;
}

/**
 * Formats a meet date for the team schedule.
 * @param {string} dateValue - Meet date in YYYY-MM-DD format
 * @returns {string} Escaped display date
 */
function formatMeetDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return TeamsBrowserSafety.escapeHtml(dateValue || 'Date unavailable');

  return TeamsBrowserSafety.escapeHtml(date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  }));
}

/**
 * Formats a meet timing window for responsive display.
 * @param {string} time - Displayable meet time range
 * @returns {string} Escaped meet-time HTML
 */
function formatMeetTime(time) {
  const timeParts = String(time || '').split(' - ');
  if (timeParts.length !== 2) return TeamsBrowserSafety.escapeHtml(time);

  const startTime = TeamsBrowserSafety.escapeHtml(timeParts[0]);
  const endTime = TeamsBrowserSafety.escapeHtml(timeParts[1]);
  return `<span class="team-meets__time-start">${startTime} -</span><span class="team-meets__time-end"> ${endTime}</span>`;
}

/**
 * Formats a matchup label and emphasizes the selected team.
 * @param {string} label - Published team label
 * @param {Object} team - Team represented by the card
 * @returns {string} Escaped matchup label HTML
 */
function formatMeetTeamLabel(label, team) {
  const safeLabel = TeamsBrowserSafety.escapeHtml(label);
  return PreferencesService.teamMatchesLabel(team, label) ? `<strong>${safeLabel}</strong>` : safeLabel;
}

/**
 * Removes a trailing pool suffix from a meet location label.
 * @param {*} location - Published meet location
 * @returns {string} Normalized location label
 */
function formatMeetLocationLabel(location) {
  return typeof location === 'string' ? location.replace(/\s+Pool\s*$/i, '').trim() : '';
}

/**
 * Formats a compact team-meet name.
 * @param {string} meetName - Published meet name
 * @returns {string} Escaped compact meet name
 */
function formatTeamMeetName(meetName) {
  const displayName = String(meetName || 'Meet').replace(/^Dual Meet\s+(#\d+)$/i, 'Dual $1');
  return TeamsBrowserSafety.escapeHtml(displayName);
}

/**
 * Determines whether a known pool course differs from the standard course.
 * @param {Object|null} poolData - Matched pool data
 * @returns {boolean} Whether the known course is nonstandard
 */
function hasNonstandardMeetCourse(poolData) {
  const hasKnownCourse = Number.isInteger(poolData?.laneCount)
    && Number.isFinite(poolData?.laneLength)
    && typeof poolData?.laneLengthUnits === 'string';
  return hasKnownCourse && (
    poolData.laneCount !== 8
    || poolData.laneLength !== 25
    || poolData.laneLengthUnits !== 'yards'
  );
}

/**
 * Formats meets involving a team as a schedule table.
 * @param {Object} team - Team represented by the card
 * @param {Array} meets - Available meet models
 * @returns {string} Team meet schedule HTML
 */
function formatMeetsSchedule(team, meets) {
  const teamMeets = Array.isArray(meets) ? meets.filter(meet => (
    meet && (!(meet.home_team || meet.visiting_team)
      || PreferencesService.meetIncludesFavoriteTeam(meet, team))
  )).sort((first, second) => String(first.date || '').localeCompare(String(second.date || ''))) : [];
  if (teamMeets.length === 0) return '';

  const safeTeamName = TeamsBrowserSafety.escapeHtml(team.name || 'team');
  const hasHomeMeet = teamMeets.some(meet => PreferencesService.teamMatchesLabel(team, meet.home_team || ''));
  const rows = teamMeets.map(meet => {
    const isTimeTrials = globalThis.TeamAgendaDisplay.isTimeTrialsMeet(meet);
    const isSpecialMeet = !(meet.home_team || meet.visiting_team);
    const awayTeam = meet.visiting_team || 'Away Team';
    const homeTeam = meet.home_team || 'Home Team';
    const isHomeMeet = PreferencesService.teamMatchesLabel(team, homeTeam);
    const location = isTimeTrials ? globalThis.TeamAgendaDisplay.getMeetLocation(meet, team) : meet.location;
    const time = globalThis.TeamAgendaDisplay.getMeetDisplayTime(meet, team);
    const poolData = findPoolByName(location);
    const courseLabel = formatPoolCourseLabel(poolData);
    const isNonstandardCourse = hasNonstandardMeetCourse(poolData);
    const courseInfo = courseLabel ? `<span class="team-meets__course${isNonstandardCourse ? ' team-meets__course--nonstandard' : ''}">${TeamsBrowserSafety.escapeHtml(courseLabel)}</span>` : '';
    const matchup = isSpecialMeet
      ? ''
      : `<span class="team-meets__matchup-team">${formatMeetTeamLabel(homeTeam, team)}</span> <span class="team-meets__matchup-team"><span class="vs">vs.</span> ${formatMeetTeamLabel(awayTeam, team)}</span>`;
    return `
      <tr${isHomeMeet ? ' class="team-meets__row--home"' : ''}>
        <td>${formatMeetDate(meet.date)}<span class="team-meets__time">${formatMeetTime(time)}</span></td>
        <td>${formatTeamMeetName(meet.name)}</td>
        <td class="team-meets__matchup">${matchup}</td>
        <td>${getEnhancedPoolLink(location, formatMeetLocationLabel(location))}${courseInfo}</td>
      </tr>
    `;
  }).join('');

  return `
    <details class="practice-schedule__phase team-meets__phase">
      <summary class="practice-schedule__summary team-meets__summary">
        <span class="practice-schedule__title">Meets</span>
        ${hasHomeMeet ? '<span class="team-meets__home-label">Home meet</span>' : ''}
        <span class="practice-schedule__toggle-icon" aria-hidden="true">&#9650;</span>
      </summary>
      <div class="practice-schedule__body team-meets__body">
        <table class="team-meets__table">
          <caption class="visually-hidden">Meet schedule for ${safeTeamName}</caption>
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Meet</th><th scope="col">Matchup</th><th scope="col">Pool</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>
  `;
}

/**
 * Combines practice and meet schedule sections for a team.
 * @param {Object} team - Team represented by the card
 * @param {Array} meets - Available meet models
 * @returns {string} Combined schedule HTML
 */
function formatSchedules(team, meets) {
  const practiceScheduleHtml = formatPracticeSchedules(team.practice);
  const meetsScheduleHtml = formatMeetsSchedule(team, meets);
  if (!practiceScheduleHtml && !meetsScheduleHtml) return '';

  return `<section class="practice-schedule" aria-label="Schedules"><h3>Schedules</h3>${practiceScheduleHtml}${meetsScheduleHtml}</section>`;
}

/**
 * Create team logo HTML with graceful fallback
 * @param {string} teamId - Team ID for logo filename
 * @returns {string} - HTML for team logo with fallback
 */
function createTeamLogo(teamId) {
  if (!teamId) return '';

  const safeTeamId = String(teamId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeTeamId || !AVAILABLE_TEAM_LOGOS.has(safeTeamId)) return '';

  return `
    <div class="team-logo">
      <span class="team-logo-img team-logo-img--${safeTeamId}" aria-hidden="true"></span>
    </div>
  `;
}

/**
 * Format publicly published team staff and contact addresses for display.
 * @param {Object} staff - Staff data from the team source record
 * @returns {string} - HTML for coaches and team managers
 */
function formatTeamStaff(staff) {
  if (!staff) return '';

  /**
   * Compares staff records by display name.
   * @param {Object} first - First staff record
   * @param {Object} second - Second staff record
   * @returns {number} Locale comparison result
   * @private
   */
  const compareByName = (first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' });
  /**
   * Ranks coaching roles for display order.
   * @param {Object} member - Coaching staff record
   * @returns {number} Coaching role rank
   * @private
   */
  const getCoachRank = member => {
    const role = member.role.toLowerCase();
    if (role.includes('head coach')) return 0;
    if (role.includes('assistant coach')) return 1;
    return 2;
  };
  const coaches = Array.isArray(staff.coaches) ? [...staff.coaches].sort((first, second) => (
    getCoachRank(first) - getCoachRank(second) || compareByName(first, second)
  )) : [];
  const managers = Array.isArray(staff.managers) ? [...staff.managers].sort(compareByName) : [];
  const contacts = Array.isArray(staff.contacts) ? [...staff.contacts].sort((first, second) => (
    first.label.localeCompare(second.label, undefined, { sensitivity: 'base' })
  )) : [];
  const mailIcon = IconCatalog.render('mail', 'team-staff__mail-icon');
  /**
   * Selects shared contacts for a staff audience.
   * @param {string} audience - Staff audience identifier
   * @returns {Array} Matching shared contacts
   * @private
   */
  const getAudienceContacts = audience => contacts.filter(contact => contact.audience === audience);
  /**
   * Formats a safe email icon link.
   * @param {string} email - Published email address
   * @param {string} label - Accessible link label
   * @returns {string} Email link HTML, or an empty string
   * @private
   */
  const formatEmail = (email, label) => {
    const emailUrl = TeamsBrowserSafety.safeMailtoUrl(email);
    const safeLabel = TeamsBrowserSafety.escapeHtml(label);
    return emailUrl ? `<a class="team-staff__email" href="${emailUrl}" aria-label="${safeLabel}" title="${safeLabel}">${mailIcon}</a>` : '';
  };
  /**
   * Formats direct and shared email links for one staff member.
   * @param {Object} member - Staff member record
   * @param {string} audience - Staff audience identifier
   * @returns {string} Staff email-links HTML
   * @private
   */
  const formatMemberEmails = (member, audience) => {
    const emailLinks = [];
    const usedEmails = new Set();
    /**
     * Adds one safe email link unless its address has already been used.
     * @param {string} email - Published email address
     * @param {string} label - Accessible link label
     * @private
     */
    const addEmailLink = (email, label) => {
      if (!email || usedEmails.has(email.toLowerCase())) return;

      usedEmails.add(email.toLowerCase());
      emailLinks.push(formatEmail(email, label));
    };

    addEmailLink(member.email, `Email ${member.name}`);
    getAudienceContacts(audience).forEach(contact => {
      addEmailLink(contact.email, `Email ${member.name} via ${contact.label}`);
    });

    return emailLinks.length > 0 ? `<span class="team-staff__email-links">${emailLinks.join('')}</span>` : '';
  };
  /**
   * Formats fallback shared contacts for a staff audience.
   * @param {string} audience - Staff audience identifier
   * @returns {string} Shared email-links HTML
   * @private
   */
  const formatAudienceEmails = audience => {
    const emailLinks = getAudienceContacts(audience).map(contact => formatEmail(contact.email, `Email ${contact.label}`)).join('');
    return emailLinks ? `<span class="team-staff__email-links team-staff__email-links--fallback">${emailLinks}</span>` : '';
  };
  /**
   * Formats a staff audience list or its empty-state contact.
   * @param {Array} members - Staff members to display
   * @param {string} audience - Staff audience identifier
   * @param {string} emptyMessage - Message shown when no names are published
   * @returns {string} Staff list HTML
   * @private
   */
  const formatMembers = (members, audience, emptyMessage) => {
    if (members.length === 0) return `<p class="team-staff__empty">${emptyMessage}${formatAudienceEmails(audience)}</p>`;

    return `<ul class="team-staff__list">${members.map(member => `
      <li><span class="team-staff__name">${TeamsBrowserSafety.escapeHtml(member.name)}</span><span class="team-staff__details"><span class="team-staff__separator" aria-hidden="true">-</span><span class="team-staff__role">${TeamsBrowserSafety.escapeHtml(member.role)}</span>${formatMemberEmails(member, audience)}</span></li>
    `).join('')}</ul>`;
  };

  return `
    <section class="team-staff" aria-label="Publicly listed team staff">
      <h3>Coaches &amp; Managers</h3>
      <div class="team-staff__columns">
        <div>
          ${formatMembers(coaches, 'coaches', 'No current coach names publicly listed.')}
        </div>
        <div>
          ${formatMembers(managers, 'managers', 'No team manager names publicly listed.')}
        </div>
      </div>
      ${staff.note ? `<p class="team-staff__note">${TeamsBrowserSafety.escapeHtml(staff.note)}</p>` : ''}
    </section>
  `;
}

/**
 * Builds the detail markup for one team after pool and meet context has settled.
 * @param {Object} team - Published team record
 * @returns {string} Team detail HTML
 */
function renderTeamDetails(team) {
  const teamName = team.name || 'Unknown Team';
  const safeShortName = TeamsBrowserSafety.escapeHtml(team.shortName || teamName);
  const teamId = String(team.id || '');
  const teamUrl = TeamsBrowserSafety.safeHttpUrl(team.url);
  const practiceUrl = TeamsBrowserSafety.safeHttpUrl(team.practice && team.practice.url);
  const resultsUrl = TeamsBrowserSafety.safeHttpUrl(team.resultsUrl);
  const merchandiseUrl = TeamsBrowserSafety.safeHttpUrl(team.merchandiseUrl);
  const boosterUrl = TeamsBrowserSafety.safeHttpUrl(team.booster && team.booster.url);
  const homePools = Array.isArray(team.homePools) ? team.homePools : [];
  const homePool = homePools[0] || '';
  const poolData = homePool ? findPoolByName(homePool) : null;
  const meets = teamsBrowserDataManager.getMeets().getAllMeets();
  const upcomingEvents = globalThis.TeamAgendaDisplay.getUpcomingEvents(team, meets);
  const agendaTitleId = `team-agenda-title-${String(teamId || teamName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const schedulesHtml = formatSchedules(team, meets);
  const staffHtml = formatTeamStaff(team.staff);
  const upcomingEventsHtml = `
    <section class="favorite-week" aria-labelledby="${agendaTitleId}">
      <div class="favorite-week__heading">
        <h3 id="${agendaTitleId}">Upcoming Events</h3>
      </div>
      ${upcomingEvents.length === 0 ? `<p class="favorite-week__status">${TeamsBrowserSafety.escapeHtml(globalThis.TeamAgendaDisplay.getStatus(upcomingEvents))}</p>` : ''}
      ${globalThis.TeamAgendaDisplay.renderEvents(upcomingEvents, 4, teamsPoolLocationIndex)}
    </section>
  `;

  return `
    ${merchandiseUrl ? `
      <a href="${merchandiseUrl}" target="_blank" rel="noopener noreferrer" class="team-merchandise" data-analytics-link-purpose="merchandise">
        <span class="team-merchandise__icon" aria-hidden="true">${IconCatalog.render('shirt-plus')}</span>
        <span>Get Your Official ${safeShortName} Gear!<span class="visually-hidden"> (opens in new tab)</span></span>
      </a>
    ` : ''}

    ${upcomingEventsHtml}

    ${homePool ? `
      <div class="detail-item">
        <strong><span class="detail-item__icon" aria-hidden="true">${IconCatalog.render('pool')}</span> Home Pool:</strong> ${poolData ?
          getEnhancedPoolLink(homePool) :
          TeamsBrowserSafety.escapeHtml(homePool)
        }
      </div>
    ` : ''}

    ${staffHtml}

    ${schedulesHtml}

    ${teamUrl || practiceUrl || boosterUrl ? `
      <div class="team-actions team-actions--website">
        ${teamUrl ? `<a href="${teamUrl}" target="_blank" rel="noopener" class="btn">${IconCatalog.render('globe')}Team Website</a>` : ''}
        ${practiceUrl ? `<a href="${practiceUrl}" target="_blank" rel="noopener" class="btn">${IconCatalog.render('calendar')}Practice Schedule</a>` : ''}
        ${boosterUrl ? `<a href="${boosterUrl}" target="_blank" rel="noopener noreferrer" class="btn">Booster Club</a>` : ''}
      </div>
    ` : ''}

    ${globalThis.TeamAgendaDisplay.renderCalendarActions(team)}

    ${resultsUrl ? `
      <div class="team-actions">
        <a href="${resultsUrl}" target="_blank" rel="noopener" class="btn">${IconCatalog.render('trophy')}Swim Meet Results</a>
      </div>
    ` : ''}
  `;
}

/**
 * Populates one team's details after shared enrichment without rendering hidden siblings.
 * @param {Element} teamCard - Team card whose detail region should be populated
 * @returns {Promise<Element|null>} Hydrated detail region, when present
 */
async function hydrateTeamDetails(teamCard) {
  const details = teamCard && teamCard.querySelector('.team-details');
  if (!details || details.dataset.teamDetailsHydrated === 'true') return details;

  const teamId = teamCard.dataset.teamId;
  let hydrationPromise = teamDetailsHydrationPromises.get(teamId);
  if (!hydrationPromise) {
    hydrationPromise = startTeamsBrowserEnrichment().then(detailsAvailable => {
      if (!detailsAvailable) return TEAM_DETAILS_UNAVAILABLE_HTML;
      const team = teamsBrowserTeams.find(candidate => String(candidate.id || '') === teamId);
      return team ? renderTeamDetails(team) : '';
    }).finally(() => teamDetailsHydrationPromises.delete(teamId));
    teamDetailsHydrationPromises.set(teamId, hydrationPromise);
  }

  details.setAttribute('aria-busy', 'true');
  if (!details.hidden) details.innerHTML = TEAM_DETAILS_LOADING_HTML;
  const detailsHtml = await hydrationPromise;
  if (!details.isConnected) return null;
  details.innerHTML = detailsHtml;
  details.dataset.teamDetailsHydrated = 'true';
  details.setAttribute('aria-busy', 'false');
  return details;
}

/**
 * Toggles the collapsed state of a team card
 * @param {Element} toggleButton - The disclosure button
 */
function toggleTeamCard(toggleButton) {
  const teamCard = toggleButton.closest('.team-card');
  const details = teamCard.querySelector('.team-details');
  const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
  teamCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (details) {
    details.hidden = isExpanded;
    if (!isExpanded) {
      details.innerHTML = details.dataset.teamDetailsHydrated === 'true' ? details.innerHTML : TEAM_DETAILS_LOADING_HTML;
      void hydrateTeamDetails(teamCard);
    }
  }
  if (!isExpanded && window.cnslAnalytics) {
    window.cnslAnalytics.trackInteraction(
      AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN,
      { directoryName: 'teams' }
    );
  }
  if (teamCard.dataset.teamId === PreferencesService.get().favoriteTeamId) {
    const preferences = PreferencesService.get();
    PreferencesService.save({ ...preferences, favoriteTeamExpanded: !isExpanded });
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.FIXED_SETTING_CHANGE, {
        settingName: 'favorite_team_expanded',
        settingValue: isExpanded ? 'collapsed' : 'expanded'
      });
    }
  }
}

/**
 * Renders the list of teams in the #teamList element
 * @param {Array} teams - Array of team objects
 */
function renderTeams(teams) {
  const list = document.getElementById("teamList");
  if (!list) return;

  // Safety check - ensure teams is an array
  if (!Array.isArray(teams) || teams.length === 0) {
    list.innerHTML = "<p>There are no teams to show yet.</p>";
    return;
  }

  const preferences = PreferencesService.get();
  const favoriteTeamId = preferences.favoriteTeamId;
  const favoriteTeamExpanded = preferences.favoriteTeamExpanded;
  const expandedTeamIds = new Set(Array.from(list.querySelectorAll('.team-header__toggle[aria-expanded="true"]'))
    .map(toggle => toggle.closest('.team-card')?.dataset.teamId)
    .filter(Boolean));
  const linkedTeamId = new URLSearchParams(window.location.search).get('team');
  /**
   * Compares team records by display name.
    * @param {Object} a - First team record
    * @param {Object} b - Second team record
   * @returns {number} Locale comparison result
   * @private
   */
  const compareTeams = (a, b) => {
    const nameA = (a && a.name) ? a.name : '';
    const nameB = (b && b.name) ? b.name : '';
    return nameA.localeCompare(nameB);
  };
  const sortedTeams = PreferencesService.sortWithFavorite(teams, favoriteTeamId, team => team.id || '', compareTeams);

  // Generate HTML for each team
  const html = sortedTeams.map(team => {
    const teamName = team.name || 'Unknown Team';
    const safeTeamName = TeamsBrowserSafety.escapeHtml(teamName);
    const teamId = String(team.id || '');
    const safeTeamId = TeamsBrowserSafety.escapeHtml(teamId);
    const detailsId = `team-details-${String(teamId || teamName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const isFavorite = teamId === favoriteTeamId;
    const isExpanded = expandedTeamIds.has(teamId)
      || teamId === linkedTeamId
      || (isFavorite && favoriteTeamExpanded);

    // Create team logo HTML
    const logoHtml = createTeamLogo(teamId);

    return `
      <div class="team-card ${isFavorite ? `favorite-card${isExpanded ? '' : ' collapsed'}` : 'collapsed'}" data-team-card data-team-id="${safeTeamId}" data-analytics-context="team_details">
        <div class="team-header" data-team-card-header>
          ${logoHtml}
          <div class="team-header-content">
            <h2><button type="button" class="team-header__toggle" data-team-card-action="toggle" aria-expanded="${String(isExpanded)}" aria-controls="${detailsId}">${safeTeamName}${isFavorite ? ' <span class="favorite-marker" role="img" aria-label="Favorite team" title="Favorite team">&#9733;</span>' : ''}</button></h2>
          </div>
        </div>

        <div class="team-details" id="${detailsId}" data-team-details-hydrated="false" aria-busy="${String(isExpanded)}"${isExpanded ? '' : ' hidden'}>
          ${isExpanded ? TEAM_DETAILS_LOADING_HTML : ''}
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
  if (!document.prerendering) hydrateExpandedTeamDetails();
}

  /**
   * Re-renders teams after saved preferences change.
   */
function refreshTeamsForPreferences() {
  if (!teamsBrowserDataManager || !document.getElementById('teamList')) return;
  teamsBrowserTeams = teamsBrowserDataManager.getTeams().getAllTeams();
  renderTeams(teamsBrowserTeams);
}

/**
 * Handle team URL parameter for direct linking to specific teams
 * URL format: teams.html?team=teamId
 */
function handleTeamUrlParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get('team');
  if (!teamId) return;

  const escapedTeamId = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(teamId)
    : teamId.replace(/[^a-zA-Z0-9_-]/g, '');
  const teamCard = escapedTeamId ? document.querySelector(`[data-team-id="${escapedTeamId}"]`) : null;
  if (!teamCard) return;

  teamCard.classList.remove('collapsed');
  const toggleButton = teamCard.querySelector('.team-header__toggle');
  const details = teamCard.querySelector('.team-details');
  if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
  if (details) {
    details.hidden = false;
    details.innerHTML = details.dataset.teamDetailsHydrated === 'true' ? details.innerHTML : TEAM_DETAILS_LOADING_HTML;
    void hydrateTeamDetails(teamCard);
  }

  teamCard.classList.add('highlighted');
  teamCard.scrollIntoView({
    behavior: window.shouldReduceMotion() ? 'auto' : 'smooth',
    block: 'center'
  });

  setTimeout(() => {
    teamCard.classList.remove('highlighted');
  }, 3000);
}

/**
 * Starts the team directory as soon as its deferred controller executes.
 * @returns {Promise<void>} Promise settled after initial summaries and background enrichment begin
 */
async function startTeamsBrowser() {
  if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }
  // Check if we're on the teams page before fetching data
  if (!document.getElementById("teamList")) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }

  const teamList = document.getElementById("teamList");
  teamList.addEventListener('click', event => {
    const toggleButton = event.target.closest('[data-team-card-action="toggle"]');
    if (toggleButton) {
      toggleTeamCard(toggleButton);
      return;
    }

    if (event.target.closest('a')) return;

    const teamCard = event.target.closest('[data-team-card]');
    const cardToggle = teamCard && teamCard.querySelector('[data-team-card-action="toggle"]');
    if (cardToggle && (cardToggle.getAttribute('aria-expanded') !== 'true' || event.target.closest('[data-team-card-header]'))) toggleTeamCard(cardToggle);
  });

  try {
    // Initialize the data manager with the new OOP system
    await initializeTeamsBrowser();

    // Get teams from the data manager
    const teamsManager = teamsBrowserDataManager.getTeams();
    const teams = teamsManager.getAllTeams();
    teamsBrowserTeams = teams;

    renderTeams(teams);
    markTeamPerformance('summary-visible');
    setTeamListStatus(`Team directory loaded. ${teams.length} teams available.`, false);
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    scheduleTeamsBrowserActivationWork();

  } catch (error) {
    console.error("Failed to load team data:", error);
    const list = document.getElementById("teamList");
    if (list) {
      list.innerHTML = `<p>${IconCatalog.getTextGlyph('warning')} The team directory did not load. Please check your connection and refresh the page to try again.</p>`;
    }
    setTeamListStatus('The team directory did not load. Please check your connection and refresh the page to try again.', false);
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
  }
}

void startTeamsBrowser();

window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, refreshTeamsForPreferences);
