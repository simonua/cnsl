let teamsData = []; // Avoid global variable name conflicts

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
    const teamNickname = team.nickname || '';
    const teamDiv = team.division || '';
    const teamPool = team.homePool || '';
    const teamUrl = team.url || '#';
    
    return `
      <div class="team-item">
        <h3>${teamName} ${teamNickname ? `(${teamNickname})` : ''}</h3>
        <p>${teamDiv ? `Division: ${teamDiv}` : ''}</p>
        <p>${teamPool ? `Home Pool: ${teamPool}` : ''}</p>
        <div class="team-buttons">
          <a href="${teamUrl}" target="_blank" rel="noopener" class="btn btn-primary">Team Page</a>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the teams page before fetching data
  if (!document.getElementById("teamList")) {
    console.log("Not on teams page, skipping team data fetch");
    return;
  }
  
  fetch("assets/data/teams.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("Loaded team data:", data.length, "teams");
      teamsData = data;
      renderTeams(data);
    })
    .catch(error => {
      console.error("Failed to load team data:", error);
      const list = document.getElementById("teamList");
      if (list) {
        list.innerHTML = "<p>⚠️ Team data is currently unavailable. Please try again later.</p>";
      }
    });
});
