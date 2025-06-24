let teamData = [];

document.addEventListener("DOMContentLoaded", () => {
  fetch("assets/data/teams.json")
    .then(res => res.json())
    .then(data => {
      teamData = data;
    });
});

function startCopilotVoice() {
  const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    document.getElementById("copilotQuery").value = e.results[0][0].transcript;
    handleSearch();
  };
  recognition.onerror = e => {
    console.error("Speech recognition error:", e);
  };
  recognition.start();
}


function handleSearch() {
  const input = document.getElementById("copilotQuery").value.toLowerCase();
  const output = document.getElementById("copilotResponse");

  if (!input.trim()) {
    output.innerHTML = "<p>Please ask something like a team name or meet day.</p>";
    return;
  }

  const match = teamData.find(team =>
    team.keywords.some(k => input.includes(k))
  );

  if (!match) {
    output.innerHTML = `<p>I’m still learning! Try asking about a team or browse the <a href='faq.html'>FAQs</a>.</p>`;
    return;
  }

  let response = `<p><strong>${match.name}</strong></p>`;

  if (input.includes("practice")) {
    response += match.practice.map(p =>
      `<p>🕒 ${p.day}: ${p.time} at ${p.location}</p>`
    ).join("");
  } else if (input.includes("meet")) {
    response += match.meets?.map(m =>
      `<p>📍 ${m.type === "home" ? "Home" : "Away"} meet at ${m.location} on ${m.days.join(", ")}</p>`
    ).join("") || "<p>No meet info available.</p>";
  } else if (input.includes("where") || input.includes("swim")) {
    response += `<p>🏊 Practices at: ${match.pools.join(", ")}</p>`;
  } else {
    response += `
      <p>🏊 Pools: ${match.pools.join(", ")}</p>
      <p>🕒 Practice:</p>
      ${match.practice.map(p => `<p>${p.day}: ${p.time} at ${p.location}</p>`).join("")}
    `;
  }

  if (match.url) {
    response += `<p><a href="${match.url}" target="_blank">Team Website</a></p>`;
  }

  output.innerHTML = response;
  speak(output.innerText || output.textContent);

}
