// Global data manager instance for copilot
let copilotDataManager = null;

// Search engine instance
let searchEngine = null;


// ------------------------------
//    SAFE REFERENCE HELPERS
// ------------------------------

/**
 * Safely get TimeUtils reference
 * @returns {object|null} TimeUtils class or null if not available
 */
function _getTimeUtils() {
  return (typeof window !== 'undefined' && window.TimeUtils) ? window.TimeUtils : null;
}


// ------------------------------
//    MODERN DATA ACCESS HELPERS
// ------------------------------

/**
 * Get a pool using the modern object-oriented approach
 * @param {string} poolName - Pool name
 * @returns {Pool|null} - Pool object or null
 */
function getPoolInfo(poolName) {
  if (copilotDataManager && copilotDataManager.isInitialized()) {
    return copilotDataManager.getPool(poolName);
  }
  return null;
}

/**
 * Get all pools using the modern object-oriented approach
 * @returns {Array} - Array of Pool objects
 */
function getAllPoolsInfo() {
  if (copilotDataManager && copilotDataManager.isInitialized()) {
    return copilotDataManager.getPools().getAllPools();
  }
  return [];
}

/**
 * Get pool features using the modern enumeration approach
 * @param {string} poolName - Pool name
 * @returns {Array} - Array of pool features
 */
function getPoolFeatures(poolName) {
  const pool = getPoolInfo(poolName);
  return pool ? pool.getFeatures() : [];
}

/**
 * Get pool current status using the modern status system
 * @param {string} poolName - Pool name
 * @returns {Object|null} - Pool status object
 */
function getPoolCurrentStatus(poolName) {
  const pool = getPoolInfo(poolName);
  return pool ? pool.getCurrentStatus() : null;
}

/**
 * Get all available pool names
 * @returns {Array} - All available pool names
 */
function getAllPoolNames() {
  if (typeof PoolNames !== 'undefined') {
    return PoolNames.getAllPoolNames();
  }
  
  if (copilotDataManager && copilotDataManager.pools && copilotDataManager.pools.isDataLoaded()) {
    return copilotDataManager.pools.getAllPools().map(pool => pool.name);
  }
  
  return [];
}

/**
 * Formats pool schedule for display with accurate timeslot highlighting
 * @param {Object} pool - Pool object with schedules property
 * @returns {string} - HTML string for displaying hours
 */
