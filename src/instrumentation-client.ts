import { reportClientError } from '@/lib/errorMonitoring/client';

// Next.js loads this before hydration. Only actual Error objects are captured
// from window events; failed image/script URLs are intentionally ignored so a
// third-party URL can never enter the monitoring pipeline.
try {
  window.addEventListener('error', (event) => {
    if (event.error !== undefined && event.error !== null) {
      reportClientError(event.error, 'window');
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandled-rejection');
  });
} catch {
  // Instrumentation initialization must never delay or break hydration.
}
