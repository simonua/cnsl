let teamData = [];
let poolData = [];
let meetData = [];

// ------------------------------
//    SCHEDULE UTILITY FUNCTIONS
// ------------------------------

/**
 * Formats activity types for display
 * @param {string|Array} types - Single type string or array of types
 * @returns {string} - Formatted types string
 */
function formatActivityTypes(types) {
  if (!types) return '';
  if (typeof types === 'string') return types;
  if (Array.isArray(types)) return types.join(', ');
  return '';
}

/**
 * Checks if a pool is currently open based on its schedule
 * @param {Object} pool - Pool object with schedules property
 * @returns {boolean} - True if the pool is currently open
 */
function isPoolOpen(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules)) {
    return false;
  }

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return false;
  }

  // Find today's hours - there might be multiple time slots for the same day
  const todayHours = activeSchedule.hours.filter(h => 
    h.weekDays && h.weekDays.includes(currentDay)
  );
  if (!todayHours.length) {
    return false;
  }

  // Check if current time falls within any of today's time slots
  return todayHours.some(hour => {
    const startMinutes = timeStringToMinutes(hour.startTime);
    const endMinutes = timeStringToMinutes(hour.endTime);
    return currentTime >= startMinutes && currentTime <= endMinutes;
  });
}

/**
 * Converts time string (e.g., "6:00AM", "10:30PM") to minutes since midnight
 * @param {string} timeStr - Time string in format "H:MMAM/PM"
 * @returns {number} - Minutes since midnight
 */
function timeStringToMinutes(timeStr) {
  const match = timeStr.match(/(\d{1,2}):?(\d{0,2})(AM|PM)/i);
  if (!match) return 0;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3].toUpperCase();

  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
    adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
    adjustedHours = 0;
  }

  return adjustedHours * 60 + minutes;
}

/**
 * Formats pool schedule for display in copilot responses
 * @param {Object} pool - Pool object with schedules property
 * @returns {string} - HTML string for displaying hours
 */
function formatCopilotPoolHours(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules) || pool.schedules.length === 0) {
    return '<div><strong>🕒 Hours:</strong> Not available</div>';
  }

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return '<div><strong>🕒 Hours:</strong> No current schedule available</div>';
  }

  const isOpen = isPoolOpen(pool);
  const statusIcon = isOpen ? '🟢' : '🔴';
  const statusText = isOpen ? 'Open Now' : 'Closed';

  // Format the period dates
  const startDate = new Date(activeSchedule.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(activeSchedule.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const periodText = `Hours for ${startDate} - ${endDate}`;

  // Group hours by day and time range with activity types
  const dayGroups = {};
  activeSchedule.hours.forEach(hour => {
    if (hour.weekDays) {
      hour.weekDays.forEach(day => {
        if (!dayGroups[day]) {
          dayGroups[day] = [];
        }
        dayGroups[day].push({
          timeRange: hour.startTime && hour.endTime ? `${hour.startTime}-${hour.endTime}` : '',
          types: formatActivityTypes(hour.types),
          notes: hour.notes || ''
        });
      });
    }
  });

  // Format hours display
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach(day => {
    if (dayGroups[day]) {
      const daySlots = dayGroups[day];
      if (daySlots.length === 1) {
        // Single time slot for the day
        const slot = daySlots[0];
        const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange) : '';
        hoursDisplay += `<div style="margin-bottom: 0.3rem;"><strong>${day}:</strong> <span class="time-range-container">${timeHtml}</span>${typesText}${notesText}</div>`;
      } else {
        // Multiple time slots for the day
        hoursDisplay += `<div style="margin-bottom: 0.3rem;"><strong>${day}:</strong></div>`;
        daySlots.forEach(slot => {
          const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
          const notesText = slot.notes ? ` - ${slot.notes}` : '';
          const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange) : '';
          hoursDisplay += `<div style="margin-left: 1rem; margin-bottom: 0.2rem;"><span class="time-range-container">${timeHtml}</span>${typesText}${notesText}</div>`;
        });
      }
    }
  });

  return `
    <div>
      <strong>🕒 Hours:</strong> <span style="color: ${isOpen ? 'var(--success-color)' : 'var(--error-color)'}; font-weight: 600;">${statusIcon} ${statusText}</span><br>
      <div style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">
        ${periodText}
      </div>
      <div style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
        ${hoursDisplay}
      </div>
    </div>
  `;
}

/**
 * Groups consecutive days for cleaner display in copilot
 * @param {Array} days - Array of day names
 * @returns {Array} - Array of formatted day ranges
 */
function groupConsecutiveDaysForCopilot(days) {
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  const groups = [];
  let currentGroup = [sortedDays[0]];

  for (let i = 1; i < sortedDays.length; i++) {
    const currentIndex = dayOrder.indexOf(sortedDays[i]);
    const prevIndex = dayOrder.indexOf(sortedDays[i - 1]);

    if (currentIndex === prevIndex + 1) {
      currentGroup.push(sortedDays[i]);
    } else {
      groups.push(formatDayGroupForCopilot(currentGroup));
      currentGroup = [sortedDays[i]];
    }
  }
  groups.push(formatDayGroupForCopilot(currentGroup));

  return groups;
}

/**
 * Formats a group of consecutive days for copilot display
 * @param {Array} group - Array of consecutive day names
 * @returns {string} - Formatted day range string
 */
function formatDayGroupForCopilot(group) {
  if (group.length === 1) {
    return group[0].substring(0, 3); // Return abbreviated day name
  } else {
    return `${group[0].substring(0, 3)}-${group[group.length - 1].substring(0, 3)}`;
  }
}

/**
 * Formats a time range into three separate spans for better alignment
 * @param {string} timeRange - Time range in format "startTime-endTime"
 * @returns {string} - HTML with three spans for start, dash, and end time
 */
function formatTimeRangeSpans(timeRange) {
  if (!timeRange) return '';
  
  const parts = timeRange.split('-');
  if (parts.length !== 2) return timeRange;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  return `<span class="time-start">${startTime}</span><span class="time-dash">-</span><span class="time-end">${endTime}</span>`;
}

// ------------------------------
//    APPLICATION INITIALIZATION
// ------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Load team data
  fetch("assets/data/teams.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      teamData = data.teams || data; // Handle both new structure and backward compatibility
    })
    .catch(error => {
      console.error("Failed to load team data:", error);
      const output = document.getElementById("copilotResponse");
      if (output) {
        output.innerHTML = "<p>⚠️ Team data is currently unavailable. Please try again later.</p>";
      }
    });
    
  // Load pool data
  fetch("assets/data/pools.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      poolData = data.pools || data; // Handle both new structure and backward compatibility
    })
    .catch(error => {
      console.error("Failed to load pool data:", error);
    });
    
  // Try to load meet data if available
  fetch("assets/data/meets.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      meetData = data;
    })
    .catch(error => {
      console.error("Failed to load meet data:", error);
    });
});

/**
 * Handles the search functionality when the user submits a query
 */
