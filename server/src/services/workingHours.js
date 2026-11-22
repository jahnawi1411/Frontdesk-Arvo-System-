// Frontdesk SLA and Working-Time Calculation Service
// Arvo Systems Working Schedule:
// - Monday to Friday: 9:30 AM to 6:30 PM (9.0 working hours / 540 working minutes per day)
// - Saturdays & Sundays: Non-working days
// - Festival Holidays: Configurable non-working dates
// - Off-hours: SLA clock pauses outside 9:30 AM - 6:30 PM

export const WORK_START_HOUR = 9;
export const WORK_START_MINUTE = 30; // 9:30 AM
export const WORK_END_HOUR = 18;
export const WORK_END_MINUTE = 30; // 6:30 PM

export const MINUTES_PER_WORK_DAY = (WORK_END_HOUR * 60 + WORK_END_MINUTE) - (WORK_START_HOUR * 60 + WORK_START_MINUTE); // 540 minutes (9 hours)

// Default SLA Commitments
export const DEFAULT_SLA_CONFIG = {
  URGENT: {
    firstResponseMinutes: 2 * 60, // 2 working hours
    resolutionMinutes: 9 * 60,    // Same working day (9 working hours)
  },
  MEDIUM: {
    firstResponseMinutes: 4.5 * 60, // Half a working day (4.5 hours = 270 minutes)
    resolutionMinutes: 3 * 540,     // 3 working days (27 working hours = 1620 minutes)
  },
  SMALL: {
    firstResponseMinutes: 9 * 60,  // 1 working day (9 working hours = 540 minutes)
    resolutionMinutes: 5 * 540,    // ~1 working week (5 working days = 45 working hours = 2700 minutes)
  },
  AUTO_CLOSE_WORKING_DAYS: 5,       // ~1 working week (5 working days)
  REOPEN_WINDOW_WORKING_DAYS: 5,    // ~1 working week (5 working days)
  PRIORITY_CHANGE_POLICY: 'RECALCULATE_FROM_REMAINING_RATIO', // or 'RESET_FROM_CREATION', 'RECALCULATE_FROM_NOW'
};

/**
 * Normalizes date string or Date object to YYYY-MM-DD
 */
export function formatDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Checks if a date is a festival holiday
 * @param {Date} date
 * @param {Array<string>|Set<string>} holidays - Array or Set of 'YYYY-MM-DD' strings
 */
export function isHoliday(date, holidays = []) {
  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  return holidaySet.has(formatDateKey(date));
}

/**
 * Checks if a given date is a working day (Mon-Fri and not a holiday)
 */
