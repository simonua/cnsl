/**
 * Weather service for retrieving forecasts using the National Weather Service API
 */
class WeatherService {
    
    // ------------------------------
    //    CONSTANTS
    // ------------------------------
    
    static BASE_URL = 'https://api.weather.gov';
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
    
    
    // ------------------------------
    //    VARIABLES
    // ------------------------------
    
    static isInitialized = false;
    static lastError = null;
    
    
    // ------------------------------
    //    PRIVATE METHODS
    // ------------------------------
    
    /**
     * Helper function to extract address for weather API from pool object
     * @param {Object} pool - Pool object (either format)
     * @returns {string} - Address string for weather API
     */
    static getPoolAddressForWeather(pool) {
        if (pool.location) {
            // New location format - use full address
            const addressParts = [];
            if (pool.location.street) addressParts.push(pool.location.street);
            if (pool.location.city || pool.location.state || pool.location.zip) {
                const city = pool.location.city || '';
                const state = pool.location.state || '';
                const zip = pool.location.zip || '';
                const cityStateZip = (city + ', ' + state + ' ' + zip).trim();
                addressParts.push(cityStateZip);
            }
            return addressParts.join(', ');
        } else if (pool.address) {
            // Legacy format
            return pool.address;
        }
        return '';
    }

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
            console.log('🌦️ Making request to:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn(`🌦️ Weather API request failed: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const data = await response.json();
            console.log('🌦️ API response received successfully');
            return data;
        } catch (error) {
            console.warn('🌦️ Weather API request error:', error.message);
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
            '21044': { lat: 39.2151, lng: -76.8736 },
            '21045': { lat: 39.1851, lng: -76.8610 },
            '21046': { lat: 39.2300, lng: -76.8800 }
        };
        
