import * as Sentry from '@sentry/react-native';

// Crash reporting — DSN yoksa devre dışı kalır (lokal geliştirmede sessiz).
// DSN: sentry.io → Project Settings → Client Keys (EXPO_PUBLIC_SENTRY_DSN)
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(dsn);

export function initMonitoring() {
  Sentry.init({
    dsn,
    enabled: monitoringEnabled,
    // Dev'de gürültü yaratmasın, sadece production build'lerde raporla
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
  });
}

// Yakalanan ama uygulamayı çökertmeyen hatalar için (errorHandler, catch blokları)
export function captureError(error, context = {}) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { extra: context });
}

// Kullanıcı oturum açınca çağır — crash raporlarına kullanıcı bağlamı ekler
export function setMonitoringUser(userId) {
  if (!monitoringEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
