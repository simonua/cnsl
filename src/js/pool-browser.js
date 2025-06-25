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
