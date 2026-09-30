import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Hafif dokunmatik geri bildirim — buton basımları, beğeni, kaydetme.
 */
export function lightImpact() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Orta şiddetli geri bildirim — eşleşme, onaylama.
 */
export function mediumImpact() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Ağır geri bildirim — silme, engelleme gibi yıkıcı eylemler.
 */
export function heavyImpact() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Başarı bildirimi — kayıt tamamlandı, mesaj gönderildi.
 */
export function successNotification() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Hata bildirimi — validasyon hatası.
 */
export function errorNotification() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Seçim değişimi — tab geçişi, picker seçimi.
 */
export function selectionFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync();
}
