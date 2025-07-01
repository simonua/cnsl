/**
 * CNSL Search Engine
 * Handles natural language query processing and search functionality for the Columbia Neighborhood Swim League
 * 
 * @author Simon Kurtz
 * @version 2.0.0
 */

// ------------------------------
//    SEARCH ENGINE CLASS
// ------------------------------

// Prevent multiple declarations
if (!window.CNSLSearchEngine) {
  class CNSLSearchEngine {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * Processes a natural language query and returns relevant information
   * Uses a decision tree approach to categorize and route queries appropriately
   * @param {string} query - The user's search query
   * @returns {string} HTML content to display as a response
   */
  processQuery(query) {
    console.log('🔍 SEARCH DECISION TREE START');
    console.log('📝 Original Query:', `"${query}"`);
    
    // Parse and normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    console.log('🔧 Normalized Query:', `"${normalizedQuery}"`);
    
    // Extract date/time context from query
    const dateTimeContext = this.extractDateTimeContext(normalizedQuery);
    console.log('📅 Date/Time Context:', dateTimeContext);
    
    // DECISION TREE: Primary query categorization
    // ========================================
    console.log('🌳 DECISION TREE: Starting primary categorization...');
    
    // BRANCH 1: Team-related queries (practice, meets, coach info)
    // Keywords: team names, "practice", "meet", "coach", location questions with team context
    if (this.isTeamQuery(normalizedQuery)) {
      console.log('✅ BRANCH 1: Team-related query detected');
      console.log('🏊‍♀️ Routing to handleTeamQuery()');
      return this.handleTeamQuery(normalizedQuery, dateTimeContext);
    }
    
    // BRANCH 2: Pool feature and status queries
    // Keywords: feature names, "open now", "available", pool characteristics
    if (this.isPoolFeatureQuery(normalizedQuery)) {
      console.log('✅ BRANCH 2: Pool feature/status query detected');
      console.log('🎯 Routing to handlePoolFeatureQuery()');
      return this.handlePoolFeatureQuery(normalizedQuery, dateTimeContext);
    }
    
    // BRANCH 3: Pool location and basic info queries
    // Keywords: "pool", "where", "location", "address", specific pool names
    if (this.isPoolLocationQuery(normalizedQuery)) {
      console.log('✅ BRANCH 3: Pool location query detected');
      console.log('📍 Routing to handlePoolLocationQuery()');
      return this.handlePoolLocationQuery(normalizedQuery, dateTimeContext);
    }
    
    // BRANCH 4: Meet schedule queries
    // Keywords: "meet", "event", "competition", "schedule", team names with meet context
    if (this.isMeetQuery(normalizedQuery)) {
      console.log('✅ BRANCH 4: Meet schedule query detected');
      console.log('📅 Routing to handleMeetQuery()');
      return this.handleMeetQuery(normalizedQuery, dateTimeContext);
    }
    
    // BRANCH 5: Pool hours and availability queries
    // Keywords: "hour", "open", "close", "time", "when does", "available"
    if (this.isHoursQuery(normalizedQuery)) {
      console.log('✅ BRANCH 5: Pool hours query detected');
      console.log('🕒 Routing to handleHoursQuery()');
      return this.handleHoursQuery(normalizedQuery, dateTimeContext);
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


  // ------------------------------
  //    QUERY TYPE DETECTION
  // ------------------------------

  /**
   * Determines if a query is team-related
   * @param {string} query - The normalized query string
   * @returns {boolean} True if the query is about teams
   */
  isTeamQuery(query) {
    console.log('🤔 CHECKING IF TEAM QUERY');
    console.log(`📝 Query to analyze: "${query}"`);
    
    if (!this.dataManager || !this.dataManager.teams) {
      console.log('❌ No team data available');
      return false;
    }
    
    const teamKeywords = ['practice', 'training', 'coach', 'team'];
    const hasTeamKeyword = teamKeywords.some(keyword => query.includes(keyword));
    
    console.log(`🔑 Team keywords found: ${hasTeamKeyword ? 'YES' : 'NO'}`);
    if (hasTeamKeyword) {
      console.log(`   - Matched keyword(s): ${teamKeywords.filter(k => query.includes(k)).join(', ')}`);
    }
    
    if (hasTeamKeyword) {
      console.log('✅ TEAM QUERY: Detected via team keywords');
      return true;
    }
    
    // Check if any team names or keywords are mentioned
    const teams = this.dataManager.teams.getAllTeams();
    console.log(`👥 Checking against ${teams.length} teams for name/keyword matches...`);
    
    const teamMatch = teams.some(team => {
      const teamName = team.name.toLowerCase();
      const teamNickname = team.nickname ? team.nickname.toLowerCase() : '';
      const teamKeywords = team.keywords || [];
      
      // Check team name, nickname, or keywords
      const nameMatch = query.includes(teamName);
      const nicknameMatch = teamNickname && query.includes(teamNickname);
      const keywordMatch = teamKeywords.some(keyword => query.includes(keyword.toLowerCase()));
      
      if (nameMatch || nicknameMatch || keywordMatch) {
        console.log(`   ✅ Match found with team: ${team.name}`);
        if (nameMatch) console.log(`      - Matched team name: "${teamName}"`);
        if (nicknameMatch) console.log(`      - Matched nickname: "${teamNickname}"`);
        if (keywordMatch) {
          const matchedKeywords = teamKeywords.filter(k => query.includes(k.toLowerCase()));
          console.log(`      - Matched keywords: [${matchedKeywords.join(', ')}]`);
        }
        return true;
      }
      return false;
    });
    
    if (teamMatch) {
      console.log('✅ TEAM QUERY: Detected via team name/keyword match');
    } else {
      console.log('❌ NOT A TEAM QUERY: No team matches found');
    }
    
    console.log('🤔 TEAM QUERY CHECK COMPLETE\n');
    return teamMatch;
  }

  /**
   * Determines if a query is about pool features
   * @param {string} query - The normalized query string
   * @returns {boolean} True if the query is about pool features
   */
  isPoolFeatureQuery(query) {
    const featureKeywords = ['slide', 'lap', 'diving', 'hot tub', 'wifi', 'grill', 'basketball', 
      'tennis', 'playground', 'picnic', 'snack bar', 'wading', 'pool lift', 'open now', 
      'available', 'status', 'closed'];
    return featureKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Determines if a query is about pool location
   * @param {string} query - The normalized query string
   * @returns {boolean} True if the query is about pool locations
   */
  isPoolLocationQuery(query) {
    const locationKeywords = ['where', 'location', 'address', 'pool'];
    return locationKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Determines if a query is about meet schedules
   * @param {string} query - The normalized query string
   * @returns {boolean} True if the query is about meets
   */
  isMeetQuery(query) {
    const meetKeywords = ['meet', 'event', 'competition', 'schedule'];
    return meetKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Determines if a query is about pool hours
   * @param {string} query - The normalized query string
   * @returns {boolean} True if the query is about hours
   */
  isHoursQuery(query) {
    const hoursKeywords = ['hour', 'open', 'close', 'time', 'when does', 'available'];
    return hoursKeywords.some(keyword => query.includes(keyword));
  }


  // ------------------------------
  //    QUERY HANDLERS
  // ------------------------------

  /**
   * Handles queries related to teams, practice schedules, and coaching
   * Enhanced to support location queries like "Where is Marlins practice tonight?"
   * @param {string} query - The user's search query
   * @param {Object} dateTimeContext - The parsed date/time context
   * @returns {string} HTML content to display as a response
   */
  handleTeamQuery(query, dateTimeContext = {}) {
    if (!this.dataManager || !this.dataManager.teams || !this.dataManager.teams.isDataLoaded()) {
      return `
        <div class="copilot-response error">
          <h3>⚠️ Team Information Unavailable</h3>
          <p>Sorry, team information is not available right now. Please try again later.</p>
        </div>
      `;
    }
    
    // DECISION SUB-TREE: Team query type classification
    // ================================================
    
    const matchingTeams = this.extractTeamsFromQuery(query);
    
    if (matchingTeams.length === 0) {
      return this.handleNoTeamFound(query);
    }
    
    // BRANCH 1: Practice-related queries (schedule, location, times)
    if (query.includes('practice') || query.includes('training') || query.includes('where')) {
      return this.handlePracticeQuery(query, matchingTeams);
    }
    
    // BRANCH 2: Meet-related queries for specific teams
    if (query.includes('meet') || query.includes('competition')) {
      return this.handleTeamMeetQuery(query, matchingTeams);
    }
    
    // BRANCH 3: General team information
    return this.handleGeneralTeamQuery(query, matchingTeams);
  }

  /**
   * Handles pool feature queries like "which pools have slides"
   * @param {string} query - The user's search query
   * @param {Object} dateTimeContext - The parsed date/time context
   * @returns {string} HTML content to display as a response
   */
  handlePoolFeatureQuery(query, dateTimeContext = {}) {
    if (!this.dataManager || !this.dataManager.pools || !this.dataManager.pools.isDataLoaded()) {
      return `
        <div class="copilot-response error">
          <h3>⚠️ Pool Information Unavailable</h3>
          <p>Sorry, pool information is not available right now. Please try again later.</p>
        </div>
      `;
    }

    const pools = this.dataManager.pools.getAllPools();
    const features = this.extractFeaturesFromQuery(query);
    
    if (query.includes('open') || query.includes('closed') || query.includes('status')) {
      return this.getPoolStatusResponse(pools);
    }
    
    if (features.length > 0) {
      return this.searchPoolsByFeatures(pools, features);
    }
    
    return `<p>I can help you find pools with specific features. Try asking about slides, lap pools, diving boards, or other amenities.</p>`;
  }

  /**
   * Handles pool location queries like "where is the pool"
   * @param {string} query - The user's search query
   * @param {Object} dateTimeContext - The parsed date/time context
   * @returns {string} HTML content to display as a response
   */
  handlePoolLocationQuery(query, dateTimeContext = {}) {
    if (!this.dataManager || !this.dataManager.pools || !this.dataManager.pools.isDataLoaded()) {
      return `
        <div class="copilot-response error">
          <h3>⚠️ Pool Information Unavailable</h3>
          <p>Sorry, pool information is not available right now. Please try again later.</p>
        </div>
      `;
    }

    const pools = this.dataManager.pools.getAllPools();
    
    // Try to find a specific pool mentioned in the query
    const pool = pools.find(p => 
      query.includes(p.name.toLowerCase().replace(/\s+/g, '')) ||
      query.includes(p.name.toLowerCase())
    );
    
    if (pool) {
      return this.getSpecificPoolInfo(pool);
    }
    
    return `
      <div class="copilot-response">
        <h3>🏊‍♀️ Pool Locations</h3>
        <p>There are ${pools.length} pools in Columbia. Try asking about a specific pool by name, or ask "which pools are near me?"</p>
      </div>
    `;
  }

  /**
   * Handles pool hours queries
   * @param {string} query - The user's search query
   * @param {Object} dateTimeContext - The parsed date/time context
   * @returns {string} HTML content to display as a response
   */
  handleHoursQuery(query, dateTimeContext = {}) {
    if (!this.dataManager || !this.dataManager.pools || !this.dataManager.pools.isDataLoaded()) {
      return `
        <div class="copilot-response error">
          <h3>⚠️ Pool Information Unavailable</h3>
          <p>Sorry, pool information is not available right now. Please try again later.</p>
        </div>
      `;
    }

    const pools = this.dataManager.pools.getAllPools();
    
    if (query.includes('open now') || query.includes('available now')) {
      return this.getPoolStatusResponse(pools);
    }
    
    return `
      <div class="copilot-response">
        <h3>🕒 Pool Hours</h3>
        <p>Pool hours vary by location and season. Use the <a href="pools.html">pools page</a> to see current hours for all pools, or ask about a specific pool.</p>
      </div>
    `;
  }

  /**
   * Handles meet-related queries
   * @param {string} query - The user's search query
   * @param {Object} dateTimeContext - The parsed date/time context
   * @returns {string} HTML content to display as a response
   */
  handleMeetQuery(query, dateTimeContext = {}) {
    if (!this.dataManager || !this.dataManager.meets || !this.dataManager.meets.isDataLoaded()) {
      return `
        <div class="copilot-response">
          <h3>📅 Meet Information</h3>
          <p>Meet information is not currently available. Please check the <a href="meets.html">meets page</a> for the latest schedule.</p>
        </div>
      `;
    }

    const meets = this.dataManager.meets.getAllMeets();
    
    return `
      <div class="copilot-response">
        <h3>🏊‍♀️ Swim Meets</h3>
        <p>There are ${meets.length} meets scheduled. Visit the <a href="meets.html">meets page</a> for detailed information.</p>
      </div>
    `;
  }


  // ------------------------------
  //    EXTRACTION UTILITIES
  // ------------------------------

  /**
   * Extracts teams that match keywords found in the query
   * @param {string} query - The user's search query
   * @returns {Array} Array of matching team objects
   */
  extractTeamsFromQuery(query) {
    console.log('🔍 EXTRACTING TEAMS - Starting team extraction...');
    console.log('📝 Query to search:', `"${query}"`);

    if (!this.dataManager || !this.dataManager.teams) {
      console.log('❌ No data manager or teams data available');
      return [];
    }
    
    const teamData = this.dataManager.teams.getAllTeams();
    console.log(`📊 Total teams available: ${teamData.length}`);
    
    const queryLower = query.toLowerCase();
    const matchingTeams = [];

    // Check each team for matches
    teamData.forEach((team, index) => {
      console.log(`🔍 [${index + 1}/${teamData.length}] Checking team: "${team.name}"`);
      
      const teamName = team.name.toLowerCase();
      const teamNickname = team.nickname ? team.nickname.toLowerCase() : '';
      const teamKeywords = team.keywords || [];
      
      console.log(`   - Team name: "${teamName}"`);
      console.log(`   - Nickname: "${teamNickname || 'None'}"`);
      console.log(`   - Keywords: [${teamKeywords.join(', ')}]`);
      
      let isMatch = false;
      let matchReason = '';
      
      // Check team name match
      if (queryLower.includes(teamName)) {
        isMatch = true;
        matchReason = 'full team name match';
      }
      // Check nickname match  
      else if (teamNickname && queryLower.includes(teamNickname)) {
        isMatch = true;
        matchReason = 'nickname match';
      }
      // Check keywords match
      else if (teamKeywords.some(keyword => queryLower.includes(keyword.toLowerCase()))) {
        isMatch = true;
        const matchedKeyword = teamKeywords.find(keyword => queryLower.includes(keyword.toLowerCase()));
        matchReason = `keyword match: "${matchedKeyword}"`;
      }
      // Check if team name contains first word of query
      else if (teamName.includes(queryLower.split(' ')[0])) {
        isMatch = true;
        matchReason = 'partial name match (first word)';
      }
      
      if (isMatch) {
        matchingTeams.push(team);
        console.log(`   ✅ MATCH FOUND! Reason: ${matchReason}`);
      } else {
        console.log(`   ❌ No match`);
      }
    });

    console.log(`🎯 EXTRACTION COMPLETE - Total teams found: ${matchingTeams.length}`);
    if (matchingTeams.length > 0) {
      console.log('📋 Matched teams:');
      matchingTeams.forEach((team, index) => {
        console.log(`   ${index + 1}. ${team.name} (${team.nickname || 'No nickname'})`);
      });
    }
    console.log('🔍 EXTRACTING TEAMS - End\n');
    
    return matchingTeams;
  }

  /**
   * Extracts pool feature keywords from a user query
   * @param {string} query - The user's search query
   * @returns {Array} Array of feature keywords found in the query
   */
  extractFeaturesFromQuery(query) {
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
   * Extracts date/time context from query (placeholder implementation)
   * @param {string} query - The normalized query string
   * @returns {Object} Date/time context object
   */
  extractDateTimeContext(query) {
    // This is a simplified implementation
    // In a full implementation, this would parse dates, times, and relative terms
    return {
      hasDateContext: query.includes('today') || query.includes('tomorrow') || query.includes('now'),
      isCurrentTime: query.includes('now') || query.includes('currently')
    };
  }


  // ------------------------------
  //    SEARCH UTILITIES
  // ------------------------------

  /**
   * Gets pool status response showing which pools are currently open
   * @param {Array} pools - Array of pool objects
   * @returns {string} HTML formatted response
   */
  getPoolStatusResponse(pools) {
    const openPools = [];
    const closedPools = [];
    
    pools.forEach(pool => {
      const status = getPoolStatus(pool);
      if (isPoolOpen(pool)) {
        openPools.push({ pool, status });
      } else {
        closedPools.push({ pool, status });
      }
    });
    
    let response = '<div class="copilot-response"><h3>🏊‍♀️ Current Pool Status</h3>';
    
    if (openPools.length > 0) {
      response += '<h4 style="color: var(--success-color);">🟢 Currently Open:</h4><ul>';
      openPools.forEach(({ pool, status }) => {
        response += `<li><strong>${pool.name}</strong> - ${status.message}</li>`;
      });
      response += '</ul>';
    }
    
    if (closedPools.length > 0) {
      response += '<h4 style="color: var(--error-color);">🔴 Currently Closed:</h4><ul>';
      closedPools.forEach(({ pool, status }) => {
        response += `<li><strong>${pool.name}</strong> - ${status.message}</li>`;
      });
      response += '</ul>';
    }
    
    response += '</div>';
    return response;
  }

  /**
   * Searches pools by requested features
   * @param {Array} pools - Array of pool objects
   * @param {Array} features - Array of requested feature names
   * @returns {string} HTML formatted response
   */
  searchPoolsByFeatures(pools, features) {
    const matchingPools = pools.filter(pool => {
      return features.every(feature => {
        if (!pool.features) return false;
        
        // Map feature names to pool feature properties
        const featureMap = {
          'slide': ['slides', 'waterSlide'],
          'lap': ['lapPool'],
          'wading': ['wadingPool', 'babyPool'],
          'diving': ['divingBoard'],
          'hot tub': ['hotTub', 'spa'],
          'wifi': ['wifi'],
          'pool lift': ['poolLift'],
          'grill': ['grills'],
          'basketball': ['basketball'],
          'tennis': ['tennis'],
          'playground': ['playground'],
          'picnic': ['picnicArea'],
          'snack bar': ['snackBar']
        };
        
        const mappedFeatures = featureMap[feature] || [feature];
        return mappedFeatures.some(mappedFeature => pool.features[mappedFeature]);
      });
    });
    
    if (matchingPools.length === 0) {
      return `
        <div class="copilot-response">
          <h3>🔍 Feature Search Results</h3>
          <p>No pools found with the requested features: ${features.join(', ')}</p>
        </div>
      `;
    }
    
    let response = `
      <div class="copilot-response">
        <h3>🎯 Pools with ${features.join(', ')}</h3>
        <p>Found ${matchingPools.length} pool(s):</p>
        <ul>
    `;
    
    matchingPools.forEach(pool => {
      response += `<li><strong>${pool.name}</strong></li>`;
    });
    
    response += '</ul></div>';
    return response;
  }

  /**
   * Gets detailed information about a specific pool
   * @param {Object} pool - Pool object
   * @returns {string} HTML formatted response
   */
  getSpecificPoolInfo(pool) {
    const status = getPoolStatus(pool);
    
    // Handle both location formats for address display
    let addressDisplay = 'Address not available';
    
    if (pool.location) {
      // New location format
      const addressParts = [];
      if (pool.location.street) addressParts.push(pool.location.street);
      if (pool.location.city || pool.location.state || pool.location.zip) {
        const city = pool.location.city || '';
        const state = pool.location.state || '';
        const zip = pool.location.zip || '';
        const cityStateZip = (city + ', ' + state + ' ' + zip).trim();
        addressParts.push(cityStateZip);
      }
      addressDisplay = addressParts.join(', ');
    } else if (pool.address) {
      // Legacy format
      addressDisplay = pool.address;
    }
    
    return `
      <div class="copilot-response">
        <h3>🏊‍♀️ ${pool.name}</h3>
        <p><strong>Address:</strong> ${addressDisplay}</p>
        <p><strong>Status:</strong> <span style="color: ${status.color};">${status.message}</span></p>
        ${pool.features ? '<p><strong>Features:</strong> Available on pool details page</p>' : ''}
        <p><a href="pools.html" target="_blank">View full details</a></p>
      </div>
    `;
  }


  // ------------------------------
  //    TEAM QUERY HELPERS
  // ------------------------------

  /**
   * Handles practice-related queries
   * @param {string} query - The user's search query
   * @param {Array} teams - Array of matching team objects
   * @returns {string} HTML formatted response
   */
  handlePracticeQuery(query, teams) {
    console.log('🏊‍♀️ HANDLING PRACTICE QUERY');
    console.log(`📝 Query: "${query}"`);
    console.log(`👥 Teams to process: ${teams.length}`);
    
    let response = `
      <div class="copilot-response">
        <h3>🏊‍♀️ Practice Information</h3>
    `;
    
    teams.forEach((team, index) => {
      console.log(`📋 [${index + 1}/${teams.length}] Processing team: ${team.name}`);
      
      response += `<h4>${team.name}</h4>`;
      
      // Add team keywords/nickname for clarity
      if (team.nickname) {
        response += `<p><em>Also known as: ${team.nickname}</em></p>`;
      }
      
      // Practice pools information
      if (team.practicePools && team.practicePools.length > 0) {
        response += `<p><strong>Practice Pools:</strong> ${team.practicePools.join(', ')}</p>`;
      } else if (team.homePools && team.homePools.length > 0) {
        response += `<p><strong>Home Pool(s):</strong> ${team.homePools.join(', ')}</p>`;
      }
      
      // Practice schedule information if available
      if (team.practice) {
        if (team.practice.url) {
          response += `<p><strong>Practice Schedule:</strong> <a href="${team.practice.url}" target="_blank">View detailed schedule</a></p>`;
        }
        
        // Show preseason schedule if available
        if (team.practice.preseason && team.practice.preseason.length > 0) {
          response += `<div style="margin-top: 10px;"><strong>Recent Practice Schedule:</strong>`;
          team.practice.preseason.slice(0, 2).forEach(period => {
            response += `
              <div style="margin-left: 15px; margin-top: 5px;">
                <strong>${period.period}</strong> (${period.days})<br>
                <em>Location:</em> ${period.location}
            `;
            
            if (period.sessions && period.sessions.length > 0) {
              response += `<br><em>Times:</em><ul style="margin: 5px 0;">`;
              period.sessions.forEach(session => {
                response += `<li>${session.time} - ${session.group}</li>`;
              });
              response += `</ul>`;
            }
            response += `</div>`;
          });
          response += `</div>`;
        }
      }
      
      // Team website
      if (team.url) {
        response += `<p><strong>Team Website:</strong> <a href="${team.url}" target="_blank">Visit team site</a></p>`;
      }
      
      // Add separator between teams if multiple
      if (index < teams.length - 1) {
        response += `<hr style="margin: 20px 0;">`;
      }
    });
    
    response += `
        <div style="margin-top: 20px; padding: 10px; background-color: var(--bg-secondary); border-radius: 5px;">
          <strong>💡 Pro Tip:</strong> For the most up-to-date practice schedules and any last-minute changes, 
          always check the team's official website or contact the team directly.
        </div>
      </div>
    `;
    
    console.log('🏊‍♀️ PRACTICE QUERY COMPLETE - Response generated');
    return response;
  }

  /**
   * Handles queries when no team is found
   * @param {string} query - The user's search query
   * @returns {string} HTML formatted response
   */
  handleNoTeamFound(query) {
    return `
      <div class="copilot-response">
        <h3>🤔 Team Not Found</h3>
        <p>I couldn't find a team matching your query. Try using the team's full name or nickname.</p>
        <p><a href="teams.html">View all teams</a></p>
      </div>
    `;
  }

  /**
   * Handles team meet queries
   * @param {string} query - The user's search query
   * @param {Array} teams - Array of matching team objects
   * @returns {string} HTML formatted response
   */
  handleTeamMeetQuery(query, teams) {
    return `
      <div class="copilot-response">
        <h3>📅 Team Meet Information</h3>
        <p>Meet information for ${teams.map(t => t.name).join(', ')} is available on the <a href="meets.html">meets page</a>.</p>
      </div>
    `;
  }

  /**
   * Handles general team information queries
   * @param {string} query - The user's search query
   * @param {Array} teams - Array of matching team objects
   * @returns {string} HTML formatted response
   */
  handleGeneralTeamQuery(query, teams) {
    let response = `
      <div class="copilot-response">
        <h3>🏊‍♀️ Team Information</h3>
    `;
    
    teams.forEach(team => {
      response += `
        <h4>${team.name} (${team.nickname || 'No nickname'})</h4>
        <p><strong>Pool:</strong> ${team.pool || 'Not specified'}</p>
      `;
    });
    
    response += '<p><a href="teams.html">View all team details</a></p></div>';
    return response;
  }
}


// Export the search engine class for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CNSLSearchEngine;
}

// Make sure it's available globally
window.CNSLSearchEngine = CNSLSearchEngine;

}
