import { AppState } from 'react-native';

function isBackgroundedNetworkError(err) {
  return err instanceof TypeError && typeof err.message === 'string' && err.message.includes('Network request failed');
}

function waitForActive() {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Ekran kilitlenince (uygulama arka plana düşünce) iOS soketi kesiyor ve
 * supabase-js isteği hiç sunucuya ulaşmadan "TypeError: Network request
 * failed" ile düşüyor. Böyle bir durum tespit edilirse (fn çalışırken
 * arka plana geçilmişse) uygulama ön plana dönünce sessizce bir kez daha
 * denenir — kullanıcı hata görmeden akış tamamlanmış olur.
 */
export async function runWithBackgroundRetry(fn) {
  let wentBackground = false;
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') wentBackground = true;
  });

  try {
    return await fn();
  } catch (err) {
    if (wentBackground && isBackgroundedNetworkError(err)) {
      await waitForActive();
      return await fn();
    }
    throw err;
  } finally {
    sub.remove();
  }
}
