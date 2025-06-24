let poolData = [];
let userCoords = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch("assets/data/pools.json")
    .then(res => res.json())
    .then(data => {
      poolData = data;
      getUserLocation();
      renderPools(data);
    });
});

function getUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    userCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };
    renderPools(poolData); // re-render with distances
  });
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderPools(data) {
  const list = document.getElementById("poolList");
  if (data.length === 0) {
    list.innerHTML = "<p>No pools match your filters.</p>";
    return;
  }

  const sorted = [...data];
  if (userCoords) {
    sorted.forEach(pool => {
      pool.distance = calcDistance(userCoords.lat, userCoords.lng, pool.lat, pool.lng);
    });
    sorted.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
  }

  list.innerHTML = sorted.map(pool => {
    const feats = pool.features.map(f => `<span class="badge">${f}</span>`).join(" ");
    const team = pool.team
      ? `<p><a href="${pool.team.url}" target="_blank">${pool.team.name}</a></p>`
      : "";
    const status = pool.openNow ? "✅ Open" : "❌ Closed";
    const distance = pool.distance ? `<p>📍 ~${pool.distance.toFixed(1)} km away</p>` : "";

    return `
      <article class="pool-card">
        <h3>${pool.name}</h3>
        <p>${pool.address}</p>
        ${team}
        <p>${status}</p>
        ${distance}
        <div class="features">${feats}</div>
        <p><a href="https://maps.apple.com/?q=${encodeURIComponent(pool.mapsQuery)}" target="_blank">📍 Get Directions</a></p>
      </article>
    `;
  }).join("");

  describePools(poolData);
}

function applyFilters() {
  const filters = {
    splash: document.getElementById("filterSplash")?.checked,
    lap: document.getElementById("filterLap")?.checked,
    dive: document.getElementById("filterDive")?.checked,
    slide: document.getElementById("filterSlide")?.checked
  };
  const openOnly = document.getElementById("filterOpenNow")?.checked;

  const filtered = poolData.filter(pool => {
    if (openOnly && !pool.openNow) return false;
    for (let key in filters) {
      if (filters[key] && !pool.features.includes(key)) return false;
    }
    return true;
  });

  renderPools(filtered);
}

function handlePoolSearch() {
  const query = document.getElementById("poolQuery").value.toLowerCase();
  const requiredFeatures = [];
  if (query.includes("dive")) requiredFeatures.push("dive");
  if (query.includes("slide")) requiredFeatures.push("slide");
  if (query.includes("splash")) requiredFeatures.push("splash");
  if (query.includes("lap")) requiredFeatures.push("lap");

  const wantsOpen = query.includes("open") || query.includes("now") || query.includes("tonight") || query.includes("today");
  const wantsNearby = query.includes("near me") || query.includes("close by");

  let filtered = poolData.filter(pool => {
    if (wantsOpen && !pool.openNow) return false;
    for (let feat of requiredFeatures) {
      if (!pool.features.includes(feat)) return false;
    }
    return true;
  });

  if (wantsNearby && userCoords) {
    filtered.forEach(pool => {
      pool.distance = calcDistance(userCoords.lat, userCoords.lng, pool.lat, pool.lng);
    });
    filtered.sort((a, b) => a.distance - b.distance);
  }

  renderPools(filtered);
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

function describePools(pools) {
  if (!Array.isArray(pools)) return;

  if (pools.length === 0) {
    speak("No pools match your filters.");
  } else {
    const highlights = pools.slice(0, 3).map(p => p.name).join(", ");
    const phrase = `I found ${pools.length} pool${pools.length > 1 ? "s" : ""}. ${highlights} are nearby.`;
    speak(phrase);
  }
}
