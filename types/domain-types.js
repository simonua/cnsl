/**
 * Design-time JSDoc contracts for active annual data and manager boundaries.
 * These declarations mirror the published schemas and are never delivered to browsers.
 */

/** @typedef {'pools'|'teams'|'meets'} AnnualDataDomain */

/** @typedef {'cash'|'credit'|'other'|'paypal'|'venmo'} PaymentMethodValue */

/**
 * @typedef {Object} PoolScheduleSourceUpdate
 * @property {string} sourceName
 * @property {string} updatedOn
 * @property {string} note
 */

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
 * @property {string[]} types
 * @property {string} accessStatus
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {string} [notes]
 * @property {string} [sourceUrl]
 * @property {PoolScheduleSourceUpdate} [sourceUpdate]
 */

/**
 * @typedef {Object} PoolScheduleRecord
 * @property {string} startDate
 * @property {string} endDate
 * @property {PoolHoursRecord[]} hours
 */

/**
 * @typedef {Object} PoolScheduleOverrideRecord
 * @property {string} startDate
 * @property {string} endDate
 * @property {PoolHoursRecord[]} hours
 * @property {'overlay'|'replace-day'} [overrideMode]
 * @property {string} reason
 */

/**
 * @typedef {Object} PoolFeatureOverrideEvidence
 * @property {'maintainer'|'official-source'} type
 * @property {string} officialSourceCheckedOn
 * @property {string} note
 * @property {string} [observedOn]
 * @property {string} [sourceUrl]
 */

/**
 * @typedef {Object} PoolFeatureOverride
 * @property {string} feature
 * @property {'add'|'remove'} action
 * @property {PoolFeatureOverrideEvidence} evidence
 */

/**
 * @typedef {Object} PoolRecord
 * @property {string} id
 * @property {string} name
 * @property {string} caUrl
 * @property {PoolLocation} location
 * @property {string[]} features
 * @property {number} laneCount
 * @property {'meters'|'yards'|null} laneLengthUnits
 * @property {number|null} laneLength
 * @property {string} scheduleUrl
 * @property {PoolScheduleRecord[]} schedules
 * @property {PoolFeatureOverride[]} [featureOverrides]
 * @property {PoolScheduleOverrideRecord[]} [scheduleOverrides]
 * @property {string} [phone]
 */

/**
 * @typedef {Object} PoolsDocument
 * @property {string} seasonStartDate
 * @property {string} seasonEndDate
 * @property {string} caPoolDirectoryUrl
 * @property {string} caPoolGuideUrl
 * @property {PoolRecord[]} pools
 */

/**
 * @typedef {Object} MeetTimingWindow
 * @property {string} start Time in 24-hour `HH:mm` format.
 * @property {string} end Time in 24-hour `HH:mm` format.
 */

/**
 * @typedef {Object} DualMeetTimingWindow
 * @property {string} start Time in 24-hour `HH:mm` format.
 * @property {string} end Time in 24-hour `HH:mm` format.
 * @property {string} relayCheckInDeadline Relay check-in deadline in 24-hour `HH:mm` format.
 * @property {string} firstSwimTime First event time in 24-hour `HH:mm` format.
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
 * @typedef {Object} HomeMeetGuideSource
 * @property {'host-team-manager'|'visiting-team-manager'} type
 * @property {string} receivedOn
 */

/**
 * @typedef {Object} HomeMeetRoleGuide
 * @property {string} [arrivalTime]
 * @property {string} [arrivalGuidance]
 * @property {string[]} [parkingNotes]
 * @property {string} [familySetupLocation]
 * @property {string} [clerkGuidance]
 * @property {string} [checkInGuidance]
 * @property {string} [volunteerCheckInLocation]
 * @property {string} [swimmerCheckInLocation]
 * @property {string} [warmupTime]
 * @property {string[]} [helpfulNotes]
 */

/**
 * @typedef {Object} HomeMeetDietaryOption
 * @property {'allergy-friendly'|'gluten-free'|'other'|'vegan'|'vegetarian'} type
 * @property {'available'|'by-request'|'limited'} availability
 */

/**
 * @typedef {Object} HomeMeetConcessions
 * @property {string} [opensAt]
 * @property {PaymentMethodValue[]} [paymentMethods]
 * @property {number[]} [denominationsNotAccepted]
 * @property {string[]} [foodItems]
 * @property {string[]} [mealItems]
 * @property {string[]} [snackItems]
 * @property {string[]} [drinkItems]
 * @property {HomeMeetDietaryOption[]} [dietaryOptions]
 * @property {string[]} [notes]
 */

