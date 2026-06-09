/**
 * Validates maintained lesson-provider records for safe directory rendering.
 */
if (typeof window === 'undefined' || !window.LessonProviderService) {
  class LessonProviderService {
    static normalizeLogo(logo) {
      if (!logo || typeof logo !== 'object'
        || !/^assets\/images\/provider-logos\/[a-z0-9-]+\.(?:png|jpg)$/.test(logo.src)
        || !Number.isInteger(logo.width) || logo.width < 1
        || !Number.isInteger(logo.height) || logo.height < 1) {
        throw new Error('Invalid lesson directory logo.');
      }
      return { src: logo.src, width: logo.width, height: logo.height };
    }

    static normalizeHttpsUrl(value) {
      try {
        const url = new URL(String(value));
        return url.protocol === 'https:' ? url.href : '';
      } catch (_error) {
        return '';
      }
    }

    static normalizeDocument(documentData) {
      if (!documentData || !Array.isArray(documentData.providers)) {
        throw new Error('Invalid lesson provider data response.');
      }

      return documentData.providers.map(provider => LessonProviderService.normalizeProvider(provider));
    }

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
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = LessonProviderService;
  if (typeof window !== 'undefined') window.LessonProviderService = LessonProviderService;
}
