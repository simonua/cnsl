(function initializeAnalyticsInteractionType(globalScope) {
  'use strict';

  const AnalyticsInteractionType = Object.freeze({
    BANNER: 'banner',
    DIRECTORY_DETAIL_OPEN: 'directory_detail_open',
    EXTERNAL_LINK: 'external_link',
    FIXED_SETTING_CHANGE: 'fixed_setting_change',
    INSTALL: 'install',
    PUBLISHED_SETTING_CHANGE: 'published_setting_change',
    RESOURCE: 'resource',
    SHARE: 'share'
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsInteractionType };
  } else {
    globalScope.AnalyticsInteractionType = AnalyticsInteractionType;
  }
}(typeof window !== 'undefined' ? window : globalThis));