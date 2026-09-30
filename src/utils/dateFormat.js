export const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/**
 * "2 dk", "3 sa", "5 gün", "12 Oca" gibi göreceli zaman
 */
export function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * "5 Haziran Cuma, 18:00" formatı
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const dayName = DAYS_TR[d.getDay()];
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${dayName}, ${hours}:${mins}`;
}

/**
 * Sesleniş süre kaldı: "42 dk kaldı", "3 sa kaldı"
 */
export function expiresIn(expiresAt) {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = Math.floor((exp - now) / 1000);
  if (diff <= 0) return null;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk kaldı`;
  return `${Math.floor(diff / 3600)} sa kaldı`;
}

/**
 * Güven sinyali: "Yeni üye", "3 aydır üye", "2 yıldır üye"
 */
export function membershipDuration(createdAt) {
  if (!createdAt) return null;
  const now = new Date();
  const joined = new Date(createdAt);
  const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  if (months < 1) return 'Yeni üye';
  if (months < 12) return `${months} aydır üye`;
  const years = Math.floor(months / 12);
  return `${years} yıldır üye`;
}

/**
 * Sohbet listesi: "Az önce", "14:30", "Dün", "12.03"
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk`;

  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear()) {
    return 'Dün';
  }

  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
