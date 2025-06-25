let poolData = [];
let userCoords = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch("assets/data/pools.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      poolData = data;
      getUserLocation();
      renderPools(data);
    })
    .catch(error => {
      console.error("Failed to load pool data:", error);
      const list = document.getElementById("poolList");
      if (list) {
        list.innerHTML = "<p>⚠️ Pool data is currently unavailable. Please try again later.</p>";
      }
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
  // If pool data is not loaded yet, try to load it first
  if (!poolData || poolData.length === 0) {
    fetch("assets/data/pools.json")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        poolData = data;
        // Call handlePoolSearch again once data is loaded
        handlePoolSearch();
      })
      .catch(error => {
        console.error("Failed to load pool data:", error);
        const list = document.getElementById("poolList");
        if (list) {
          list.innerHTML = "<p>⚠️ Pool data is currently unavailable. Please try again later.</p>";
        }
      });
    return;
  }

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
  // Check if we already have a recognition instance running
  if (window.poolRecognitionActive) {
    console.log('Speech recognition already active');
    return;
  }
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Speech recognition is not supported in this browser. Please try Chrome or Edge.');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  window.poolRecognitionActive = true;
  
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    document.getElementById("poolQuery").value = e.results[0][0].transcript;
    handlePoolSearch();
  };
  recognition.onerror = e => {
    console.error("Speech recognition error:", e);
    alert('Speech recognition failed. Please try again or type your question.');
    window.poolRecognitionActive = false;
  };
  recognition.onend = () => {
    window.poolRecognitionActive = false;
  };
  recognition.start();
}

function describePools(pools) {
  // This function no longer uses speech synthesis
  return;
}
