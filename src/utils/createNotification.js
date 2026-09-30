import { supabase } from '../services/supabase';

/**
 * Bir kullanıcıya in-app bildirim oluşturur.
 * Push notification gönderme ayrı bir backend (edge function) tarafından
 * notifications tablosundaki INSERT'i dinleyip yapılır.
 *
 * @param {object} params
 * @param {string} params.userId - Hedef kullanıcı
 * @param {string} params.type   - 'request_approved' | 'request_rejected' | 'new_question' | 'question_answered' | 'event_cancelled' | 'event_reminder' | 'new_participant' | 'system'
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {object} [params.data] - { eventId, ... }
 */
export async function createNotification({ userId, type, title, body, data = {} }) {
  if (!userId || !type || !title) return;
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    data,
  });
  if (error && __DEV__) {
    console.warn('Bildirim oluşturulamadı:', error.message);
  }
}