export function isWorkingDay(date, holidays = []) {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/**
 * Returns minute of day (0 - 1439) for a Date object
 */
export function getMinuteOfDay(date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/**
 * Checks if a date/time is within working hours
 */
export function isWithinWorkingHours(date, holidays = []) {
  if (!isWorkingDay(date, holidays)) return false;
  const minuteOfDay = getMinuteOfDay(date);
  const workStartMinute = WORK_START_HOUR * 60 + WORK_START_MINUTE; // 570
  const workEndMinute = WORK_END_HOUR * 60 + WORK_END_MINUTE;       // 1110
  return minuteOfDay >= workStartMinute && minuteOfDay < workEndMinute;
}

/**
 * Advances a date to the start of the next working period (9:30 AM)
 * If already inside working hours, returns the date unchanged.
 */
export function moveToNextWorkingPeriod(date, holidays = []) {
  let cur = new Date(date);
  const workStartMinute = WORK_START_HOUR * 60 + WORK_START_MINUTE;
  const workEndMinute = WORK_END_HOUR * 60 + WORK_END_MINUTE;

  while (true) {
    if (!isWorkingDay(cur, holidays)) {
      // Move to next day at 9:30 AM
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
      continue;
    }

    const minute = cur.getHours() * 60 + cur.getMinutes();
    if (minute < workStartMinute) {
      // Same day, snap forward to 9:30 AM
      cur.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
      return cur;
    } else if (minute >= workEndMinute) {
      // After working hours: advance to next day at 9:30 AM
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
      continue;
    } else {
      // Within working hours
      return cur;
    }
  }
}

/**
 * Adds working minutes to a start date, strictly respecting:
 * - Working hours (9:30 AM to 6:30 PM)
 * - Weekends (Saturday & Sunday excluded)
 * - Festival holidays (excluded)
 * 
 * @param {Date|string} startDate
 * @param {number} minutesToAdd
 * @param {Array<string>|Set<string>} holidays
 * @returns {Date} Target deadline date
 */
export function addWorkingMinutes(startDate, minutesToAdd, holidays = []) {
  if (minutesToAdd <= 0) return new Date(startDate);

  let cur = moveToNextWorkingPeriod(new Date(startDate), holidays);
  let remainingMinutes = minutesToAdd;

  const workEndMinute = WORK_END_HOUR * 60 + WORK_END_MINUTE; // 1110

  while (remainingMinutes > 0) {
    const curMinuteOfDay = cur.getHours() * 60 + cur.getMinutes() + cur.getSeconds() / 60;
    const remainingInDay = workEndMinute - curMinuteOfDay;

    if (remainingMinutes <= remainingInDay) {
      cur = new Date(cur.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= remainingInDay;
      // Advance to next day at 9:30 AM
      cur.setDate(cur.getDate() + 1);
      cur.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
      cur = moveToNextWorkingPeriod(cur, holidays);
    }
  }

  return cur;
}

/**
 * Calculates the exact working minutes elapsed between two dates
 * 
 * @param {Date|string} fromDate
 * @param {Date|string} toDate
 * @param {Array<string>|Set<string>} holidays
 * @returns {number} Working minutes elapsed
 */
export function getWorkingMinutesBetween(fromDate, toDate, holidays = []) {
  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (end <= start) return 0;

  let totalWorkingMinutes = 0;
  let cur = new Date(start);

  const workStartMinute = WORK_START_HOUR * 60 + WORK_START_MINUTE; // 570
  const workEndMinute = WORK_END_HOUR * 60 + WORK_END_MINUTE;       // 1110

  while (cur < end) {
    if (isWorkingDay(cur, holidays)) {
      const dayStart = new Date(cur);
      dayStart.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);

      const dayEnd = new Date(cur);
      dayEnd.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);

      const effectiveStart = new Date(Math.max(cur.getTime(), dayStart.getTime()));
      const effectiveEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));

      if (effectiveEnd > effectiveStart) {
        totalWorkingMinutes += (effectiveEnd.getTime() - effectiveStart.getTime()) / (60 * 1000);
      }
    }

    // Move to next calendar day at midnight
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }

  return Math.round(totalWorkingMinutes * 100) / 100;
}

/**
 * Calculates remaining working minutes until deadline from a given timestamp
 * If overdue, returns a negative number of working minutes
 */
export function getRemainingWorkingMinutes(deadline, fromDate = new Date(), holidays = []) {
  const target = new Date(deadline);
  const from = new Date(fromDate);

  if (from <= target) {
    return getWorkingMinutesBetween(from, target, holidays);
  } else {
    return -getWorkingMinutesBetween(target, from, holidays);
  }
}

/**
 * Calculates initial SLA deadlines for a ticket given its priority and creation time
 */
export function calculateInitialSlaDeadlines(createdAt, priority, holidays = [], customConfig = {}) {
  const config = { ...DEFAULT_SLA_CONFIG, ...customConfig };
  const priorityConfig = config[priority.toUpperCase()] || config.MEDIUM;

  const firstResponseDeadline = addWorkingMinutes(createdAt, priorityConfig.firstResponseMinutes, holidays);
  const resolutionDeadline = addWorkingMinutes(createdAt, priorityConfig.resolutionMinutes, holidays);

  return {
    firstResponseDeadline,
    resolutionDeadline,
    firstResponseMinutes: priorityConfig.firstResponseMinutes,
    resolutionMinutes: priorityConfig.resolutionMinutes,
  };
}

