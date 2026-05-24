/**
 * File Helper Utility
 * Provides static methods for resolving correct file paths in both development and production environments
 * 
 * @author Simon Kurtz
 * @version 1.0.0
 */

// ------------------------------
//    FILE HELPER CLASS
// ------------------------------

if (typeof module !== 'undefined' && module.exports && typeof globalThis.YEAR === 'undefined') {
  require('../config/app-config.js');
}

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.FileHelper) {
  class FileHelper {
  
  // ------------------------------
  //    ENVIRONMENT DETECTION
  // ------------------------------

  /**
   * Determines if the application is running in development mode
   * @returns {boolean} True if in development mode
   */
  static isDevelopmentMode() {
    // Check for localhost/127.0.0.1 which is almost always development
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // When running the development server (npm start/npm run dev:watch),
      // files are served from the /out directory with a production-like structure
      return false; // Consider localhost as production-like structure for paths
    }
    
    // Check if we're running from a built application (out directory)
    // Built apps should NEVER use src/ paths
    const pathname = window.location.pathname;
    if (pathname.includes('/out/') || document.querySelector('base[href*="/out/"]')) {
      return false; // Built application
    }
    
    // Check if we have any script tags loading from src/ directory
    // This indicates we're in development with direct src/ file serving
    const scriptTags = document.querySelectorAll('script[src*="src/js/"]');
    if (scriptTags.length > 0) {
      return true; // Development mode with src/ structure
    }
    
    // Check if we have any link tags loading from src/ directory
    const linkTags = document.querySelectorAll('link[href*="src/css/"]');
    if (linkTags.length > 0) {
      return true; // Development mode with src/ structure
    }
    
    // Default to production mode for any other case
    return false;
  }

  /**
   * Determines if the application is running in production mode
   * @returns {boolean} True if in production mode
   */
  static isProductionMode() {
    return !this.isDevelopmentMode();
  }

  /**
   * Gets the current environment type
   * @returns {string} 'development' or 'production'
   */
  static getEnvironment() {
    return this.isDevelopmentMode() ? 'development' : 'production';
  }

  // ------------------------------
  //    DATA FILE PATH RESOLUTION
  // ------------------------------

  /**
   * Gets the correct base path for data files
   * @returns {string} Base path for data files
   */
  static getDataBasePath() {
    if (this.isDevelopmentMode()) {
      return 'src/assets/data/';
    } else {
      return 'assets/data/';
    }
  }

  /**
   * Gets the active season year used for published seasonal data.
   * @returns {number} Active season year
   */
  static getSeasonYear() {
    if (typeof globalThis.YEAR !== 'number') {
      throw new Error('Application YEAR configuration is not loaded.');
    }

    return globalThis.YEAR;
  }

  /**
   * Gets the correct base path for seasonal domain data.
   * @param {string} domain - Seasonal data domain (e.g., 'pools')
   * @returns {string} Base path for the domain data
   */
  static getSeasonDataBasePath(domain) {
    return this.getDataBasePath() + `${this.getSeasonYear()}/${domain}/`;
  }

  /**
   * Gets the correct path for pools.json
   * @returns {string} Full path to pools.json
   */
  static getPoolsDataPath() {
    return this.getSeasonDataBasePath('pools') + 'pools.json';
  }

  /**
   * Gets the correct path for teams.json
   * @returns {string} Full path to teams.json
   */
  static getTeamsDataPath() {
    return this.getSeasonDataBasePath('teams') + 'teams.json';
  }

  /**
   * Gets the correct path for meets.json
   * @returns {string} Full path to meets.json
   */
  static getMeetsDataPath() {
    return this.getSeasonDataBasePath('meets') + 'meets.json';
  }

  /**
   * Gets the correct path for any data file
   * @param {string} filename - The data file name (e.g., 'pools.json')
   * @returns {string} Full path to the data file
   */
  static getDataFilePath(filename) {
    return this.getDataBasePath() + filename;
  }

  // ------------------------------
  //    ASSET PATH RESOLUTION
  // ------------------------------

  /**
   * Gets the correct base path for assets
   * @returns {string} Base path for assets
   */
  static getAssetsBasePath() {
    if (this.isDevelopmentMode()) {
      return 'src/assets/';
    } else {
      return 'assets/';
    }
  }

  /**
   * Gets the correct path for images
   * @returns {string} Base path for images
   */
  static getImagesBasePath() {
    return this.getAssetsBasePath() + 'images/';
  }

  /**
   * Gets the correct path for favicons
   * @returns {string} Base path for favicons
   */
  static getFaviconsBasePath() {
    return this.getAssetsBasePath() + 'favicons/';
  }

  /**
   * Gets the correct path for any image file
   * @param {string} filename - The image file name
   * @returns {string} Full path to the image file
   */
  static getImagePath(filename) {
    return this.getImagesBasePath() + filename;
  }

  /**
   * Gets the correct path for team logos
   * @returns {string} Base path for team logos
   */
  static getTeamLogosBasePath() {
    return this.getImagesBasePath() + 'logos/';
  }

  /**
   * Gets the correct path for a team logo
   * @param {string} filename - The logo file name
   * @returns {string} Full path to the team logo
   */
  static getTeamLogoPath(filename) {
    return this.getTeamLogosBasePath() + filename;
  }

  // ------------------------------
  //    SCRIPT AND STYLE PATH RESOLUTION
  // ------------------------------

  /**
   * Gets the correct base path for JavaScript files
   * @returns {string} Base path for JS files
   */
  static getJsBasePath() {
    if (this.isDevelopmentMode()) {
      return 'src/js/';
    } else {
      return 'js/';
    }
  }

  /**
   * Gets the correct base path for CSS files
   * @returns {string} Base path for CSS files
   */
  static getCssBasePath() {
    if (this.isDevelopmentMode()) {
      return 'src/css/';
    } else {
      return 'css/';
    }
  }

  /**
   * Gets the correct path for any JavaScript file
   * @param {string} filename - The JS file name
   * @returns {string} Full path to the JS file
   */
  static getJsPath(filename) {
    return this.getJsBasePath() + filename;
  }

  /**
   * Gets the correct path for any CSS file
   * @param {string} filename - The CSS file name
   * @returns {string} Full path to the CSS file
   */
  static getCssPath(filename) {
    return this.getCssBasePath() + filename;
  }

  // ------------------------------
  //    DOCUMENT PATH RESOLUTION
  // ------------------------------

  /**
   * Gets the correct path for pool schedule PDFs
   * @returns {string} Base path for pool schedule PDFs
   */
  static getPoolSchedulesBasePath() {
    return this.getSeasonDataBasePath('pools') + 'pool-schedules/';
  }

  /**
   * Gets the correct path for a pool schedule PDF
   * @param {string} filename - The PDF file name
   * @returns {string} Full path to the pool schedule PDF
   */
  static getPoolSchedulePath(filename) {
    return this.getPoolSchedulesBasePath() + filename;
  }

  // ------------------------------
  //    FILE LOADING METHODS
  // ------------------------------

  /**
   * Load a JSON file with proper path resolution
   * @param {string} filePath - Path to the JSON file (will be resolved based on environment)
   * @returns {Promise<Object>} Promise that resolves with JSON data
   */
  static async loadJsonFile(filePath) {
    try {
      // If the path starts with 'assets/', resolve it properly for the current environment
      let resolvedPath = filePath;
      if (filePath.startsWith('assets/data/')) {
        const filename = filePath.replace('assets/data/', '');
        resolvedPath = this.getDataFilePath(filename);
      } else if (filePath.startsWith('assets/')) {
        // Handle other asset paths
        if (this.isDevelopmentMode()) {
          resolvedPath = 'src/' + filePath;
        }
        // In production mode, keep the path as-is
      }

      const response = await fetch(resolvedPath);
      if (!response.ok) {
        throw new Error(`Failed to load ${resolvedPath}: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`FileHelper.loadJsonFile: Error loading ${filePath}:`, error);
      throw error;
    }
  }

  // ------------------------------
  //    UTILITY METHODS
  // ------------------------------

  /**
   * Gets all key file paths for the application
   * @returns {Object} Object containing all important file paths
   */
  static getAllPaths() {
    return {
      environment: this.getEnvironment(),
      basePaths: {
        data: this.getDataBasePath(),
        assets: this.getAssetsBasePath(),
        images: this.getImagesBasePath(),
        js: this.getJsBasePath(),
        css: this.getCssBasePath()
      },
      dataFiles: {
        pools: this.getPoolsDataPath(),
        teams: this.getTeamsDataPath(),
        meets: this.getMeetsDataPath()
      },
      assetPaths: {
        favicons: this.getFaviconsBasePath(),
        teamLogos: this.getTeamLogosBasePath(),
        poolSchedules: this.getPoolSchedulesBasePath()
      }
    };
  }

  }

  // Make FileHelper available globally
  if (typeof window !== 'undefined') {
    window.FileHelper = FileHelper;
  }

  // Export for Node.js compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHelper;
  }
}
