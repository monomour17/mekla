import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Etkinlik için 24 saat ve 2 saat öncesine local push reminder zamanlar.
 * Zamanlanan id'ler AsyncStorage'da saklanır → katılımdan ayrılınca iptal edilebilir.
 *
 * Bildirim tercihi (event_reminder = false) ise hiç schedule etmez.
 *
 * @param {object} event - { id, title, event_date, location_detail, city }
 * @param {object} prefs - profiles.notification_prefs
 */
export async function scheduleEventReminders(event, prefs) {
  if (!event?.id || !event?.event_date) return;
  if (prefs && prefs.event_reminder === false) return;

  // Zaten zamanlanmışsa atla (idempotent)
  await cancelEventReminders(event.id);

  const eventDate = new Date(event.event_date);
  const now = new Date();
  const place = event.location_detail || event.city || '';

  const slots = [
    { hours: 24, label: 'yarın bu saatte' },
    { hours: 2, label: '2 saat sonra' },
  ];

  const ids = [];
  for (const slot of slots) {
    const fireDate = new Date(eventDate.getTime() - slot.hours * 60 * 60 * 1000);
    if (fireDate <= now) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${event.title} — ${slot.label}`,
          body: place ? `Buluşma yeri: ${place}` : 'Etkinliğin yaklaşıyor.',
          data: { screen: 'EventDetail', eventId: event.id },
        },
        trigger: fireDate,
      });
      ids.push(id);
    } catch (e) {
      if (__DEV__) console.warn('Reminder zamanlanamadı:', e.message);
    }
  }

  if (ids.length > 0) {
    await AsyncStorage.setItem(`@event_reminders_${event.id}`, JSON.stringify(ids));
  }
}

/**
 * Etkinlik için zamanlanmış tüm reminder'ları iptal eder.
 */
export async function cancelEventReminders(eventId) {
  if (!eventId) return;
  const key = `@event_reminders_${eventId}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const ids = JSON.parse(raw);
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (_) { /* zaten geçmiş olabilir */ }
    }
    await AsyncStorage.removeItem(key);
  } catch (e) {
    if (__DEV__) console.warn('Reminder iptal hatası:', e.message);
  }
}