/**
 * Formats working minutes into human-readable string (e.g. "3h 15m", "1d 2h", "-45m overdue")
 */
export function formatWorkingDuration(minutes) {
  const isNegative = minutes < 0;
  const absMinutes = Math.abs(Math.round(minutes));

  const days = Math.floor(absMinutes / MINUTES_PER_WORK_DAY);
  const remainingMinsAfterDays = absMinutes % MINUTES_PER_WORK_DAY;
  const hours = Math.floor(remainingMinsAfterDays / 60);
  const mins = remainingMinsAfterDays % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  const formatted = parts.join(' ');
  return isNegative ? `${formatted} overdue` : formatted;
}

/**
 * Determines real-time SLA status for a ticket: 'ON_TRACK', 'OVERDUE', or 'PAUSED'
 */
export function getTicketSlaStatus(ticket, now = new Date(), holidays = []) {
  if (ticket.status === 'WAITING_FOR_CUSTOMER') {
    return 'PAUSED';
  }

  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    const isOverdue = ticket.resolvedAt 
      ? new Date(ticket.resolvedAt) > new Date(ticket.resolutionDeadline)
      : false;
    return isOverdue ? 'OVERDUE' : 'ON_TRACK';
  }

  // Check first response deadline if no first response has occurred yet
  if (!ticket.firstResponseAt && new Date(now) > new Date(ticket.firstResponseDeadline)) {
    return 'OVERDUE';
  }

  // Check resolution deadline
  if (new Date(now) > new Date(ticket.resolutionDeadline)) {
    return 'OVERDUE';
  }

  return 'ON_TRACK';
}

/**
 * Handles pausing Resolution SLA when status is changed to WAITING_FOR_CUSTOMER.
 * Preserves consumed working time up to pause timestamp.
 */
export function pauseResolutionSla(ticket, pauseTimestamp = new Date(), holidays = []) {
  const now = new Date(pauseTimestamp);
  const consumedMinutes = getWorkingMinutesBetween(ticket.createdAt, now, holidays);
  const remainingMinutes = getRemainingWorkingMinutes(ticket.resolutionDeadline, now, holidays);

  return {
    pausedAt: now,
    consumedWorkingMinutes: consumedMinutes,
    remainingWorkingMinutes: remainingMinutes,
  };
}

/**
 * Handles resuming Resolution SLA when customer replies or status leaves WAITING_FOR_CUSTOMER.
 * Calculates new resolution deadline using preserved remaining working time.
 */
export function resumeResolutionSla(ticket, resumeTimestamp = new Date(), holidays = []) {
  const resumeDate = new Date(resumeTimestamp);
  const pauseDate = ticket.pausedAt ? new Date(ticket.pausedAt) : resumeDate;

  // Working minutes remaining at the time of pause
  const remainingWorkingMinutes = getRemainingWorkingMinutes(ticket.resolutionDeadline, pauseDate, holidays);

  // New resolution deadline calculated from resume date with the remaining working minutes
  let newResolutionDeadline;
  if (remainingWorkingMinutes > 0) {
    newResolutionDeadline = addWorkingMinutes(resumeDate, remainingWorkingMinutes, holidays);
  } else {
    // If it was already overdue before pause, keep it overdue proportionally
    newResolutionDeadline = new Date(resumeDate.getTime() + remainingWorkingMinutes * 60 * 1000);
  }

  const pausedDurationSeconds = Math.max(0, Math.floor((resumeDate.getTime() - pauseDate.getTime()) / 1000));
  const totalPausedSeconds = (ticket.totalPausedSeconds || 0) + pausedDurationSeconds;

  return {
    resolutionDeadline: newResolutionDeadline,
    pausedAt: null,
    totalPausedSeconds,
    remainingWorkingMinutes,
  };
}

/**
 * Calculates new deadlines when ticket priority changes mid-flight.
 * Implements configurable policy:
 * - RECALCULATE_FROM_REMAINING_RATIO (Default): Scales remaining working percentage to new priority SLA
 * - RESET_FROM_CREATION: Recalculates from ticket creation date
 * - RECALCULATE_FROM_NOW: Grants full new SLA duration starting from change moment
 */
