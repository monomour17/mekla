import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback, Keyboard, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { compressImage } from '../../utils/photos';
import { registerForPushNotifications, savePushToken } from '../../services/notifications';
import useAppStore from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';

export default function BusinessAboutScreen({ navigation, route }) {
  const { businessName, category, city, logoUri, coverUri } = route.params;
  const { user } = useAuth();
  const setHasProfile = useAppStore((state) => state.setHasProfile);

  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!user || loading) return;
    setLoading(true);

    try {
      // Logo yükle (zorunlu)
      let logoUrl = null;
      if (logoUri) {
        const compressed = await compressImage(logoUri);
        const fileName = `${user.id}/business_logo/${Date.now()}.jpg`;
        const resp = await fetch(compressed);
        const buf = await resp.arrayBuffer();
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(fileName, buf, { contentType: 'image/jpeg' });
        if (upErr) {
          Alert.alert('Hata', 'Logo yüklenemedi, tekrar dene.');
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      // Kapak yükle (opsiyonel)
      let coverUrl = null;
      if (coverUri) {
        const compressed = await compressImage(coverUri);
        const fileName = `${user.id}/business_cover/${Date.now()}.jpg`;
        const resp = await fetch(compressed);
        const buf = await resp.arrayBuffer();
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(fileName, buf, { contentType: 'image/jpeg' });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
          coverUrl = publicUrl;
        }
      }

      // Profile kaydet (upsert: varsa güncelle, yoksa oluştur)
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        account_type: 'business',
        display_name: businessName,
        city,
        business_name: businessName,
        business_category: category,
        business_bio: bio.trim() || null,
        business_address: address.trim() || null,
        business_website: website.trim() || null,
        business_instagram: instagram.trim().replace('@', '') || null,
        business_cover_url: coverUrl,
        photos: logoUrl ? [logoUrl] : [],
        is_active: true,
        looking_for: 'both',
        has_children: false,
        children_ages: [],
      });

      if (error) {
        Alert.alert('Hata', error.message ?? 'Profil kaydedilemedi, tekrar dene.');
        return;
      }

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        {/* Scroll edilebilir içerik */}
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.step}>3 / 3</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.title}>Hakkında</Text>
              <Text style={styles.subtitle}>Müşterilerinize kendinizi tanıtın</Text>
            </View>
          </View>

          <Text style={styles.label}>Kısa Açıklama</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Örn: Aileler ve çiftler için özel menü, çocuk oyun köşesi, hafta sonu brunch..."
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{bio.length}/200</Text>

          <Text style={styles.label}>Adres / İlçe</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Bağdat Cad. No:12, Kadıköy"
            value={address}
            onChangeText={setAddress}
            maxLength={150}
          />

          <Text style={styles.label}>Web Sitesi</Text>
          <TextInput
            style={styles.input}
            placeholder="https://işletmeniz.com"
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            placeholder="@kullaniciadi"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />

          <View style={styles.finishCard}>
            <Text style={styles.finishEmoji}>🎉</Text>
            <Text style={styles.finishTitle}>Hazırsınız!</Text>
            <Text style={styles.finishSub}>
              <Text style={styles.bold}>{businessName}</Text> işletme profili oluşturulacak.
              Hemen etkinlik oluşturup müşterilerinize duyurabilirsiniz.
            </Text>
          </View>
        </ScrollView>

        {/* Sabit alt buton — her zaman görünür */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleFinish}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Profili Oluştur"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Profili Oluştur</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const PRIMARY = '#6C47FF';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 28 },
  headerLeft: { alignItems: 'center', gap: 4, paddingTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  step: { color: '#aaa', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#1a1a1a', marginBottom: 20,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 13 },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: -16, marginBottom: 20 },
  finishCard: {
    backgroundColor: '#F5F2FF', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 28, marginTop: 8,
  },
  finishEmoji: { fontSize: 40, marginBottom: 10 },
  finishTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  finishSub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21 },
  bold: { fontWeight: '700', color: PRIMARY },
  button: {
    backgroundColor: PRIMARY, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
