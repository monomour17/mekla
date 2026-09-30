import PostHog from 'posthog-react-native';

// Ürün analitiği — API key yoksa tüm çağrılar no-op olur.
// Key: posthog.com (EU cloud önerilir, KVKK/GDPR) → EXPO_PUBLIC_POSTHOG_API_KEY
const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

export const posthog = apiKey ? new PostHog(apiKey, { host }) : null;

// LAUNCH_STRATEGY.md funnel metrikleriyle birebir eşleşen event adları.
// Yeni event eklerken buraya ekle — ekranlara string yazma.
export const EVENTS = {
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETED: 'onboarding_completed', // Funnel #1
  COMMUNITY_JOINED: 'community_joined', // Funnel #2
  EVENT_APPLIED: 'event_applied', // Funnel #3
  EVENT_REQUEST_APPROVED: 'event_request_approved', // Funnel #4
  EVENT_REQUEST_REJECTED: 'event_request_rejected',
  MOMENT_POSTED: 'moment_posted', // Funnel #6
  EVENT_CREATED: 'event_created',
  EVENT_CHAT_MESSAGE_SENT: 'event_chat_message_sent',
};

export function track(event, properties = {}) {
  posthog?.capture(event, properties);
}

// Login sonrası çağır — anonim aktiviteyi gerçek kullanıcıya bağlar
export function identifyUser(userId, properties = {}) {
  if (!userId) return;
  posthog?.identify(userId, properties);
}

// Logout'ta çağır — cihazdaki analitik kimliğini sıfırlar
export function resetAnalytics() {
  posthog?.reset();
}
