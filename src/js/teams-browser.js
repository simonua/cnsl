// Global data manager instance for teams browser
let teamsBrowserDataManager = null;
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
  return getPoolDataFromLocation(poolName, teamsBrowserDataManager);
}

/**
 * Get the published regular-season practice schedule.
 * @param {Object} practice - Practice object from team data
 * @returns {Object|null} - Current active practice schedule or null
 */
function getCurrentPracticeSchedule(practice) {
  return practice && practice.regular ? practice.regular : null;
}

/**
 * Get enhanced pool link using new pool link helper
 * @param {string} location - Pool location name
 * @param {string} fallbackAddress - Fallback address if pool not found (unused now)
 * @returns {string} - HTML link to pools.html page with pool data
 */
function getEnhancedPoolLink(location, _fallbackAddress) {
  if (!location) return '';
  
  // Use the new pool link helper
  return generateEnhancedPoolLink(location, teamsBrowserDataManager, {
    preferPoolsPage: true,
    showBothLinks: false
  });
}

function getVisiblePracticeSessions(sessions) {
  return PreferencesService.filterPracticeSessions(sessions, PreferencesService.get().practiceGroups);
}

/**
 * Format the published regular practice schedule.
 * @param {Object} practice - Practice object from team data
 * @returns {string} - HTML string for current practice schedule
 */
function formatCurrentPracticeSchedule(practice) {
  const currentSchedule = getCurrentPracticeSchedule(practice);
  if (!currentSchedule) return '';
  const morningPractices = Array.isArray(currentSchedule.morning) ? currentSchedule.morning.map(morning => ({
    ...morning,
    sessions: getVisiblePracticeSessions(morning.sessions)
  })).filter(morning => morning.sessions.length > 0) : [];
  const eveningPractices = Array.isArray(currentSchedule.evening) ? currentSchedule.evening.map(evening => ({
    ...evening,
    sessions: getVisiblePracticeSessions(evening.sessions)
  })).filter(evening => evening.sessions.length > 0) : [];
  if (morningPractices.length === 0 && eveningPractices.length === 0) return '';
  
  let html = '<div class="practice-schedule">';
  html += '<h3>Regular Practice Schedule</h3>';
  
  // Add season info
  if (currentSchedule.season) {
    html += `<div class="season-info"><strong>Season:</strong> ${TeamsBrowserSafety.escapeHtml(currentSchedule.season)}</div>`;
  }
  
  // Morning practices
  if (morningPractices.length > 0) {
    morningPractices.forEach(morning => {
      html += '<div class="practice-period">';
      html += '<strong>Morning Practice:</strong>';
      html += `<div class="practice-details">`;
      html += `<div><strong>Days:</strong> ${TeamsBrowserSafety.escapeHtml(morning.days)}</div>`;
      if (morning.location) {
        const poolLink = getEnhancedPoolLink(morning.location, morning.address);
        html += `<div><strong>Location:</strong> ${poolLink}</div>`;
      }
      if (morning.sessions.length > 0) {
        html += '<div class="sessions">';
        morning.sessions.forEach(session => {
          html += `<div class="session-item">`;
          html += `<span class="session-time">${TeamsBrowserSafety.escapeHtml(session.time)}</span>`;
          html += `<span class="session-group">${TeamsBrowserSafety.escapeHtml(session.group)}</span>`;
          html += `</div>`;
        });
        html += '</div>';
      }
      html += '</div></div>';
    });
  }
  
  // Evening practices
  if (eveningPractices.length > 0) {
    eveningPractices.forEach(evening => {
      html += '<div class="practice-period">';
      html += `<strong>${TeamsBrowserSafety.escapeHtml(evening.day)} Evening Practice:</strong>`;
      html += `<div class="practice-details">`;
      if (evening.location) {
        const poolLink = getEnhancedPoolLink(evening.location, evening.address);
        html += `<div><strong>Location:</strong> ${poolLink}</div>`;
      }
      if (evening.sessions.length > 0) {
        html += '<div class="sessions">';
        evening.sessions.forEach(session => {
          html += `<div class="session-item">`;
          html += `<span class="session-time">${TeamsBrowserSafety.escapeHtml(session.time)}</span>`;
          html += `<span class="session-group">${TeamsBrowserSafety.escapeHtml(session.group)}</span>`;
          html += `</div>`;
        });
        html += '</div>';
      }
      html += '</div></div>';
    });
  }
  
  html += '</div>';
  return html;
}

/**
 * Create a map link for a pool location
 * @param {string} location - Pool location name
 * @param {string} address - Pool address
 * @returns {string} - HTML link to pools.html page
 */
