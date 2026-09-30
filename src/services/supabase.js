import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Telefon kilitliyken (veya kilitlenme anında) iOS Keychain erişimi
// "User interaction is not allowed" hatasıyla reddedebilir — bu, ham haliyle
// Supabase'in her isteğine (sadece login değil) sızıp konsolda hataya, bazen
// başarısız sorgulara yol açıyordu. Kök nedeni de kapatıyoruz: varsayılan
// erişilebilirlik WHEN_UNLOCKED (kilitliyken hiç okunamaz) yerine
// AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY kullanıyoruz — oturum token'ı cihaz
// açıldıktan sonraki ilk kilit açılıştan itibaren kilitliyken de okunabilir
// kalıyor. try/catch yine de defans olarak duruyor (Android'de bu seçenek
// geçerli değil, yine de en kötü ihtimalle bir istek geçici oturumsuz görünür).
const KEYCHAIN_OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const SecureStoreAdapter = {
  getItem: async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      if (__DEV__) console.warn('[supabase] SecureStore okunamadı (muhtemelen cihaz kilitli):', err.message);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
    } catch (err) {
      if (__DEV__) console.warn('[supabase] SecureStore yazılamadı:', err.message);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      if (__DEV__) console.warn('[supabase] SecureStore silinemedi:', err.message);
    }
  },
};

// Ağ donarsa (uçak modu aç/kapa, hotspot kopması vb.) native fetch süresiz
// asılı kalabilir. Ekran seviyesindeki withTimeout'lar (OTPScreen, checkProfile)
// sadece kullanıcıya mesaj gösteriyor — altta asılı kalan isteği gerçekten iptal
// etmiyor, bu yüzden "Tekrar Dene"den sonra bile eski istek kaynakları meşgul
// tutmaya devam edebiliyor ve tek çıkış uygulamayı kapat-aç oluyordu. Burada
// TÜM istekleri (auth/DB/storage — hepsi `global.fetch`'i paylaşır) tek noktadan
// gerçek bir AbortController ile sarmalayıp belirli bir süre sonra native
// seviyede iptal ediyoruz, ekran seviyesi timeout'lardan biraz daha geç ki
// kullanıcı mesajı görsün ama isteğin kendisi de temizlensin.
const FETCH_TIMEOUT_MS = 20000;

function timeoutFetch(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Çağıran taraf zaten kendi abortSignal'ini verdiyse (ör. .abortSignal()),
  // onu da dinleyip bizim controller'ı da tetikleyelim.
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: timeoutFetch,
  },
});
