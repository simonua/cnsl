let poolData = [];

document.addEventListener("DOMContentLoaded", () => {
  fetch("assets/data/pools.json")
    .then(res => res.json())
    .then(data => {
      poolData = data;
      renderPools(data);
    });
});

function renderPools(data) {
  const list = document.getElementById("poolList");
  if (data.length === 0) {
    list.innerHTML = "<p>No pools match your filters.</p>";
    return;
  }

  list.innerHTML = data.map(pool => {
    const feats = pool.features.map(f => `<span class="badge">${f}</span>`).join(" ");
    const team = pool.team
      ? `<p><a href="${pool.team.url}" target="_blank">${pool.team.name}</a></p>`
      : "";
    const status = pool.openNow ? "✅ Open" : "❌ Closed";

    return `
      <article class="pool-card">
        <h3>${pool.name}</h3>
        <p>${pool.address}</p>
        ${team}
        <p>${status}</p>
        <div>${feats}</div>
      </article>
    `;
  }).join("");
}

function applyFilters() {
  const openNow = document.getElementById("filterOpenNow").checked;
  const splash = document.getElementById("filterSplash").checked;
  const lap = document.getElementById("filterLap").checked;
  const dive = document.getElementById("filterDive").checked;

  const filtered = poolData.filter(pool => {
    if (openNow && !pool.openNow) return false;
    if (splash && !pool.features.includes("splash")) return false;
    if (lap && !pool.features.includes("lap")) return false;
    if (dive && !pool.features.includes("dive")) return false;
    return true;
  });

  renderPools(filtered);
}

function handlePoolSearch() {
  const query = document.getElementById("poolQuery").value.toLowerCase();
  const marlinKeywords = ["long reach", "marlins", "kendall", "jeffers", "stevens"];

  if (marlinKeywords.some(k => query.includes(k))) {
    renderPools(poolData.filter(p =>
      p.team && p.team.name.toLowerCase().includes("marlins")
    ));
  } else {
    document.getElementById("poolList").innerHTML =
      "<p>I couldn't find a match for that question—try filtering by features or location.</p>";
  }
}

function startPoolVoice() {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    document.getElementById("poolQuery").value = e.results[0][0].transcript;
    handlePoolSearch();
  };
  recognition.start();
}