/**
 * @typedef {Object} HomeMeetGeneralGuide
 * @property {string[]} [parkingNotes]
 * @property {string[]} [poolsideConditions]
 * @property {string[]} [helpfulNotes]
 * @property {HomeMeetConcessions} [concessions]
 */

/**
 * @typedef {Object} HomeMeetGuide
 * @property {string} poolId
 * @property {HomeMeetGuideSource} source
 * @property {HomeMeetGeneralGuide} [general]
 * @property {HomeMeetRoleGuide|null} homeTeam
 * @property {HomeMeetRoleGuide|null} visitingTeam
 */

/**
 * @typedef {Object} TeamBoosterRecord
 * @property {string} name
 * @property {string} url
 */

/**
 * @typedef {Object} PracticeSessionRecord
 * @property {string} time
 * @property {string} group
 */

/**
 * @typedef {Object} PreseasonPracticeRecord
 * @property {string} period
 * @property {string} days
 * @property {string} location
 * @property {PracticeSessionRecord[]} sessions
 * @property {string} [address]
 */

/**
 * @typedef {Object} MorningPracticeRecord
 * @property {string} days
 * @property {string} location
 * @property {PracticeSessionRecord[]} sessions
 * @property {string} [address]
 */

/**
 * @typedef {Object} EveningPracticeRecord
 * @property {string} day
 * @property {string} location
 * @property {PracticeSessionRecord[]} sessions
 * @property {string} [address]
 */

/**
 * @typedef {Object} RegularPracticeRecord
 * @property {string} season
 * @property {MorningPracticeRecord[]} morning
 * @property {EveningPracticeRecord[]} evening
 */

/**
 * @typedef {Object} SimplePracticeSessionRecord
 * @property {string} day
 * @property {string} time
 * @property {string} location
 */

/**
 * @typedef {Object} DetailedPracticeRecord
 * @property {string} url
 * @property {PreseasonPracticeRecord[]} [preseason]
 * @property {RegularPracticeRecord} [regular]
 * @property {SimplePracticeSessionRecord[]} [sessions]
 */

/**
 * @typedef {Object} TeamRecord
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string[]} keywords
 * @property {string} url
 * @property {string} eventsSubscriptionUrl
 * @property {string} merchandiseUrl
 * @property {string[]} homePools
 * @property {string} timeTrialsPool
 * @property {string[]} practicePools
 * @property {TeamStaffRecord} staff
 * @property {string} [resultsUrl]
 * @property {string} [calendarUrl]
 * @property {TeamBoosterRecord} [booster]
 * @property {{dualMeets?: MeetTimingWindow, timeTrials?: MeetTimingWindow}} [meetTimeOverrides]
 * @property {HomeMeetGuide[]} [homeMeetGuides]
 * @property {DetailedPracticeRecord} [practice]
 */

/**
 * @typedef {Object} TeamsDocument
 * @property {TeamRecord[]} teams
 */

/**
 * @typedef {Object} RegularMeetRecord
 * @property {string} date
 * @property {string} visiting_team
 * @property {string} home_team
 * @property {string} location
 * @property {string} [name]
 */

/**
 * @typedef {Object} SpecialMeetRecord
 * @property {string} date
 * @property {string} name
 * @property {string} location
 * @property {'timeTrials'} [timeWindowKey]
 */

/**
 * @typedef {Object} MeetRecord
 * @property {string} date
 * @property {string} location
 * @property {string} [name]
 * @property {string} [visiting_team]
 * @property {string} [home_team]
 * @property {'timeTrials'} [timeWindowKey]
 */

/**
 * @typedef {Object} MeetsDocument
 * @property {string} url
 * @property {{dualMeets: DualMeetTimingWindow, timeTrials: MeetTimingWindow}} meetTimes
 * @property {RegularMeetRecord[]} regular_meets
 * @property {SpecialMeetRecord[]} special_meets
 */

/**
 * @typedef {Object} SeasonInfo
 * @property {string} seasonStartDate
 * @property {string} seasonEndDate
 * @property {string} caPoolDirectoryUrl
 * @property {string} caPoolGuideUrl
 */