// eslint-disable-next-line no-unused-vars
function getPoolMapLink(location, address) {
  // Try to use enhanced pool link first (which links to pools.html when available)
  const enhancedLink = getEnhancedPoolLink(location, address);
  if (enhancedLink) {
    return enhancedLink;
  }
  
  // Fallback to pools.html page
  return `<a href="pools.html" class="location-link">${TeamsBrowserSafety.escapeHtml(location)}</a>`;
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

  const safeSourceUrl = TeamsBrowserSafety.safeHttpUrl(staff.sourceUrl);

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
      ${safeSourceUrl ? `<a class="team-staff__source" href="${safeSourceUrl}" target="_blank" rel="noopener">View CNSL team staff info</a>` : ''}
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
  if (teamCard.classList.contains('favorite-card')) {
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
    const teamId = String(team.id || '');
    const safeTeamId = TeamsBrowserSafety.escapeHtml(teamId);
    const detailsId = `team-details-${String(teamId || teamName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const teamUrl = TeamsBrowserSafety.safeHttpUrl(team.url);
    const practiceUrl = TeamsBrowserSafety.safeHttpUrl(team.practice && team.practice.url);
    const calendarUrl = TeamsBrowserSafety.safeHttpUrl(team.calendarUrl);
    const resultsUrl = TeamsBrowserSafety.safeHttpUrl(team.resultsUrl);
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
    
    // Format current practice schedule (no preseason)
    const practiceScheduleHtml = formatCurrentPracticeSchedule(team.practice);
    const staffHtml = formatTeamStaff(team.staff);
    
    const upcomingEventsHtml = `
      <section class="favorite-week" aria-labelledby="${agendaTitleId}">
        <div class="favorite-week__heading">
          <h3 id="${agendaTitleId}">${TeamsBrowserSafety.escapeHtml(globalThis.TeamAgendaDisplay.getTitle(teamName, upcomingEvents))}</h3>
        </div>
        <p class="favorite-week__status">${TeamsBrowserSafety.escapeHtml(globalThis.TeamAgendaDisplay.getStatus(upcomingEvents))}</p>
        ${globalThis.TeamAgendaDisplay.renderEvents(upcomingEvents, 4)}
      </section>
    `;
    
    // Get fallback address for legacy compatibility
    let fallbackAddress;
    if (poolData?.location) {
      const parts = [];
      if (poolData.location.street) parts.push(poolData.location.street);
      if (poolData.location.city || poolData.location.state || poolData.location.zip) {
        const city = poolData.location.city || '';
        const state = poolData.location.state || '';
        const zip = poolData.location.zip || '';
        const cityStateZip = (city + ', ' + state + ' ' + zip).trim();
        parts.push(cityStateZip);
      }
      fallbackAddress = parts.join(', ');
    } else {
      fallbackAddress = poolData?.address || '';
    }
    
    return `
      <div class="team-card ${isFavorite ? `favorite-card${isExpanded ? '' : ' collapsed'}` : 'collapsed'}" data-team-id="${safeTeamId}">
        <div class="team-header">
          ${logoHtml}
          <div class="team-header-content">
            <h2><button type="button" class="team-header__toggle" aria-expanded="${String(isExpanded)}" aria-controls="${detailsId}">${safeTeamName}${isFavorite ? ' <span class="favorite-badge">Favorite team</span>' : ''}</button></h2>
          </div>
        </div>
        
        <div class="team-details" id="${detailsId}"${isExpanded ? '' : ' hidden'}>
          ${upcomingEventsHtml}
          
          ${homePool ? `
            <div class="detail-item">
              <strong>🏠 Home Pool:</strong> ${poolData ? 
                getEnhancedPoolLink(homePool, fallbackAddress) : 
                TeamsBrowserSafety.escapeHtml(homePool)
              }
            </div>
          ` : ''}

          ${staffHtml}

          ${teamUrl ? `
            <div class="team-actions team-actions--website">
              <a href="${teamUrl}" target="_blank" rel="noopener" class="btn">🌐 Team Website</a>
            </div>
          ` : ''}
          
          ${practiceScheduleHtml}
          
          ${practiceUrl || calendarUrl || resultsUrl ? `
            <div class="team-actions">
              ${practiceUrl ? 
                `<a href="${practiceUrl}" target="_blank" rel="noopener" class="btn">📅 Practice Schedule</a>` : 
                ''
              }
              ${calendarUrl ?
                `<a href="${calendarUrl}" target="_blank" rel="noopener" class="btn">📅 Team Calendar</a>` :
                ''
              }
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
  
  if (teamId) {
    // Wait a moment for the DOM to be ready, then find and expand the team
    setTimeout(() => {
      const escapedTeamId = window.CSS && typeof window.CSS.escape === 'function'
        ? window.CSS.escape(teamId)
        : teamId.replace(/[^a-zA-Z0-9_-]/g, '');
      const teamCard = escapedTeamId ? document.querySelector(`[data-team-id="${escapedTeamId}"]`) : null;
      if (teamCard) {
        // Expand the team card
        teamCard.classList.remove('collapsed');
        const toggleButton = teamCard.querySelector('.team-header__toggle');
        const details = teamCard.querySelector('.team-details');
        if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
        if (details) details.hidden = false;
        
        // Add a highlight class for visual emphasis
        teamCard.classList.add('highlighted');
        
        // Scroll to the team card
        teamCard.scrollIntoView({ 
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center' 
        });
        
        // Remove highlight after a few seconds
        setTimeout(() => {
          teamCard.classList.remove('highlighted');
        }, 3000);
      } else {
        // If team card not found, try again after a short delay
        // This handles cases where rendering is still in progress
        setTimeout(() => handleTeamUrlParameter(), 100);
      }
    }, 150); // Increased timeout for better reliability
  }
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
    const toggleButton = event.target.closest('.team-header__toggle');
    if (toggleButton) {
      toggleTeamCard(toggleButton);
      return;
    }

    const cardSurface = event.target.closest('.team-card.collapsed, .team-header');
    if (!cardSurface) return;
    const cardToggle = cardSurface.closest('.team-card').querySelector('.team-header__toggle');
    if (cardToggle) toggleTeamCard(cardToggle);
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
