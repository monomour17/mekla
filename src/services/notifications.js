import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Bildirim geldiğinde uygulamanın ön plandayken nasıl davranacağını ayarla
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Push notification izni iste ve Expo Push Token al.
 * @returns {string|null} Expo push token veya null
 */
export async function registerForPushNotifications() {
  // Push notification sadece gerçek cihazda çalışır
  if (!Device.isDevice) {
    if (__DEV__) console.warn('Push notifications yalnızca gerçek cihazlarda çalışır.');
    return null;
  }

  // Mevcut izin durumunu kontrol et
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // İzin yoksa iste
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.warn('Push notification izni verilmedi.');
    return null;
  }

  // Android için notification channel (kanal) oluştur
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Varsayılan',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C47FF',
    });
  }

  // Expo Push Token al
  // projectId: app.json → extra.eas.projectId varsa kullan, yoksa Expo Go otomatik algılar
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {},
    );
    return tokenData.data;
  } catch (e) {
    if (__DEV__) console.warn('Expo push token alınamadı (projectId eksik olabilir):', e.message);
    return null;
  }
}

/**
 * Push token'ı Supabase profiles tablosuna kaydet.
 * @param {string} userId - Kullanıcı ID
 * @param {string} token - Expo Push Token
 */
export async function savePushToken(userId, token) {
  if (!userId || !token) return;
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error && __DEV__) {
    console.error('Push token kaydedilemedi:', error.message);
  }
}

/**
 * Kullanıcı çıkış yaptığında push token'ı temizle.
 * @param {string} userId
 */
export async function clearPushToken(userId) {
  if (!userId) return;
  await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', userId);
}

/**
 * Bildirim dinleyicilerini kur.
 * Bildirime tıklandığında uygun ekrana yönlendirme yapar.
 * @param {object} navigationRef - React Navigation ref
 * @returns {function} cleanup fonksiyonu
 */
export function setupNotificationListeners(navigationRef) {
  // Bildirime tıklanınca
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (!navigationRef?.current) return;

    // navigationRef root seviyede çalışıyor (MainStack) — 'Etkinlikler'/'Topluluk'/
    // 'Profil' sekmeleri MainTabs'ın içinde bir seviye daha derinde, önce
    // MainTabs'a inmek gerekiyor, aksi halde yönlendirme sessizce başarısız oluyor.
    if (data?.screen === 'EventRequests') {
      navigationRef.current.navigate('MainTabs', {
        screen: 'Profil',
        params: { screen: 'EventRequests' },
      });
    } else if (data?.eventId) {
      // screen alanı gönderilmese bile eventId taşıyan tüm bildirimler
      // (katılım onayı, soru, işletme etkinliği...) etkinlik detayına gider
      navigationRef.current.navigate('MainTabs', {
        screen: 'Etkinlikler',
        params: { screen: 'EventDetail', params: { eventId: data.eventId } },
      });
    } else if (data?.postId) {
      // Cevapsız gönderi kurtarma bildirimi: gönderi detayına gider
      navigationRef.current.navigate('MainTabs', {
        screen: 'Topluluk',
        params: { screen: 'PostDetail', params: { postId: data.postId } },
      });
    }
  });

  // Ön plandayken bildirim alındığında (opsiyonel loglama)
  const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) {
      console.log('Bildirim alındı:', notification.request.content);
    }
  });

  return () => {
    responseSubscription.remove();
    notificationSubscription.remove();
  };
}
