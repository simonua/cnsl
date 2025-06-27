let teamsData = []; // Avoid global variable name conflicts
let poolsData = []; // Store pools data for lookups

/**
 * Load pools data for lookups
 */
async function loadPoolsData() {
  try {
    const response = await fetch("assets/data/pools.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    poolsData = data.pools || data;
    console.log("Loaded pools data:", poolsData.length, "pools");
  } catch (error) {
    console.error("Failed to load pools data:", error);
    poolsData = [];
  }
}

/**
 * Find pool by name from pools data
 * @param {string} poolName - Name of the pool to find
 * @returns {Object|null} - Pool object or null if not found
 */
function findPoolByName(poolName) {
  if (!poolName || !Array.isArray(poolsData)) return null;
  
  return poolsData.find(pool => 
    pool.name && pool.name.toLowerCase() === poolName.toLowerCase()
  ) || null;
}

/**
 * Format practice schedule similar to pool schedules
 * @param {Object} practice - Practice object from team data
 * @returns {string} - HTML string for practice schedule
 */
function formatPracticeSchedule(practice) {
  if (!practice) return '';
  
  let html = '<div class="practice-schedule">';
  html += '<h4>🏊‍♂️ Practice Schedule</h4>';
  
  // Add season info if available
  if (practice.regular && practice.regular.season) {
    html += `<div class="season-info"><strong>Season:</strong> ${practice.regular.season}</div>`;
  }
  
  // Morning practices
  if (practice.regular && practice.regular.morning) {
    const morning = practice.regular.morning;
    html += '<div class="practice-period">';
    html += '<strong>Morning Practice:</strong>';
    html += `<div class="practice-details">`;
    html += `<div><strong>Days:</strong> ${morning.days}</div>`;
    if (morning.location) {
      const poolLink = getPoolMapLink(morning.location, morning.address);
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
  if (practice.regular && practice.regular.evening && Array.isArray(practice.regular.evening)) {
    practice.regular.evening.forEach(evening => {
      html += '<div class="practice-period">';
      html += `<strong>${evening.day} Evening Practice:</strong>`;
      html += `<div class="practice-details">`;
      if (evening.location) {
        const poolLink = getPoolMapLink(evening.location, evening.address);
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
 * Get the next upcoming practice information
 * @param {Object} practice - Practice object from team data
 * @returns {Object|null} - Next practice info or null
 */
function getNextPractice(practice) {
  if (!practice || !practice.regular) return null;
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  // Check if we're still in season
  if (practice.regular.season) {
    const seasonEnd = new Date(practice.regular.season.split(' - ')[1] + ' 2025');
    if (now > seasonEnd) return null;
  }
  
  // Check morning practices (Tuesday-Friday)
  if (practice.regular.morning) {
    const morningDays = [2, 3, 4, 5]; // Tuesday-Friday
    for (let day of morningDays) {
      if (day > currentDay || (day === currentDay && currentTime < 10 * 60)) {
        // Found next morning practice
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const sessions = practice.regular.morning.sessions;
        const firstSession = sessions && sessions[0] ? sessions[0] : null;
        
        return {
          day: dayNames[day],
          time: firstSession ? firstSession.time : 'Morning',
          location: practice.regular.morning.location,
          address: practice.regular.morning.address,
          type: 'Morning Practice'
        };
      }
    }
  }
  
  // Check evening practices
  if (practice.regular.evening && Array.isArray(practice.regular.evening)) {
    for (let evening of practice.regular.evening) {
      const dayName = evening.day;
      const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
      
      if (dayIndex > currentDay || (dayIndex === currentDay && currentTime < 20 * 60)) {
        const sessions = evening.sessions;
        const firstSession = sessions && sessions[0] ? sessions[0] : null;
        
        return {
          day: dayName,
          time: firstSession ? firstSession.time : 'Evening',
          location: evening.location,
          address: evening.address,
          type: 'Evening Practice'
        };
      }
    }
  }
  
  return null;
}

/**
 * Create a map link for a pool location
 * @param {string} location - Pool location name
 * @param {string} address - Pool address
 * @returns {string} - HTML link to Google Maps
 */
function getPoolMapLink(location, address) {
  const query = encodeURIComponent(address || location);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return `<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
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
    // Handle potential missing name properties
    const nameA = (a && a.name) ? a.name : '';
    const nameB = (b && b.name) ? b.name : '';
    return nameA.localeCompare(nameB);
  });

  // Generate HTML for each team
  const html = sortedTeams.map(team => {
    // Safety checks for all team properties
    const teamName = team.name || 'Unknown Team';
    const teamUrl = team.url || '#';
    const homePools = Array.isArray(team.homePools) ? team.homePools : [];
    const homePool = homePools[0] || '';
    
    // Find pool data for the home pool
    const poolData = homePool ? findPoolByName(homePool) : null;
    const poolAddress = poolData ? poolData.address : '';
    
    // Get next practice info
    const nextPractice = getNextPractice(team.practice);
    
    // Format practice schedule
    const practiceScheduleHtml = formatPracticeSchedule(team.practice);
    
    let upcomingPracticeHtml = '';
    if (nextPractice) {
      const practicePoolLink = getPoolMapLink(nextPractice.location, nextPractice.address);
      upcomingPracticeHtml = `
        <div class="upcoming-practice">
          <strong>🏊‍♂️ Upcoming practice:</strong> ${nextPractice.type} on ${nextPractice.day} at ${practicePoolLink} at ${nextPractice.time}
        </div>
      `;
    }
    
    return `
      <div class="team-card">
        <div class="team-header">
          <h3>${teamName}</h3>
        </div>
        
        ${upcomingPracticeHtml}
        
        <div class="team-details">
          ${homePool ? `
            <div class="detail-item">
              <strong>🏠 Home Pool:</strong> ${poolData ? 
                `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poolAddress)}" target="_blank" rel="noopener" class="pool-link">${homePool}</a>` : 
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
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the teams page before fetching data
  if (!document.getElementById("teamList")) {
    console.log("Not on teams page, skipping team data fetch");
    return;
  }
  
  // Load both pools and teams data
  await loadPoolsData();
  
  fetch("assets/data/teams.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const teams = data.teams || data; // Handle both new structure and backward compatibility
      console.log("Loaded team data:", teams.length, "teams");
      teamsData = teams;
      renderTeams(teams);
    })
    .catch(error => {
      console.error("Failed to load team data:", error);
      const list = document.getElementById("teamList");
      if (list) {
        list.innerHTML = "<p>⚠️ Team data is currently unavailable. Please try again later.</p>";
      }
    });
});
