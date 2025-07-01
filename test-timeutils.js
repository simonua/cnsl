// Load the TimeUtils class
const TimeUtils = require('./src/js/services/time-utils.js');

console.log('🧪 Testing Enhanced TimeUtils...');
console.log('');

// Test basic functionality
try {
  const easternTime = TimeUtils.getEasternTime();
  console.log('✅ getEasternTime():', easternTime.toISOString());
} catch (error) {
  console.log('❌ getEasternTime() failed:', error.message);
}

// Test time conversion
try {
  const minutes = TimeUtils.timeStringToMinutes('2:30PM');
  console.log('✅ timeStringToMinutes("2:30PM"):', minutes);
  
  const timeStr = TimeUtils.minutesToTimeString(minutes);
  console.log('✅ minutesToTimeString(' + minutes + '):', timeStr);
} catch (error) {
  console.log('❌ Time conversion failed:', error.message);
}

// Test edge cases
try {
  console.log('');
  console.log('🔬 Testing Edge Cases:');
  
  // Test midnight conversions
  const midnight = TimeUtils.timeStringToMinutes('12:00AM');
  console.log('✅ Midnight (12:00AM):', midnight + ' minutes');
  
  // Test noon conversions  
  const noon = TimeUtils.timeStringToMinutes('12:00PM');
  console.log('✅ Noon (12:00PM):', noon + ' minutes');
  
  // Test time slot checking
  const isCurrentSlot = TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', 600, true);
  console.log('✅ isCurrentTimeSlot(9:00AM-5:00PM, 10:00AM):', isCurrentSlot);
  
  // Test overnight time slots
  const isOvernightSlot = TimeUtils.isCurrentTimeSlot('11:00PM', '6:00AM', 60, true);
  console.log('✅ isCurrentTimeSlot(11:00PM-6:00AM, 1:00AM):', isOvernightSlot);
  
} catch (error) {
  console.log('❌ Edge case testing failed:', error.message);
}

// Test time info
try {
  const timeInfo = TimeUtils.getCurrentEasternTimeInfo();
  console.log('');
  console.log('✅ getCurrentEasternTimeInfo():');
  console.log('   Date:', timeInfo.date);
  console.log('   Day:', timeInfo.day);
  console.log('   Minutes:', timeInfo.minutes);
  console.log('   Timezone:', timeInfo.timezone);
  console.log('   Valid:', timeInfo.isValid);
} catch (error) {
  console.log('❌ getCurrentEasternTimeInfo() failed:', error.message);
}

// Test HTML formatting
try {
  console.log('');
  console.log('🎨 Testing HTML Formatting:');
  
  const basicFormat = TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false);
  console.log('✅ Basic format:', basicFormat);
  
  const highlightedFormat = TimeUtils.formatTimeRangeWithHighlight(
    '9:00AM-5:00PM', 
    true, 
    600, 
    { color: 'green' }, 
    false
  );
  console.log('✅ Highlighted format:', highlightedFormat);
  
} catch (error) {
  console.log('❌ HTML formatting failed:', error.message);
}

// Run self-validation
try {
  console.log('');
  console.log('🔍 Running Self-Validation...');
  const validationResults = TimeUtils.validateSelf();
  console.log('Overall Success:', validationResults.success);
  console.log('Tests Passed:', validationResults.tests.filter(t => t.success).length + '/' + validationResults.tests.length);
  
  if (validationResults.errors.length > 0) {
    console.log('Errors found:');
    validationResults.errors.forEach(error => console.log('  -', error));
  }
  
  if (validationResults.warnings.length > 0) {
    console.log('Warnings found:');
    validationResults.warnings.forEach(warning => console.log('  -', warning));
  }
  
} catch (error) {
  console.log('❌ Self-validation failed:', error.message);
}

console.log('');
console.log('🎉 TimeUtils testing completed!');
