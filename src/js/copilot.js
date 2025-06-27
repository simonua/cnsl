// Legacy global variables for backward compatibility
let teamData = [];
let poolData = [];
let meetData = [];

// Object-oriented data management
let dataManager = null;

// ------------------------------
//    SCHEDULE UTILITY FUNCTIONS
// ------------------------------

/**
 * Gets the current Eastern Time (EDT/EST) as a Date object
 * @returns {Date} - Current time in Eastern timezone
 */
function getEasternTime() {
  // Use the new TimeUtils class if available, fallback to legacy implementation
  if (typeof TimeUtils !== 'undefined') {
    return TimeUtils.getEasternTime();
  }
  
  // Legacy fallback implementation
  const now = new Date();
  console.log(`🌍 Browser local time: ${now.toLocaleString()}`);
  
  // Convert to Eastern Time using proper timezone handling
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  console.log(`🗽 Eastern time: ${easternTime.toLocaleString()}`);
  
  // Verify timezone conversion
  const easternTimeString = now.toLocaleString("en-US", {timeZone: "America/New_York"});
  const timezone = now.toLocaleDateString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(', ')[1] || 'ET';
  console.log(`🕐 Eastern time string: ${easternTimeString} (${timezone})`);
  
  return easternTime;
}

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
 * Extracts pool feature keywords from a user query
 * @param {string} query - The user's search query
 * @returns {Array} Array of feature keywords found in the query
 */
function extractFeaturesFromQuery(query) {
  const normalizedQuery = query.toLowerCase();
  
  // Define known pool features and their common variations
  const featureMap = {
    'slide': ['slide', 'slides', 'water slide', 'waterslide'],
    'lap': ['lap', 'laps', 'lap pool', 'swimming laps', 'lap swimming'],
    'wading': ['wading', 'wading pool', 'baby pool', 'kiddie pool', 'toddler pool', 'shallow pool'],
    'diving': ['diving', 'dive', 'diving board', 'high dive'],
    'hot tub': ['hot tub', 'hottub', 'spa', 'jacuzzi'],
    'wifi': ['wifi', 'wi-fi', 'internet', 'wireless'],
    'pool lift': ['pool lift', 'lift', 'accessibility', 'accessible', 'handicap'],
    'grill': ['grill', 'grills', 'bbq', 'barbecue'],
    'basketball': ['basketball', 'hoop', 'basketball hoop'],
    'tennis': ['tennis', 'tennis court', 'courts'],
    'playground': ['playground', 'play area', 'kids area'],
    'picnic': ['picnic', 'picnic area', 'picnic tables'],
    'snack bar': ['snack bar', 'snacks', 'food', 'concession']
  };
  
  const extractedFeatures = [];
  
  // Check each feature category for matches
  Object.entries(featureMap).forEach(([feature, keywords]) => {
    const hasFeature = keywords.some(keyword => normalizedQuery.includes(keyword));
    if (hasFeature) {
      extractedFeatures.push(feature);
    }
  });
  
  // Remove duplicates and return
  return [...new Set(extractedFeatures)];
}

/**
 * Gets detailed pool status including privileged access states
 * @param {Object} pool - Pool object with schedules property
 * @returns {Object} - Status object with {isOpen: boolean, status: string, color: string, icon: string}
 */
