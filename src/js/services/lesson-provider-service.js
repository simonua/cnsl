/**
 * Validates maintained lesson-provider records for safe directory rendering.
 */
if (typeof globalThis.LessonProviderService === 'undefined') {
  /** Validates and normalizes lesson-provider directory data. */
  class LessonProviderService {
    /**
     * Validate and copy provider logo metadata.
     * @param {Object} logo - Candidate logo record
     * @returns {Object} Normalized logo metadata
     * @throws {Error} When the logo record is invalid
     */
    static normalizeLogo(logo) {
      if (!logo || typeof logo !== 'object'
        || !/^assets\/images\/provider-logos\/[a-z0-9-]+\.(?:png|jpg)$/.test(logo.src)
        || !Number.isInteger(logo.width) || logo.width < 1
        || !Number.isInteger(logo.height) || logo.height < 1) {
        throw new Error('Invalid lesson directory logo.');
      }
      return { src: logo.src, width: logo.width, height: logo.height };
    }

    /**
     * Normalize an absolute HTTPS URL.
     * @param {*} value - Candidate URL
     * @returns {string} Normalized URL, or an empty string when invalid
     */
    static normalizeHttpsUrl(value) {
      try {
        const url = new URL(String(value));
        return url.protocol === 'https:' ? url.href : '';
      } catch (_error) {
        return '';
      }
    }

    /**
     * Normalize all lesson providers in a directory document.
     * @param {Object} documentData - Candidate lesson directory document
     * @returns {Array} Normalized provider records
     * @throws {Error} When the document is invalid
     */
    static normalizeDocument(documentData) {
      if (!documentData || !Array.isArray(documentData.providers)) {
        throw new Error('Invalid lesson provider data response.');
      }

      return documentData.providers.map(provider => LessonProviderService.normalizeProvider(provider));
    }

    /**
     * Validate and normalize one lesson provider.
     * @param {Object} provider - Candidate provider record
     * @returns {Object} Normalized provider record
     * @throws {Error} When the provider is invalid
     */
    static normalizeProvider(provider) {
      if (!provider || typeof provider !== 'object') {
        throw new Error('Invalid lesson provider record.');
      }

      const requiredStrings = ['id', 'name', 'websiteUrl', 'sourceUrl', 'reviewedOn'];
      const websiteUrl = LessonProviderService.normalizeHttpsUrl(provider.websiteUrl);
      const sourceUrl = LessonProviderService.normalizeHttpsUrl(provider.sourceUrl);
      const contactUrl = provider.contactUrl ? LessonProviderService.normalizeHttpsUrl(provider.contactUrl) : '';
      const hasContactName = typeof provider.contactName === 'string' && provider.contactName.trim() !== '';
      const hasContactEmail = typeof provider.contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.contactEmail);
      if (requiredStrings.some(field => typeof provider[field] !== 'string' || provider[field].trim() === '')
        || !websiteUrl
        || !sourceUrl
        || (provider.contactUrl && !contactUrl)
        || (hasContactName !== hasContactEmail)
        || (provider.phone && !/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(provider.phone))
        || !Array.isArray(provider.classTypes)
        || provider.classTypes.length === 0
        || provider.classTypes.some(classType => typeof classType !== 'string' || classType.trim() === '')) {
        throw new Error('Invalid lesson provider record.');
      }

      return {
        id: provider.id,
        name: provider.name,
        logo: LessonProviderService.normalizeLogo(provider.logo),
        websiteUrl,
        contactUrl,
        contactName: hasContactName ? provider.contactName : '',
        contactEmail: hasContactEmail ? provider.contactEmail : '',
        phone: typeof provider.phone === 'string' ? provider.phone : '',
        classTypes: [...provider.classTypes],
        sourceUrl,
        reviewedOn: provider.reviewedOn
      };
    }

    /**
     * Validate and normalize related aquatic programs.
     * @param {Object} documentData - Candidate lesson directory document
     * @returns {Array} Normalized related programs
     * @throws {Error} When a program record is invalid
     */
    static normalizeRelatedPrograms(documentData) {
      if (!documentData || !Array.isArray(documentData.relatedPrograms)) {
        throw new Error('Invalid related swimming program data response.');
      }

      return documentData.relatedPrograms.map(program => {
        const requiredStrings = [
          'id',
          'name',
          'programType',
          'websiteUrl',
          'informationUrl',
          'eligibility',
          'practiceSetting',
          'summerLeagueFit',
          'sourceUrl',
          'reviewedOn'
        ];
        const websiteUrl = LessonProviderService.normalizeHttpsUrl(program && program.websiteUrl);
        const informationUrl = LessonProviderService.normalizeHttpsUrl(program && program.informationUrl);
        const sourceUrl = LessonProviderService.normalizeHttpsUrl(program && program.sourceUrl);
        if (!program || requiredStrings.some(field => typeof program[field] !== 'string' || program[field].trim() === '')
          || !websiteUrl || !informationUrl || !sourceUrl
          || !Array.isArray(program.highlights)
          || program.highlights.length === 0
          || program.highlights.some(highlight => typeof highlight !== 'string' || highlight.trim() === '')) {
          throw new Error('Invalid related swimming program record.');
        }

        return {
          ...program,
          logo: LessonProviderService.normalizeLogo(program.logo),
          highlights: [...program.highlights],
          websiteUrl,
          informationUrl,
          sourceUrl
        };
      });
    }

    /**
     * Validate and normalize outdoor swim programs against published pools.
     * @param {Object} documentData - Candidate lesson directory document
     * @param {Array} pools - Published pool records
     * @returns {Object} Normalized outdoor swim program data
     * @throws {Error} When program or location data is invalid
     */
    static normalizeOutdoorSwimPrograms(documentData, pools) {
      const programs = documentData && documentData.outdoorSwimPrograms;
      const availablePools = Array.isArray(pools) ? pools : [];
      const poolNames = new Map(availablePools.map(pool => [pool.id, pool.name]));
      const sourceUrl = LessonProviderService.normalizeHttpsUrl(programs && programs.sourceUrl);
      const registrationUrl = LessonProviderService.normalizeHttpsUrl(programs && programs.registrationUrl);
      const alternativeUrl = LessonProviderService.normalizeHttpsUrl(programs && programs.alternative && programs.alternative.url);
      const validText = value => typeof value === 'string' && value.trim() !== '';
      if (!programs || !sourceUrl || !registrationUrl || !alternativeUrl
        || !validText(programs.reviewedOn) || !validText(programs.weatherPolicy)
        || !programs.alternative || !validText(programs.alternative.name)
        || !Array.isArray(programs.bring) || programs.bring.length === 0 || programs.bring.some(item => !validText(item))
        || !Array.isArray(programs.options) || programs.options.length === 0) {
        throw new Error('Invalid outdoor swim program data response.');
      }

      const options = programs.options.map(option => {
        if (!option || !validText(option.name) || !validText(option.schedule) || !validText(option.cadence)
          || !Array.isArray(option.locations) || option.locations.length === 0) {
          throw new Error('Invalid outdoor swim program option.');
        }
        const locations = option.locations.map(location => {
          if (!location || !poolNames.has(location.poolId) || !validText(location.days)) {
            throw new Error('Invalid outdoor swim program location.');
          }
          return { poolId: location.poolId, poolName: poolNames.get(location.poolId), days: location.days };
        });
        return { name: option.name, schedule: option.schedule, cadence: option.cadence, locations };
      });

      return {
        sourceUrl,
        registrationUrl,
        reviewedOn: programs.reviewedOn,
        options,
        bring: [...programs.bring],
        weatherPolicy: programs.weatherPolicy,
        alternative: { name: programs.alternative.name, url: alternativeUrl }
      };
    }
  }

  globalThis.LessonProviderService = LessonProviderService;
}