function formatCopilotPoolHours(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules) || pool.schedules.length === 0) {
    return '<div><strong>🕒 Hours:</strong> Not available</div>';
  }

  // Get current Eastern time info (user's timezone considered but defaulted to Eastern)
  const timeUtils = _getTimeUtils();
  if (!timeUtils) return '<div><strong>🕒 Hours:</strong> Time utilities not available</div>';
  
  const easternTimeInfo = timeUtils.getCurrentEasternTimeInfo();
  const currentDate = easternTimeInfo.date;
  
  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return '<div><strong>🕒 Hours:</strong> No current schedule available</div>';
  }

  // Get pool status to determine overall state
  const poolStatus = pool.getCurrentStatus ? pool.getCurrentStatus() : { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  const isCurrentlyOpen = poolStatus.isOpen;
  const statusIcon = poolStatus.icon;
  const statusText = poolStatus.status;

  // Format the period dates
  const startDate = new Date(activeSchedule.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(activeSchedule.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const periodText = `Hours for <b>${startDate} - ${endDate}</b> (All times ${easternTimeInfo.timezone})`;

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
          types: timeUtils.formatActivityTypes(hour.types),
          notes: hour.notes || '',
          startMinutes: hour.startTime ? timeUtils.timeStringToMinutes(hour.startTime) : 0,
          endMinutes: hour.endTime ? timeUtils.timeStringToMinutes(hour.endTime) : 0
        });
      });
    }
  });

  // Format hours display with accurate highlighting
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach(day => {
    if (dayGroups[day]) {
      const daySlots = dayGroups[day];
      const isCurrentDay = day === easternTimeInfo.day;
      
      // Check if any slot in this day is the current timeslot
      const hasCurrentTimeSlot = isCurrentDay && daySlots.some(slot => 
        easternTimeInfo.minutes >= slot.startMinutes && 
        easternTimeInfo.minutes < slot.endMinutes &&
        isCurrentlyOpen
      );
      
      // Only style the day heading if it contains the current time slot
      const dayStyle = hasCurrentTimeSlot ? 'font-weight: 700; color: var(--primary-color);' : '';
      
      if (daySlots.length === 1) {
        // Single time slot for the day
        const slot = daySlots[0];
        const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        
        // Check for accurate slot highlighting - only highlight if we're currently in this exact time slot
        const isCurrentTimeSlot = isCurrentDay && 
          easternTimeInfo.minutes >= slot.startMinutes && 
          easternTimeInfo.minutes < slot.endMinutes;
        
        const timeHtml = slot.timeRange ? timeUtils.formatTimeRangeWithHighlight(slot.timeRange, true, null, poolStatus, isCurrentTimeSlot) : '';
        
        hoursDisplay += `<div style="margin-bottom: 0.3rem; ${dayStyle}"><strong>${day}:</strong> ${timeHtml}${typesText}${notesText}</div>`;
      } else {
        // Multiple time slots for the day - sort by start time
        const sortedSlots = daySlots.sort((a, b) => a.startMinutes - b.startMinutes);
        
        hoursDisplay += `<div style="margin-bottom: 0.3rem; ${dayStyle}"><strong>${day}:</strong></div>`;
        sortedSlots.forEach(slot => {
          const typesText = slot.types ? ` <em>(${slot.types})</em>` : '';
          const notesText = slot.notes ? ` - ${slot.notes}` : '';
          
          // Check for accurate slot highlighting - only highlight if we're currently in this exact time slot
          const isCurrentTimeSlot = isCurrentDay && 
            easternTimeInfo.minutes >= slot.startMinutes && 
            easternTimeInfo.minutes < slot.endMinutes;
          
          const timeHtml = slot.timeRange ? timeUtils.formatTimeRangeWithHighlight(slot.timeRange, true, null, poolStatus, isCurrentTimeSlot) : '';
          
          hoursDisplay += `<div style="margin-left: 1rem; margin-bottom: 0.2rem;">${timeHtml}${typesText}${notesText}</div>`;
        });
      }
    }
  });

  return `
    <div>
      <strong>🕒 Hours:</strong> <span style="color: ${poolStatus.color === 'green' ? 'var(--success-color)' : 'var(--error-color)'}; font-weight: 600;">${statusIcon} ${statusText}</span><br>
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
 * Groups consecutive days for cleaner display
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
 * Formats a group of consecutive days for display
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

// ------------------------------
//    OBJECT-ORIENTED DATA ACCESS HELPERS
// ------------------------------

// ------------------------------
//    APPLICATION INITIALIZATION
// ------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await initializeCopilot();
});

/**
 * Initialize copilot with modern data manager
 */
async function initializeCopilot() {
  try {
    console.log('🚀 INITIALIZATION STARTING...');
    console.log('================================');
    
    // Add FileHelper debugging
    console.log('🔧 ENVIRONMENT DETECTION:');
    console.log(`   - Environment: ${FileHelper.getEnvironment()}`);
    console.log(`   - Is Development: ${FileHelper.isDevelopmentMode()}`);
    console.log(`   - Is Production: ${FileHelper.isProductionMode()}`);
    console.log(`   - Current URL: ${window.location.href}`);
    console.log(`   - Pathname: ${window.location.pathname}`);
    console.log(`   - Hostname: ${window.location.hostname}`);
    
    // Test file accessibility
    console.log('🧪 TESTING FILE ACCESSIBILITY:');
    const fileValidation = await FileHelper.validateDataFiles();
    console.log('   - File validation results:', fileValidation);
    
    copilotDataManager = new DataManager();
    await copilotDataManager.initialize();
    
    // Generate detailed loading report
    console.log('📊 DATA LOADING REPORT:');
    console.log('========================');
    
    // Check and report pools data
    if (copilotDataManager.pools && copilotDataManager.pools.isDataLoaded()) {
      const allPools = copilotDataManager.pools.getAllPools();
      const openPools = allPools.filter(pool => pool.isOpenNow && pool.isOpenNow());
      console.log(`🏊 POOLS: ${allPools.length} total pools loaded from ${FileHelper.getPoolsDataPath()}`);
      console.log(`   - Currently open: ${openPools.length}`);
      console.log(`   - Currently closed: ${allPools.length - openPools.length}`);
      
      // Show sample pool names
      if (allPools.length > 0) {
        const samplePools = allPools.slice(0, 3).map(p => p.name).join(', ');
        console.log(`   - Sample pools: ${samplePools}${allPools.length > 3 ? ', ...' : ''}`);
      }
    } else {
      console.log('❌ POOLS: Failed to load pool data');
    }
    
    // Check and report teams data
    if (copilotDataManager.teams && copilotDataManager.teams.isDataLoaded()) {
      const allTeams = copilotDataManager.teams.getAllTeams();
      console.log(`👥 TEAMS: ${allTeams.length} total teams loaded from ${FileHelper.getTeamsDataPath()}`);
      
      // Count teams with practice schedules
      const teamsWithPractice = allTeams.filter(team => team.practice && team.practice.preseason);
      console.log(`   - Teams with practice schedules: ${teamsWithPractice.length}`);
      
      // Show sample team names
      if (allTeams.length > 0) {
        const sampleTeams = allTeams.slice(0, 3).map(t => t.name).join(', ');
        console.log(`   - Sample teams: ${sampleTeams}${allTeams.length > 3 ? ', ...' : ''}`);
      }
    } else {
      console.log('❌ TEAMS: Failed to load team data');
    }
    
    // Check and report meets data
    if (copilotDataManager.meets && copilotDataManager.meets.isDataLoaded()) {
      const allMeets = copilotDataManager.meets.getAllMeets();
      console.log(`📅 MEETS: ${allMeets.length} total meets loaded from ${FileHelper.getMeetsDataPath()}`);
      
      // Show sample meet information
      if (allMeets.length > 0) {
        const sampleMeets = allMeets.slice(0, 2).map(m => m.name || m.title || 'Unnamed Meet').join(', ');
        console.log(`   - Sample meets: ${sampleMeets}${allMeets.length > 2 ? ', ...' : ''}`);
      }
    } else {
      console.log('❌ MEETS: Failed to load meet data');
    }
    
    // Overall statistics
    const stats = copilotDataManager.getStatistics();
    if (stats) {
      console.log('📈 OVERALL STATISTICS:');
      console.log(`   - Total data objects loaded: ${(stats.pools?.totalPools || 0) + (stats.teams?.totalTeams || 0) + (stats.meets?.totalMeets || 0)}`);
      console.log(`   - Data files successfully loaded: ${[
        copilotDataManager.pools?.isDataLoaded(),
        copilotDataManager.teams?.isDataLoaded(),
        copilotDataManager.meets?.isDataLoaded()
      ].filter(Boolean).length}/3`);
    }
    
    // Initialize search engine if available
    console.log('🔍 SEARCH ENGINE INITIALIZATION:');
    if (typeof CNSLSearchEngine !== 'undefined') {
      searchEngine = new CNSLSearchEngine(copilotDataManager);
      console.log('✅ Search engine initialized successfully');
      console.log('   - Natural language query processing: ENABLED');
      console.log('   - Team practice queries: ENABLED');
      console.log('   - Pool feature searches: ENABLED');
      console.log('   - Meet schedule queries: ENABLED');
    } else {
      console.warn('⚠️ CNSLSearchEngine not available - search functionality will be limited');
      searchEngine = null;
    }
    
    console.log('================================');
    console.log('✅ INITIALIZATION COMPLETE');
    console.log('================================\n');
    
  } catch (error) {
    console.error('❌ INITIALIZATION FAILED:', error);
    console.error('💡 Check that all data files are present and properly formatted');
    showDataLoadError();
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
    let response;
    
    if (searchEngine) {
      // Use the new search engine
      response = searchEngine.processQuery(query);
    } else {
      // Fallback to legacy processing
      console.warn('Search engine not available, using legacy processing');
      response = legacyProcessQuery(query);
    }
    
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
 * Handles predefined search samples from the UI
 * @param {string} sampleQuery - The predefined query to search for
 */
function searchSample(sampleQuery) {
  const queryInput = document.getElementById("copilotQuery");
  if (queryInput) {
    queryInput.value = sampleQuery;
    handleSearch();
  }
}

/**
 * Modern query processing using search engine
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function legacyProcessQuery(query) {
  return `
    <div class="copilot-response error">
      <h3>⚠️ Search Unavailable</h3>
      <p>The search system is temporarily unavailable. Please try again later or use the navigation menu to browse content.</p>
    </div>
  `;
}

/**
 * Modern search pools function
 * @param {string} searchTerm - Search term
 * @returns {Array} - Array of search results
 */
function searchPoolsInfo(searchTerm) {
  if (copilotDataManager && copilotDataManager.pools && copilotDataManager.pools.isDataLoaded()) {
    return copilotDataManager.pools.searchPools(searchTerm);
  }
  return [];
}

// ------------------------------
//    SEARCH DELEGATION
// ------------------------------

/**
 * Demo function to showcase the modern object-oriented features
 * This can be called from the browser console for testing
 */
function demonstrateObjectOrientedFeatures() {
  console.log('🎯 CNSL Modern Architecture Demo');
  console.log('=================================');
  
  if (!copilotDataManager || !copilotDataManager.isInitialized()) {
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
  const poolsManager = copilotDataManager.getPools();
  const firstPool = poolsManager.getAllPools()[0];
  if (firstPool) {
    console.log(`Pool: ${firstPool.getName()}`);
    console.log(`Features: ${firstPool.getFeatures().join(', ')}`);
    console.log(`Current Status:`, firstPool.getCurrentStatus());
    console.log(`Is Open Now: ${firstPool.isOpenNow()}`);
  }
  
  // Demo 3: Time utilities
  const timeUtils = _getTimeUtils();
  if (timeUtils) {
    console.log('\n⏰ 3. Time Utilities:');
    const easternTimeInfo = timeUtils.getCurrentEasternTimeInfo();
    console.log(`Eastern Time Info:`, easternTimeInfo);
  }
  
  // Demo 4: Search capabilities
  console.log('\n🔍 4. Search Capabilities:');
  if (searchEngine) {
    console.log('Search engine is available and ready');
    const testQuery = 'pool hours';
    console.log(`Test query: "${testQuery}"`);
    // Note: We don't run the query in demo to avoid DOM manipulation
  }
  
  // Demo 5: Statistics
  console.log('\n📊 5. System Statistics:');
  const stats = copilotDataManager.getStatistics();
  if (stats) {
    console.log('Pool Stats:', {
      total: stats.pools?.totalPools || 0,
      open: stats.pools?.openPools || 0,
      openPercentage: (stats.pools?.openPercentage || 0) + '%'
    });
  }
  
  console.log('\n🎉 Demo completed! Modern architecture is working properly.');
}

// Make functions available globally
window.demonstrateObjectOrientedFeatures = demonstrateObjectOrientedFeatures;
window.searchSample = searchSample;
