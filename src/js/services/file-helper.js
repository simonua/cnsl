/**
 * File Helper Utility
 * Provides static methods for resolving paths in the delivered application layout.
 *
 * @author Simon Kurtz
 * @version 1.0.0
 */

// ------------------------------
//    FILE HELPER CLASS
// ------------------------------

// Prevent multiple declarations
if (typeof globalThis.FileHelper === 'undefined') {
  /** Resolves delivered asset paths and loads JSON resources. */
  class FileHelper {

  // ------------------------------
  //    DATA FILE PATH RESOLUTION
  // ------------------------------

  /**
   * Gets the correct base path for data files
   * @returns {string} Base path for data files
   */
  static getDataBasePath() {
    return 'assets/data/';
  }

  /**
   * Gets the active season year used for published seasonal data.
   * @returns {number} Active season year
    * @throws {Error} When the application year configuration is unavailable
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
    return globalThis.ANNUAL_DATA_PATHS.pools;
  }

  /**
   * Gets the correct path for teams.json
   * @returns {string} Full path to teams.json
   */
  static getTeamsDataPath() {
    return globalThis.ANNUAL_DATA_PATHS.teams;
  }

  /**
   * Gets the correct path for meets.json
   * @returns {string} Full path to meets.json
   */
  static getMeetsDataPath() {
    return globalThis.ANNUAL_DATA_PATHS.meets;
  }

  /**
   * Gets the non-seasonal swim lesson provider directory path.
   * @returns {string} Full path to lessons.json
   */
  static getLessonsDataPath() {
    return this.getDataFilePath('lessons.json');
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
    return 'assets/';
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
    return 'js/';
  }

  /**
   * Gets the correct base path for CSS files
   * @returns {string} Base path for CSS files
   */
  static getCssBasePath() {
    return 'css/';
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
  //    FILE LOADING METHODS
  // ------------------------------

  /**
   * Load a JSON file from the delivered application layout.
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Promise that resolves with JSON data
   * @throws {Error} When the request fails or returns a non-success response
   */
  static async loadJsonFile(filePath) {
    try {
      const response = await fetch(filePath, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load ${filePath}: ${response.status} ${response.statusText}`);
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
      layout: 'delivered',
      basePaths: {
        data: this.getDataBasePath(),
        assets: this.getAssetsBasePath(),
        images: this.getImagesBasePath(),
        js: this.getJsBasePath(),
        css: this.getCssBasePath()
      },
      dataFiles: {
        lessons: this.getLessonsDataPath(),
        pools: this.getPoolsDataPath(),
        teams: this.getTeamsDataPath(),
        meets: this.getMeetsDataPath()
      },
      assetPaths: {
        favicons: this.getFaviconsBasePath(),
        teamLogos: this.getTeamLogosBasePath()
      }
    };
  }

  }

  globalThis.FileHelper = FileHelper;
}
