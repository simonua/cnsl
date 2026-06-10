/**
 * Projects CNSL meet records into runtime-only pool calendar overrides.
 * Keeps cross-domain schedule enrichment separate from published pool source data.
 */

if (typeof globalThis.PoolMeetScheduleService === 'undefined') {
  class PoolMeetScheduleService {
    static GENERATED_SOURCE = 'cnsl-meet';
    static WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

    static applyMeetOverrides(pools = [], teams = [], meets = []) {
      const overridesByPool = PoolMeetScheduleService.getOverridesByPool(pools, teams, meets);
      pools.forEach(pool => {
        pool.schedulePeriods = PoolMeetScheduleService.removePublishedMeetSlots(pool.schedulePeriods);
        const generatedOverrides = overridesByPool.get(pool.name) || [];
        const authoredOverrides = Array.isArray(pool.scheduleOverrides)
          ? PoolMeetScheduleService.removeUnconfirmedMeetPlaceholders(
            pool.scheduleOverrides.filter(override => override.source !== PoolMeetScheduleService.GENERATED_SOURCE),
            generatedOverrides
          )
          : [];
        pool.scheduleOverrides = PoolMeetScheduleService.mergeGeneratedOverrides(
          authoredOverrides,
          generatedOverrides
        );
      });
    }

    static removePublishedMeetSlots(scheduleRecords) {
      return Array.isArray(scheduleRecords) ? scheduleRecords.map(record => {
        if (!Array.isArray(record.hours)) return record;
        const hours = record.hours.filter(hour => hour.accessStatus !== 'swim-meet');
        return hours.length === record.hours.length ? record : { ...record, hours };
      }) : scheduleRecords;
    }

    static removeUnconfirmedMeetPlaceholders(authoredOverrides, generatedOverrides) {
      return authoredOverrides.flatMap(override => {
        const hasPublishedMeetSlot = Array.isArray(override.hours)
          && override.hours.some(hour => hour.accessStatus === 'swim-meet');
        if (!hasPublishedMeetSlot) return [override];

        const hasAuthoritativeMeet = generatedOverrides.some(generatedOverride => (
          override.startDate === generatedOverride.startDate
          && override.endDate === generatedOverride.endDate
        ));
        return hasAuthoritativeMeet ? PoolMeetScheduleService.removePublishedMeetSlots([override]) : [];
      });
    }

    static mergeGeneratedOverrides(authoredOverrides, generatedOverrides) {
      return generatedOverrides.reduce((overrides, generatedOverride) => {
        const existingIndex = overrides.findIndex(override => (
          override.startDate === generatedOverride.startDate
          && override.endDate === generatedOverride.endDate
          && Array.isArray(override.hours)
        ));
        if (existingIndex === -1) return [...overrides, generatedOverride];

        return overrides.map((override, index) => index === existingIndex ? {
          ...override,
          reason: generatedOverride.reason,
          hours: [...override.hours, ...generatedOverride.hours]
        } : override);
      }, authoredOverrides);
    }

    static getOverridesByPool(pools = [], teams = [], meets = []) {
      const poolsByName = new Map(pools.map(pool => [PoolMeetScheduleService.normalizePoolName(pool.name), pool]));
      const overridesByPool = new Map();
      const overrideKeys = new Set();
      const addOverride = (poolName, meet, timingWindow) => {
        const publishedPool = poolsByName.get(PoolMeetScheduleService.normalizePoolName(poolName));
        const override = PoolMeetScheduleService.createOverride(meet, timingWindow, publishedPool && publishedPool.id);
        if (!publishedPool || !override) return;

        const key = `${publishedPool.name}|${override.startDate}|${override.hours[0].startTime}|${override.hours[0].endTime}`;
        if (overrideKeys.has(key)) return;
        overrideKeys.add(key);
        overridesByPool.set(publishedPool.name, [...(overridesByPool.get(publishedPool.name) || []), override]);
      };

      meets.forEach(meet => addOverride(meet && meet.location, meet, meet && meet.getKnownTimingWindow()));
      meets.filter(meet => meet && meet.getTimeWindowKey() === 'timeTrials').forEach(meet => {
        teams.forEach(team => addOverride(
          team.timeTrialsPool,
          meet,
          meet.getKnownTimingWindow(team.getMeetTimeOverride('timeTrials'))
        ));
      });

      return overridesByPool;
    }

    static createOverride(meet, timingWindow, poolId = '') {
      if (!meet || !/^\d{4}-\d{2}-\d{2}$/.test(meet.date) || !timingWindow) return null;
      const weekday = PoolMeetScheduleService.getWeekday(meet.date);
      if (!weekday) return null;

      const isSpecialMeet = typeof meet.isSpecialMeet !== 'function' || meet.isSpecialMeet();
      const meetLink = !isSpecialMeet
        && /^[a-zA-Z0-9_-]+$/.test(poolId)
        ? { meetDate: meet.date, meetPoolId: poolId }
        : {};
      return {
        source: PoolMeetScheduleService.GENERATED_SOURCE,
        startDate: meet.date,
        endDate: meet.date,
        reason: isSpecialMeet ? meet.name || 'Swim Meet' : '',
        hours: [{
          weekDays: [weekday],
          types: [isSpecialMeet ? 'Swim Meet' : meet.name || 'Swim Meet'],
          accessStatus: 'swim-meet',
          startTime: PoolMeetScheduleService.formatScheduleTime(timingWindow.startMinutes),
          endTime: PoolMeetScheduleService.formatScheduleTime(timingWindow.endMinutes),
          ...meetLink
        }]
      };
    }

    static getWeekday(dateString) {
      const date = new Date(`${dateString}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : PoolMeetScheduleService.WEEKDAYS[date.getUTCDay()];
    }

    static formatScheduleTime(minutes) {
      if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) return '';
      const hour = Math.floor(minutes / 60);
      const minute = String(minutes % 60).padStart(2, '0');
      return `${hour % 12 || 12}:${minute}${hour < 12 ? 'am' : 'pm'}`;
    }

    static normalizePoolName(poolName) {
      return String(poolName || '').trim().replace(/\s+pool$/i, '').toLowerCase();
    }
  }

  globalThis.PoolMeetScheduleService = PoolMeetScheduleService;
}
