import { describe, it, expect } from 'vitest';
import {
  addWorkingMinutes,
  getWorkingMinutesBetween,
  getRemainingWorkingMinutes,
  pauseResolutionSla,
  resumeResolutionSla,
  isEligibleForAutoClosure,
  isEligibleForReopening,
  recalculateDeadlinesOnPriorityChange,
  WORK_START_HOUR,
  WORK_START_MINUTE,
  WORK_END_HOUR,
  WORK_END_MINUTE,
  MINUTES_PER_WORK_DAY,
} from '../src/services/workingHours.js';

describe('Frontdesk Working-Time & SLA Calculation Engine', () => {
  // Configured festival holidays for tests
  const holidays = ['2026-11-25', '2026-12-25']; // E.g., Nov 25 festival holiday, Dec 25 Christmas

  // Test 1: SLA calculation across weekends
  it('1. SLA calculation accurately excludes weekends (Saturday and Sunday)', () => {
    // Friday at 14:30 (2:30 PM). 4 hours remain on Friday until 18:30 (240 minutes)
    // 2026-11-20 is Friday.
    const friday230PM = new Date(2026, 10, 20, 14, 30, 0); // Friday Nov 20, 2026
    
    // Add 9 working hours (540 working minutes):
    // 4 hours (240 mins) consumed on Friday (ends at 18:30)
    // Saturday (Nov 21) & Sunday (Nov 22) must be completely skipped!
    // Remaining 5 hours (300 mins) resume on Monday Nov 23 at 09:30 AM
    // Deadline should be Monday Nov 23 at 14:30 (2:30 PM)
    const deadline = addWorkingMinutes(friday230PM, 9 * 60, holidays);

    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(10); // November
    expect(deadline.getDate()).toBe(23);  // Monday Nov 23
    expect(deadline.getHours()).toBe(14);
    expect(deadline.getMinutes()).toBe(30);
  });

  // Test 2: SLA calculation across festival holidays
  it('2. SLA calculation accurately excludes configured festival holidays', () => {
    // Tuesday Nov 24, 2026 at 16:30 (4:30 PM). 2 hours remain until 18:30
    const tuesday430PM = new Date(2026, 10, 24, 16, 30, 0);
    // Nov 25 is a festival holiday.
    // Add 5 working hours (300 minutes):
    // 2 hours consumed on Tuesday (until 18:30)
    // Wednesday Nov 25 is a festival holiday -> skipped!
    // Remaining 3 hours resume Thursday Nov 26 at 09:30 AM -> Thursday 12:30 PM
    const deadline = addWorkingMinutes(tuesday430PM, 5 * 60, holidays);

    expect(deadline.getDate()).toBe(26); // Thursday Nov 26
    expect(deadline.getHours()).toBe(12);
    expect(deadline.getMinutes()).toBe(30);
  });

  // Test 3: Tickets created outside working hours
  it('3. Tickets created outside working hours do not start counting until next working period (09:30 AM)', () => {
    // Ticket arrives at 21:00 (9:00 PM) on Tuesday Nov 24, 2026
    const tuesdayNight = new Date(2026, 10, 24, 21, 0, 0);
    
    // Urgent ticket SLA: 2 working hours (120 minutes)
    // Since Wednesday Nov 25 is a holiday, the next working period begins Thursday Nov 26 at 09:30 AM
    // 2 working hours from Thursday 09:30 AM = Thursday 11:30 AM
    const deadline = addWorkingMinutes(tuesdayNight, 2 * 60, holidays);

    expect(deadline.getDate()).toBe(26); // Thursday
    expect(deadline.getHours()).toBe(11);
    expect(deadline.getMinutes()).toBe(30);

    // Also test early morning ticket at 07:00 AM on Monday Nov 16 (normal working day)
    const mondayMorning = new Date(2026, 10, 16, 7, 0, 0);
    const deadlineMorning = addWorkingMinutes(mondayMorning, 2 * 60, holidays);
    expect(deadlineMorning.getDate()).toBe(16);
    expect(deadlineMorning.getHours()).toBe(11); // 09:30 AM + 2 hours = 11:30 AM
    expect(deadlineMorning.getMinutes()).toBe(30);
  });

  // Test 4: Friday evening tickets (Meera's specific example!)
  it('4. Friday 6 PM tickets: SLA must not be overdue on Sunday morning', () => {
    // Friday Nov 20, 2026 at 18:00 (6:00 PM).
    // Urgent SLA: 2 working hours (120 working minutes)
    const friday6PM = new Date(2026, 10, 20, 18, 0, 0);
    const deadline = addWorkingMinutes(friday6PM, 120, holidays);

    // 30 mins consumed on Friday (18:00 to 18:30)
    // Weekend skipped.
    // 90 mins remaining on Monday at 09:30 -> Monday 11:00 AM!
    expect(deadline.getDate()).toBe(23); // Monday
    expect(deadline.getHours()).toBe(11);
    expect(deadline.getMinutes()).toBe(0);

    // On Sunday morning at 10:00 AM, test if it is overdue:
    const sundayMorning = new Date(2026, 10, 22, 10, 0, 0);
    const remainingMinsOnSunday = getRemainingWorkingMinutes(deadline, sundayMorning, holidays);

    // Remaining working minutes must still be 90 minutes!
    expect(remainingMinsOnSunday).toBe(90);
    expect(remainingMinsOnSunday > 0).toBe(true); // NOT OVERDUE!
  });

  // Test 5: SLA pause when waiting for a customer
  it('5. SLA pause when status changes to Waiting for Customer', () => {
    const monday930AM = new Date(2026, 10, 16, 9, 30, 0);
    const mockTicket = {
      createdAt: monday930AM,
      priority: 'MEDIUM',
      // Medium resolution SLA: 3 working days (1620 mins) -> Thursday 09:30 AM
      resolutionDeadline: addWorkingMinutes(monday930AM, 3 * 540, holidays),
    };

    // Agent sets to Waiting for Customer on Monday at 12:30 PM (3 hours elapsed)
    const monday1230PM = new Date(2026, 10, 16, 12, 30, 0);
    const pauseResult = pauseResolutionSla(mockTicket, monday1230PM, holidays);

    expect(pauseResult.consumedWorkingMinutes).toBe(180); // 3 hours = 180 mins
    expect(pauseResult.remainingWorkingMinutes).toBe(1620 - 180); // 1440 mins remaining
  });

  // Test 6 & 7: SLA resume after a customer reply & Preservation of consumed SLA time
  it('6 & 7. SLA resume after customer reply preserves consumed working time and shifts resolution deadline', () => {
    const monday930AM = new Date(2026, 10, 16, 9, 30, 0);
    const originalDeadline = addWorkingMinutes(monday930AM, 3 * 540, holidays); // 1620 mins

    const mockTicket = {
      createdAt: monday930AM,
      priority: 'MEDIUM',
      resolutionDeadline: originalDeadline,
      pausedAt: new Date(2026, 10, 16, 12, 30, 0), // Paused at 12:30 PM (180 mins consumed, 1440 mins left)
      totalPausedSeconds: 0,
    };

    // Customer takes 4 calendar days to reply (Friday Nov 20 at 10:30 AM)
    const customerReplyTime = new Date(2026, 10, 20, 10, 30, 0);
    const resumeResult = resumeResolutionSla(mockTicket, customerReplyTime, holidays);

    // The remaining 1440 working minutes (2.667 working days) are added starting from customerReplyTime:
    // Friday has 8 hours left (10:30 to 18:30 = 480 mins).
    // Remaining after Friday: 1440 - 480 = 960 mins.
    // Weekend skipped.
    // Monday has 540 mins. Remaining: 960 - 540 = 420 mins.
    // Tuesday: 09:30 AM + 420 mins (7 hours) = Tuesday 16:30 (4:30 PM)
    expect(resumeResult.resolutionDeadline.getDate()).toBe(24); // Tuesday Nov 24
    expect(resumeResult.resolutionDeadline.getHours()).toBe(16);
    expect(resumeResult.resolutionDeadline.getMinutes()).toBe(30);

    // Consumed time is preserved:
    const workingMinutesFromCreationToPause = getWorkingMinutesBetween(mockTicket.createdAt, mockTicket.pausedAt, holidays);
    expect(workingMinutesFromCreationToPause).toBe(180);
  });

  // Test 8: Automatic closure after five working days without a customer response
  it('8. Automatic closure triggered after 5 working days without customer reply', () => {
    // Ticket paused on Monday Nov 16 at 10:00 AM
    const monday10AM = new Date(2026, 10, 16, 10, 0, 0);
    const mockTicket = {
      status: 'WAITING_FOR_CUSTOMER',
      pausedAt: monday10AM,
      updatedAt: monday10AM,
    };

    // 4 working days later (Friday Nov 20 at 10:00 AM) -> Not eligible yet
    const day4 = new Date(2026, 10, 20, 10, 0, 0);
    expect(isEligibleForAutoClosure(mockTicket, day4, holidays, 5)).toBe(false);

    // 5 working days later (Monday Nov 23 at 10:00 AM) -> Eligible!
    const day5 = new Date(2026, 10, 23, 10, 0, 0);
    expect(isEligibleForAutoClosure(mockTicket, day5, holidays, 5)).toBe(true);
  });

  // Test 9 & 10: Reopening within permitted period vs Rejection after permitted period
  it('9 & 10. Ticket reopening allowed within 5 working days; rejected after 5 working days', () => {
    // Ticket marked resolved on Monday Nov 16 at 14:00 (2:00 PM)
    const resolvedTime = new Date(2026, 10, 16, 14, 0, 0);
    const mockTicket = {
      status: 'RESOLVED',
      resolvedAt: resolvedTime,
    };

    // Customer requests reopening 3 working days later (Thursday Nov 19 at 14:00) -> Allowed!
    const withinPeriod = new Date(2026, 10, 19, 14, 0, 0);
    expect(isEligibleForReopening(mockTicket, withinPeriod, holidays, 5)).toBe(true);

    // Customer requests reopening 6 working days later (Tuesday Nov 24 at 15:00) -> Rejected!
    const afterPeriod = new Date(2026, 10, 24, 15, 0, 0);
    expect(isEligibleForReopening(mockTicket, afterPeriod, holidays, 5)).toBe(false);
  });
});
