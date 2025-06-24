// js/speech.js
function speak(text) {
  const utter = new SpeechSynthesisUtterance();
  utter.text = text.replace(/<\/?[^>]+(>|$)/g, " ");
  utter.lang = "en-US";
  utter.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}
