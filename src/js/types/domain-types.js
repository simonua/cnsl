/**
 * Shared JSDoc contracts for annual data and the manager boundary.
 *
 * These declarations mirror the published JSON schemas while retaining the
 * legacy fields still accepted by the application. They intentionally contain
 * no runtime code.
 */

/** @typedef {'pools'|'teams'|'meets'} AnnualDataDomain */

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
 * @typedef {Object} PoolRecord
 * @property {string} [id]
 * @property {string} name
 * @property {string} [caUrl]
 * @property {string} scheduleUrl
 * @property {PoolLocation} [location]
 * @property {string} [address]
 * @property {string} [mapsQuery]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {number} laneCount
 * @property {'meters'|'yards'|null} laneLengthUnits
 * @property {number|null} laneLength
 * @property {string[]} features
 * @property {string[]} [amenities]
 * @property {boolean} [divingBoard]
 * @property {boolean} [babyPool]
 * @property {PoolScheduleRecord[]} schedules
 * @property {PoolScheduleRecord[]} [scheduleOverrides]
 * @property {Object} [hours]
 * @property {Object[]} [restrictions]
 * @property {Object[]} [specialEvents]
 * @property {string} [lastUpdated]
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
 * @property {string} [warmupTime]
 */

/**
 * @typedef {Object} HomeMeetGuide
 * @property {string} poolId
 * @property {Object} source
 * @property {Object} [general]
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
 * @property {string} [poolName] Legacy pool reference accepted by managers.
 * @property {string} [coach] Legacy coach value accepted by managers.
 * @property {string} [division] Legacy division value accepted by managers.
 * @property {Object[]} [roster] Legacy roster value accepted by managers.
 * @property {Object[]} [schedule] Legacy schedule value accepted by managers.
 * @property {string} [email] Legacy shared email accepted by managers.
 * @property {string} [phone] Legacy phone value accepted by managers.
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
 * @property {string} [homeTeam] Legacy home-team value accepted by managers.
 * @property {string} [awayTeam] Legacy away-team value accepted by managers.
 * @property {string} [homePool] Legacy home-pool value accepted by managers.
 * @property {string} [awayPool] Legacy away-pool value accepted by managers.
 * @property {string} [time] Legacy meet time accepted by managers.
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
 * @property {MeetRecord[]} [regular_meets]
 * @property {MeetRecord[]} [special_meets]
 * @property {MeetRecord[]} [meets] Legacy combined meet list accepted by managers.
 * @property {string} [lastUpdated]
 */

/**
 * @typedef {Object} SeasonInfo
 * @property {string} seasonStartDate
 * @property {string} seasonEndDate
 * @property {string} [caPoolDirectoryUrl]
 * @property {string} [caPoolGuideUrl]
 */
