/**
 * Cache service for managing localStorage with expiration
 */
class CacheService {
    
    // ------------------------------
    //    CONSTANTS
    // ------------------------------
    
    static CACHE_PREFIX = 'cnsl_cache_';
    static DEFAULT_EXPIRY_MINUTES = 30;
    
    
    // ------------------------------
    //    PUBLIC METHODS
    // ------------------------------
    
    /**
     * Store data in cache with expiration
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     * @param {number} expiryMinutes - Minutes until expiration (default: 30)
     */
    static set(key, data, expiryMinutes = CacheService.DEFAULT_EXPIRY_MINUTES) {
        try {
            const cacheKey = CacheService.CACHE_PREFIX + key;
            const expiryTime = new Date().getTime() + (expiryMinutes * 60 * 1000);
            
            const cacheItem = {
                data: data,
                expiry: expiryTime,
                created: new Date().toISOString()
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
        } catch (error) {
            console.warn('Cache: Failed to store data', error);
        }
    }
    
    /**
     * Retrieve data from cache if not expired
     * @param {string} key - Cache key
     * @returns {*|null} Cached data or null if expired/not found
     */
    static get(key) {
        try {
            const cacheKey = CacheService.CACHE_PREFIX + key;
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) {
                return null;
            }
            
            const cacheItem = JSON.parse(cached);
            const now = new Date().getTime();
            
            if (now > cacheItem.expiry) {
                CacheService.remove(key);
                return null;
            }
            
            return cacheItem.data;
        } catch (error) {
            console.warn('Cache: Failed to retrieve data', error);
            return null;
        }
    }
    
    /**
     * Remove item from cache
     * @param {string} key - Cache key
     */
    static remove(key) {
        try {
            const cacheKey = CacheService.CACHE_PREFIX + key;
            localStorage.removeItem(cacheKey);
        } catch (error) {
            console.warn('Cache: Failed to remove data', error);
        }
    }
    
    /**
     * Clear all cache entries
     */
    static clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CacheService.CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Cache: Failed to clear cache', error);
        }
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    static getStats() {
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(CacheService.CACHE_PREFIX));
            
            let totalSize = 0;
            let expiredCount = 0;
            const now = new Date().getTime();
            
            cacheKeys.forEach(key => {
                const value = localStorage.getItem(key);
                totalSize += value.length;
                
                try {
                    const cacheItem = JSON.parse(value);
                    if (now > cacheItem.expiry) {
                        expiredCount++;
                    }
                } catch (e) {
                    expiredCount++;
                }
            });
            
            return {
                totalItems: cacheKeys.length,
                expiredItems: expiredCount,
                totalSizeBytes: totalSize
            };
        } catch (error) {
            console.warn('Cache: Failed to get stats', error);
            return {
                totalItems: 0,
                expiredItems: 0,
                totalSizeBytes: 0
            };
        }
    }
    
    /**
     * Clean up expired cache entries
     */
    static cleanup() {
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(CacheService.CACHE_PREFIX));
            const now = new Date().getTime();
            
            cacheKeys.forEach(key => {
                try {
                    const value = localStorage.getItem(key);
                    const cacheItem = JSON.parse(value);
                    
                    if (now > cacheItem.expiry) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Cache: Failed to cleanup', error);
        }
    }
}
