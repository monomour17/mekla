import AsyncStorage from '@react-native-async-storage/async-storage';

// Sohbet okundu-bilgisi cihazda tutulur: { [eventId]: ISO tarih }.
// Sunucu tarafı read-receipt gerektirmeden "okunmamış" rozetini besler.
const KEY = '@chat_last_read';

export async function getLastReadMap() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function markChatRead(eventId) {
  if (!eventId) return;
  const map = await getLastReadMap();
  map[eventId] = new Date().toISOString();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Yazılamazsa rozet bir sonraki açılışta tekrar görünür — kritik değil
  }
}

export function isUnread(lastMessageTime, lastReadTime) {
  if (!lastMessageTime) return false;
  if (!lastReadTime) return true;
  return new Date(lastMessageTime) > new Date(lastReadTime);
}