        return zipCoordinates[zipCode] || { 
            lat: WeatherService.COLUMBIA_MD_LAT, 
            lng: WeatherService.COLUMBIA_MD_LNG 
        };
    }
    
    /**
     * Get coordinates for a zip code (hard-coded for Columbia, MD area)
     * @param {string} zipCode - 5-digit zip code
     * @returns {Object|null} Coordinates object or null
     */
    static _getCoordinatesForZip(zipCode) {
        // Columbia, MD area zip codes with precise coordinates
        // Using centralized coordinates for each zip code to reduce API calls
        const zipCoordinates = {
            '21044': { lat: 39.2044301, lng: -76.885809 },   // Bryant Woods, Phelps Luck area
            '21045': { lat: 39.2077365, lng: -76.8266841 },  // Kendall Ridge area  
            '21046': { lat: 39.1730865, lng: -76.8397082 }   // General Columbia area
        };
        
        const coords = zipCoordinates[zipCode];
        if (coords) {
            console.log(`🌦️ Using zip code ${zipCode} coordinates: ${coords.lat}, ${coords.lng}`);
            return coords;
        }
        
        console.warn(`🌦️ Unknown zip code: ${zipCode}, using default Columbia coordinates`);
        return { 
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
            console.warn('🌦️ No zip code found in pool address:', poolAddress);
            return null;
        }
        
        return await WeatherService.getForecastForZip(zipCode, targetDate);
    }
    
    /**
     * Get weather forecast for coordinates (backward compatibility)
     * This method converts coordinates to zip code for efficiency
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Date} targetDate - Date to get forecast for
     * @returns {Promise<Object|null>} Weather forecast or null
     */
    static async getForecastForCoordinates(lat, lng, targetDate = new Date()) {
        if (!lat || !lng) {
            console.warn('🌦️ Invalid coordinates:', lat, lng);
            return null;
        }
        
        // Map coordinates to zip codes for efficiency
        // Find the closest zip code match
        let closestZip = '21044'; // Default
        let minDistance = Infinity;
        
        const zipCoords = {
            '21044': { lat: 39.2044301, lng: -76.885809 },
            '21045': { lat: 39.2077365, lng: -76.8266841 },
            '21046': { lat: 39.1730865, lng: -76.8397082 }
        };
        
        for (const [zipCode, coords] of Object.entries(zipCoords)) {
            const distance = Math.sqrt(
                Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestZip = zipCode;
            }
        }
        
        console.log(`🌦️ Converting coordinates ${lat}, ${lng} to zip code ${closestZip} for efficient caching`);
        return await WeatherService.getForecastForZip(closestZip, targetDate);
    }
    
    /**
     * Get weather forecast for a zip code using optimized zip-based caching
     * @param {string} zipCode - 5-digit zip code
     * @param {Date} targetDate - Date to get forecast for
     * @returns {Promise<Object|null>} Weather forecast or null
     */
    static async getForecastForZip(zipCode, targetDate = new Date()) {
        if (!zipCode || zipCode.length !== 5) {
            console.warn('🌦️ Invalid zip code:', zipCode);
            return null;
        }
        
        // Use zip code and date for cache key (more efficient than lat/lng)
        const cacheKey = `weather_${zipCode}_${targetDate.toISOString().split('T')[0]}`;
        
        // Check cache first
        const cached = CacheService.get(cacheKey);
        if (cached) {
            console.log(`🌦️ Using cached weather data for zip code ${zipCode}`);
            return cached;
        }
        
        try {
            console.log(`🌦️ Getting weather for zip code: ${zipCode}`);
            
            // Get coordinates for this zip code
            const coordinates = WeatherService._getCoordinatesForZip(zipCode);
            if (!coordinates) {
                console.warn(`🌦️ No coordinates available for zip code: ${zipCode}`);
                return null;
            }
            
            // Step 1: Get grid information from coordinates
            const pointsUrl = `${WeatherService.BASE_URL}/points/${coordinates.lat},${coordinates.lng}`;
            const pointsData = await WeatherService._makeRequest(pointsUrl);
            
            if (!pointsData || !pointsData.properties) {
                console.warn('🌦️ No grid data received from points API');
                return null;
            }
            
            console.log('🌦️ Grid data received, getting forecast...');
            
            // Step 2: Get forecast using the forecast URL from grid data
            const forecastUrl = pointsData.properties.forecast;
            const forecastData = await WeatherService._makeRequest(forecastUrl);
            
            if (!forecastData || !forecastData.properties || !forecastData.properties.periods) {
                console.warn('🌦️ No forecast data received');
                return null;
            }
            
            console.log('🌦️ Forecast data received, processing...');
            
            // Step 3: Find forecast for target date
            const forecast = WeatherService._findForecastForDate(
                forecastData.properties.periods, 
                targetDate
            );
            
            if (forecast) {
                // Add location information
                forecast.zipCode = zipCode;
                forecast.coordinates = coordinates;
                forecast.generatedAt = new Date().toISOString();
                
                // Cache the result using zip code key
                CacheService.set(cacheKey, forecast, WeatherService.CACHE_EXPIRY_MINUTES);
                
                console.log(`🌦️ Weather forecast cached for zip code ${zipCode}:`, forecast.shortForecast, forecast.temperature + '°' + forecast.temperatureUnit);
                return forecast;
            }
            
            console.warn('🌦️ No forecast found for target date');
            return null;
        } catch (error) {
            console.warn('🌦️ Weather service error:', error);
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
                const isUpcoming = meetDate >= now && meetDate <= sevenDaysFromNow;
                if (isUpcoming) {
                    console.log('🌦️ Found upcoming meet:', meet.name, 'on', meet.date, 'at', meet.location);
                }
                return isUpcoming;
            } catch (error) {
                return false;
            }
        });
        
        console.log('🌦️ Processing', upcomingMeets.length, 'upcoming meets for weather');
        
        const meetsWithWeather = [];
        
        for (const meet of upcomingMeets) {
            try {
                let pool = poolsManager.getPool(meet.location);
                
                // If exact match fails, try removing "Pool" suffix for fallback
                if (!pool && meet.location.endsWith(' Pool')) {
                    const poolNameWithoutSuffix = meet.location.replace(' Pool', '');
                    console.log('🌦️ Trying fallback pool name:', poolNameWithoutSuffix);
                    pool = poolsManager.getPool(poolNameWithoutSuffix);
                }
                
                const poolAddress = WeatherService.getPoolAddressForWeather(pool);
                
                if (pool && poolAddress) {
                    console.log('🌦️ Getting weather for', meet.location, 'at address:', poolAddress);
                    const meetDate = new Date(meet.date);
                    let forecast;
                    
                    try {
                        forecast = await WeatherService.getForecastForPool(poolAddress, meetDate);
                        if (forecast) {
                            console.log('🌦️ Weather retrieved:', forecast.shortForecast, forecast.temperature + '°' + forecast.temperatureUnit);
                        }
                    } catch (error) {
                        console.warn('🌦️ Weather API failed:', error.message);
                        forecast = null;
                    }
                    meetsWithWeather.push({
                        ...meet,
                        weather: forecast
                    });
                } else {
                    console.log('🌦️ No pool found or address available for:', meet.location);
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
                            const poolAddress = WeatherService.getPoolAddressForWeather(pool);
                            const forecast = await WeatherService.getForecastForPool(poolAddress, practiceDate);
                            
                            practicesWithWeather.push({
                                poolName: pool.name,
                                poolAddress: poolAddress,
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
            // Test with 21045 zip code coordinates
            const coords = WeatherService._getCoordinatesForZip('21045');
            const testUrl = `${WeatherService.BASE_URL}/points/${coords.lat},${coords.lng}`;
            const response = await WeatherService._makeRequest(testUrl);
            return response !== null;
        } catch (error) {
            return false;
        }
    }
}
