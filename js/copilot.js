function handleSearch() {
  const input = document.getElementById("copilotQuery").value.toLowerCase();
  const output = document.getElementById("copilotResponse");

  if (!input.trim()) {
    output.innerHTML = "<p>Please ask something about a pool, team, or meet.</p>";
    return;
  }

  // Example stub logic – replace with smart matching
  if (input.includes("rapids")) {
    output.innerHTML = "<p><strong>Rapids practice</strong> at Running Brook Pool on Mondays, Wednesdays, and Fridays at 7:00 AM.</p>";
  } else if (input.includes("barracudas") && input.includes("practice")) {
    output.innerHTML = "<p><strong>Barracudas</strong> practice at Clemens Crossing Pool – check the team page for current times.</p>";
  } else if (input.includes("lightning schedule")) {
    output.innerHTML = "<p>The <strong>Lightning</strong> swim at Jeffers Hill. Meets: June 22 (home), June 29 (away), July 6 (home).</p>";
  } else {
    output.innerHTML = `<p>I'm still learning! Try rephrasing, or check the <a href="faq.html">FAQs</a>.</p>`;
  }
}
