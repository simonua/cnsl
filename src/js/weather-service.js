/**
 * Weather service for retrieving forecasts using the National Weather Service API
 */
class WeatherService {
    
    // ------------------------------
    //    CONSTANTS
    // ------------------------------
    
    static BASE_URL = 'https://api.weather.gov';
    static DEFAULT_USER_AGENT = 'CNSL-Swimming-App/1.0 (simonkurtz@gmail.com)';
    static CACHE_EXPIRY_MINUTES = 30;
    static COLUMBIA_MD_LAT = 39.2014;
    static COLUMBIA_MD_LNG = -76.8610;
    
    
    // ------------------------------
    //    VARIABLES
    // ------------------------------
    
    static isInitialized = false;
    static lastError = null;
    
    
    // ------------------------------
    //    PRIVATE METHODS
    // ------------------------------
    
    /**
     * Extract zip code from address string
     * @param {string} address - Full address string
     * @returns {string|null} Zip code or null if not found
     */
    static _extractZipCode(address) {
        if (!address) return null;
        
        const zipMatch = address.match(/\b(\d{5})\b/);
        return zipMatch ? zipMatch[1] : null;
    }
    
    /**
     * Make API request with error handling
     * @param {string} url - API endpoint URL
     * @returns {Promise<Object|null>} Response data or null on error
     */
    static async _makeRequest(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': WeatherService.DEFAULT_USER_AGENT,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn(`Weather API request failed: ${response.status} ${response.statusText}`);
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.warn('Weather API request error:', error.message);
            WeatherService.lastError = error;
            return null;
        }
    }
    
    /**
     * Get coordinates for a zip code (simplified lookup)
     * @param {string} zipCode - 5-digit zip code
     * @returns {Object|null} Coordinates object or null
     */
    static _getCoordinatesForZip(zipCode) {
        // Columbia, MD area zip codes with approximate coordinates
        const zipCoordinates = {
            '21044': { lat: 39.2151, lng: -76.8736 }, // Bryant Woods area
            '21045': { lat: 39.1851, lng: -76.8610 }, // Thunder Hill area
            '21046': { lat: 39.2300, lng: -76.8800 }, // Clarksville area
            '21043': { lat: 39.2300, lng: -76.8300 }, // Ellicott City area
        };
        
        return zipCoordinates[zipCode] || { 
            lat: WeatherService.COLUMBIA_MD_LAT, 
            lng: WeatherService.COLUMBIA_MD_LNG 
        };
    }
    
    /**
     * Parse forecast periods for relevant days
     * @param {Array} periods - Forecast periods from API
     * @param {Date} targetDate - Date to find forecast for
     * @returns {Object|null} Relevant forecast period or null
     */
    static _findForecastForDate(periods, targetDate) {
        if (!periods || !Array.isArray(periods)) return null;
        
        const targetDateString = targetDate.toISOString().split('T')[0];
        
        for (const period of periods) {
            try {
                const periodDate = new Date(period.startTime);
                const periodDateString = periodDate.toISOString().split('T')[0];
                
                if (periodDateString === targetDateString) {
                    return {
                        name: period.name,
                        temperature: period.temperature,
                        temperatureUnit: period.temperatureUnit,
                        shortForecast: period.shortForecast,
                        detailedForecast: period.detailedForecast,
                        windSpeed: period.windSpeed,
                        windDirection: period.windDirection,
                        isDaytime: period.isDaytime,
                        icon: period.icon
                    };
                }
            } catch (error) {
                console.warn('Error parsing forecast period:', error);
            }
        }
        
        return null;
    }
    
    
    // ------------------------------
    //    PUBLIC METHODS
    // ------------------------------
    
    /**
     * Initialize the weather service
     */
    static initialize() {
        WeatherService.isInitialized = true;
        WeatherService.lastError = null;
        
        // Clean up expired cache entries on initialization
        CacheService.cleanup();
    }
    
    /**
     * Get weather forecast for a pool location
     * @param {string} poolAddress - Pool address string
     * @param {Date} targetDate - Date to get forecast for
     * @returns {Promise<Object|null>} Weather forecast or null
     */
    static async getForecastForPool(poolAddress, targetDate = new Date()) {
        if (!WeatherService.isInitialized) {
            WeatherService.initialize();
        }
        
        const zipCode = WeatherService._extractZipCode(poolAddress);
        if (!zipCode) {
            console.warn('No zip code found in pool address:', poolAddress);
            return null;
        }
        
        return await WeatherService.getForecastForZip(zipCode, targetDate);
    }
    
    /**
     * Get weather forecast for a zip code
     * @param {string} zipCode - 5-digit zip code
     * @param {Date} targetDate - Date to get forecast for
     * @returns {Promise<Object|null>} Weather forecast or null
     */
    static async getForecastForZip(zipCode, targetDate = new Date()) {
        if (!zipCode || zipCode.length !== 5) {
            console.warn('Invalid zip code:', zipCode);
            return null;
        }
        
        const cacheKey = `weather_${zipCode}_${targetDate.toISOString().split('T')[0]}`;
        
        // Check cache first
        const cached = CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const coordinates = WeatherService._getCoordinatesForZip(zipCode);
            const pointsUrl = `${WeatherService.BASE_URL}/points/${coordinates.lat},${coordinates.lng}`;
            
            // Get grid information
            const pointsData = await WeatherService._makeRequest(pointsUrl);
            if (!pointsData || !pointsData.properties) {
                return null;
            }
            
            // Get forecast
            const forecastUrl = pointsData.properties.forecast;
            const forecastData = await WeatherService._makeRequest(forecastUrl);
            if (!forecastData || !forecastData.properties || !forecastData.properties.periods) {
                return null;
            }
            
            // Find forecast for target date
            const forecast = WeatherService._findForecastForDate(
                forecastData.properties.periods, 
                targetDate
            );
            
            if (forecast) {
                // Add location information
                forecast.zipCode = zipCode;
                forecast.coordinates = coordinates;
                forecast.generatedAt = new Date().toISOString();
                
                // Cache the result
                CacheService.set(cacheKey, forecast, WeatherService.CACHE_EXPIRY_MINUTES);
                
                return forecast;
            }
            
            return null;
        } catch (error) {
            console.warn('Weather service error:', error);
            WeatherService.lastError = error;
            return null;
        }
    }
    
    /**
     * Get weather forecasts for upcoming meets within the next 7 days
     * @param {Array} meets - Array of meet objects
     * @param {Object} poolsManager - PoolsManager instance for pool lookups
     * @returns {Promise<Array>} Array of meet objects with weather data
     */
    static async getForecastsForUpcomingMeets(meets, poolsManager) {
        if (!meets || !Array.isArray(meets) || !poolsManager) {
            return [];
        }
        
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);
        
        const upcomingMeets = meets.filter(meet => {
            try {
                const meetDate = new Date(meet.date);
                return meetDate >= now && meetDate <= sevenDaysFromNow;
            } catch (error) {
                return false;
            }
        });
        
        const meetsWithWeather = [];
        
        for (const meet of upcomingMeets) {
            try {
                const pool = poolsManager.getPool(meet.location);
                if (pool && pool.address) {
                    const meetDate = new Date(meet.date);
                    const forecast = await WeatherService.getForecastForPool(pool.address, meetDate);
                    
                    meetsWithWeather.push({
                        ...meet,
                        weather: forecast
                    });
                } else {
                    meetsWithWeather.push(meet);
                }
            } catch (error) {
                console.warn('Error getting weather for meet:', meet, error);
                meetsWithWeather.push(meet);
            }
        }
        
        return meetsWithWeather;
    }
    
    /**
     * Get weather forecasts for upcoming practices within the next 7 days
     * @param {Array} pools - Array of pool objects with practice schedules
     * @returns {Promise<Array>} Array of practice objects with weather data
     */
    static async getForecastsForUpcomingPractices(pools) {
        if (!pools || !Array.isArray(pools)) {
            return [];
        }
        
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);
        
        const practicesWithWeather = [];
        
        for (const pool of pools) {
            if (!pool.schedules || !Array.isArray(pool.schedules)) {
                continue;
            }
            
            for (const schedule of pool.schedules) {
                try {
                    const startDate = new Date(schedule.startDate);
                    const endDate = new Date(schedule.endDate);
                    
                    // Check if schedule overlaps with next 7 days
                    if (startDate <= sevenDaysFromNow && endDate >= now) {
                        const practiceDate = new Date(Math.max(startDate.getTime(), now.getTime()));
                        
                        if (practiceDate <= sevenDaysFromNow) {
                            const forecast = await WeatherService.getForecastForPool(pool.address, practiceDate);
                            
                            practicesWithWeather.push({
                                poolName: pool.name,
                                poolAddress: pool.address,
                                schedule: schedule,
                                practiceDate: practiceDate.toISOString().split('T')[0],
                                weather: forecast
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Error getting weather for practice:', pool.name, error);
                }
            }
        }
        
        return practicesWithWeather;
    }
    
    /**
     * Get last error information
     * @returns {Error|null} Last error or null
     */
    static getLastError() {
        return WeatherService.lastError;
    }
    
    /**
     * Clear the last error
     */
    static clearLastError() {
        WeatherService.lastError = null;
    }
    
    /**
     * Check if service is available (basic connectivity test)
     * @returns {Promise<boolean>} True if service is available
     */
    static async isServiceAvailable() {
        try {
            const testUrl = `${WeatherService.BASE_URL}/points/${WeatherService.COLUMBIA_MD_LAT},${WeatherService.COLUMBIA_MD_LNG}`;
            const response = await WeatherService._makeRequest(testUrl);
            return response !== null;
        } catch (error) {
            return false;
        }
    }
}