function handleSearch() {
  const queryInput = document.getElementById("copilotQuery");
  const responseElement = document.getElementById("copilotResponse");
  
  if (!queryInput || !responseElement) return;
  
  const query = queryInput.value.trim().toLowerCase();
  
  if (!query) {
    responseElement.innerHTML = `
      <div class="copilot-response error">
        <h3>⚠️ Please enter a question</h3>
        <p>Type your question in the search box above or use the voice button to speak your question.</p>
      </div>
    `;
    return;
  }
  
  // Show loading state with mobile-friendly feedback
  responseElement.innerHTML = `
    <div class="copilot-response info">
      <h3>🔍 Searching...</h3>
      <p>Looking for information about "${query}"</p>
    </div>
  `;
  
  // Process the query and provide a response
  setTimeout(() => {
    const response = processQuery(query);
    responseElement.innerHTML = response;
    
    // Scroll to response with mobile optimization
    responseElement.scrollIntoView({ 
      behavior: "smooth", 
      block: "start" 
    });
    
    // Clear search input for mobile UX
    queryInput.value = '';
  }, 300);
}

/**
 * Processes a natural language query and returns relevant information
 * Uses a decision tree approach to categorize and route queries appropriately
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function processQuery(query) {
  console.log('🔍 SEARCH DECISION TREE START');
  console.log('📝 Original Query:', `"${query}"`);
  
  // Parse and normalize the query
  const normalizedQuery = query.toLowerCase().trim();
  console.log('🔧 Normalized Query:', `"${normalizedQuery}"`);
  
  // Extract date/time context from query
  const dateTimeContext = extractDateTimeContext(normalizedQuery);
  console.log('📅 Date/Time Context:', dateTimeContext);
  
  // DECISION TREE: Primary query categorization
  // ========================================
  console.log('🌳 DECISION TREE: Starting primary categorization...');
  
  // BRANCH 1: Team-related queries (practice, meets, coach info)
  // Keywords: team names, "practice", "meet", "coach", location questions with team context
  if (isTeamQuery(normalizedQuery)) {
    console.log('✅ BRANCH 1: Team-related query detected');
    console.log('🏊‍♀️ Routing to handleTeamQuery()');
    return handleTeamQuery(normalizedQuery, dateTimeContext);
  }
  
  // BRANCH 2: Pool feature and status queries
  // Keywords: feature names, "open now", "available", pool characteristics
  if (isPoolFeatureQuery(normalizedQuery)) {
    console.log('✅ BRANCH 2: Pool feature/status query detected');
    console.log('🎯 Routing to handlePoolFeatureQuery()');
    return handlePoolFeatureQuery(normalizedQuery, dateTimeContext);
  }
  
  // BRANCH 3: Pool location and basic info queries
  // Keywords: "pool", "where", "location", "address", specific pool names
  if (isPoolLocationQuery(normalizedQuery)) {
    console.log('✅ BRANCH 3: Pool location query detected');
    console.log('📍 Routing to handlePoolLocationQuery()');
    return handlePoolLocationQuery(normalizedQuery, dateTimeContext);
  }
  
  // BRANCH 4: Meet schedule queries
  // Keywords: "meet", "event", "competition", "schedule", team names with meet context
  if (isMeetQuery(normalizedQuery)) {
    console.log('✅ BRANCH 4: Meet schedule query detected');
    console.log('📅 Routing to handleMeetQuery()');
    return handleMeetQuery(normalizedQuery, dateTimeContext);
  }
  
  // BRANCH 5: Pool hours and availability queries
  // Keywords: "hour", "open", "close", "time", "when does", "available"
  if (isHoursQuery(normalizedQuery)) {
    console.log('✅ BRANCH 5: Pool hours query detected');
    console.log('🕒 Routing to handleHoursQuery()');
    return handleHoursQuery(normalizedQuery, dateTimeContext);
  }
  
  // Default response with helpful suggestions
  console.log('❌ NO MATCH: Query did not match any decision tree branches');
  console.log('🤷‍♂️ Returning default response with suggestions');
  console.log('🔍 SEARCH DECISION TREE END\n');
  
  return `
    <div class="copilot-response error">
      <h3>🤔 I'm not sure about that</h3>
      <p>I couldn't understand your question. Try asking about:</p>
      <div class="suggestion-grid">
        <div class="suggestion-item">
          <strong>Teams:</strong> "When do the Marlins practice?"
        </div>
        <div class="suggestion-item">
          <strong>Pools:</strong> "Where is the Phelps Luck pool?"
        </div>
        <div class="suggestion-item">
          <strong>Hours:</strong> "What are the pool hours?" or "Which pools are open now?"
        </div>
        <div class="suggestion-item">
          <strong>Features:</strong> "Which pools have slides?"
        </div>
        <div class="suggestion-item">
          <strong>Meets:</strong> "When is the next swim meet?"
        </div>
      </div>
    </div>
  `;
}

/**
 * Handles queries related to teams, practice schedules, and coaching
 * Enhanced to support location queries like "Where is Marlins practice tonight?"
 * @param {string} query - The user's search query
 * @param {Object} dateTimeContext - The parsed date/time context
 * @returns {string} HTML content to display as a response
 */
