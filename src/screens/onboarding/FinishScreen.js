import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { uploadPhoto } from '../../utils/photos';
import { registerForPushNotifications, savePushToken } from '../../services/notifications';
import useAppStore from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';
import { track, EVENTS } from '../../services/analytics';

// Onboarding'de toplanan sinyalleri, platformun sabit alan listesindeki
// isimlere eşler. Yanlış/loose bir eşleşme yapmaktansa eşleşmeyeni boş bırakır —
// alan listesi genişledikçe buraya yeni kural eklenebilir.
function matchCommunityNames({ hasChildren, childrenAges, accountType }) {
  const names = new Set();
  if (hasChildren && childrenAges?.includes('0-2')) names.add('0-3 Yaş Ebeveynleri');
  if (hasChildren && accountType === 'individual') names.add('Tek Ebeveynler');
  return [...names];
}

export default function FinishScreen({ route }) {
  const { user } = useAuth();
  const { name, city, accountType, lookingFor, hasChildren, childCount, childrenAges, photoUri } =
    route.params;
  const setHasProfile = useAppStore((state) => state.setHasProfile);
  const joinedCommunities = useAppStore((state) => state.joinedCommunities);
  const setJoinedCommunities = useAppStore((state) => state.setJoinedCommunities);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!user || loading) return;
    setLoading(true);

    try {
      // Profil fotoğrafını yükle (onboarding'de zorunlu adım).
      // Yükleme başarısız olursa hesabı fotoğrafsız açmak yerine kullanıcıya
      // tekrar denetiriz — güven modeli fotoğrafa dayanıyor.
      let photos = [];
      if (photoUri) {
        try {
          const url = await uploadPhoto('photos', user.id, photoUri);
          photos = [url];
        } catch (e) {
          Alert.alert('Hata', 'Fotoğraf yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
          return;
        }
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        account_type: accountType,
        display_name: name,
        city,
        looking_for: lookingFor,
        has_children: hasChildren ?? false,
        child_count: hasChildren ? childCount : null,
        children_ages: hasChildren ? childrenAges : [],
        is_active: true,
        photos,
      });

      if (error) {
        Alert.alert('Hata', 'Profil kaydedilemedi, tekrar dene.');
        return;
      }

      track(EVENTS.ONBOARDING_COMPLETED, {
        account_type: accountType,
        city,
        has_children: hasChildren ?? false,
      });

      // Profil verisine uyan sabit alanlara otomatik üye yap — kullanıcı
      // "burası benim için" hissini alanı kendi aramadan, ilk açılışta alsın.
      try {
        const matchedNames = matchCommunityNames({ hasChildren, childrenAges, accountType });
        if (matchedNames.length > 0) {
          const { data: matched } = await supabase
            .from('communities')
            .select('id')
            .in('name', matchedNames);
          const matchedIds = (matched ?? []).map((c) => c.id);
          if (matchedIds.length > 0) {
            await supabase
              .from('user_communities')
              .upsert(
                matchedIds.map((community_id) => ({ user_id: user.id, community_id })),
                { onConflict: 'user_id,community_id', ignoreDuplicates: true },
              );
            setJoinedCommunities([...new Set([...(joinedCommunities ?? []), ...matchedIds])]);
            matchedIds.forEach((community_id) =>
              track(EVENTS.COMMUNITY_JOINED, { community_id, source: 'onboarding_auto' }),
            );
          }
        }
      } catch { /* otomatik alan eşleşmesi başarısız olsa da onboarding'i engelleme */ }

      // Profil başarıyla oluşturuldu: onboarding bağlamında push izni iste.
      // Kullanıcı nedenini bilerek izin veriyor (yeni topluluk üyesi).
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken) await savePushToken(user.id, pushToken);
      } catch { /* push başarısız olsa da devam et */ }

      setHasProfile(true);
    } catch (e) {
      Alert.alert('Hata', 'Bir şeyler ters gitti, tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.step}>6 / 6</Text>

        <View style={styles.centerContent}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Hazırsınız!</Text>
          <Text style={styles.subtitle}>
            Merhaba <Text style={styles.name}>{name}</Text> — {city} çevresindeki
            etkinlikler ve topluluklar sizi bekliyor.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Haydi Başlayalım!</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  step: { color: '#aaa', fontSize: 13, marginBottom: 12 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  name: { fontWeight: '700', color: '#6C47FF' },
  button: {
    backgroundColor: '#6C47FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
