import { describe, expect, it } from 'vitest';
import { nextReminderTimestamp, reminderBody } from './reminders';

describe('daily reminders', () => {
  it('schedules later today when the selected time has not passed', () => {
    const now = new Date(2026, 7, 20, 8, 0, 0);
    expect(new Date(nextReminderTimestamp('09:30', now)!).getDate()).toBe(20);
  });

  it('rolls to tomorrow when the selected time has passed', () => {
    const now = new Date(2026, 7, 20, 10, 0, 0);
    expect(new Date(nextReminderTimestamp('09:30', now)!).getDate()).toBe(21);
  });

  it('rejects invalid local times', () => {
    expect(nextReminderTimestamp('25:99')).toBeNull();
  });

  it('uses the live due count in notification copy', () => {
    expect(reminderBody(10)).toBe('10 words ready to review today.');
    expect(reminderBody(1)).toBe('1 word ready to review today.');
  });
});
