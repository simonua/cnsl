let meetsData = []; // Avoid global variable name conflicts

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 */
function renderMeets(meets) {
  const list = document.getElementById("meetList");
  if (!list) return;
  
  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    list.innerHTML = "<p>No meet information available.</p>";
    return;
  }

  // Get current date for highlighting upcoming meets
  const currentDate = new Date();
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  
  // Sort meets by date
  const sortedMeets = [...meets].sort((a, b) => {
    // Assume meet.date is a string in a format that can be converted to Date
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateA - dateB;
  });

  // Group meets by month/date
  const meetsByDate = {};
  sortedMeets.forEach(meet => {
    if (!meet.date) return;
    
    const meetDate = new Date(meet.date);
    const dateKey = meetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    if (!meetsByDate[dateKey]) {
      meetsByDate[dateKey] = [];
    }
    meetsByDate[dateKey].push(meet);
  });

  // Generate HTML for meets grouped by date
  let html = '';
  
  Object.keys(meetsByDate).forEach(dateKey => {
    html += `<h3 class="meet-date">${dateKey}</h3>`;
    html += '<div class="meet-group">';
    
    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      const time = meet.time || 'TBA';
      let meetContent = '';
      
      // Check if meet is today or upcoming
      const meetDate = new Date(meet.date);
      const isToday = meetDate.toDateString() === today.toDateString();
      const isUpcoming = meetDate >= today;
      
      // Add appropriate CSS classes based on date
      let meetClasses = "meet-item";
      if (isToday) {
        meetClasses += " meet-today";
      } else if (isUpcoming) {
        meetClasses += " meet-upcoming";
      } else {
        meetClasses += " meet-past";
      }
      
      // Check if it's a special meet (has name property) or regular meet
      if (meet.name) {
        // Special meet format
        meetClasses += " special-meet";
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-name">${meet.name}</div>
            <div class="meet-details">
              <span class="meet-location">${location}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${isToday ? '<span class="today-tag">TODAY</span>' : ''}
          </div>
        `;
      } else {
        // Regular meet format
        const homeTeam = meet.home_team || 'TBA';
        const visitingTeam = meet.visiting_team || 'TBA';
        
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-teams">${visitingTeam} vs. ${homeTeam}</div>
            <div class="meet-details">
              <span class="meet-location">${location}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${isToday ? '<span class="today-tag">TODAY</span>' : ''}
          </div>
        `;
      }
      
      html += meetContent;
    });
    
    html += '</div>';
  });

  // If no meets have valid dates
  if (html === '') {
    html = "<p>No scheduled meets found.</p>";
  }

  list.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    console.log("Not on meets page, skipping meet data fetch");
    return;
  }
  
  fetch("assets/data/meets.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("Loaded meet data");
      meetsData = data;
      
      // Combine regular meets and special meets
      const allMeets = [
        ...(data.regular_meets || []), 
        ...(data.special_meets || [])
      ];
      
      console.log(`Processing ${allMeets.length} meets (${data.regular_meets?.length || 0} regular, ${data.special_meets?.length || 0} special)`);
      renderMeets(allMeets);
    })
    .catch(error => {
      console.error("Failed to load meet data:", error);
      const list = document.getElementById("meetList");
      if (list) {
        list.innerHTML = "<p>⚠️ Meet data is currently unavailable. Please try again later.</p>";
      }
    });
});
