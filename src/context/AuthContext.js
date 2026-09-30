import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { clearPushToken } from '../services/notifications';
import { setMonitoringUser } from '../services/monitoring';
import { identifyUser, resetAnalytics } from '../services/analytics';

const AuthContext = createContext({ user: null, session: null, loading: true });

export function AuthProvider({ children }) {
  // undefined = henüz kontrol edilmedi (splash göster)
  // null      = oturum yok
  // Session   = oturum var
  const [session, setSession] = useState(undefined);

  // Stale closure'ı önlemek için mevcut kullanıcı ID'sini ref'te tut.
  // onAuthStateChange SIGNED_OUT geldiğinde session state'i çoktan null olur;
  // ref'te saklanan önceki ID ile clearPushToken çağrılır.
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    // İlk yüklemede mevcut session'ı al
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      currentUserIdRef.current = s?.user?.id ?? null;
      setSession(s ?? null);
      setMonitoringUser(s?.user?.id ?? null);
      if (s?.user?.id) identifyUser(s.user.id);
    });

    // Sonraki değişiklikleri dinle (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      const previousUserId = currentUserIdRef.current;
      currentUserIdRef.current = s?.user?.id ?? null;
      setSession(s ?? null);
      setMonitoringUser(s?.user?.id ?? null);

      if (event === 'SIGNED_IN' && s?.user?.id) {
        identifyUser(s.user.id);
      }

      // Kullanıcı çıkış yaptığında push token'ı ve analitik kimliğini temizle
      if (event === 'SIGNED_OUT' && previousUserId) {
        resetAnalytics();
        try {
          await clearPushToken(previousUserId);
        } catch (err) {
          if (__DEV__) console.error('Push token temizlenemedi:', err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session: session ?? null,
        loading: session === undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
