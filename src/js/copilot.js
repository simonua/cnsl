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
    responseElement.innerHTML = "<p>Please enter a question or search term.</p>";
    return;
  }
  
  responseElement.innerHTML = "<p>Searching...</p>";
  
  // Process the query and provide a response
  const response = processQuery(query);
  responseElement.innerHTML = response;
  
  // Scroll to response
  responseElement.scrollIntoView({ behavior: "smooth" });
}

/**
 * Processes a natural language query and returns relevant information
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function processQuery(query) {
  // Check for team related queries
  if (query.includes("team") || query.includes("practice")) {
    return handleTeamQuery(query);
  }
  
  // Check for pool related queries
  if (query.includes("pool") || query.includes("swim") || query.includes("where")) {
    return handlePoolQuery(query);
  }
  
  // Check for meet related queries
  if (query.includes("meet") || query.includes("event") || query.includes("when") || query.includes("schedule")) {
    return handleMeetQuery(query);
  }
  
  // Default response if no patterns match
  return "<p>I'm not sure how to answer that question. Try asking about teams, pools, or meets.</p>";
}

/**
 * Handles queries related to teams
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handleTeamQuery(query) {
  if (!teamData || !teamData.length) {
    return "<p>Sorry, team information is not available right now.</p>";
  }
  
  // Look for team names in the query
  const matchingTeams = teamData.filter(team => 
    query.includes(team.name.toLowerCase()) || 
    query.includes(team.nickname.toLowerCase())
  );
  
  if (matchingTeams.length === 0) {
    return "<p>I couldn't find information about that team. Try asking about a specific team by name.</p>" +
           "<p>Available teams: " + teamData.map(t => t.nickname).join(", ") + "</p>";
  }
  
  // Build response for matching teams
  const teamInfo = matchingTeams.map(team => `
    <div class="team-info">
      <h3>${team.name} (${team.nickname})</h3>
      <p><strong>Home Pool:</strong> ${team.homePool}</p>
      <p><strong>Practice Times:</strong> ${team.practiceTimes}</p>
      <p><strong>Coaches:</strong> ${team.coaches.join(", ")}</p>
    </div>
  `).join("");
  
  return teamInfo;
}

/**
 * Handles queries related to pools
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handlePoolQuery(query) {
  if (!poolData || !poolData.length) {
    return "<p>Sorry, pool information is not available right now.</p>";
  }
  
  // Look for pool names in the query
  const matchingPools = poolData.filter(pool => 
    query.includes(pool.name.toLowerCase())
  );
  
  if (matchingPools.length === 0) {
    return "<p>I couldn't find information about that pool. Try asking about a specific pool by name or check the pools page.</p>";
  }
  
  // Build response for matching pools
  const poolInfo = matchingPools.map(pool => `
    <div class="pool-info">
      <h3>${pool.name}</h3>
      <p>${pool.address}, ${pool.city}, ${pool.state} ${pool.zip}</p>
      <p><a href="https://maps.google.com/?q=${encodeURIComponent(pool.address + ' ' + pool.city + ', ' + pool.state + ' ' + pool.zip)}" 
        target="_blank" rel="noopener" class="btn btn-secondary">Get Directions</a></p>
    </div>
  `).join("");
  
  return poolInfo;
}

/**
 * Handles queries related to meets
 * @param {string} query - The user's search query
 * @returns {string} HTML content to display as a response
 */
function handleMeetQuery(query) {
  if (!meetData || !meetData.length) {
    return "<p>Sorry, meet information is not available right now.</p>";
  }
  
  // Look for meet information
  // This would need to be expanded based on your meet data structure
  return "<p>Please check our schedule page for upcoming meets and events.</p>";
}