function handleTeamQuery(query, dateTimeContext = {}) {
  if (!teamData || !teamData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Team Information Unavailable</h3>
        <p>Sorry, team information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // DECISION SUB-TREE: Team query type classification
  // ================================================
  
  const matchingTeams = extractTeamsFromQuery(query);
  
  if (matchingTeams.length === 0) {
    return handleNoTeamFound(query);
  }
  
  // BRANCH 1: Practice-related queries (schedule, location, times)
  if (query.includes('practice') || query.includes('training') || query.includes('where')) {
    return handlePracticeQuery(query, matchingTeams);
  }
  
  // BRANCH 2: Meet-related queries for specific teams
  if (query.includes('meet') || query.includes('competition')) {
    return handleTeamMeetQuery(query, matchingTeams);
  }
  
  // BRANCH 3: General team information
  return handleGeneralTeamQuery(query, matchingTeams);
}

/**
 * Extracts teams that match keywords found in the query
 * @param {string} query - The user's search query
 * @returns {Array} Array of matching team objects
 */
function extractTeamsFromQuery(query) {
  console.log('🔍 Extracting teams from query:', `"${query}"`);

  if (!teamData) {
    return [];
  }
  
  const queryLower = query.toLowerCase();
  const matchingTeams = [];
  
  for (const team of teamData) {
    console.log('🔎 Checking team:', team.name);
    // Check if any team keywords are found in the query
    if (team.keywords && team.keywords.some(keyword => 
      queryLower.includes(keyword.toLowerCase())
    )) {
      matchingTeams.push(team);
    }
    // Also check the team name directly
    else if (team.name && queryLower.includes(team.name.toLowerCase())) {
      matchingTeams.push(team);
    }
  }

  if (matchingTeams.length === 0) {
    console.log('❌ No matching teams found for query:', `"${query}"`); 
  } else {
    console.log('✅ Matching teams found:', matchingTeams.map(t => t.name).join(', '));
  }
  return matchingTeams;
}

/**
 * Handles practice-related queries for teams
 * @param {string} query - The user's search query
 * @param {Array} teams - Array of matching team objects
 * @returns {string} HTML content for practice information
 */
function handlePracticeQuery(query, teams) {
  const today = new Date();
  const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
  const isTonight = query.includes('tonight') || query.includes('today');
  const isLocation = query.includes('where') || query.includes('location');
  
  const practiceInfo = teams.map(team => {
    if (!team.practice) {
      return `
        <div class="team-card">
          <h3>${team.name}</h3>
          <p>Practice information not available. Please check the team's website or contact coaches directly.</p>
          ${team.url ? `<a href="${team.url}" target="_blank" class="button">Visit Team Website</a>` : ''}
        </div>
      `;
    }
    
    let practiceDetails = '';
    
    // Check for current practice periods
    if (team.practice.preseason) {
      const currentPractice = getCurrentPracticeInfo(team.practice.preseason, today);
      if (currentPractice) {
        practiceDetails = formatPracticeInfo(currentPractice, isTonight, isLocation, todayDay);
      }
    }
    
    // If no current practice found, show general practice info
    if (!practiceDetails && team.practice.regular) {
      practiceDetails = formatRegularPracticeInfo(team.practice.regular, isLocation);
    }
    
    // Fallback to practice pools if no detailed schedule
    if (!practiceDetails && team.practicePools) {
      practiceDetails = `
        <div class="detail-item">
          <strong>🏊‍♀️ Practice Locations:</strong><br>
          ${team.practicePools.map(pool => `<span class="pool-tag">${pool}</span>`).join(' ')}
        </div>
      `;
    }
    
    return `
      <div class="team-card">
        <h3>${team.name}</h3>
        <div class="team-details">
          ${practiceDetails || '<p>Detailed practice schedule not available.</p>'}
          ${team.practice?.url ? `<div class="detail-item"><a href="${team.practice.url}" target="_blank">View Full Practice Schedule</a></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  const title = isLocation ? '📍 Practice Locations' : 
                isTonight ? '🏊‍♀️ Tonight\'s Practice' : 
                '🏊‍♀️ Practice Information';
  
  return `
    <div class="copilot-response success">
      <h3>${title}</h3>
      ${practiceInfo}
    </div>
  `;
}

/**
 * Gets current practice information based on date ranges
 * @param {Array} practices - Array of practice period objects
 * @param {Date} date - Current date
 * @returns {Object|null} - Current practice info or null
 */
function getCurrentPracticeInfo(practices, date) {
  if (!practices || !Array.isArray(practices)) return null;
  
  return practices.find(practice => {
    if (!practice.period) return false;
    
    try {
      // Extract dates from period string (e.g., "May 27 - May 30")
      const dates = practice.period.match(/(\w+ \d+)/g);
      if (!dates || dates.length < 2) return false;
      
      const currentYear = date.getFullYear();
      const startDate = new Date(`${dates[0]}, ${currentYear}`);
      const endDate = new Date(`${dates[1]}, ${currentYear}`);
      
      // Handle year boundary (if end date is in next year)
      if (endDate < startDate) {
        endDate.setFullYear(currentYear + 1);
      }
      
      return date >= startDate && date <= endDate;
    } catch (error) {
      console.warn('Error parsing practice period:', practice.period, error);
      return false;
    }
  });
}

/**
 * Formats practice information for display
 * @param {Object} practice - Practice period object
 * @param {boolean} isTonight - Whether query is about tonight
 * @param {boolean} isLocation - Whether query is about location
 * @param {string} todayDay - Current day name
 * @returns {string} - Formatted practice HTML
 */
function formatPracticeInfo(practice, isTonight, isLocation, todayDay) {
  let html = '';
  
  if (practice.location) {
    const mapQuery = encodeURIComponent(practice.address || practice.location);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    
    html += `
      <div class="detail-item">
        <strong>📍 Location:</strong> <a href="${mapsUrl}" target="_blank" rel="noopener">${practice.location}</a>
        ${practice.address ? `<br><span class="address-text"><a href="${mapsUrl}" target="_blank" rel="noopener">${practice.address}</a></span>` : ''}
      </div>
    `;
  }
  
  if (!isLocation && practice.sessions) {
    html += `
      <div class="detail-item">
        <strong>⏰ Schedule (${practice.period}):</strong><br>
        <div class="practice-schedule">
          ${practice.sessions.map(session => `
            <div class="session-item">
              <span class="session-time">${session.time}</span>
              <span class="session-group">${session.group}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    if (practice.days) {
      html += `
        <div class="detail-item">
          <strong>📅 Days:</strong> ${practice.days}
        </div>
      `;
    }
  }
  
  return html;
}

/**
 * Formats regular practice information for display
 * @param {Object} regularPractice - Regular practice schedule data with morning/evening structure
 * @param {boolean} isLocation - Whether to focus on location information
 * @returns {string} - Formatted practice HTML
 */
function formatRegularPracticeInfo(regularPractice, isLocation = false) {
  if (!regularPractice) return '';
  
  let html = '';
  
  // Handle morning practices
  if (regularPractice.morning) {
    html += formatSinglePracticeInfo(regularPractice.morning, isLocation, 'Mornings');
  }
  
  // Handle evening practices (array of day-specific practices)
  if (regularPractice.evening && Array.isArray(regularPractice.evening)) {
    regularPractice.evening.forEach(eveningPractice => {
      const dayLabel = eveningPractice.day ? `${eveningPractice.day} Evening` : 'Evenings';
      html += formatSinglePracticeInfo(eveningPractice, isLocation, dayLabel);
    });
  }
  
  // Add season information if available
  if (regularPractice.season && !isLocation) {
    html = `
      <div class="detail-item">
        <strong>📆 Season:</strong> ${regularPractice.season}
      </div>
    ` + html;
  }
  
  return html;
}

/**
 * Formats a single practice period for display
 * @param {Object} practice - Single practice period object
 * @param {boolean} isLocation - Whether to focus on location information
 * @param {string} label - Optional label for the practice session
 * @returns {string} - Formatted practice HTML
 */
function formatSinglePracticeInfo(practice, isLocation = false, label = '') {
  if (!practice) return '';
  
  let html = '';
  
  // Location information
  if (practice.location) {
    const mapQuery = encodeURIComponent(practice.address || practice.location);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    
    html += `
      <div class="detail-item">
        <strong>📍 Location:</strong> <a href="${mapsUrl}" target="_blank" rel="noopener">${practice.location}</a>
        ${practice.address ? `<br><span class="address-text"><a href="${mapsUrl}" target="_blank" rel="noopener">${practice.address}</a></span>` : ''}
      </div>
    `;
  }
  
  // If only location requested, return early
  if (isLocation) {
    return html;
  }
  
  // Schedule information
  if (practice.days) {
    html += `
      <div class="detail-item">
        <strong>📅 Days:</strong> ${practice.days}
      </div>
    `;
  }
  
  // Day-specific information (for evening practices)
  // Only show if the day is not already in the label
  if (practice.day && (!label || !label.toLowerCase().includes(practice.day.toLowerCase()))) {
    html += `
      <div class="detail-item">
        <strong>📅 Day:</strong> ${practice.day}
      </div>
    `;
  }
  
  if (practice.time || practice.times) {
    const timeInfo = practice.time || (Array.isArray(practice.times) ? practice.times.join(', ') : practice.times);
    html += `
      <div class="detail-item">
        <strong>⏰ Time:</strong> ${timeInfo}
      </div>
    `;
  }
  
  // Sessions/groups if available
  if (practice.sessions && Array.isArray(practice.sessions)) {
    html += `
      <div class="detail-item">
        <strong>🏊‍♀️ Groups:</strong><br>
        <div class="practice-schedule">
          ${practice.sessions.map(session => `
            <div class="session-item">
              <span class="session-time">${session.time || ''}</span>
              <span class="session-group">${session.group || session.name || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Period information
  if (practice.period) {
    html += `
      <div class="detail-item">
        <strong>📆 Period:</strong> ${practice.period}
      </div>
    `;
  }
  
  // If we have a label, wrap content in collapsible section
  if (label && html) {
    const sectionId = `practice-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return `
      <div class="collapsible-section">
        <button class="collapsible-header" onclick="toggleCollapsible('${sectionId}')" aria-expanded="true">
          <span class="collapsible-title">🏊‍♀️ ${label}</span>
        </button>
        <div class="collapsible-content" id="${sectionId}">
          <div style="padding-left: 20px;">
            ${html}
          </div>
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * Handles team meet queries
 * @param {string} query - The user's search query
 * @param {Array} teams - Array of matching team objects
 * @returns {string} HTML content for team meet information
 */
function handleTeamMeetQuery(query, teams) {
  if (!meetData || !meetData.regular_meets) {
    return `
      <div class="copilot-response info">
        <h3>📅 Meet Information</h3>
        <p>Meet schedules will be available closer to the season. Please check back later.</p>
      </div>
    `;
  }
  
  const teamMeets = [];
  teams.forEach(team => {
    const teamName = team.name.replace(' Marlins', '').replace(' ', ''); // Handle team name variations
    const meets = meetData.regular_meets.filter(meet => 
      meet.visiting_team.includes(teamName) || meet.home_team.includes(teamName)
    );
    
    if (meets.length > 0) {
      teamMeets.push({ team, meets: meets.slice(0, 3) }); // Limit to next 3 meets
    }
  });
  
  if (teamMeets.length === 0) {
    return `
      <div class="copilot-response warning">
        <h3>📅 No Upcoming Meets Found</h3>
        <p>No upcoming meets found for the requested team(s). Check the full meet schedule for more information.</p>
        <p><a href="meets.html" class="button">View Meet Schedule</a></p>
      </div>
    `;
  }
  
  const meetInfo = teamMeets.map(({ team, meets }) => {
    const meetList = meets.map(meet => {
      const isHome = meet.home_team.includes(team.name.replace(' Marlins', ''));
      const opponent = isHome ? meet.visiting_team : meet.home_team;
      
      return `
        <div class="meet-item">
          <div class="meet-date">${new Date(meet.date).toLocaleDateString()}</div>
          <div class="meet-details">
            <strong>${meet.name}</strong><br>
            vs ${opponent} ${isHome ? '(Home)' : '(Away)'}<br>
            <span class="meet-location">📍 ${meet.location}</span>
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="team-card">
        <h3>${team.name}</h3>
        <div class="team-meets">
          ${meetList}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="copilot-response success">
      <h3>📅 Upcoming Meets</h3>
      ${meetInfo}
      <p><a href="meets.html" class="button">View Full Meet Schedule</a></p>
    </div>
  `;
}

/**
 * Handles general team information queries
 * @param {string} query - The user's search query
 * @param {Array} teams - Array of matching team objects
 * @returns {string} HTML content for general team information
 */
function handleGeneralTeamQuery(query, teams) {
  const teamInfo = teams.map(team => {
    const name = team.name || 'Unknown Team';
    const homePools = Array.isArray(team.homePools) ? team.homePools.join(', ') : 
                     team.homePool || 'TBA';
    const practicePools = Array.isArray(team.practicePools) ? team.practicePools.join(', ') : 'TBA';
    
    return `
      <div class="team-card">
        <h3>${name}</h3>
        <div class="team-details">
          <div class="detail-item">
            <strong>� Home Pool(s):</strong> ${homePools}
          </div>
          <div class="detail-item">
            <strong>🏊‍♀️ Practice Pool(s):</strong> ${practicePools}
          </div>
          ${team.url ? `
            <div class="detail-item">
              <a href="${team.url}" target="_blank" class="button">Visit Team Website</a>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="copilot-response success">
      <h3>🏆 Team Information</h3>
      ${teamInfo}
    </div>
  `;
}

/**
 * Handles case when no team is found in query
 * @param {string} query - The user's search query
 * @returns {string} HTML content for no team found
 */
function handleNoTeamFound(query) {
  const teamNames = teamData
    .map(t => t.name || 'Unknown Team')
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
    
  return `
    <div class="copilot-response warning">
      <h3>🏊‍♀️ Team Not Found</h3>
      <p>I couldn't find information about that team. Try asking about a specific team by name.</p>
      <div class="team-list">
        <h4>Available teams include:</h4>
        <p>${teamNames}</p>
      </div>
      <div class="suggestion-examples">
        <h4>Try asking:</h4>
        <ul>
          <li>"When do the Marlins practice?"</li>
          <li>"Where is Long Reach practice tonight?"</li>
          <li>"What meets does Phelps Luck have coming up?"</li>
        </ul>
      </div>
    </div>
  `;
}

/**
 * Handles queries related to pool locations and basic information
 * @param {string} query - The user's search query
 * @param {Object} dateTimeContext - The parsed date/time context
 * @returns {string} HTML content to display as a response
 */
function handlePoolLocationQuery(query, dateTimeContext = {}) {
  if (!poolData || !poolData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Pool Information Unavailable</h3>
        <p>Sorry, pool information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // Look for specific pool names in the query
  const matchingPools = poolData.filter(pool => {
    if (!pool.name) return false;
    return query.toLowerCase().includes(pool.name.toLowerCase());
  });
  
  if (matchingPools.length === 0) {
    return handleNoPoolLocationFound(query);
  }
  
  // Build response for matching pools
  const poolInfo = matchingPools.map(pool => {
    const name = pool.name || 'Unknown Pool';
    const address = pool.address || '';
    
    // Build location query for maps
    const locationQuery = pool.mapsQuery || 
                         encodeURIComponent(`${name} Pool ${address}`);
    
    // Format opening hours
    const hoursInfo = formatCopilotPoolHours(pool);
    
    // Format features if available
    const featuresInfo = pool.features && Array.isArray(pool.features) ? `
      <div class="detail-item">
        <strong>🎯 Features:</strong> ${pool.features.sort().join(', ')}
      </div>
    ` : '';
    
    return `
      <div class="pool-card">
        <h3>${name}</h3>
        <div class="pool-details">
          <div class="detail-item">
            <strong>📍 Address:</strong><br>
            <a href="https://www.google.com/maps/search/?api=1&query=${locationQuery}" 
               target="_blank" 
               rel="noopener" 
               class="address-link">
              ${address || 'Address not available'}
            </a>
          </div>
          <div class="detail-item">
            ${hoursInfo}
          </div>
          ${featuresInfo}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="copilot-response success">
      <h3>🏊‍♀️ Pool Information</h3>
      ${poolInfo}
    </div>
  `;
}

/**
 * Handles case when no specific pool location is found
 * @param {string} query - The user's search query
 * @returns {string} HTML content for no pool found
 */
function handleNoPoolLocationFound(query) {
  const poolNames = poolData
    .map(p => p.name || 'Unknown Pool')
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
    
  return `
    <div class="copilot-response warning">
      <h3>🏊‍♀️ Pool Not Found</h3>
      <p>I couldn't find a specific pool matching your query. Try asking about a pool by its exact name.</p>
      
      <div class="pool-list">
        <h4>Available pools include:</h4>
        <p>${poolNames}</p>
      </div>
      
      <div class="suggestion-examples">
        <h4>Try asking:</h4>
        <ul>
          <li>"Where is Bryant Woods pool?"</li>
          <li>"What's the address of Kendall Ridge?"</li>
          <li>"How do I get to Stevens Forest pool?"</li>
        </ul>
      </div>
      
      <div class="action-buttons">
        <a href="pools.html" class="button">Browse All Pools</a>
      </div>
    </div>
  `;
}

/**
 * Handles queries related to pool features and current availability
 * Enhanced to filter by multiple features and current open status
 * @param {string} query - The user's search query
 * @param {Object} dateTimeContext - The parsed date/time context
 * @returns {string} HTML content to display as a response
 */
function handlePoolFeatureQuery(query, dateTimeContext = {}) {
  if (!poolData || !poolData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Pool Information Unavailable</h3>
        <p>Sorry, pool information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // DECISION SUB-TREE: Feature query type classification
  // ===================================================
  
  const requestedFeatures = extractFeaturesFromQuery(query);
  const wantsOpenNow = query.includes('open now') || query.includes('right now') || query.includes('currently open');
  const wantsAvailable = query.includes('available') || query.includes('which pools') || query.includes('what pools');
  
  let filteredPools = poolData;
  
  // FILTER 1: By features if specified
  if (requestedFeatures.length > 0) {
    filteredPools = filteredPools.filter(pool => {
      if (!pool.features || !Array.isArray(pool.features)) return false;
      
      // Check if pool has ALL requested features (AND logic)
      return requestedFeatures.every(feature => 
        pool.features.some(poolFeature => 
          poolFeature.toLowerCase().includes(feature.toLowerCase()) ||
          feature.toLowerCase().includes(poolFeature.toLowerCase())
        )
      );
    });
  }
  
  // FILTER 2: By current open status if specified
  if (wantsOpenNow) {
    filteredPools = filteredPools.filter(pool => isPoolOpen(pool));
  }
  
  // Handle no results
  if (filteredPools.length === 0) {
    return handleNoPoolsFound(query, requestedFeatures, wantsOpenNow);
  }
  
  // BRANCH 1: Current status focus
  if (wantsOpenNow) {
    return handleOpenPoolsQuery(query, filteredPools, requestedFeatures);
  }
  
  // BRANCH 2: Feature-focused results
  return handleFeaturePoolsQuery(query, filteredPools, requestedFeatures);
}

/**
 * Handles displaying currently open pools with features
 * @param {string} query - The user's search query
 * @param {Array} pools - Filtered pool array
 * @param {Array} features - Requested features
 * @returns {string} HTML content for open pools
 */
function handleOpenPoolsQuery(query, pools, features) {
  const openPools = pools.filter(pool => isPoolOpen(pool));
  const closedPools = pools.filter(pool => !isPoolOpen(pool));
  
  let html = '';
  
  if (openPools.length > 0) {
    const openPoolsList = openPools.map(pool => {
      return formatPoolCard(pool, true, features);
    }).join('');
    
    html += `
      <div class="open-pools-section">
        <h4>🟢 Currently Open${features.length > 0 ? ` with ${features.join(', ')}` : ''}</h4>
        ${openPoolsList}
      </div>
    `;
  }
  
  if (closedPools.length > 0) {
    const closedPoolsList = closedPools.map(pool => {
      return formatPoolCard(pool, false, features);
    }).join('');
    
    html += `
      <div class="closed-pools-section">
        <h4>🔴 Currently Closed${features.length > 0 ? ` but has ${features.join(', ')}` : ''}</h4>
        ${closedPoolsList}
      </div>
    `;
  }
  
  const title = openPools.length > 0 ? 
    `🟢 ${openPools.length} Pool${openPools.length !== 1 ? 's' : ''} Currently Open` :
    '🔴 No Pools Currently Open';
  
  return `
    <div class="copilot-response ${openPools.length > 0 ? 'success' : 'warning'}">
      <h3>${title}</h3>
      ${html}
      <div class="action-buttons">
        <a href="pools.html" class="button">Browse All Pools</a>
      </div>
    </div>
  `;
}

/**
 * Handles displaying pools filtered by features
 * @param {string} query - The user's search query
 * @param {Array} pools - Filtered pool array
 * @param {Array} features - Requested features
 * @returns {string} HTML content for feature pools
 */
function handleFeaturePoolsQuery(query, pools, features) {
  const poolsList = pools.map(pool => {
    const isOpen = isPoolOpen(pool);
    return formatPoolCard(pool, isOpen, features);
  }).join('');
  
  const featureText = features.length > 0 ? ` with ${features.join(', ')}` : '';
  const title = `🎯 ${pools.length} Pool${pools.length !== 1 ? 's' : ''} Found${featureText}`;
  
  return `
    <div class="copilot-response success">
      <h3>${title}</h3>
      ${poolsList}
      <div class="action-buttons">
        <a href="pools.html" class="button">Browse All Pools</a>
      </div>
    </div>
  `;
}

/**
 * Formats a pool card for feature query results
 * @param {Object} pool - Pool object
 * @param {boolean} isOpen - Whether pool is currently open
 * @param {Array} highlightFeatures - Features to highlight
 * @returns {string} HTML for pool card
 */
function formatPoolCard(pool, isOpen, highlightFeatures = []) {
  const name = pool.name || 'Unknown Pool';
  const features = Array.isArray(pool.features) ? pool.features : [];
  const statusIcon = isOpen ? '🟢' : '🔴';
  const statusText = isOpen ? 'Open Now' : 'Closed';
  const statusColor = isOpen ? 'var(--success-color)' : 'var(--error-color)';
  
  // Highlight requested features
  const formattedFeatures = features.map(feature => {
    const isHighlighted = highlightFeatures.some(reqFeature => 
      feature.toLowerCase().includes(reqFeature.toLowerCase()) ||
      reqFeature.toLowerCase().includes(feature.toLowerCase())
    );
    
    return isHighlighted ? 
      `<span class="highlighted-feature">${feature}</span>` : 
      feature;
  }).join(', ');
  
  // Get address for location link
  const locationQuery = pool.mapsQuery || encodeURIComponent(`${pool.name} Pool ${pool.address || ''}`);
  
  return `
    <div class="pool-card feature-result">
      <div class="pool-header">
        <h4>${name}</h4>
        <span class="pool-status" style="color: ${statusColor}; font-weight: 600;">
          ${statusIcon} ${statusText}
        </span>
      </div>
      <div class="pool-details">
        <div class="detail-item">
          <strong>🎯 Features:</strong> ${formattedFeatures || 'None listed'}
        </div>
        ${pool.address ? `
          <div class="detail-item">
            <strong>📍 Location:</strong><br>
            <a href="https://www.google.com/maps/search/?api=1&query=${locationQuery}" 
               target="_blank" 
               class="address-link">
              ${pool.address}
            </a>
          </div>
        ` : ''}
        ${isOpen ? `
          <div class="detail-item">
            ${formatCopilotPoolHours(pool)}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Handles case when no pools match the feature criteria
 * @param {string} query - The user's search query
 * @param {Array} features - Requested features that weren't found
 * @param {boolean} wantsOpenNow - Whether user wanted currently open pools
 * @returns {string} HTML content for no pools found
 */
function handleNoPoolsFound(query, features, wantsOpenNow) {
  let reasonText = '';
  
  if (features.length > 0 && wantsOpenNow) {
    reasonText = `No pools are currently open with ${features.join(', ')}.`;
  } else if (features.length > 0) {
    reasonText = `No pools found with ${features.join(', ')}.`;
  } else if (wantsOpenNow) {
    reasonText = 'No pools are currently open.';
  } else {
    reasonText = 'No pools match your criteria.';
  }
  
  // Get all available features for suggestions
  const allFeatures = [...new Set(
    poolData.flatMap(pool => pool.features || [])
  )].sort();
  
  const featuresDisplay = allFeatures.slice(0, 12).map(feature => 
    `<span class="feature-tag">${feature}</span>`
  ).join(' ');
  
  return `
    <div class="copilot-response warning">
      <h3>🔍 No Matching Pools Found</h3>
      <p>${reasonText}</p>
      
      <div class="suggestions-section">
        <h4>Available Features:</h4>
        <div class="features-grid">
          ${featuresDisplay}
        </div>
        
        <h4>Try asking:</h4>
        <ul class="suggestion-list">
          <li>"Which pools have slides?"</li>
          <li>"What pools are open now?"</li>
          <li>"Pools with lap swimming and hot tub"</li>
          <li>"Which pools have diving boards?"</li>
        </ul>
      </div>
      
      <div class="action-buttons">
        <a href="pools.html" class="button">Browse All Pools</a>
      </div>
    </div>
  `;
}

/**
 * Handles queries related to meets
 * @param {string} query - The user's search query
 * @param {Object} dateTimeContext - The parsed date/time context
 * @returns {string} HTML content to display as a response
 */
function handleMeetQuery(query, dateTimeContext = {}) {
  if (!meetData || !meetData.length) {
    return `
      <div class="copilot-response info">
        <h3>📅 Meet Information</h3>
        <p>Meet schedules are typically updated closer to the season. Please check back later or visit our meets page for the most current information.</p>
        <p><a href="meets.html" class="button">Browse Meet Schedule</a></p>
      </div>
    `;
  }
  
  // If we have meet data, process it here
  const upcomingMeets = meetData.filter(meet => {
    // Add logic to filter upcoming meets
    return true; // Placeholder - implement date filtering
  });
  
  if (upcomingMeets.length === 0) {
    return `
      <div class="copilot-response info">
        <h3>📅 No Upcoming Meets</h3>
        <p>There are no upcoming meets scheduled at this time. Please check back later.</p>
        <p><a href="meets.html" class="button">View Meet Archive</a></p>
      </div>
    `;
  }
  
  const meetList = upcomingMeets.slice(0, 3).map(meet => {
    const name = meet.name || 'Swim Meet';
    const date = meet.date || 'TBA';
    const location = meet.location || 'TBA';
    
    return `
      <div class="meet-card">
        <h4>${name}</h4>
        <div class="meet-details">
          <div class="detail-item">
            <strong>📅 Date:</strong> ${date}
          </div>
          <div class="detail-item">
            <strong>📍 Location:</strong> ${location}
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  return `
    <div class="copilot-response success">
      <h3>📅 Upcoming Meets</h3>
      ${meetList}
      <p><a href="meets.html" class="button">View All Meets</a></p>
    </div>
  `;
}

/**
 * Handles queries related to pool opening hours
 * @param {string} query - The user's search query
 * @param {Object} dateTimeContext - The parsed date/time context
 * @returns {string} HTML content to display as a response
 */
function handleHoursQuery(query, dateTimeContext = {}) {
  if (!poolData || !poolData.length) {
    return `
      <div class="copilot-response info">
        <h3>🕒 Pool Hours Information</h3>
        <p>Pool hours information is not available at the moment. Please check back later or contact the pool directly for current hours.</p>
        <p><a href="pools.html" class="button">Browse All Pools</a></p>
      </div>
    `;
  }

  // Check if asking about a specific pool
  const specificPool = poolData.find(pool => {
    const poolName = pool.name ? pool.name.toLowerCase() : '';
    return poolName && query.toLowerCase().includes(poolName);
  });

  if (specificPool) {
    // Show hours for specific pool
    const hoursInfo = `
      <div class="pool-card">
        <h4>${specificPool.name}</h4>
        ${formatCopilotPoolHours(specificPool)}
      </div>
    `;

    return `
      <div class="copilot-response success">
        <h3>🕒 Pool Hours</h3>
        ${hoursInfo}
      </div>
    `;
  }

  // Show all open pools or pools with hours
  const poolsWithHours = poolData.filter(pool => pool.schedules && Array.isArray(pool.schedules) && pool.schedules.length > 0);
  const openPools = poolData.filter(pool => isPoolOpen(pool));

  if (query.toLowerCase().includes("open") || query.toLowerCase().includes("now")) {
    // Show currently open pools
    if (openPools.length === 0) {
      return `
        <div class="copilot-response warning">
          <h3>🔴 No Pools Currently Open</h3>
          <p>It looks like no pools are currently open. Check back during regular hours or view all pools for more information.</p>
          <p><a href="pools.html" class="button">Browse All Pools</a></p>
        </div>
      `;
    }

    const openPoolsList = openPools.map(pool => {
      const name = pool.name || 'Unknown Pool';
      
      return `
        <div class="pool-card">
          <h4>${name}</h4>
          ${formatCopilotPoolHours(pool)}
        </div>
      `;
    }).join('');

    return `
      <div class="copilot-response success">
        <h3>🟢 Currently Open Pools</h3>
        ${openPoolsList}
      </div>
    `;
  }

  // Show all pools with available hours information
  if (poolsWithHours.length === 0) {
    return `
      <div class="copilot-response info">
        <h3>🕒 Pool Hours</h3>
        <p>Detailed hours information is being updated. Please visit the pools page to see current status and contact information.</p>
        <p><a href="pools.html" class="button">Browse All Pools</a></p>
      </div>
    `;
  }

  const hoursPoolsList = poolsWithHours.slice(0, 6).map(pool => {
    const name = pool.name || 'Unknown Pool';
    
    return `
      <div class="pool-card">
        <h4>${name}</h4>
        ${formatCopilotPoolHours(pool)}
      </div>
    `;
  }).join('');

  return `
    <div class="copilot-response success">
      <h3>🕒 Pool Hours</h3>
      ${hoursPoolsList}
      ${poolsWithHours.length > 6 ? '<p><a href="pools.html" class="button">View All Pools</a></p>' : ''}
    </div>
  `;
}

/**
 * Toggles the visibility of a collapsible content section
 * @param {string} sectionId - The ID of the section to toggle
 */
function toggleCollapsible(sectionId) {
  const content = document.getElementById(sectionId);
  const header = content?.previousElementSibling;
  
  if (!content || !header) return;
  
  const isExpanded = header.getAttribute('aria-expanded') === 'true';
  
  // Toggle the content visibility
  if (isExpanded) {
    content.style.display = 'none';
    header.setAttribute('aria-expanded', 'false');
  } else {
    content.style.display = 'block';
    header.setAttribute('aria-expanded', 'true');
  }
}

// ------------------------------
//    QUERY DECISION TREE HELPERS
// ------------------------------

/**
 * Determines if a query is team-related
 * Looks for team names, practice keywords, and coaching inquiries
 * @param {string} query - The user's search query
 * @returns {boolean} - True if query is team-related
 */
function isTeamQuery(query) {
  console.log('🔍 Checking BRANCH 1: Team-related query...');
  
  const teamKeywords = ['practice', 'coach', 'team', 'marlins', 'long reach', 'phelps luck', 'wilde lake', 
                       'owen brown', 'thunder hill', 'pointers run', 'clary', 'swansfield', 'hawthorn',
                       'dorsey search', 'huntington', 'kings contrivance', 'harper', 'pheasant ridge',
                       'clemens crossing', 'oakland mills'];
                       
  const practiceKeywords = ['practice', 'training', 'warm up', 'warmup'];
  const locationWithTeam = query.includes('where') && teamKeywords.some(team => query.includes(team));
  
  const foundTeamKeywords = teamKeywords.filter(keyword => query.includes(keyword));
  const foundPracticeKeywords = practiceKeywords.filter(keyword => query.includes(keyword));
  
  const isTeamRelated = teamKeywords.some(keyword => query.includes(keyword)) || 
                       practiceKeywords.some(keyword => query.includes(keyword)) ||
                       locationWithTeam;
  
  if (foundTeamKeywords.length > 0) {
    console.log('  ✅ Found team keywords:', foundTeamKeywords);
  }
  if (foundPracticeKeywords.length > 0) {
    console.log('  ✅ Found practice keywords:', foundPracticeKeywords);
  }
  if (locationWithTeam) {
    console.log('  ✅ Found location + team combination');
  }
  
  console.log(`  📊 Team query result: ${isTeamRelated}`);
  return isTeamRelated;
}

/**
 * Determines if a query is about pool features or current availability
 * @param {string} query - The user's search query
 * @returns {boolean} - True if query is about pool features/status
 */
function isPoolFeatureQuery(query) {
  console.log('🔍 Checking BRANCH 2: Pool feature/status query...');
  
  const featureKeywords = ['slide', 'diving', 'lap', 'feature', 'hot tub', 'spa', 'wading', 'kiddie',
                          'wifi', 'lift', 'ada', 'accessible', 'volleyball', 'basketball', 'play'];
  const statusKeywords = ['open now', 'available now', 'currently open', 'right now'];
  const availabilityKeywords = ['which pools', 'what pools', 'pools that have', 'pools with'];
  
  const foundFeatureKeywords = featureKeywords.filter(keyword => query.includes(keyword));
  const foundStatusKeywords = statusKeywords.filter(keyword => query.includes(keyword));
  const foundAvailabilityKeywords = availabilityKeywords.filter(keyword => query.includes(keyword));
  
  const isFeatureQuery = featureKeywords.some(keyword => query.includes(keyword)) ||
                        statusKeywords.some(keyword => query.includes(keyword)) ||
                        availabilityKeywords.some(keyword => query.includes(keyword));
  
  if (foundFeatureKeywords.length > 0) {
    console.log('  ✅ Found feature keywords:', foundFeatureKeywords);
  }
  if (foundStatusKeywords.length > 0) {
    console.log('  ✅ Found status keywords:', foundStatusKeywords);
  }
  if (foundAvailabilityKeywords.length > 0) {
    console.log('  ✅ Found availability keywords:', foundAvailabilityKeywords);
  }
  
  console.log(`  📊 Pool feature query result: ${isFeatureQuery}`);
  return isFeatureQuery;
}

/**
 * Determines if a query is asking for pool location information
 * @param {string} query - The user's search query
 * @returns {boolean} - True if query is about pool locations
 */
function isPoolLocationQuery(query) {
  console.log('🔍 Checking BRANCH 3: Pool location query...');
  
  const locationKeywords = ['where', 'location', 'address', 'directions', 'how to get'];
  const poolKeywords = ['pool', 'swim', 'swimming'];
  const hasPoolName = poolData && poolData.some(pool => 
    pool.name && query.toLowerCase().includes(pool.name.toLowerCase())
  );
  
  const foundLocationKeywords = locationKeywords.filter(keyword => query.includes(keyword));
  const foundPoolKeywords = poolKeywords.filter(keyword => query.includes(keyword));
  const matchedPoolNames = hasPoolName ? poolData.filter(pool => 
    pool.name && query.toLowerCase().includes(pool.name.toLowerCase())
  ).map(pool => pool.name) : [];
  
  const isLocationQuery = (locationKeywords.some(keyword => query.includes(keyword)) && 
                          poolKeywords.some(keyword => query.includes(keyword))) || hasPoolName;
  
  if (foundLocationKeywords.length > 0) {
    console.log('  ✅ Found location keywords:', foundLocationKeywords);
  }
  if (foundPoolKeywords.length > 0) {
    console.log('  ✅ Found pool keywords:', foundPoolKeywords);
  }
  if (matchedPoolNames.length > 0) {
    console.log('  ✅ Found pool names:', matchedPoolNames);
  }
  
  console.log(`  📊 Pool location query result: ${isLocationQuery}`);
  return isLocationQuery;
}

/**
 * Determines if a query is about swim meets
 * @param {string} query - The user's search query
 * @returns {boolean} - True if query is about meets
 */
function isMeetQuery(query) {
  console.log('  🏊 Checking if meet query for:', `"${query}"`);
  
  const meetKeywords = ['meet', 'competition', 'event', 'dual meet', 'championship', 'finals'];
  const scheduleKeywords = ['schedule', 'when', 'next meet', 'upcoming'];
  
  const foundMeetKeywords = meetKeywords.filter(keyword => query.includes(keyword));
  const foundScheduleKeywords = scheduleKeywords.filter(keyword => query.includes(keyword));
  const hasPracticeExclusion = query.includes('practice');
  const hasPoolExclusion = query.includes('pool');
  
  console.log('    🎯 Found meet keywords:', foundMeetKeywords);
  console.log('    📅 Found schedule keywords:', foundScheduleKeywords);
  console.log('    🚫 Has practice exclusion:', hasPracticeExclusion);
  console.log('    🚫 Has pool exclusion:', hasPoolExclusion);
  
  const isMeetKeywordMatch = foundMeetKeywords.length > 0;
  const isScheduleKeywordMatch = foundScheduleKeywords.length > 0 && !hasPracticeExclusion && !hasPoolExclusion;
  const result = isMeetKeywordMatch || isScheduleKeywordMatch;
  
  console.log(`    ✅ Meet query result: ${result} (meet: ${isMeetKeywordMatch}, schedule: ${isScheduleKeywordMatch})`);
  
  return result;
}

/**
 * Determines if a query is about pool hours
 * @param {string} query - The user's search query
 * @returns {boolean} - True if query is about hours
 */
function isHoursQuery(query) {
  console.log('  🕒 Checking if hours query for:', `"${query}"`);
  
  const timeKeywords = ['hour', 'time', 'open', 'close', 'when does', 'what time', 'schedule'];
  const excludeKeywords = ['practice', 'meet', 'team']; // Don't match practice/meet schedules
  
  const foundTimeKeywords = timeKeywords.filter(keyword => query.includes(keyword));
  const foundExcludeKeywords = excludeKeywords.filter(keyword => query.includes(keyword));
  
  console.log('    ⏰ Found time keywords:', foundTimeKeywords);
  console.log('    🚫 Found exclude keywords:', foundExcludeKeywords);
  
  const hasTimeKeywords = foundTimeKeywords.length > 0;
  const hasExcludeKeywords = foundExcludeKeywords.length > 0;
  const result = hasTimeKeywords && !hasExcludeKeywords;
  
  console.log(`    ✅ Hours query result: ${result} (time: ${hasTimeKeywords}, excluded: ${hasExcludeKeywords})`);
  
  return result;
}

/**
 * Extracts and parses date/time context from natural language queries
 * Handles relative dates like "tonight", "tomorrow", "this Tuesday", etc.
 * @param {string} query - The normalized query string
 * @returns {Object} - Date/time context object
 */
function extractDateTimeContext(query) {
  const context = {
    hasTimeReference: false,
    targetDate: null,
    timeOfDay: null,
    dayOfWeek: null,
    isToday: false,
    isTomorrow: false,
    isThisWeek: false,
    relativeDay: null,
    originalText: []
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Time of day patterns
  const timeOfDayPatterns = {
    'tonight': { timeOfDay: 'evening', targetDate: today },
    'this evening': { timeOfDay: 'evening', targetDate: today },
    'this afternoon': { timeOfDay: 'afternoon', targetDate: today },
    'this morning': { timeOfDay: 'morning', targetDate: today },
    'right now': { timeOfDay: 'current', targetDate: today },
    'currently': { timeOfDay: 'current', targetDate: today }
  };
  
  // Day reference patterns
  const dayPatterns = {
    'today': { targetDate: today, isToday: true },
    'tomorrow': { 
      targetDate: new Date(today.getTime() + 24 * 60 * 60 * 1000), 
      isTomorrow: true 
    }
  };
  
  // Day of week patterns
  const dayOfWeekMap = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
    'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3,
    'thu': 4, 'fri': 5, 'sat': 6
  };
  
  // Check for time of day references
  Object.entries(timeOfDayPatterns).forEach(([pattern, data]) => {
    if (query.includes(pattern)) {
      context.hasTimeReference = true;
      context.timeOfDay = data.timeOfDay;
      context.targetDate = data.targetDate;
      context.originalText.push(pattern);
      
      if (data.targetDate.getTime() === today.getTime()) {
        context.isToday = true;
      }
    }
  });
  
  // Check for day references
  Object.entries(dayPatterns).forEach(([pattern, data]) => {
    if (query.includes(pattern)) {
      context.hasTimeReference = true;
      context.targetDate = data.targetDate;
      context.isToday = data.isToday || false;
      context.isTomorrow = data.isTomorrow || false;
      context.originalText.push(pattern);
    }
  });
  
  // Check for "this [day]" patterns
  const thisPattern = /this\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i;
  const thisMatch = query.match(thisPattern);
  if (thisMatch) {
    const dayName = thisMatch[1].toLowerCase();
    const targetDayNumber = dayOfWeekMap[dayName];
    
    if (targetDayNumber !== undefined) {
      const currentDayNumber = now.getDay();
      let daysUntilTarget = targetDayNumber - currentDayNumber;
      
      // If the target day has passed this week, get next week's occurrence
      if (daysUntilTarget < 0) {
        daysUntilTarget += 7;
      }
      
      const targetDate = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
      
      context.hasTimeReference = true;
      context.targetDate = targetDate;
      context.dayOfWeek = dayName;
      context.isThisWeek = daysUntilTarget <= 6;
      context.relativeDay = `this ${dayName}`;
      context.originalText.push(thisMatch[0]);
      
      if (daysUntilTarget === 0) {
        context.isToday = true;
      } else if (daysUntilTarget === 1) {
        context.isTomorrow = true;
      }
    }
  }
  
  // Check for standalone day names (assume this week)
  Object.entries(dayOfWeekMap).forEach(([dayName, dayNumber]) => {
    if (query.includes(dayName) && !context.hasTimeReference) {
      const currentDayNumber = now.getDay();
      let daysUntilTarget = dayNumber - currentDayNumber;
      
      // If the day has passed, assume next week
      if (daysUntilTarget < 0) {
        daysUntilTarget += 7;
      }
      
      const targetDate = new Date(today.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
      
      context.hasTimeReference = true;
      context.targetDate = targetDate;
      context.dayOfWeek = dayName;
      context.isThisWeek = daysUntilTarget <= 6;
      context.relativeDay = dayName;
      context.originalText.push(dayName);
      
      if (daysUntilTarget === 0) {
        context.isToday = true;
      } else if (daysUntilTarget === 1) {
        context.isTomorrow = true;
      }
    }
  });
  
  return context;
}
