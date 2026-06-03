/**
 * Projects CNSL meet records into runtime-only pool calendar overrides.
 * Keeps cross-domain schedule enrichment separate from published pool source data.
 */

if (typeof window === 'undefined' || !window.PoolMeetScheduleService) {
  class PoolMeetScheduleService {
    static GENERATED_SOURCE = 'cnsl-meet';
    static WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

    static applyMeetOverrides(pools = [], teams = [], meets = []) {
      const overridesByPool = PoolMeetScheduleService.getOverridesByPool(pools, teams, meets);
      pools.forEach(pool => {
        const authoredOverrides = Array.isArray(pool.scheduleOverrides)
          ? pool.scheduleOverrides.filter(override => override.source !== PoolMeetScheduleService.GENERATED_SOURCE)
          : [];
        pool.scheduleOverrides = [...authoredOverrides, ...(overridesByPool.get(pool.name) || [])];
      });
    }

    static getOverridesByPool(pools = [], teams = [], meets = []) {
      const poolNames = new Map(pools.map(pool => [PoolMeetScheduleService.normalizePoolName(pool.name), pool.name]));
      const overridesByPool = new Map();
      const overrideKeys = new Set();
      const addOverride = (poolName, meet, timingWindow) => {
        const publishedPoolName = poolNames.get(PoolMeetScheduleService.normalizePoolName(poolName));
        const override = PoolMeetScheduleService.createOverride(meet, timingWindow);
        if (!publishedPoolName || !override) return;

        const key = `${publishedPoolName}|${override.startDate}|${override.hours[0].startTime}|${override.hours[0].endTime}`;
        if (overrideKeys.has(key)) return;
        overrideKeys.add(key);
        overridesByPool.set(publishedPoolName, [...(overridesByPool.get(publishedPoolName) || []), override]);
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

    static createOverride(meet, timingWindow) {
      if (!meet || !/^\d{4}-\d{2}-\d{2}$/.test(meet.date) || !timingWindow) return null;
      const weekday = PoolMeetScheduleService.getWeekday(meet.date);
      if (!weekday) return null;

      return {
        source: PoolMeetScheduleService.GENERATED_SOURCE,
        startDate: meet.date,
        endDate: meet.date,
        reason: meet.name || 'Swim Meet',
        hours: [{
          weekDays: [weekday],
          types: ['Swim Meet'],
          accessStatus: 'swim-meet',
          startTime: PoolMeetScheduleService.formatScheduleTime(timingWindow.startMinutes),
          endTime: PoolMeetScheduleService.formatScheduleTime(timingWindow.endMinutes)
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

  if (typeof module !== 'undefined' && module.exports) module.exports = PoolMeetScheduleService;
  if (typeof window !== 'undefined') window.PoolMeetScheduleService = PoolMeetScheduleService;
}