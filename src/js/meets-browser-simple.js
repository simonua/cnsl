// Simple test version to debug meets display issue

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    console.log("Not on meets page, skipping meet data fetch");
    return;
  }

  const meetList = document.getElementById("meetList");
  
  try {
    console.log("🔄 SIMPLE TEST: Loading meets data...");
    
    // Load meets data directly
    const response = await fetch('assets/data/meets.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("📋 SIMPLE TEST: Meets data loaded:", data);
    
    let allMeets = [];
    if (data.regular_meets) {
      console.log("📅 SIMPLE TEST: Regular meets found:", data.regular_meets.length);
      allMeets = [...data.regular_meets];
    }
    if (data.special_meets) {
      console.log("🎯 SIMPLE TEST: Special meets found:", data.special_meets.length);
      allMeets = [...allMeets, ...data.special_meets];
    }
    
    console.log(`✅ SIMPLE TEST: Found ${allMeets.length} total meets`);
    
    // Simple render - just display first 5 meets without any date filtering
    let html = '<div style="padding: 1rem; background: #f0f0f0; margin-bottom: 1rem;">SIMPLE TEST MODE - Showing first 5 meets</div>';
    
    const meetsToShow = allMeets.slice(0, 5);
    console.log('🎯 SIMPLE TEST: Showing these meets:', meetsToShow);
    
    meetsToShow.forEach((meet, index) => {
      const location = meet.location || 'TBA';
      const time = meet.time || '8:00 AM - 12:00 PM';
      const homeTeam = meet.home_team || 'Home Team';
      const visitingTeam = meet.visiting_team || 'Visiting Team';
      const meetName = meet.name || `Meet ${index + 1}`;
      
      html += `
        <div style="border: 1px solid #ddd; margin: 1rem 0; padding: 1rem; background: white;">
          <h3>${meetName} - ${meet.date}</h3>
          <p><strong>Teams:</strong> ${homeTeam} vs ${visitingTeam}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Time:</strong> ${time}</p>
        </div>
      `;
    });
    
    console.log('🎯 SIMPLE TEST: Generated HTML length:', html.length);
    console.log('🎯 SIMPLE TEST: Setting innerHTML...');
    meetList.innerHTML = html;
    console.log('✅ SIMPLE TEST: innerHTML set successfully');
    
  } catch (error) {
    console.error("❌ SIMPLE TEST: Error loading meets:", error);
    meetList.innerHTML = "<p>⚠️ SIMPLE TEST: Meet data is currently unavailable. Please try again later.</p>";
  }
});
