/**
 * Centralized Turkish string constants / labels.
 * Import selectively:  import { LABELS, MESSAGES, PLACEHOLDERS } from '../constants/strings';
 */

export const LABELS = {
  // Tabs
  feed: 'Akış',
  groups: 'Gruplar',
  events: 'Etkinlikler',
  chats: 'Sohbetler',
  profile: 'Profil',
  discover: 'Keşfet',
  myEvents: 'Etkinliklerim',

  // Actions
  share: 'Paylaş',
  cancel: 'İptal',
  save: 'Kaydet',
  delete: 'Sil',
  edit: 'Düzenle',
  send: 'Gönder',
  close: 'Kapat',
  back: 'Geri',
  join: 'Katıl',
  leave: 'Ayrıl',
  approve: 'Onayla',
  reject: 'Reddet',
  block: 'Engelle',
  report: 'Şikayet Et',
  refresh: 'Yenile',
  loadMore: 'Daha Fazla',
  retry: 'Tekrar Dene',

  // Post types
  moment: 'Anı',
  notice: 'Sesleniş',
  post: 'Gönderi',
  comment: 'Yorum',

  // Event statuses
  open: 'Açık',
  full: 'Dolu',
  finished: 'Bitti',
  cancelled: 'İptal Edildi',
  pending: 'Bekliyor',
  approved: 'Onaylandı',

  // Profile
  displayName: 'İsim',
  city: 'Şehir',
  bio: 'Hakkında',
  photos: 'Fotoğraflar',
  settings: 'Ayarlar',
  logout: 'Çıkış Yap',

  // Misc
  members: 'Üye',
  participants: 'Katılımcı',
  comments: 'Yorumlar',
  likes: 'Beğeni',
  location: 'Konum',
  date: 'Tarih',
  time: 'Saat',
};

export const MESSAGES = {
  // Errors
  genericError: 'Bir hata oluştu. Lütfen tekrar dene.',
  networkError: 'İnternet bağlantını kontrol et.',
  permissionRequired: 'Bu işlem için izin gerekli.',
  sessionExpired: 'Oturumun sona erdi. Lütfen tekrar giriş yap.',
  photoPermission: 'Fotoğraf seçmek için galeri izni gerekli.',
  cameraPermission: 'Kamera kullanmak için kamera izni gerekli.',

  // Success
  saved: 'Kaydedildi.',
  deleted: 'Silindi.',
  sent: 'Gönderildi.',
  postCreated: 'Gönderi paylaşıldı.',
  eventCreated: 'Etkinlik oluşturuldu.',

  // Confirmations
  confirmDelete: 'Silmek istediğine emin misin?',
  confirmCancel: 'İptal etmek istediğine emin misin?',
  confirmLeave: 'Ayrılmak istediğine emin misin?',
  confirmBlock: 'Bu kullanıcıyı engellemek istediğine emin misin?',
  confirmLogout: 'Çıkış yapmak istediğine emin misin?',

  // Empty states
  noEvents: 'Henüz etkinlik yok',
  noPosts: 'Henüz paylaşım yok',
  noChats: 'Henüz sohbet yok',
  noComments: 'Henüz yorum yok',
  noMembers: 'Henüz üye yok',
  noResults: 'Sonuç bulunamadı',
};

export const PLACEHOLDERS = {
  search: 'Ara...',
  writeComment: 'Yorum yaz...',
  writeMessage: 'Mesaj yaz...',
  writePost: 'Bir şeyler paylaş...',
  writeMoment: 'Bu anı hakkında bir şeyler yaz...',
  writeNotice: 'Ne yapmak istiyorsun? Herkese seslen!',
  location: 'Konum (opsiyonel)',
  eventTitle: 'Etkinlik başlığı',
  eventDescription: 'Etkinlik açıklaması',
};
