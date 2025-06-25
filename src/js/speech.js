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
  const voiceButton = document.querySelector('button[onclick="startCopilotVoice()"]');
  
  if (searchInput && voiceButton) {
    const originalPlaceholder = searchInput.placeholder;
    const originalButtonContent = voiceButton.innerHTML;
    
    // Visual feedback for listening state
    searchInput.placeholder = "🎙️ Listening...";
    voiceButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    `;
    voiceButton.style.backgroundColor = '#ff4444';
    voiceButton.style.color = 'white';
    
    // Listen for speech results
    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      searchInput.value = speechResult;
      
      // Reset UI
      searchInput.placeholder = originalPlaceholder;
      voiceButton.innerHTML = originalButtonContent;
      voiceButton.style.backgroundColor = '';
      voiceButton.style.color = '';
      
      // Automatically perform search
      setTimeout(() => handleSearch(), 500);
    };
    
    // Handle end of speech input
    recognition.onend = () => {
      searchInput.placeholder = originalPlaceholder;
      voiceButton.innerHTML = originalButtonContent;
      voiceButton.style.backgroundColor = '';
      voiceButton.style.color = '';
    };
    
    // Handle errors
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      searchInput.placeholder = originalPlaceholder;
      voiceButton.innerHTML = originalButtonContent;
      voiceButton.style.backgroundColor = '';
      voiceButton.style.color = '';
      
      // Show user-friendly error message
      if (event.error === 'not-allowed') {
        alert('Please allow microphone access to use voice search.');
      } else if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      }
    };
    
    // Start listening
    recognition.start();
  }
}
