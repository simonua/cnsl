/**
 * Shared JSDoc contracts for annual data and the manager boundary.
 *
 * These declarations mirror the published JSON schemas and contain no runtime code.
 */

/** @typedef {'pools'|'teams'|'meets'} AnnualDataDomain */

/** @typedef {'cash'|'credit'|'other'|'paypal'|'venmo'} PaymentMethodValue */

/**
 * @typedef {Object} PoolLocation
 * @property {string} street
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {number} lat
 * @property {number} lng
 * @property {string} mapsQuery
 * @property {string} googleMapsUrl
 */

/**
 * @typedef {Object} PoolHoursRecord
 * @property {string[]} weekDays
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {string|string[]} [types]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} PoolScheduleRecord
 * @property {string} startDate
 * @property {string} endDate
 * @property {PoolHoursRecord[]} hours
 * @property {string} [reason]
 */

/**
 * @typedef {Object} PoolFeatureOverrideEvidence
 * @property {'maintainer'|'official-source'} type
 * @property {string} [observedOn]
 * @property {string} officialSourceCheckedOn
 * @property {string} [sourceUrl]
 * @property {string} note
 */

/**
 * @typedef {Object} PoolFeatureOverride
 * @property {string} feature
 * @property {'add'|'remove'} action
 * @property {PoolFeatureOverrideEvidence} evidence
 */

/**
 * @typedef {Object} PoolRecord
 * @property {string} [id]
 * @property {string} name
 * @property {string} [caUrl]
 * @property {string} scheduleUrl
 * @property {PoolLocation} [location]
 * @property {string} [phone]
 * @property {number} laneCount
 * @property {'meters'|'yards'|null} laneLengthUnits
 * @property {number|null} laneLength
 * @property {string[]} features
 * @property {PoolFeatureOverride[]} [featureOverrides]
 * @property {PoolScheduleRecord[]} schedules
 * @property {PoolScheduleRecord[]} [scheduleOverrides]
 */

/**
 * @typedef {Object} PoolsDocument
 * @property {string} seasonStartDate
 * @property {string} seasonEndDate
 * @property {string} [caPoolDirectoryUrl]
 * @property {string} [caPoolGuideUrl]
 * @property {PoolRecord[]} pools
 * @property {string} [lastUpdated]
 */

/**
 * @typedef {Object} StaffMemberRecord
 * @property {string} name
 * @property {string} role
 * @property {string} [email]
 */

/**
 * @typedef {Object} StaffContactRecord
 * @property {'coaches'|'managers'} audience
 * @property {string} label
 * @property {string} email
 */

/**
 * @typedef {Object} TeamStaffRecord
 * @property {string} sourceUrl
 * @property {string} verifiedOn
 * @property {StaffMemberRecord[]} coaches
 * @property {StaffMemberRecord[]} managers
 * @property {StaffContactRecord[]} contacts
 * @property {string} [note]
 */

/**
 * @typedef {Object} HomeMeetRoleGuide
 * @property {string} [arrivalTime]
 * @property {string} [arrivalGuidance]
 * @property {string[]} [parkingNotes]
 * @property {string} [warmupTime]
 */

/**
 * @typedef {Object} HomeMeetGuide
 * @property {string} poolId
 * @property {Object} source
 * @property {{concessions?: {paymentMethods?: PaymentMethodValue[]}, parkingNotes?: string[]}} [general]
 * @property {HomeMeetRoleGuide|null} homeTeam
 * @property {HomeMeetRoleGuide|null} visitingTeam
 */

/**
 * @typedef {Object} TeamRecord
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string[]} keywords
 * @property {string} url
 * @property {string} [resultsUrl]
 * @property {string} [calendarUrl]
 * @property {string} eventsSubscriptionUrl
 * @property {string} merchandiseUrl
 * @property {string[]} homePools
 * @property {string} timeTrialsPool
 * @property {{dualMeets?: MeetTimingWindow, timeTrials?: MeetTimingWindow}} [meetTimeOverrides]
 * @property {HomeMeetGuide[]} [homeMeetGuides]
 * @property {string[]} practicePools
 * @property {TeamStaffRecord} staff
 * @property {Object} [practice]
 */

/**
 * @typedef {Object} TeamsDocument
 * @property {TeamRecord[]} teams
 * @property {string} [lastUpdated]
 */

/**
 * @typedef {Object} MeetRecord
 * @property {string} date
 * @property {string} [name]
 * @property {string} [location]
 * @property {string} [home_team]
 * @property {string} [visiting_team]
 * @property {'timeTrials'} [timeWindowKey]
 */

/**
 * @typedef {Object} MeetTimingWindow
 * @property {string} start Time in 24-hour `HH:mm` format.
 * @property {string} end Time in 24-hour `HH:mm` format.
 * @property {string} [relayCheckInDeadline] Relay check-in deadline in 24-hour `HH:mm` format.
 * @property {string} [firstSwimTime] First event time in 24-hour `HH:mm` format.
 */

/**
 * @typedef {Object} MeetsDocument
 * @property {string} [url]
 * @property {{dualMeets: MeetTimingWindow, timeTrials: MeetTimingWindow}} meetTimes
 * @property {MeetRecord[]} regular_meets
 * @property {MeetRecord[]} special_meets
 * @property {string} [lastUpdated]
 */

/**
 * @typedef {Object} SeasonInfo
 * @property {string} seasonStartDate
 * @property {string} seasonEndDate
 * @property {string} [caPoolDirectoryUrl]
 * @property {string} [caPoolGuideUrl]
 */
