// js/speech.js
function speak(text) {
  const utter = new SpeechSynthesisUtterance();
  utter.text = text.replace(/<\/?[^>]+(>|$)/g, " ");
  utter.lang = "en-US";
  utter.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

/**
 * Starts voice input for the copilot search
 * Uses the Web Speech API to recognize speech and fill the search box
 */
function startCopilotVoice() {
  // Check browser support for SpeechRecognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("Sorry, your browser doesn't support voice input.");
    return;
  }
  
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  // Update UI to show listening state
  const searchInput = document.getElementById("copilotQuery");
  if (searchInput) {
    const originalPlaceholder = searchInput.placeholder;
    searchInput.placeholder = "Listening...";
    
    // Listen for speech results
    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      searchInput.value = speechResult;
      searchInput.placeholder = originalPlaceholder;
      
      // Automatically perform search
      handleSearch();
    };
    
    // Handle end of speech input
    recognition.onend = () => {
      searchInput.placeholder = originalPlaceholder;
    };
    
    // Handle errors
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      searchInput.placeholder = originalPlaceholder;
    };
    
    // Start listening
    recognition.start();
  }
}
