// Global data manager instance for teams browser
let teamsBrowserDataManager = null;
let teamsPoolLocationIndex = new Map();
const TeamsBrowserSafety = HtmlSafety;
const AVAILABLE_TEAM_LOGOS = new Set([
  'ccc', 'cfhss', 'dsd', 'hcc', 'hd', 'kcw', 'lrm', 'obb', 'omts', 'pls', 'prp', 'prr', 'thl', 'wlw'
]);


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the teams browser with data manager
 */
async function initializeTeamsBrowser() {
  if (!teamsBrowserDataManager) {
    teamsBrowserDataManager = getDataManager();
    await teamsBrowserDataManager.initialize(['pools', 'teams', 'meets']);
    teamsPoolLocationIndex = globalThis.createPoolLocationIndex(teamsBrowserDataManager.getPools().getAllPools());
  }
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

function getVisiblePracticeSessions(sessions) {
  return PreferencesService.filterPracticeSessions(sessions, PreferencesService.get().practiceGroups);
}

function formatPracticeSessions(sessions) {
  return `<div class="sessions">${sessions.map(session => `
    <div class="session-item">
      <span class="session-time">${TeamsBrowserSafety.escapeHtml(session.time)}</span>
      <span class="session-group">${TeamsBrowserSafety.escapeHtml(session.group)}</span>
    </div>
  `).join('')}</div>`;
}

function formatPracticePhase(title, dateRange, content, isCurrent) {
  const currentClass = isCurrent ? ' practice-schedule__phase--current' : '';
  const currentBadge = isCurrent ? '<span class="practice-schedule__badge">Current schedule</span>' : '';
  return `
    <details class="practice-schedule__phase${currentClass}">
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

function formatPreseasonPracticeSchedule(practice, isCurrent) {
  const publishedPeriods = Array.isArray(practice && practice.preseason) ? practice.preseason : [];
  const currentPeriodIndex = isCurrent ? publishedPeriods.findIndex(period => globalThis.TeamScheduleService.isCurrentPracticeRange(period.period)) : -1;
  const periods = publishedPeriods.map((period, index) => ({
    ...period,
    sessions: getVisiblePracticeSessions(period.sessions),
    isCurrent: index === currentPeriodIndex
  })).filter(period => period.sessions.length > 0);
  if (periods.length === 0) return '';

  const content = periods.map(period => `
    <div class="practice-period${period.isCurrent ? ' practice-period--current' : ''}">
      <strong>${TeamsBrowserSafety.escapeHtml(period.period)}${period.isCurrent ? '<span class="practice-period__badge">Current period</span>' : ''}</strong>
      <div class="practice-details">
        <div><strong>Days:</strong> ${TeamsBrowserSafety.escapeHtml(period.days)}</div>
        <div><strong>Location:</strong> ${getEnhancedPoolLink(period.location)}</div>
        ${formatPracticeSessions(period.sessions)}
      </div>
    </div>
  `).join('');
  const dateRange = `${periods[0].period.split(' - ')[0]} - ${periods[periods.length - 1].period.split(' - ')[1]}`;
  return formatPracticePhase('Pre-season practices', dateRange, content, isCurrent);
}

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

function formatPracticeSchedules(practice) {
  const currentPhase = globalThis.TeamScheduleService.getCurrentPracticePhase(practice);
  const preSeasonHtml = formatPreseasonPracticeSchedule(practice, currentPhase === 'preseason');
  const inSeasonHtml = formatInSeasonPracticeSchedule(practice, currentPhase === 'regular');
  if (!preSeasonHtml && !inSeasonHtml) return '';

  return `${preSeasonHtml}${inSeasonHtml}`;
}

function formatMeetDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return TeamsBrowserSafety.escapeHtml(dateValue || 'Date unavailable');

  return TeamsBrowserSafety.escapeHtml(date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  }));
}

function formatMeetTime(time) {
  const timeParts = String(time || '').split(' - ');
  if (timeParts.length !== 2) return TeamsBrowserSafety.escapeHtml(time);

  const startTime = TeamsBrowserSafety.escapeHtml(timeParts[0]);
  const endTime = TeamsBrowserSafety.escapeHtml(timeParts[1]);
  return `<span class="team-meets__time-start">${startTime} -</span><span class="team-meets__time-end"> ${endTime}</span>`;
}

function formatMeetTeamLabel(label, team) {
  const safeLabel = TeamsBrowserSafety.escapeHtml(label);
  return PreferencesService.teamMatchesLabel(team, label) ? `<strong>${safeLabel}</strong>` : safeLabel;
}

function formatMeetLocationLabel(location) {
  return typeof location === 'string' ? location.replace(/\s+Pool\s*$/i, '').trim() : '';
}

function formatTeamMeetName(meetName) {
  const displayName = String(meetName || 'Meet').replace(/^Dual Meet\s+(#\d+)$/i, 'Dual $1');
  return TeamsBrowserSafety.escapeHtml(displayName);
}

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

function formatMeetsSchedule(team, meets) {
  const teamMeets = Array.isArray(meets) ? meets.filter(meet => (
    meet && (!(meet.home_team || meet.visiting_team)
      || PreferencesService.meetIncludesFavoriteTeam(meet, team))
  )).sort((first, second) => String(first.date || '').localeCompare(String(second.date || ''))) : [];
  if (teamMeets.length === 0) return '';

  const safeTeamName = TeamsBrowserSafety.escapeHtml(team.name || 'team');
  const hasHomeMeet = teamMeets.some(meet => PreferencesService.teamMatchesLabel(team, meet.home_team || meet.homeTeam || ''));
  const rows = teamMeets.map(meet => {
    const isTimeTrials = globalThis.TeamAgendaDisplay.isTimeTrialsMeet(meet);
    const isSpecialMeet = !(meet.home_team || meet.visiting_team);
    const awayTeam = meet.visiting_team || meet.awayTeam || 'Away Team';
    const homeTeam = meet.home_team || meet.homeTeam || 'Home Team';
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

  const compareByName = (first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' });
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
  const mailIcon = '<svg class="team-staff__mail-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7"></path></svg>';
  const getAudienceContacts = audience => contacts.filter(contact => contact.audience === audience);
  const formatEmail = (email, label) => {
    const emailUrl = TeamsBrowserSafety.safeMailtoUrl(email);
    const safeLabel = TeamsBrowserSafety.escapeHtml(label);
    return emailUrl ? `<a class="team-staff__email" href="${emailUrl}" aria-label="${safeLabel}" title="${safeLabel}">${mailIcon}</a>` : '';
  };
  const formatMemberEmails = (member, audience) => {
    const emailLinks = [];
    const usedEmails = new Set();
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
  const formatAudienceEmails = audience => {
    const emailLinks = getAudienceContacts(audience).map(contact => formatEmail(contact.email, `Email ${contact.label}`)).join('');
    return emailLinks ? `<span class="team-staff__email-links team-staff__email-links--fallback">${emailLinks}</span>` : '';
  };
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
 * Toggles the collapsed state of a team card
 * @param {Element} toggleButton - The disclosure button
 */
function toggleTeamCard(toggleButton) {
  const teamCard = toggleButton.closest('.team-card');
  const details = teamCard.querySelector('.team-details');
  const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
  teamCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (teamCard.dataset.teamId === PreferencesService.get().favoriteTeamId) {
    const preferences = PreferencesService.get();
    PreferencesService.save({ ...preferences, favoriteTeamExpanded: !isExpanded });
    if (window.cnslAnalytics) window.cnslAnalytics.trackFixedSettingChange('favorite_team_expanded', isExpanded ? 'collapsed' : 'expanded');
  }
  if (details) details.hidden = isExpanded;
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
    list.innerHTML = "<p>No team information available.</p>";
    return;
  }

  const preferences = PreferencesService.get();
  const favoriteTeamId = preferences.favoriteTeamId;
  const favoriteTeamExpanded = preferences.favoriteTeamExpanded;
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
    const safeShortName = TeamsBrowserSafety.escapeHtml(team.shortName || teamName);
    const teamId = String(team.id || '');
    const safeTeamId = TeamsBrowserSafety.escapeHtml(teamId);
    const detailsId = `team-details-${String(teamId || teamName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const teamUrl = TeamsBrowserSafety.safeHttpUrl(team.url);
    const practiceUrl = TeamsBrowserSafety.safeHttpUrl(team.practice && team.practice.url);
    const calendarUrl = TeamsBrowserSafety.safeHttpUrl(team.calendarUrl);
    const eventsSubscriptionUrl = TeamsBrowserSafety.safeHttpUrl(team.eventsSubscriptionUrl);
    const resultsUrl = TeamsBrowserSafety.safeHttpUrl(team.resultsUrl);
    const merchandiseUrl = TeamsBrowserSafety.safeHttpUrl(team.merchandiseUrl);
    const boosterUrl = TeamsBrowserSafety.safeHttpUrl(team.booster && team.booster.url);
    const isFavorite = teamId === favoriteTeamId;
    const isExpanded = isFavorite && favoriteTeamExpanded;
    const homePools = Array.isArray(team.homePools) ? team.homePools : [];
    const homePool = homePools[0] || '';
    
    // Create team logo HTML
    const logoHtml = createTeamLogo(teamId);
    
    // Find pool data for the home pool using data manager
    const poolData = homePool ? findPoolByName(homePool) : null;
    
    const upcomingEvents = globalThis.TeamAgendaDisplay.getUpcomingEvents(team, teamsBrowserDataManager.getMeets().getAllMeets());
    const agendaTitleId = `team-agenda-title-${String(teamId || teamName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    
    const schedulesHtml = formatSchedules(team, teamsBrowserDataManager.getMeets().getAllMeets());
    const staffHtml = formatTeamStaff(team.staff);
    
    const upcomingEventsHtml = `
      <section class="favorite-week" aria-labelledby="${agendaTitleId}">
        <div class="favorite-week__heading">
          <h3 id="${agendaTitleId}">Upcoming events</h3>
        </div>
        ${upcomingEvents.length === 0 ? `<p class="favorite-week__status">${TeamsBrowserSafety.escapeHtml(globalThis.TeamAgendaDisplay.getStatus(upcomingEvents))}</p>` : ''}
        ${globalThis.TeamAgendaDisplay.renderEvents(upcomingEvents, 4, teamsPoolLocationIndex)}
      </section>
    `;
    
    return `
      <div class="team-card ${isFavorite ? `favorite-card${isExpanded ? '' : ' collapsed'}` : 'collapsed'}" data-team-card data-team-id="${safeTeamId}" data-analytics-context="team_details">
        <div class="team-header" data-team-card-header>
          ${logoHtml}
          <div class="team-header-content">
            <h2><button type="button" class="team-header__toggle" data-team-card-action="toggle" aria-expanded="${String(isExpanded)}" aria-controls="${detailsId}">${safeTeamName}${isFavorite ? ' <span class="favorite-badge">Favorite team</span>' : ''}</button></h2>
          </div>
        </div>

        <div class="team-details" id="${detailsId}"${isExpanded ? '' : ' hidden'}>
          ${merchandiseUrl ? `
            <a href="${merchandiseUrl}" target="_blank" rel="noopener noreferrer" class="team-merchandise" data-analytics-link-purpose="merchandise">
              <span class="team-merchandise__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 4 6 5.5 3.5 9 6 10.5V20h12v-9.5L20.5 9 18 5.5 15 4a3 3 0 0 1-6 0Z"></path><path d="M12 10.25v4.5"></path><path d="M9.75 12.5h4.5"></path></svg></span>
              <span>Get Your Official ${safeShortName} Gear!<span class="visually-hidden"> (opens in new tab)</span></span>
            </a>
          ` : ''}

          ${upcomingEventsHtml}
          
          ${homePool ? `
            <div class="detail-item">
              <strong><span class="detail-item__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 7c1.5 0 2.25 1.5 3.75 1.5S8 7 9.5 7s2.25 1.5 3.75 1.5S15.5 7 17 7s2.25 1.5 3.75 1.5S23 7 23 7"></path><path d="M2 12c1.5 0 2.25 1.5 3.75 1.5S8 12 9.5 12s2.25 1.5 3.75 1.5S15.5 12 17 12s2.25 1.5 3.75 1.5S23 12 23 12"></path><path d="M2 17c1.5 0 2.25 1.5 3.75 1.5S8 17 9.5 17s2.25 1.5 3.75 1.5S15.5 17 17 17s2.25 1.5 3.75 1.5S23 17 23 17"></path></svg></span> Home Pool:</strong> ${poolData ? 
                getEnhancedPoolLink(homePool) :
                TeamsBrowserSafety.escapeHtml(homePool)
              }
            </div>
          ` : ''}

          ${staffHtml}

          ${schedulesHtml}

          ${teamUrl || practiceUrl || boosterUrl ? `
            <div class="team-actions team-actions--website">
              ${teamUrl ? `<a href="${teamUrl}" target="_blank" rel="noopener" class="btn">🌐 Team Website</a>` : ''}
              ${practiceUrl ? `<a href="${practiceUrl}" target="_blank" rel="noopener" class="btn">📅 Practice Schedule</a>` : ''}
              ${boosterUrl ? `<a href="${boosterUrl}" target="_blank" rel="noopener noreferrer" class="btn">Booster Club</a>` : ''}
            </div>
          ` : ''}

          ${calendarUrl || eventsSubscriptionUrl ? `
            <div class="team-actions team-actions--calendar">
              ${calendarUrl ? `<a href="${calendarUrl}" target="_blank" rel="noopener" class="btn">📅 Team Calendar</a>` : ''}
              ${eventsSubscriptionUrl ? `<a href="${eventsSubscriptionUrl}" target="_blank" rel="noopener" class="btn">📅 Subscribe<span class="visually-hidden"> to team events calendar</span></a>` : ''}
            </div>
          ` : ''}
          
          ${resultsUrl ? `
            <div class="team-actions">
              ${resultsUrl ? 
                `<a href="${resultsUrl}" target="_blank" rel="noopener" class="btn">🏆 Swim Meet Results</a>` : 
                ''
              }
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

    list.innerHTML = html;
}

function refreshTeamsForPreferences() {
  if (!teamsBrowserDataManager || !document.getElementById('teamList')) return;
  renderTeams(teamsBrowserDataManager.getTeams().getAllTeams());
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
  if (details) details.hidden = false;

  teamCard.classList.add('highlighted');
  teamCard.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center'
  });

  setTimeout(() => {
    teamCard.classList.remove('highlighted');
  }, 3000);
}

/**
 * Generate a link to a specific team using URL parameters
 * @param {string} teamId - Team ID to link to
 * @param {string} teamName - Team name for display text
 * @param {Object} options - Link options
 * @returns {string} - HTML link to teams page with team parameter
 */
// eslint-disable-next-line no-unused-vars
function generateTeamLink(teamId, teamName, options = {}) {
  const {
    className = 'team-link',
    target = '_self',
    title = `View ${teamName} details`
  } = options;
  
  if (!teamId || !teamName) {
    return TeamsBrowserSafety.escapeHtml(teamName || 'Unknown Team');
  }

  const safeClassName = String(className).replace(/[^a-zA-Z0-9_ -]/g, '');
  const safeTarget = target === '_blank' ? '_blank' : '_self';
  const safeTitle = TeamsBrowserSafety.escapeHtml(title);
  const safeTeamName = TeamsBrowserSafety.escapeHtml(teamName);
  
  return `<a href="teams.html?team=${encodeURIComponent(teamId)}" 
             class="${safeClassName}" 
             target="${safeTarget}" 
             title="${safeTitle}">
             ${safeTeamName}
           </a>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the teams page before fetching data
  if (!document.getElementById("teamList")) {
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
    
    renderTeams(teams);
    setTeamListStatus(`Team directory loaded. ${teams.length} teams available.`, false);
    
    // Handle team URL parameter for direct linking
    handleTeamUrlParameter();
    
  } catch (error) {
    console.error("Failed to load team data:", error);
    const list = document.getElementById("teamList");
    if (list) {
      list.innerHTML = "<p>⚠️ Team data is currently unavailable. Please try again later.</p>";
    }
    setTeamListStatus('Team information is currently unavailable. Please try again later.', false);
  }
});

window.addEventListener('cnsl:preferences-changed', refreshTeamsForPreferences);