export function recalculateDeadlinesOnPriorityChange(
  ticket,
  newPriority,
  now = new Date(),
  holidays = [],
  policy = 'RECALCULATE_FROM_REMAINING_RATIO',
  customConfig = {}
) {
  const config = { ...DEFAULT_SLA_CONFIG, ...customConfig };
  const oldPriorityConfig = config[ticket.priority.toUpperCase()] || config.MEDIUM;
  const newPriorityConfig = config[newPriority.toUpperCase()] || config.MEDIUM;

  let newFirstResponseDeadline = ticket.firstResponseDeadline;
  let newResolutionDeadline = ticket.resolutionDeadline;

  // First response recalculation (only if not already responded)
  if (!ticket.firstResponseAt) {
    if (policy === 'RESET_FROM_CREATION') {
      newFirstResponseDeadline = addWorkingMinutes(ticket.createdAt, newPriorityConfig.firstResponseMinutes, holidays);
    } else if (policy === 'RECALCULATE_FROM_NOW') {
      newFirstResponseDeadline = addWorkingMinutes(now, newPriorityConfig.firstResponseMinutes, holidays);
    } else { // RECALCULATE_FROM_REMAINING_RATIO
      const consumedMins = getWorkingMinutesBetween(ticket.createdAt, now, holidays);
      const ratio = Math.max(0, Math.min(1, consumedMins / oldPriorityConfig.firstResponseMinutes));
      const remainingRatio = 1 - ratio;
      const newRemainingMins = remainingRatio * newPriorityConfig.firstResponseMinutes;
      newFirstResponseDeadline = addWorkingMinutes(now, newRemainingMins, holidays);
    }
  }

  // Resolution deadline recalculation
  if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
    if (policy === 'RESET_FROM_CREATION') {
      newResolutionDeadline = addWorkingMinutes(ticket.createdAt, newPriorityConfig.resolutionMinutes, holidays);
    } else if (policy === 'RECALCULATE_FROM_NOW') {
      newResolutionDeadline = addWorkingMinutes(now, newPriorityConfig.resolutionMinutes, holidays);
    } else { // RECALCULATE_FROM_REMAINING_RATIO
      const consumedMins = getWorkingMinutesBetween(ticket.createdAt, now, holidays);
      const ratio = Math.max(0, Math.min(1, consumedMins / oldPriorityConfig.resolutionMinutes));
      const remainingRatio = 1 - ratio;
      const newRemainingMins = remainingRatio * newPriorityConfig.resolutionMinutes;
      newResolutionDeadline = addWorkingMinutes(now, newRemainingMins, holidays);
    }
  }

  return {
    firstResponseDeadline: newFirstResponseDeadline,
    resolutionDeadline: newResolutionDeadline,
    policyUsed: policy,
  };
}

/**
 * Checks if a waiting ticket qualifies for automatic closure (e.g. 5 working days)
 */
export function isEligibleForAutoClosure(ticket, now = new Date(), holidays = [], thresholdDays = 5) {
  if (ticket.status !== 'WAITING_FOR_CUSTOMER') return false;
  const referenceDate = ticket.pausedAt || ticket.updatedAt;
  const elapsedWorkingMinutes = getWorkingMinutesBetween(referenceDate, now, holidays);
  const thresholdMinutes = thresholdDays * MINUTES_PER_WORK_DAY;
  return elapsedWorkingMinutes >= thresholdMinutes;
}

/**
 * Checks if a resolved ticket is eligible for reopening (within 5 working days)
 */
export function isEligibleForReopening(ticket, now = new Date(), holidays = [], maxDays = 5) {
  if (ticket.status !== 'RESOLVED') return false;
  if (!ticket.resolvedAt) return true; // fallback
  const elapsedWorkingMinutes = getWorkingMinutesBetween(ticket.resolvedAt, now, holidays);
  const maxAllowedMinutes = maxDays * MINUTES_PER_WORK_DAY;
  return elapsedWorkingMinutes <= maxAllowedMinutes;
}
