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
   * Gets the correct path for pools.json
   * @returns {string} Full path to pools.json
   */
  static getPoolsDataPath() {
    return this.getDataBasePath() + 'pools.json';
  }

  /**
   * Gets the correct path for teams.json
   * @returns {string} Full path to teams.json
   */
  static getTeamsDataPath() {
    return this.getDataBasePath() + 'teams.json';
  }

  /**
   * Gets the correct path for meets.json
   * @returns {string} Full path to meets.json
   */
  static getMeetsDataPath() {
    return this.getDataBasePath() + 'meets.json';
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
    const year = new Date().getFullYear();
    return this.getDataBasePath() + `${year}/pool-schedules/`;
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
  //    UTILITY METHODS
  // ------------------------------

  /**
   * Logs the current environment and key paths for debugging
   */
  static logEnvironmentInfo() {
    console.log('🔧 FILE HELPER ENVIRONMENT INFO');
    console.log('================================');
    console.log(`Environment: ${this.getEnvironment()}`);
    console.log(`Data Base Path: ${this.getDataBasePath()}`);
    console.log(`Assets Base Path: ${this.getAssetsBasePath()}`);
    console.log(`JS Base Path: ${this.getJsBasePath()}`);
    console.log(`CSS Base Path: ${this.getCssBasePath()}`);
    console.log('Key Data Files:');
    console.log(`  - Pools: ${this.getPoolsDataPath()}`);
    console.log(`  - Teams: ${this.getTeamsDataPath()}`);
    console.log(`  - Meets: ${this.getMeetsDataPath()}`);
    
    // Debug environment detection factors
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const hasOutPath = pathname.includes('/out/');
    const hasBaseWithOut = document.querySelector('base[href*="/out/"]') !== null;
    const scriptTagsFromSrc = document.querySelectorAll('script[src*="src/js/"]').length;
    const linkTagsFromSrc = document.querySelectorAll('link[href*="src/css/"]').length;
    
    console.log('Environment Detection Factors:');
    console.log(`  - Hostname: ${hostname}`);
    console.log(`  - Pathname: ${pathname}`);
    console.log(`  - Has /out/ in path: ${hasOutPath}`);
    console.log(`  - Has base[href] with /out/: ${hasBaseWithOut}`);
    console.log(`  - Script tags from src/: ${scriptTagsFromSrc}`);
    console.log(`  - Link tags from src/: ${linkTagsFromSrc}`);
    console.log('================================\n');
  }

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

  /**
   * Tests if a file path is accessible
   * @param {string} filePath - The file path to test
   * @returns {Promise<boolean>} True if the file is accessible
   */
  static async testFilePath(filePath) {
    try {
      const response = await fetch(filePath, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`FileHelper: Cannot access ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Validates that all critical data files are accessible
   * @returns {Promise<Object>} Object with validation results
   */
  static async validateDataFiles() {
    const results = {
      pools: await this.testFilePath(this.getPoolsDataPath()),
      teams: await this.testFilePath(this.getTeamsDataPath()),
      meets: await this.testFilePath(this.getMeetsDataPath())
    };

    const allValid = Object.values(results).every(Boolean);
    
    return {
      ...results,
      allValid,
      environment: this.getEnvironment()
    };
  }
}

// ------------------------------
//    GLOBAL AVAILABILITY
// ------------------------------

// Make FileHelper available globally
if (typeof window !== 'undefined') {
  window.FileHelper = FileHelper;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileHelper;
}
