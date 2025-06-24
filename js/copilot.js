let teamData = [];

document.addEventListener("DOMContentLoaded", () => {
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
});

function startCopilotVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Speech recognition is not supported in this browser. Please try Chrome or Edge.');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    document.getElementById("copilotQuery").value = e.results[0][0].transcript;
    handleSearch();
  };
  recognition.onerror = e => {
    console.error("Speech recognition error:", e);
    alert('Speech recognition failed. Please try again or type your question.');
  };
  recognition.start();
}

function handleSearch() {
  const input = document.getElementById("copilotQuery").value.toLowerCase();
  const output = document.getElementById("copilotResponse");

  if (!input.trim()) {
    output.innerHTML = `
      <div class="copilot-response">
        <p>👋 Hey there! I'm your Pool Copilot. Try asking me something like:</p>
        <ul>
          <li>"Where do the Marlins practice?"</li>
          <li>"When do the Barracudas have meets?"</li>
          <li>"What pools are open today?"</li>
        </ul>
      </div>
    `;
    return;
  }

  const match = teamData.find(team =>
    team.keywords.some(k => input.includes(k))
  );

  if (!match) {
    output.innerHTML = `
      <div class="copilot-response">
        <p>🤔 Hmm, I'm not quite sure about that one yet. I'm still learning about all the teams!</p>
        <p>💡 Try asking about teams like the <strong>Marlins</strong>, <strong>Barracudas</strong>, or <strong>Thunderbolts</strong>.</p>
        <p>Or check out the <a href='pools.html'>🏊 Pools section</a> for more options!</p>
      </div>
    `;
    return;
  }

  let response = `<div class="copilot-response"><h3>🏊‍♀️ ${match.name}</h3>`;

  if (input.includes("practice")) {
    response += `<p>Here's when they practice:</p>`;
    
    if (Array.isArray(match.practice)) {
      // Handle simple practice format (legacy)
      response += `<div class="practice-schedule">`;
      response += match.practice.map(p =>
        `<div class="schedule-item">📅 <strong>${p.day}:</strong> ${p.time} at ${p.location}</div>`
      ).join("");
      response += `</div>`;
    } else if (match.practice && match.practice.regular) {
      // Handle detailed practice format
      const regular = match.practice.regular;
      
      if (regular.morning) {
        response += `<h4>🌅 Morning Practice (${regular.morning.days})</h4>`;
        response += `<div class="practice-schedule">`;
        response += `<div class="schedule-location">📍 ${regular.morning.location}</div>`;
        response += regular.morning.sessions.map(s =>
          `<div class="schedule-item">⏰ ${s.time} - ${s.group}</div>`
        ).join("");
        response += `</div>`;
      }
      
      if (regular.evening && regular.evening.length > 0) {
        response += `<h4>🌆 Evening Practice</h4>`;
        regular.evening.forEach(day => {
          response += `<div class="practice-schedule">`;
          response += `<div class="schedule-day"><strong>${day.day}</strong> at ${day.location}</div>`;
          response += day.sessions.map(s =>
            `<div class="schedule-item">⏰ ${s.time} - ${s.group}</div>`
          ).join("");
          response += `</div>`;
        });
      }
    }
  } else if (input.includes("meet")) {
    if (match.meets && match.meets.length > 0) {
      response += `<p>Their meet schedule:</p><div class="meet-schedule">`;
      response += match.meets.map(m =>
        `<div class="schedule-item">🏆 ${m.type === "home" ? "🏠 Home" : "✈️ Away"} meets at <strong>${m.location}</strong> on ${m.days.join(", ")}</div>`
      ).join("");
      response += `</div>`;
    } else {
      response += `<p>🤷‍♀️ I don't have their meet schedule handy right now.</p>`;
    }
  } else if (input.includes("where") || input.includes("swim") || input.includes("pool")) {
    response += `<p>Their home pool${match.homePools.length > 1 ? 's are' : ' is'}:</p>`;
    response += `<div class="pool-list-compact">${match.homePools.map(pool => `<span class="pool-badge">🏠 ${pool}</span>`).join("")}</div>`;
    
    response += `<p>They practice at these pool${match.practicePools.length > 1 ? 's' : ''}:</p>`;
    response += `<div class="pool-list-compact">${match.practicePools.map(pool => `<span class="pool-badge">🏊 ${pool}</span>`).join("")}</div>`;
  } else {
    // General team info
    response += `
      <div class="team-overview">
        <div class="info-section">
          <h4>� Home Pools</h4>
          <div class="pool-list-compact">${match.homePools.map(pool => `<span class="pool-badge">${pool}</span>`).join("")}</div>
          
          <h4>�🏊 Practice Pools</h4>
          <div class="pool-list-compact">${match.practicePools.map(pool => `<span class="pool-badge">${pool}</span>`).join("")}</div>
        </div>
        <div class="info-section">
          <h4>📅 Practice Schedule</h4>
          <div class="practice-schedule">`;
    
    if (Array.isArray(match.practice)) {
      // Handle simple practice format
      response += match.practice.map(p => `<div class="schedule-item">${p.day}: ${p.time} at ${p.location}</div>`).join("");
    } else if (match.practice && match.practice.regular) {
      // Handle detailed practice format - show summary
      const regular = match.practice.regular;
      if (regular.morning) {
        response += `<div class="schedule-item">Morning: ${regular.morning.days} at ${regular.morning.location}</div>`;
      }
      if (regular.evening && regular.evening.length > 0) {
        regular.evening.forEach(day => {
          response += `<div class="schedule-item">${day.day} Evening: ${day.location}</div>`;
        });
      }
    }
    
    response += `
          </div>
        </div>
      </div>
    `;
  }

  if (match.url) {
    response += `<p><a href="${match.url}" target="_blank" class="team-link">🌐 Visit Team Website</a></p>`;
  }

  response += `</div>`;
  output.innerHTML = response;
}
