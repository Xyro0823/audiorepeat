export function nextReminderTimestamp(time: string, now = new Date()): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function reminderBody(dueCount: number): string {
  if (dueCount <= 0) return 'Your listening streak is waiting — start a quick practice session.';
  return `${dueCount} word${dueCount === 1 ? '' : 's'} ready to review today.`;
}

async function postToServiceWorker(data: unknown): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(data);
    return Boolean(registration.active);
  } catch {
    return false;
  }
}

export async function scheduleDailyReminder(
  enabled: boolean,
  time: string,
  dueCount: number,
): Promise<boolean> {
  const timestamp = nextReminderTimestamp(time);
  if (!enabled || timestamp === null) {
    return postToServiceWorker({ type: 'CLEAR_REMINDER' });
  }
  return postToServiceWorker({
    type: 'SET_REMINDER',
    timestamp,
    title: 'Review Today · AudioRepeat',
    body: reminderBody(dueCount),
    tag: 'daily-reminder',
  });
}

export async function sendReminderTest(dueCount: number): Promise<boolean> {
  return postToServiceWorker({
    type: 'SET_REMINDER',
    timestamp: Date.now() + 1000,
    title: 'AudioRepeat reminder 🔁',
    body: reminderBody(dueCount),
    tag: 'reminder-test',
  });
}
