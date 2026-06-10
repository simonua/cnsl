/**
 * Projects published pool schedule periods into semantic daily availability.
 * Keeps period selection, dated overrides, and access-status resolution outside the Pool model and display layer.
 */

if (typeof globalThis.PoolPeriodScheduleService === 'undefined') {
  class PoolPeriodScheduleService {
    static DAY_NAMES = Object.freeze({
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday'
    });

    static getLocalDateString(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    constructor(options = {}) {
      this.schedulePeriods = Array.isArray(options.schedulePeriods) ? options.schedulePeriods : [];
      this.scheduleOverrides = Array.isArray(options.scheduleOverrides) ? options.scheduleOverrides : [];
      this.poolName = options.poolName || '';
      this.getTimeUtils = typeof options.getTimeUtils === 'function' ? options.getTimeUtils : () => null;
      this.getPoolStatus = typeof options.getPoolStatus === 'function' ? options.getPoolStatus : () => null;
    }

    normalizeActiveSchedule() {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return {};

      const currentDate = timeUtils.getCurrentEasternTimeInfo().date;
      const activeSchedule = this.schedulePeriods.find(schedule => currentDate >= schedule.startDate && currentDate <= schedule.endDate);
      if (!activeSchedule || !Array.isArray(activeSchedule.hours)) return {};

      const normalizedSchedule = {};
      Object.values(PoolPeriodScheduleService.DAY_NAMES).forEach(day => {
        normalizedSchedule[day] = { closed: true };
      });
      activeSchedule.hours.forEach(hour => {
        if (!Array.isArray(hour.weekDays) || !hour.startTime || !hour.endTime) return;
        hour.weekDays.forEach(shortDay => {
          const fullDay = PoolPeriodScheduleService.DAY_NAMES[shortDay];
          if (!fullDay || !normalizedSchedule[fullDay].closed) return;
          normalizedSchedule[fullDay] = {
            closed: false,
            open: hour.startTime,
            close: hour.endTime,
            activities: hour.types || [],
            notes: hour.notes || '',
            accessStatus: hour.accessStatus
          };
        });
      });
      return normalizedSchedule;
    }

    getCurrentStatus() {
      const poolStatus = this.getPoolStatus();
      if (!poolStatus) return { kind: 'unavailable', isOpen: false, status: 'Error', color: 'gray' };
      if (this.schedulePeriods.length === 0) return poolStatus.SCHEDULE_NOT_FOUND;

      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return poolStatus.SCHEDULE_NOT_FOUND;
      const current = timeUtils.getCurrentEasternTimeInfo();
      return this.getStatusAtMinutes(this.getTimeSlotsForDate(current.date, current.day.substring(0, 3)), current.minutes);
    }

    getTimeSlotsForDate(dateString, shortDay) {
      const activeSchedule = this.schedulePeriods.find(schedule => dateString >= schedule.startDate && dateString <= schedule.endDate);
      if (!this.getTimeUtils()) return [];
      const override = this.getOverrideForDate(dateString, shortDay);
      if (override) return this.mergeScheduleWithOverride(activeSchedule, shortDay, override);
      if (!activeSchedule || !Array.isArray(activeSchedule.hours)) return [];

      return this.sortSlots(activeSchedule.hours.filter(hour => Array.isArray(hour.weekDays) && hour.weekDays.includes(shortDay)));
    }

    getSlotStatus(slot) {
      const poolStatus = this.getPoolStatus();
      if (!poolStatus) return { isOpen: false, color: 'gray' };
      switch (slot.accessStatus) {
        case 'public': return poolStatus.OPEN;
        case 'closed-to-public': return poolStatus.CLOSED_TO_PUBLIC;
        case 'practice-only': return poolStatus.PRACTICE_ONLY;
        case 'special-event': return poolStatus.SPECIAL_EVENT;
        case 'swim-meet': return poolStatus.SWIM_MEET;
        default: return poolStatus.RESTRICTED;
      }
    }

    getStatusAtMinutes(timeSlots, currentMinutes) {
      const poolStatus = this.getPoolStatus();
      const timeUtils = this.getTimeUtils();
      if (!poolStatus || !timeUtils) return { isOpen: false, color: 'gray' };

      for (const slot of timeSlots) {
        if (typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') {
          console.warn(`[PoolPeriodScheduleService] Skipping invalid time slot for ${this.poolName}:`, slot);
          continue;
        }
        const startMinutes = timeUtils.timeStringToMinutes(slot.startTime);
        const endMinutes = timeUtils.timeStringToMinutes(slot.endTime);
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return this.getSlotStatus(slot);
      }
      return poolStatus.CLOSED;
    }

    getWeekScheduleForDate(weekStartDate) {
      return Object.keys(PoolPeriodScheduleService.DAY_NAMES).map((shortDay, index) => {
        const targetDate = new Date(weekStartDate);
        targetDate.setDate(weekStartDate.getDate() + index);
        const dateString = PoolPeriodScheduleService.getLocalDateString(targetDate);
        const activeSchedule = this.schedulePeriods.find(schedule => dateString >= schedule.startDate && dateString <= schedule.endDate);
        const override = this.getOverrideForDate(dateString, shortDay);
        const timeSlots = override
          ? this.mergeScheduleWithOverride(activeSchedule, shortDay, override)
          : this.getRegularSlots(activeSchedule, shortDay);
        return {
          day: shortDay,
          fullDay: PoolPeriodScheduleService.DAY_NAMES[shortDay],
          timeSlots,
          isOpen: timeSlots.length > 0,
          hasOverrides: Boolean(override),
          overrideReason: override ? override.reason : null
        };
      });
    }

    getOverrideForDate(dateString, shortDay) {
      if (!Array.isArray(this.scheduleOverrides)) return null;
      return this.scheduleOverrides.find(override => (
        dateString >= override.startDate
        && dateString <= override.endDate
        && Array.isArray(override.hours)
        && override.hours.some(hour => Array.isArray(hour.weekDays) && hour.weekDays.includes(shortDay))
      ));
    }

    mergeScheduleWithOverride(activeSchedule, shortDay, override) {
      const regularSlots = this.getRegularSlots(activeSchedule, shortDay);
      const overrideSlots = this.getSlotsForDay(override.hours, shortDay).map(hour => ({
        startTime: hour.startTime,
        endTime: hour.endTime,
        activities: hour.types || [],
        notes: hour.notes || '',
        accessStatus: hour.accessStatus,
        isSpecialEvent: hour.isSpecialEvent === true,
        isOverride: true,
        overrideReason: override.reason || null,
        meetDate: hour.meetDate || '',
        meetPoolId: hour.meetPoolId || ''
      }));
      const convertedOverrides = overrideSlots.map(slot => this.withMinutes(slot));
      const mergedSlots = [];

      regularSlots.map(slot => this.withMinutes(slot)).forEach(regularSlot => {
        let remainingSlots = [regularSlot];
        convertedOverrides.forEach(overrideSlot => {
          remainingSlots = remainingSlots.flatMap(remaining => this.subtractOverride(remaining, overrideSlot));
        });
        mergedSlots.push(...remainingSlots);
      });
      mergedSlots.push(...convertedOverrides);
      return mergedSlots.sort((first, second) => first.startMinutes - second.startMinutes).map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        activities: slot.activities,
        notes: slot.notes,
        accessStatus: slot.accessStatus,
        isSpecialEvent: slot.isSpecialEvent,
        isOverride: slot.isOverride,
        overrideReason: slot.overrideReason,
        meetDate: slot.meetDate,
        meetPoolId: slot.meetPoolId
      }));
    }

    getCurrentSchedulePeriod() {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return null;
      const currentDate = timeUtils.getCurrentEasternTimeInfo().date;
      const activeSchedule = this.schedulePeriods.find(schedule => currentDate >= schedule.startDate && currentDate <= schedule.endDate);
      return activeSchedule ? {
        startDate: activeSchedule.startDate,
        endDate: activeSchedule.endDate,
        name: activeSchedule.name || 'Current Schedule'
      } : null;
    }

    getValidDateRange() {
      if (this.schedulePeriods.length === 0) return null;
      const dates = this.schedulePeriods.map(schedule => ({ start: new Date(schedule.startDate), end: new Date(schedule.endDate) }));
      return {
        startDate: new Date(Math.min(...dates.map(date => date.start.getTime()))),
        endDate: new Date(Math.max(...dates.map(date => date.end.getTime())))
      };
    }

    getSlotsForDay(hours, shortDay) {
      return Array.isArray(hours) ? hours.filter(hour => (
        Array.isArray(hour.weekDays)
        && hour.weekDays.includes(shortDay)
        && hour.startTime
        && hour.endTime
      )) : [];
    }

    getRegularSlots(activeSchedule, shortDay) {
      return this.sortSlots(this.getSlotsForDay(activeSchedule && activeSchedule.hours, shortDay).map(hour => ({
        startTime: hour.startTime,
        endTime: hour.endTime,
        activities: hour.types || [],
        notes: hour.notes || '',
        accessStatus: hour.accessStatus,
        isSpecialEvent: hour.isSpecialEvent === true,
        isOverride: false
      })));
    }

    sortSlots(slots) {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return slots;
      return [...slots].sort((first, second) => {
        if (typeof first.startTime !== 'string' || typeof second.startTime !== 'string') return 0;
        return timeUtils.timeStringToMinutes(first.startTime) - timeUtils.timeStringToMinutes(second.startTime);
      });
    }

    withMinutes(slot) {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils || typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') {
        console.warn(`[PoolPeriodScheduleService] Skipping slot with invalid times for ${this.poolName}:`, slot);
        return { ...slot, startMinutes: 0, endMinutes: 0 };
      }
      try {
        return {
          ...slot,
          startMinutes: timeUtils.timeStringToMinutes(slot.startTime),
          endMinutes: timeUtils.timeStringToMinutes(slot.endTime)
        };
      } catch (_error) {
        console.warn(`[PoolPeriodScheduleService] Skipping slot with invalid times for ${this.poolName}:`, slot);
        return { ...slot, startMinutes: 0, endMinutes: 0 };
      }
    }

    subtractOverride(regularSlot, overrideSlot) {
      if (overrideSlot.startMinutes <= regularSlot.startMinutes && overrideSlot.endMinutes >= regularSlot.endMinutes) return [];
      if (overrideSlot.endMinutes <= regularSlot.startMinutes || overrideSlot.startMinutes >= regularSlot.endMinutes) return [regularSlot];

      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return [];
      const remainingSlots = [];
      if (regularSlot.startMinutes < overrideSlot.startMinutes) {
        remainingSlots.push({ ...regularSlot, endMinutes: overrideSlot.startMinutes, endTime: timeUtils.minutesToTimeString(overrideSlot.startMinutes) });
      }
      if (regularSlot.endMinutes > overrideSlot.endMinutes) {
        remainingSlots.push({ ...regularSlot, startMinutes: overrideSlot.endMinutes, startTime: timeUtils.minutesToTimeString(overrideSlot.endMinutes) });
      }
      return remainingSlots;
    }
  }

  globalThis.PoolPeriodScheduleService = PoolPeriodScheduleService;
}
