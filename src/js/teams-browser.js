// Global data manager instance for teams browser
let teamsBrowserDataManager = null;


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the teams browser with data manager
 */
async function initializeTeamsBrowser() {
  if (!teamsBrowserDataManager) {
    teamsBrowserDataManager = getDataManager();
    await teamsBrowserDataManager.initialize();
  }
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
 * Get current practice schedule (similar to pool current schedule logic)
 * @param {Object} practice - Practice object from team data
 * @returns {Object|null} - Current active practice schedule or null
 */
function getCurrentPracticeSchedule(practice) {
  if (!practice || !practice.regular) return null;
  
  // Check if we're currently in regular season
  if (practice.regular.season) {
    const now = new Date();
    const [startDate, endDate] = practice.regular.season.split(' - ');
    const seasonStart = new Date(startDate + ' 2025');
    const seasonEnd = new Date(endDate + ' 2025');
    
    if (now >= seasonStart && now <= seasonEnd) {
      return practice.regular;
    }
  }
  
  return null;
}

/**
 * Get enhanced pool link using new pool link helper
 * @param {string} location - Pool location name
 * @param {string} fallbackAddress - Fallback address if pool not found (unused now)
 * @returns {string} - HTML link to pools.html page with pool data
 */
function getEnhancedPoolLink(location, fallbackAddress) {
  if (!location) return '';
  
  // Use the new pool link helper
  return generateEnhancedPoolLink(location, teamsBrowserDataManager, {
    preferPoolsPage: true,
    showBothLinks: false
  });
}

/**
 * Get next two upcoming practices
 * @param {Object} practice - Practice object from team data
 * @returns {Array} - Array of next two upcoming practices
 */
function getUpcomingPractices(practice, count = 2) {
  if (!practice || !practice.regular) return [];
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const practices = [];
  
  // Check if we're still in season
  if (practice.regular.season) {
    const seasonEnd = new Date(practice.regular.season.split(' - ')[1] + ' 2025');
    if (now > seasonEnd) return [];
  }
  
  // Helper to add practice to results
  const addPractice = (day, dayIndex, time, location, address, type) => {
    if (practices.length < count) {
      practices.push({
        day,
        dayIndex,
        time,
        location,
        address,
        type
      });
    }
  };
  
  // Check upcoming practices for the next 7 days
  for (let daysAhead = 0; daysAhead < 7 && practices.length < count; daysAhead++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + daysAhead);
    const checkDay = checkDate.getDay();
    const isToday = daysAhead === 0;
    
    // Morning practices (Tuesday-Friday)
    if (practice.regular.morning && [2, 3, 4, 5].includes(checkDay)) {
      const hasPassedToday = isToday && currentTime >= 10 * 60; // 10 AM cutoff
      if (!hasPassedToday) {
        const sessions = practice.regular.morning.sessions;
        const firstSession = sessions && sessions[0] ? sessions[0] : null;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        addPractice(
          dayNames[checkDay],
          checkDay,
          firstSession ? firstSession.time : 'Morning',
          practice.regular.morning.location,
          practice.regular.morning.address,
          'Morning Practice'
        );
      }
    }
    
    // Evening practices
    if (practice.regular.evening && Array.isArray(practice.regular.evening)) {
      for (let evening of practice.regular.evening) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const eveningDayIndex = dayNames.indexOf(evening.day);
        
        if (eveningDayIndex === checkDay) {
          const hasPassedToday = isToday && currentTime >= 20 * 60; // 8 PM cutoff
          if (!hasPassedToday) {
            const sessions = evening.sessions;
            const firstSession = sessions && sessions[0] ? sessions[0] : null;
            
            addPractice(
              evening.day,
              eveningDayIndex,
              firstSession ? firstSession.time : 'Evening',
              evening.location,
              evening.address,
              'Evening Practice'
            );
          }
        }
      }
    }
  }
  
  return practices;
}

/**
 * Format current practice schedule (simplified, no preseason)
 * @param {Object} practice - Practice object from team data
 * @returns {string} - HTML string for current practice schedule
 */
