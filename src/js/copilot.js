let teamData = [];
let poolData = [];
let meetData = [];

document.addEventListener("DOMContentLoaded", () => {
  // Load team data
  fetch("assets/data/teams.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      teamData = data;
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
      poolData = data;
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
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function processQuery(query) {
  // Check for team related queries
  if (query.includes("team") || query.includes("practice") || query.includes("coach")) {
    return handleTeamQuery(query);
  }
  
  // Check for pool related queries
  if (query.includes("pool") || query.includes("swim") || query.includes("where") || query.includes("location") || query.includes("address")) {
    return handlePoolQuery(query);
  }
  
  // Check for meet related queries
  if (query.includes("meet") || query.includes("event") || query.includes("when") || query.includes("schedule") || query.includes("competition")) {
    return handleMeetQuery(query);
  }
  
  // Check for feature queries (slides, diving, etc.)
  if (query.includes("slide") || query.includes("diving") || query.includes("lap") || query.includes("feature")) {
    return handleFeatureQuery(query);
  }
  
  // Default response with helpful suggestions
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
 * Handles queries related to teams
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handleTeamQuery(query) {
  if (!teamData || !teamData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Team Information Unavailable</h3>
        <p>Sorry, team information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // Look for team names in the query
  const matchingTeams = teamData.filter(team => {
    // Add safety checks before calling toLowerCase()
    const name = team.name ? team.name.toLowerCase() : '';
    const nickname = team.nickname ? team.nickname.toLowerCase() : '';
    
    return query.includes(name) || query.includes(nickname);
  });
  
  if (matchingTeams.length === 0) {
    // Safely map team nicknames with fallback for undefined values
    const teamNames = teamData
      .map(t => t.nickname || t.name || 'Unknown Team')
      .filter(Boolean)
      .slice(0, 8) // Limit for mobile display
      .join(", ");
      
    return `
      <div class="copilot-response warning">
        <h3>🏊‍♀️ Team Not Found</h3>
        <p>I couldn't find information about that team. Try asking about a specific team by name.</p>
        <div class="team-list">
          <h4>Available teams include:</h4>
          <p>${teamNames}</p>
        </div>
      </div>
    `;
  }
  
  // Build response for matching teams
  const teamInfo = matchingTeams.map(team => {
    // Add safety checks for all team properties
    const name = team.name || 'Unknown Team';
    const nickname = team.nickname || '';
    const homePool = team.homePool || 'TBA';
    const practiceTimes = team.practiceTimes || 'TBA';
    const coaches = Array.isArray(team.coaches) ? team.coaches.join(", ") : 'TBA';
    
    return `
      <div class="team-card">
        <h3>${name} ${nickname ? `(${nickname})` : ''}</h3>
        <div class="team-details">
          <div class="detail-item">
            <strong>🏊‍♀️ Home Pool:</strong> ${homePool}
          </div>
          <div class="detail-item">
            <strong>⏰ Practice Times:</strong> ${practiceTimes}
          </div>
          <div class="detail-item">
            <strong>👨‍🏫 Coaches:</strong> ${coaches}
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  return `
    <div class="copilot-response success">
      <h3>🏆 Team Information</h3>
      ${teamInfo}
    </div>
  `;
}

/**
 * Handles queries related to pools
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handlePoolQuery(query) {
  if (!poolData || !poolData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Pool Information Unavailable</h3>
        <p>Sorry, pool information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // Look for pool names in the query
  const matchingPools = poolData.filter(pool => {
    // Add safety check before calling toLowerCase()
    const name = pool.name ? pool.name.toLowerCase() : '';
    
    return query.includes(name);
  });
  
  if (matchingPools.length === 0) {
    const poolNames = poolData
      .map(p => p.name || 'Unknown Pool')
      .filter(Boolean)
      .slice(0, 6) // Limit for mobile display
      .join(", ");
      
    return `
      <div class="copilot-response warning">
        <h3>🏊‍♀️ Pool Not Found</h3>
        <p>I couldn't find information about that pool. Try asking about a specific pool by name.</p>
        <div class="pool-list">
          <h4>Available pools include:</h4>
          <p>${poolNames}</p>
        </div>
        <p><a href="pools.html" class="button">Browse All Pools</a></p>
      </div>
    `;
  }
  
  // Build response for matching pools
  const poolInfo = matchingPools.map(pool => {
    // Add safety checks for all pool properties
    const name = pool.name || 'Unknown Pool';
    const address = pool.address || '';
    const city = pool.city || '';
    const state = pool.state || '';
    const zip = pool.zip || '';
    
    // Build location query string safely
    const locationQuery = encodeURIComponent(
      [address, city, state, zip].filter(Boolean).join(', ')
    );
    
    const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
    
    return `
      <div class="pool-card">
        <h3>${name}</h3>
        <div class="pool-details">
          <div class="detail-item">
            <strong>📍 Address:</strong> ${fullAddress || 'Address not available'}
          </div>
          ${locationQuery ? `
          <div class="detail-item">
            <a href="https://maps.google.com/?q=${locationQuery}" 
               target="_blank" 
               rel="noopener" 
               class="button button-secondary">
              🗺️ Get Directions
            </a>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
  
  return `
    <div class="copilot-response success">
      <h3>🏊‍♀️ Pool Information</h3>
      ${poolInfo}
    </div>
  `;
}

/**
 * Handles queries related to pool features
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handleFeatureQuery(query) {
  if (!poolData || !poolData.length) {
    return `
      <div class="copilot-response error">
        <h3>⚠️ Pool Information Unavailable</h3>
        <p>Sorry, pool information is not available right now. Please try again later.</p>
      </div>
    `;
  }
  
  // Look for pools with specific features
  const featurePools = poolData.filter(pool => {
    if (!pool.features) return false;
    
    const features = Array.isArray(pool.features) 
      ? pool.features.join(' ').toLowerCase() 
      : pool.features.toLowerCase();
    
    if (query.includes("slide")) return features.includes("slide");
    if (query.includes("diving")) return features.includes("diving");
    if (query.includes("lap")) return features.includes("lap");
    
    return false;
  });
  
  if (featurePools.length === 0) {
    return `
      <div class="copilot-response warning">
        <h3>🔍 No Matching Features Found</h3>
        <p>I couldn't find pools with that specific feature. Try browsing all pools to see available features.</p>
        <p><a href="pools.html" class="button">Browse All Pools</a></p>
      </div>
    `;
  }
  
  const poolList = featurePools.map(pool => {
    const name = pool.name || 'Unknown Pool';
    const features = Array.isArray(pool.features) 
      ? pool.features.join(', ') 
      : pool.features || 'Features not listed';
    
    return `
      <div class="pool-card">
        <h4>${name}</h4>
        <div class="detail-item">
          <strong>🎯 Features:</strong> ${features}
        </div>
      </div>
    `;
  }).join("");
  
  return `
    <div class="copilot-response success">
      <h3>🎯 Pools with Matching Features</h3>
      ${poolList}
    </div>
  `;
}

/**
 * Handles queries related to meets
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handleMeetQuery(query) {
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
