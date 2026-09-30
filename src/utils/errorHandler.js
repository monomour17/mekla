import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { captureError } from '../services/monitoring';

/**
 * Kullanıcı dostu hata mesajları.
 * Önce internet bağlantısını kontrol eder, sonra hata tipine göre mesaj verir.
 *
 * @param {string}  action   - Yapılmaya çalışılan işlem (örn: 'Fotoğraf yükle')
 * @param {Error|object} error - Hata objesi
 * @param {object}  options  - { silent: bool, onRetry: func }
 */
export async function handleError(action, error, options = {}) {
  const { silent = false, onRetry } = options;

  // Network kontrolü
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    if (!silent) {
      Alert.alert(
        'Bağlantı Yok',
        'İnternet bağlantını kontrol edip tekrar dene.',
        onRetry
          ? [
              { text: 'Tamam', style: 'cancel' },
              { text: 'Tekrar Dene', onPress: onRetry },
            ]
          : [{ text: 'Tamam' }]
      );
    }
    return;
  }

  // Supabase / API hata mesajları
  const message = extractMessage(action, error);

  if (!silent) {
    Alert.alert(
      'Bir Sorun Oluştu',
      message,
      onRetry
        ? [
            { text: 'Tamam', style: 'cancel' },
            { text: 'Tekrar Dene', onPress: onRetry },
          ]
        : [{ text: 'Tamam' }]
    );
  }

  // Console'a detaylı hata + Sentry'ye non-fatal rapor
  if (__DEV__) console.error(`[${action}]`, error);
  captureError(error, { action });
}

function extractMessage(action, error) {
  const msg = error?.message || error?.error_description || '';

  // Auth hataları
  if (msg.includes('Invalid login credentials')) return 'Giriş bilgileri hatalı.';
  if (msg.includes('Email not confirmed')) return 'E-posta doğrulanmamış.';
  if (msg.includes('Token expired') || msg.includes('JWT expired')) return 'Oturum süresi doldu. Lütfen tekrar giriş yap.';
  if (msg.includes('rate limit') || msg.includes('too many requests')) return 'Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.';

  // Storage hataları
  if (msg.includes('Payload too large') || msg.includes('file size')) return 'Dosya çok büyük. Daha küçük bir dosya seç.';
  if (msg.includes('row-level security')) return 'Bu işlem için yetkin yok.';
  if (msg.includes('storage')) return `${action} sırasında depolama hatası oluştu.`;

  // DB hataları
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) return 'Bu kayıt zaten mevcut.';
  if (msg.includes('foreign key') || msg.includes('not found')) return 'İlgili kayıt bulunamadı.';
  if (msg.includes('permission denied')) return 'Bu işlem için yetkin yok.';

  // Genel
  if (msg) return `${action} başarısız: ${msg}`;
  return `${action} sırasında bir hata oluştu. Lütfen tekrar dene.`;
}

/**
 * OTP gönderim hatalarını kullanıcı dostu Türkçe mesaja çevirir.
 * Supabase Auth bazı hataları İngilizce ve teknik döndürür (yerleşik
 * throttle, SMS hook hataları) — bunları olduğu gibi göstermeyiz.
 */
export function otpSendErrorMessage(error) {
  const msg = error?.message || '';

  // Supabase yerleşik freni: numara başına ~60 sn'de 1 SMS
  if (msg.includes('security purposes')) {
    return 'Çok sık kod istedin. Bir dakika bekleyip tekrar dene.';
  }
  // SMS hook hatası — çoğunlukla saatlik rate limit'imize takıldı demektir
  if (msg.includes('unavailable due to hook') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Bu numaraya art arda çok fazla kod istendi. Bir süre bekleyip tekrar dene.';
  }
  if (msg.includes('Invalid') && msg.toLowerCase().includes('phone')) {
    return 'Geçerli bir telefon numarası girin.';
  }
  return 'Kod gönderilemedi. Birazdan tekrar dene.';
}

/**
 * Basit try-catch sarmalayıcı.
 * Başarılı olursa sonucu, hata olursa null döner ve kullanıcıya bildirir.
 *
 * @param {string}   action  - İşlem adı
 * @param {Function} fn      - Async fonksiyon
 * @param {object}   options - handleError'a iletilir
 * @returns {any|null}
 */
export async function trySafe(action, fn, options = {}) {
  try {
    return await fn();
  } catch (error) {
    await handleError(action, error, options);
    return null;
  }
}
