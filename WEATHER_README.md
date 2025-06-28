# Weather Service Integration

This document describes the weather service implementation for the CNSL Pool Assistant application.

## Overview

The weather service provides weather forecasts for upcoming meets and practices using the National Weather Service API. It includes automatic caching and graceful error handling.

## Files Added

### 1. `src/js/services/cache-service.js`
A general-purpose caching service using localStorage with expiration capabilities.

**Features:**
- 30-minute default cache expiration
- Automatic cleanup of expired entries
- Error handling for localStorage issues
- Cache statistics and management

**Key Methods:**
- `CacheService.set(key, data, expiryMinutes)` - Store data with expiration
- `CacheService.get(key)` - Retrieve non-expired data
- `CacheService.remove(key)` - Remove specific cache entry
- `CacheService.clear()` - Clear all cache entries
- `CacheService.cleanup()` - Remove expired entries

### 2. `src/js/services/weather-service.js`
Weather forecast service using the National Weather Service API.

**Features:**
- Fetches weather forecasts for zip codes
- Integrates with pools data for location lookup
- 30-minute caching of API responses
- Graceful fallback for API errors/throttling
- Columbia, MD area zip code mapping

**Key Methods:**
- `WeatherService.getForecastForPool(poolAddress, targetDate)` - Get forecast for pool location
- `WeatherService.getForecastForZip(zipCode, targetDate)` - Get forecast for specific zip code
- `WeatherService.getForecastsForUpcomingMeets(meets, poolsManager)` - Get forecasts for upcoming meets
- `WeatherService.isServiceAvailable()` - Check API connectivity

## Integration Points

### Meets Browser (`src/js/meets-browser.js`)
- Modified `renderMeets()` function to be async
- Automatically fetches weather for upcoming meets (next 7 days)
- Displays weather information with icons and temperature
- Weather display is hidden for past meets

### Styling (`src/css/styles.css`)
Added weather-specific CSS classes:
- `.weather-info` - Main weather container
- `.weather-icon` - Weather emoji/icon display
- `.weather-temp` - Temperature display
- `.weather-condition` - Weather description
- `.weather-wind` - Wind information
- Responsive design for mobile devices

### HTML Layout (`src/views/layouts/base.html`)
Added script includes for services in the correct dependency order:
- `services/file-helper.js` (core file utilities)
- `services/time-utils.js` (time/date utilities)
- `services/cache-service.js` (caching functionality)
- `services/weather-service.js` (weather API integration)
- `types/pool-enums.js` (type definitions)
- `services/data-manager.js` (data coordination)
- `services/speech.js` (speech/accessibility features)
- `services/search-engine.js` (search functionality)

## Usage

### Automatic Integration
Weather forecasts are automatically displayed for:
- Meets occurring within the next 7 days
- Only for upcoming/future meets (not past meets)

### Manual Usage
```javascript
// Initialize the service
WeatherService.initialize();

// Get forecast for a specific zip code
const forecast = await WeatherService.getForecastForZip('21044', new Date());

// Get forecast for a pool
const forecast = await WeatherService.getForecastForPool('10451 Green Mountain Cir, Columbia, MD 21044', new Date());

// Check if service is available
const available = await WeatherService.isServiceAvailable();
```

## Error Handling

The weather service includes comprehensive error handling:

1. **API Unavailable**: Service degrades gracefully, no weather info shown
2. **Network Errors**: Cached data used when available
3. **Rate Limiting**: Requests are throttled and cached
4. **Invalid Data**: Malformed responses are handled safely
5. **CORS Issues**: Service fails silently without breaking the app

## API Details

### National Weather Service API
- **Base URL**: `https://api.weather.gov`
- **User Agent**: Required for all requests
- **Rate Limits**: Respectful usage, caching prevents excessive requests
- **Coverage**: US locations only

### Data Flow
1. Extract zip code from pool address
2. Get coordinates for zip code (using built-in lookup)
3. Query NWS points API for grid information
4. Fetch forecast from grid forecast endpoint
5. Parse and cache forecast data
6. Display relevant forecast period

## Testing

A test page is included at `weather-test.html` to verify:
- Cache service functionality
- Weather service initialization
- API connectivity
- Forecast retrieval

To test:
1. Build the project: `npm run build`
2. Serve locally: `npm run serve`
3. Navigate to `/weather-test.html`

## Configuration

### Zip Code Mapping
Columbia, MD area zip codes are mapped to coordinates in `WeatherService._getCoordinatesForZip()`:
- 21044: Bryant Woods area
- 21045: Thunder Hill area  
- 21046: Clarksville area
- 21043: Ellicott City area

### Cache Settings
- Default expiration: 30 minutes
- Storage: localStorage
- Automatic cleanup on initialization

### Weather Icons
Weather conditions are mapped to emoji icons in `getWeatherIcon()`:
- ☀️ Sunny/Clear
- ⛅ Partly Cloudy
- ☁️ Cloudy/Overcast
- 🌧️ Rain/Showers
- ⛈️ Thunderstorms
- ❄️ Snow
- 🌫️ Fog/Mist
- 🌤️ Default

## Future Enhancements

Potential improvements:
1. **Practice Weather**: Extend to show weather for practice schedules
2. **Extended Forecasts**: Show multi-day forecasts for meets
3. **Weather Alerts**: Display severe weather warnings
4. **Pool Conditions**: Integrate with pool operating decisions based on weather
5. **Historical Data**: Track weather patterns for planning
6. **User Preferences**: Allow users to enable/disable weather display

## Dependencies

- **localStorage**: Required for caching
- **fetch API**: Required for weather API calls
- **CacheService**: Required dependency for WeatherService
- **PoolsManager**: Required for pool address lookup

## Browser Support

- Modern browsers with fetch API support
- localStorage support required
- CORS-compliant environment for API access

## Security Considerations

- No API keys required (public NWS API)
- No personal data stored
- Cache data is client-side only
- Graceful degradation when API unavailable

## File Organization

The project now follows a well-organized structure with clear separation of concerns:

### Core Services (`src/js/services/`)
- **cache-service.js** - Local storage caching with expiration
- **data-manager.js** - Coordinates all data managers and provides unified access
- **file-helper.js** - File system utilities and path resolution
- **search-engine.js** - Cross-data search functionality
- **speech.js** - Speech recognition and text-to-speech features
- **time-utils.js** - Date/time utilities for scheduling
- **weather-service.js** - Weather API integration and forecasting

### Data Models (`src/js/models/`)
- **pool.js** - Pool class definition and core pool functionality

### Type Definitions (`src/js/types/`)
- **pool-enums.js** - Pool-related constants, enums, and type definitions

### Business Logic (`src/js/`)
- **pool-schedule.js** - Pool scheduling logic
- **pools-manager.js** - Pool data management
- **teams-manager.js** - Team data management
- **meets-manager.js** - Meet/event data management

### UI Components (`src/js/`)
- **copilot.js** - AI assistant functionality
- **meets-browser.js** - Meet browsing and display
- **navigation.js** - Site navigation logic
- **pool-browser.js** - Pool browsing and display
- **teams-browser.js** - Team browsing and display

This organization provides better separation of concerns and makes the codebase more maintainable.
