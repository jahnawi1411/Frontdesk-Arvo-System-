import prisma from '../db.js';
import { DEFAULT_SLA_CONFIG } from './workingHours.js';

let holidayCache = null;
let lastHolidayFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Retrieves all active festival holiday date strings ('YYYY-MM-DD')
 */
export async function getActiveHolidays() {
  const now = Date.now();
  if (holidayCache && now - lastHolidayFetch < CACHE_TTL_MS) {
    return holidayCache;
  }

  const holidays = await prisma.holiday.findMany({
    select: { date: true },
  });
  holidayCache = holidays.map(h => h.date);
  lastHolidayFetch = now;
  return holidayCache;
}

export function invalidateHolidayCache() {
  holidayCache = null;
  lastHolidayFetch = 0;
}

/**
 * Retrieves merged system settings
 */
export async function getSystemSettings() {
  const dbSettings = await prisma.systemSetting.findMany();
  const settingsMap = {};
  for (const s of dbSettings) {
    settingsMap[s.key] = s.value;
  }

  return {
    ...DEFAULT_SLA_CONFIG,
    ...settingsMap,
    autoCloseDays: parseInt(settingsMap.SLA_AUTO_CLOSE_WORKING_DAYS || DEFAULT_SLA_CONFIG.AUTO_CLOSE_WORKING_DAYS, 10),
    reopenDays: parseInt(settingsMap.SLA_REOPEN_WINDOW_WORKING_DAYS || DEFAULT_SLA_CONFIG.REOPEN_WINDOW_WORKING_DAYS, 10),
    priorityChangePolicy: settingsMap.SLA_PRIORITY_CHANGE_POLICY || DEFAULT_SLA_CONFIG.PRIORITY_CHANGE_POLICY,
  };
}
