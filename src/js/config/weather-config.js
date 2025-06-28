/**
 * Weather service configuration for National Weather Service API
 * No API key required - it's a free public service!
 */
const WeatherConfig = {
    // National Weather Service API requires no API key
    // This configuration file is kept for future extensibility
    
    /**
     * Check if weather service is enabled
     * @returns {boolean} Always true for National Weather Service
     */
    isEnabled() {
        return true;
    },
    
    /**
     * Get API configuration
     * @returns {Object} Configuration object
     */
    getConfig() {
        return {
            provider: 'National Weather Service',
            baseUrl: 'https://api.weather.gov',
            requiresApiKey: false
        };
    }
};

// Make available globally
window.WeatherConfig = WeatherConfig;
