(function initializeAnalyticsInteractionType(globalScope) {
  'use strict';

  /** @type {Readonly<Record<string, string>>} */
  const AnalyticsInteractionType = Object.freeze({
    BANNER: 'banner',
    DIRECTORY_DETAIL_OPEN: 'directory_detail_open',
    EXPERIMENTAL_FEATURE_CHANGE: 'experimental_feature_change',
    EXTERNAL_LINK: 'external_link',
    FIXED_SETTING_CHANGE: 'fixed_setting_change',
    INSTALL: 'install',
    PUBLISHED_SETTING_CHANGE: 'published_setting_change',
    RESOURCE: 'resource',
    SHARE: 'share'
  });

  /** @type {Readonly<Record<string, string>>} */
  const AnalyticsExternalLinkPurpose = Object.freeze({
    GENERAL: 'general',
    MERCHANDISE: 'merchandise',
    POOL_PAGE: 'pool_page',
    POOL_SCHEDULE: 'pool_schedule',
    PROVIDER_CONTACT: 'provider_contact',
    PROVIDER_RECOMMENDATION: 'provider_recommendation',
    PROVIDER_WEBSITE: 'provider_website',
    RELATED_PROGRAM: 'related_program'
  });

  globalScope.AnalyticsExternalLinkPurpose = AnalyticsExternalLinkPurpose;
  globalScope.AnalyticsInteractionType = AnalyticsInteractionType;
}(globalThis));
