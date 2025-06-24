function handleSearch() {
  const input = document.getElementById("copilotQuery").value.toLowerCase();
  const output = document.getElementById("copilotResponse");

  if (!input.trim()) {
    output.innerHTML = "<p>Please ask something like a team name or meet day.</p>";
    return;
  }

  if (input.includes("barracudas") && input.includes("practice")) {
    output.innerHTML = "<p><strong>Barracudas</strong> practice at Clemens Crossing Pool – Mon, Wed, Fri at 7:00 AM.</p>";
  } else {
    output.innerHTML = "<p>I’m still learning! Try rephrasing or browse the <a href='faq.html'>FAQs</a>.</p>";
  }
}

function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Your browser doesn't support speech recognition.");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = function (event) {
    document.getElementById("copilotQuery").value = event.results[0][0].transcript;
    handleSearch();
  };

  recognition.start();
}