function getPoolStatus(pool) {
  console.log(`🏊‍♀️ GETTING DETAILED POOL STATUS: ${pool.name || 'Unknown Pool'}`);
  
  if (!pool.schedules || !Array.isArray(pool.schedules)) {
    console.log(`❌ No schedules found for ${pool.name}`);
    return { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  }

  const easternNow = getEasternTime();
  const currentDate = easternNow.toISOString().split('T')[0];
  const currentDay = easternNow.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  const currentTime = easternNow.getHours() * 60 + easternNow.getMinutes();
  
  console.log(`📅 Current Eastern Date: ${currentDate}`);
  console.log(`📆 Current Eastern Day: ${currentDay}`);
  console.log(`🕐 Current Eastern Time: ${easternNow.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} (${currentTime} minutes since midnight)`);

  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    const isActive = currentDate >= schedule.startDate && currentDate <= schedule.endDate;
    console.log(`📋 Schedule ${schedule.startDate} to ${schedule.endDate}: ${isActive ? 'ACTIVE' : 'inactive'}`);
    return isActive;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    console.log(`❌ No active schedule found for ${pool.name} on ${currentDate}`);
    return { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  }

  console.log(`✅ Active schedule found: ${activeSchedule.startDate} to ${activeSchedule.endDate}`);

  // Find today's hours
  const todayHours = activeSchedule.hours.filter(h => {
    const hasToday = h.weekDays && h.weekDays.includes(currentDay);
    console.log(`⏰ Hour entry: ${h.startTime}-${h.endTime} on [${h.weekDays?.join(', ')}] - Includes ${currentDay}? ${hasToday}`);
    return hasToday;
  });
  
  if (!todayHours.length) {
    console.log(`❌ No hours found for ${currentDay} at ${pool.name}`);
    return { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  }

  console.log(`📍 Found ${todayHours.length} time slot(s) for ${currentDay}:`);

  // Check current active time slot
  const currentSlot = todayHours.find(hour => {
    const startMinutes = timeStringToMinutes(hour.startTime);
    const endMinutes = timeStringToMinutes(hour.endTime);
    const isInRange = currentTime >= startMinutes && currentTime <= endMinutes;
    
    console.log(`   🔍 Time slot: ${hour.startTime} (${startMinutes} min) - ${hour.endTime} (${endMinutes} min)`);
    console.log(`   📌 Current time ${currentTime} min is in range? ${isInRange}`);
    
    return isInRange;
  });

  if (!currentSlot) {
    console.log(`🎯 FINAL RESULT for ${pool.name}: CLOSED (no active time slot)`);
    return { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  }

  // Determine status based on activity types
  const activityTypes = formatActivityTypes(currentSlot.types).toLowerCase();
  console.log(`🔍 Analyzing activity types: "${activityTypes}"`);

  if (activityTypes.includes('closed to public')) {
    console.log(`🎯 FINAL RESULT for ${pool.name}: CLOSED TO PUBLIC`);
    return { isOpen: false, status: 'Closed to Public', color: 'red', icon: '🔴' };
  }

  if (activityTypes.includes('cnsl practice only')) {
    console.log(`🎯 FINAL RESULT for ${pool.name}: CNSL PRACTICE ONLY (yellow)`);
    return { isOpen: true, status: 'CNSL Practice Only', color: 'yellow', icon: '🟡' };
  }

  if (activityTypes.includes('swim meet')) {
    console.log(`🎯 FINAL RESULT for ${pool.name}: SWIM MEET (yellow)`);
    return { isOpen: true, status: 'Swim Meet', color: 'yellow', icon: '🟡' };
  }

  // Regular public access
  console.log(`🎯 FINAL RESULT for ${pool.name}: OPEN NOW (green)`);
  return { isOpen: true, status: 'Open Now', color: 'green', icon: '🟢' };
}

/**
 * Checks if a pool is currently open based on its schedule (backward compatibility)
 * @param {Object} pool - Pool object with schedules property
 * @returns {boolean} - True if the pool is currently open to public
 */
function isPoolOpen(pool) {
  const status = getPoolStatus(pool);
  // Only return true for full public access (not privileged access)
  return status.isOpen && status.status === 'Open Now';
}

/**
 * Converts time string (e.g., "6:00AM", "10:30PM") to minutes since midnight
 * @param {string} timeStr - Time string in format "H:MMAM/PM"
 * @returns {number} - Minutes since midnight
 */
function timeStringToMinutes(timeStr) {
  const match = timeStr.match(/(\d{1,2}):?(\d{0,2})(AM|PM)/i);
  if (!match) {
    console.log(`❌ Time parse failed for: "${timeStr}"`);
    return 0;
  }

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3].toUpperCase();

  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
    adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
    adjustedHours = 0;
  }

  const totalMinutes = adjustedHours * 60 + minutes;
  
  return totalMinutes;
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

  const easternNow = getEasternTime();
  const currentDate = easternNow.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return '<div><strong>🕒 Hours:</strong> No current schedule available</div>';
  }

  const isOpen = isPoolOpen(pool);
  const statusIcon = isOpen ? '🟢' : '🔴';
  
  // Determine current timezone (EDT or EST)
  const currentEasternTime = getEasternTime();
  const timezone = currentEasternTime.toLocaleDateString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(', ')[1] || 'ET';
  const statusText = isOpen ? `Open Now` : `Closed`;

  // Format the period dates
  const startDate = new Date(activeSchedule.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(activeSchedule.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const periodText = `Hours for <b>${startDate} - ${endDate}</b> (All times ${timezone})`;

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
  
  // Get current time info for highlighting - use Eastern Time
  const currentDay = easternNow.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  const currentTime = easternNow.getHours() * 60 + easternNow.getMinutes();
  
  dayOrder.forEach(day => {
    if (dayGroups[day]) {
      const daySlots = dayGroups[day];
      const isCurrentDay = day === currentDay;
      const dayStyle = isCurrentDay && isOpen ? 'font-weight: 700; color: var(--primary-color);' : '';
      
      if (daySlots.length === 1) {
        // Single time slot for the day
        const slot = daySlots[0];
        const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        
        // Check for slot highlighting (only for currently active time slots)
        let isCurrentTimeSlot = false;
        let highlightStatus = '';
        
        if (slot.timeRange && isCurrentDay) {
          const [startTime, endTime] = slot.timeRange.split('-');
          const startMinutes = timeStringToMinutes(startTime.trim());
          const endMinutes = timeStringToMinutes(endTime.trim());
          
          if (currentTime >= startMinutes && currentTime < endMinutes) {
            isCurrentTimeSlot = true;
            
            // Get pool status to determine highlight color
            const poolStatus = getPoolStatus(pool);
            if (poolStatus.color === 'green') {
              highlightStatus = 'green';
            } else if (poolStatus.color === 'yellow') {
              highlightStatus = 'yellow';
            } else {
              highlightStatus = 'red';
            }
          }
        }
        
        const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange, isCurrentTimeSlot, highlightStatus) : '';
        
        hoursDisplay += `<div style="margin-bottom: 0.3rem; ${dayStyle}"><strong>${day}:</strong> ${timeHtml}${typesText}${notesText}</div>`;
      } else {
        // Multiple time slots for the day - sort by start time
        const sortedSlots = daySlots.sort((a, b) => {
          if (!a.timeRange || !b.timeRange) return 0;
          const aStart = timeStringToMinutes(a.timeRange.split('-')[0].trim());
          const bStart = timeStringToMinutes(b.timeRange.split('-')[0].trim());
          return aStart - bStart;
        });
        
        hoursDisplay += `<div style="margin-bottom: 0.3rem; ${dayStyle}"><strong>${day}:</strong></div>`;
        sortedSlots.forEach(slot => {
          const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
          const notesText = slot.notes ? ` - ${slot.notes}` : '';
          
          // Check for slot highlighting (only for currently active time slots)
          let isCurrentTimeSlot = false;
          let highlightStatus = '';
          
          if (slot.timeRange && isCurrentDay) {
            const [startTime, endTime] = slot.timeRange.split('-');
            const startMinutes = timeStringToMinutes(startTime.trim());
            const endMinutes = timeStringToMinutes(endTime.trim());
            
            if (currentTime >= startMinutes && currentTime < endMinutes) {
              isCurrentTimeSlot = true;
              console.log(`🔍 Current time slot found for ${day}: ${slot.timeRange}`);
              
              // Get pool status to determine highlight color
              const poolStatus = getPoolStatus(pool);
              if (poolStatus.color === 'green') {
                highlightStatus = 'green';
              } else if (poolStatus.color === 'yellow') {
                highlightStatus = 'yellow';
              } else {
                highlightStatus = 'red';
              }
            }
          }
          
          const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange, isCurrentTimeSlot, highlightStatus) : '';
          
          hoursDisplay += `<div style="margin-left: 1rem; margin-bottom: 0.2rem;">${timeHtml}${typesText}${notesText}</div>`;
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
 * @param {boolean} isCurrentTime - Whether this time range applies to the current time (default: false)
 * @param {string} status - Status color for highlighting: 'green', 'yellow', or 'red' (default: 'green')
 * @returns {string} - HTML with three spans for start, dash, and end time
 */
function formatTimeRangeSpans(timeRange, isCurrentTime = false, status = 'green') {
  if (!timeRange) return '';
  
  const parts = timeRange.split('-');
  if (parts.length !== 2) return timeRange;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  // Apply highlighting styles if this is the current time slot
  let highlightClass = '';
  let inlineStyle = '';
  
  if (isCurrentTime) {
    highlightClass = `highlighted-time-slot-${status}`;
    
    // Define color mapping for inline styles as fallback
    const statusColors = {
      'green': '#28a745',
      'yellow': '#ffc107', 
      'red': '#dc3545'
    };
    
    const bgColor = statusColors[status] || statusColors['green'];
    inlineStyle = ` style="background-color: ${bgColor} !important; color: white !important; padding: 2px 6px; border-radius: 4px; font-weight: 600;"`;
  }
  
  return `<span class="time-range-container ${highlightClass}"${inlineStyle}><span class="time-start">${startTime}</span><span class="time-dash">-</span><span class="time-end">${endTime}</span></span>`;
}

// ------------------------------
//    OBJECT-ORIENTED DATA ACCESS HELPERS
// ------------------------------

/**
 * Get a pool using the new object-oriented approach
 * @param {string} poolName - Pool name (can use PoolNames enum)
 * @returns {Pool|null} - Pool object or null
 */
function getPoolInfo(poolName) {
  if (dataManager && dataManager.isInitialized()) {
    return dataManager.getPool(poolName);
  }
  return null;
}

/**
 * Get all pools using the new object-oriented approach
 * @returns {Array} - Array of Pool objects
 */
function getAllPoolsInfo() {
  if (dataManager && dataManager.isInitialized()) {
    return dataManager.getPools().getAllPools();
  }
  return [];
}

/**
 * Search pools using the new object-oriented approach
 * @param {string} searchTerm - Search term
 * @returns {Array} - Array of search results
 */
function searchPoolsInfo(searchTerm) {
  if (dataManager && dataManager.isInitialized()) {
    return dataManager.getPools().searchPools(searchTerm);
  }
  return [];
}

/**
 * Get pool features using the new enumeration approach
 * @param {string} poolName - Pool name
 * @returns {Array} - Array of pool features
 */
function getPoolFeatures(poolName) {
  const pool = getPoolInfo(poolName);
  return pool ? pool.getFeatures() : [];
}

/**
 * Get pool current status using the new status system
 * @param {string} poolName - Pool name
 * @returns {Object|null} - Pool status object
 */
function getPoolCurrentStatus(poolName) {
  const pool = getPoolInfo(poolName);
  return pool ? pool.getCurrentStatus() : null;
}

/**
 * Example of using the new PoolNames enum (demonstrative)
 * @returns {Array} - All available pool names
 */
function getAllPoolNames() {
  if (typeof PoolNames !== 'undefined') {
    return PoolNames.getAllPoolNames();
  }
  // Fallback to legacy approach
  return poolData.map(pool => pool.name);
}

// ------------------------------
//    APPLICATION INITIALIZATION
// ------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize new object-oriented data management
  try {
    dataManager = getDataManager();
    await dataManager.initialize();
    
    // Maintain backward compatibility by populating legacy global variables
    const pools = dataManager.getPools();
    const teams = dataManager.getTeams();
    const meets = dataManager.getMeets();
    
    if (pools.isDataLoaded()) {
      poolData = pools.getAllPools().map(pool => pool.toJSON());
    }
    
    if (teams.isDataLoaded()) {
      teamData = teams.getAllTeams();
    }
    
    if (meets.isDataLoaded()) {
      meetData = meets.getAllMeets();
    }
    
    console.log('✅ CNSL Data loaded successfully via DataManager');
    
  } catch (error) {
    console.error('❌ Failed to initialize DataManager, falling back to legacy loading:', error);
    
    // Fallback to legacy data loading
    try {
      await Promise.all([
        loadLegacyTeamData(),
        loadLegacyPoolData(),
        loadLegacyMeetData()
      ]);
    } catch (fallbackError) {
      console.error('❌ Legacy data loading also failed:', fallbackError);
      showDataLoadError();
    }
  }
});

/**
 * Legacy team data loading (fallback)
 */
async function loadLegacyTeamData() {
  const res = await fetch("assets/data/teams.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  teamData = data.teams || data;
}

/**
 * Legacy pool data loading (fallback)
 */
async function loadLegacyPoolData() {
  const res = await fetch("assets/data/pools.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  poolData = data.pools || data;
}

/**
 * Legacy meet data loading (fallback)
 */
async function loadLegacyMeetData() {
  try {
    const res = await fetch("assets/data/meets.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    meetData = data;
  } catch (error) {
    console.warn('Meet data not available:', error);
    meetData = [];
  }
}

/**
 * Show data loading error to user
 */
function showDataLoadError() {
  const output = document.getElementById("copilotResponse");
  if (output) {
    output.innerHTML = "<p>⚠️ Pool and team data is currently unavailable. Please try again later.</p>";
  }
}

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
    
    // Handle teams with practice data (placeholder for existing logic)
    return `
      <div class="team-card">
        <h3>${team.name}</h3>
        <p>Practice schedule available. Check team website for details.</p>
      </div>
    `;
  }).join('');
  
  return `
    <div class="copilot-response info">
      <h3>🏊‍♀️ Practice Information</h3>
      ${practiceInfo}
    </div>
  `;
}

/**
 * Demo function to showcase the new object-oriented features
 * This can be called from the browser console for testing
 */
function demonstrateObjectOrientedFeatures() {
  console.log('🎯 CNSL Object-Oriented Architecture Demo');
  console.log('========================================');
  
  if (!dataManager || !dataManager.isInitialized()) {
    console.log('❌ DataManager not initialized');
    return;
  }
  
  console.log('✅ DataManager is initialized');
  
  // Demo 1: Using PoolNames enum
  if (typeof PoolNames !== 'undefined') {
    console.log('\n📋 1. Pool Names Enumeration:');
    console.log('Available pools:', PoolNames.getAllPoolNames().slice(0, 5), '... and more');
    console.log('Example constant:', PoolNames.KENDALL_RIDGE);
  }
  
  // Demo 2: Pool information access
  console.log('\n🏊 2. Pool Information Access:');
  const poolsManager = dataManager.getPools();
  const firstPool = poolsManager.getAllPools()[0];
  if (firstPool) {
    console.log(`Pool: ${firstPool.getName()}`);
    console.log(`Features: ${firstPool.getFeatures().join(', ')}`);
    console.log(`Current Status:`, firstPool.getCurrentStatus());
    console.log(`Is Open Now: ${firstPool.isOpenNow()}`);
  }
  
  // Demo 3: Time utilities
  if (typeof TimeUtils !== 'undefined') {
    console.log('\n⏰ 3. Time Utilities:');
    const easternTime = TimeUtils.getEasternTime();
    console.log(`Eastern Time: ${easternTime.toLocaleString()}`);
    console.log(`Current Day: ${TimeUtils.getDayName(easternTime)}`);
  }
  
  // Demo 4: Search capabilities
  console.log('\n🔍 4. Search Capabilities:');
  const searchResults = dataManager.search('pool');
  console.log(`Found ${searchResults.pools.length} pools matching "pool"`);
  
  // Demo 5: Statistics
  console.log('\n📊 5. System Statistics:');
  const stats = dataManager.getStatistics();
  console.log('Pool Stats:', {
    total: stats.pools.totalPools,
    open: stats.pools.openPools,
    openPercentage: stats.pools.openPercentage + '%'
  });
  
  console.log('\n🎉 Demo completed! Check the objects above for detailed information.');
}

// Make the demo function available globally for testing
window.demonstrateObjectOrientedFeatures = demonstrateObjectOrientedFeatures;