function formatCurrentPracticeSchedule(practice) {
  const currentSchedule = getCurrentPracticeSchedule(practice);
  if (!currentSchedule) return '';
  
  let html = '<div class="practice-schedule">';
  html += '<h4>🏊‍♂️ Current Practice Schedule</h4>';
  
  // Add season info
  if (currentSchedule.season) {
    html += `<div class="season-info"><strong>Season:</strong> ${currentSchedule.season}</div>`;
  }
  
  // Morning practices
  if (currentSchedule.morning) {
    const morning = currentSchedule.morning;
    html += '<div class="practice-period">';
    html += '<strong>Morning Practice:</strong>';
    html += `<div class="practice-details">`;
    html += `<div><strong>Days:</strong> ${morning.days}</div>`;
    if (morning.location) {
      const poolLink = getEnhancedPoolLink(morning.location, morning.address);
      html += `<div><strong>Location:</strong> ${poolLink}</div>`;
    }
    if (morning.sessions && Array.isArray(morning.sessions)) {
      html += '<div class="sessions">';
      morning.sessions.forEach(session => {
        html += `<div class="session-item">`;
        html += `<span class="session-time">${session.time}</span>`;
        html += `<span class="session-group">${session.group}</span>`;
        html += `</div>`;
      });
      html += '</div>';
    }
    html += '</div></div>';
  }
  
  // Evening practices
  if (currentSchedule.evening && Array.isArray(currentSchedule.evening)) {
    currentSchedule.evening.forEach(evening => {
      html += '<div class="practice-period">';
      html += `<strong>${evening.day} Evening Practice:</strong>`;
      html += `<div class="practice-details">`;
      if (evening.location) {
        const poolLink = getEnhancedPoolLink(evening.location, evening.address);
        html += `<div><strong>Location:</strong> ${poolLink}</div>`;
      }
      if (evening.sessions && Array.isArray(evening.sessions)) {
        html += '<div class="sessions">';
        evening.sessions.forEach(session => {
          html += `<div class="session-item">`;
          html += `<span class="session-time">${session.time}</span>`;
          html += `<span class="session-group">${session.group}</span>`;
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
 * Get the next upcoming practice information (simplified - now using getUpcomingPractices)
 * @param {Object} practice - Practice object from team data
 * @returns {Object|null} - Next practice info or null
 */
function getNextPractice(practice) {
  const upcoming = getUpcomingPractices(practice, 1);
  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Create a map link for a pool location
 * @param {string} location - Pool location name
 * @param {string} address - Pool address
 * @returns {string} - HTML link to pools.html page
 */
function getPoolMapLink(location, address) {
  // Try to use enhanced pool link first (which links to pools.html when available)
  const enhancedLink = getEnhancedPoolLink(location, address);
  if (enhancedLink) {
    return enhancedLink;
  }
  
  // Fallback to pools.html page
  return `<a href="pools.html" class="location-link">${location}</a>`;
}

/**
 * Create team logo HTML with graceful fallback
 * @param {string} teamId - Team ID for logo filename
 * @param {string} teamName - Team name for alt text
 * @returns {string} - HTML for team logo with fallback
 */
function createTeamLogo(teamId, teamName) {
  if (!teamId) return '';
  
  const logoPath = `assets/images/logos/${teamId}.png`;
  
  return `
    <div class="team-logo">
      <img 
        src="${logoPath}" 
        alt="${teamName} Logo" 
        class="team-logo-img"
        onerror="this.parentElement.style.display='none';"
      />
    </div>
  `;
}

/**
 * Toggles the collapsed state of a team card
 * @param {Element} headerElement - The clicked header element
 */
function toggleTeamCard(headerElement) {
  const teamCard = headerElement.closest('.team-card');
  teamCard.classList.toggle('collapsed');
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

  // Sort teams by name alphabetically
  const sortedTeams = [...teams].sort((a, b) => {
    const nameA = (a && a.name) ? a.name : '';
    const nameB = (b && b.name) ? b.name : '';
    return nameA.localeCompare(nameB);
  });

  // Generate HTML for each team
  const html = sortedTeams.map(team => {
    const teamName = team.name || 'Unknown Team';
    const teamId = team.id || '';
    const teamUrl = team.url || '#';
    const homePools = Array.isArray(team.homePools) ? team.homePools : [];
    const homePool = homePools[0] || '';
    
    // Create team logo HTML
    const logoHtml = createTeamLogo(teamId, teamName);
    
    // Find pool data for the home pool using data manager
    const poolData = homePool ? findPoolByName(homePool) : null;
    
    // Get next two upcoming practices
    const upcomingPractices = getUpcomingPractices(team.practice, 2);
    
    // Format current practice schedule (no preseason)
    const practiceScheduleHtml = formatCurrentPracticeSchedule(team.practice);
    
    // Create upcoming practices HTML for header area
    let upcomingPracticesHtml = '';
    if (upcomingPractices.length > 0) {
      upcomingPracticesHtml = `
        <div class="upcoming-practices">
          <h4>📅 Next Practices</h4>
          ${upcomingPractices.map(practice => {
            const practicePoolLink = getEnhancedPoolLink(practice.location, practice.address);
            return `
              <div class="upcoming-practice-item">
                <strong>${practice.type}:</strong> ${practice.day} at ${practice.time}
                <br><span class="practice-location">📍 ${practicePoolLink}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    
    // Get fallback address for legacy compatibility
    let fallbackAddress = '';
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
      <div class="team-card collapsed" data-team-id="${teamId}">
        <div class="team-header" onclick="toggleTeamCard(this)">
          ${logoHtml}
          <div class="team-header-content">
            <h3>${teamName}</h3>
          </div>
        </div>
        
        <div class="team-details">
          ${upcomingPracticesHtml}
          
          ${homePool ? `
            <div class="detail-item">
              <strong>🏠 Home Pool:</strong> ${poolData ? 
                getEnhancedPoolLink(homePool, fallbackAddress) : 
                homePool
              }
            </div>
          ` : ''}
          
          ${practiceScheduleHtml}
          
          <div class="team-actions">
            <a href="${teamUrl}" target="_blank" rel="noopener" class="btn">🌐 Team Website</a>
            ${team.practice && team.practice.url ? 
              `<a href="${team.practice.url}" target="_blank" rel="noopener" class="btn">📅 Practice Schedule</a>` : 
              ''
            }
            ${team.resultsUrl ? 
              `<a href="${team.resultsUrl}" target="_blank" rel="noopener" class="btn">🏆 Swim Meet Results</a>` : 
              ''
            }
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
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
      const teamCard = document.querySelector(`[data-team-id="${teamId}"]`);
      if (teamCard) {
        // Expand the team card
        teamCard.classList.remove('collapsed');
        
        // Add a highlight class for visual emphasis
        teamCard.classList.add('highlighted');
        
        // Scroll to the team card
        teamCard.scrollIntoView({ 
          behavior: 'smooth', 
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
function generateTeamLink(teamId, teamName, options = {}) {
  const {
    className = 'team-link',
    target = '_self',
    title = `View ${teamName} details`
  } = options;
  
  if (!teamId || !teamName) {
    return teamName || 'Unknown Team';
  }
  
  return `<a href="teams.html?team=${encodeURIComponent(teamId)}" 
             class="${className}" 
             target="${target}" 
             title="${title}">
             ${teamName}
           </a>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the teams page before fetching data
  if (!document.getElementById("teamList")) {
    console.log("Not on teams page, skipping team data fetch");
    return;
  }
  
  try {
    // Initialize the data manager with the new OOP system
    await initializeTeamsBrowser();
    
    // Get teams from the data manager
    const teamsManager = teamsBrowserDataManager.getTeams();
    const teams = teamsManager.getAllTeams();
    
    console.log("Loaded team data from DataManager:", teams.length, "teams");
    
    renderTeams(teams);
    
    // Handle team URL parameter for direct linking
    handleTeamUrlParameter();
    
  } catch (error) {
    console.error("Failed to load team data:", error);
    const list = document.getElementById("teamList");
    if (list) {
      list.innerHTML = "<p>⚠️ Team data is currently unavailable. Please try again later.</p>";
    }
  }
});
