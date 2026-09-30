import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pickFromGallery, compressImage } from '../../utils/photos';

export default function BusinessMediaScreen({ navigation, route }) {
  const params = route.params;

  const [logoUri, setLogoUri] = useState(null);
  const [coverUri, setCoverUri] = useState(null);
  const [picking, setPicking] = useState(null); // 'logo' | 'cover'

  const pickImage = async (type) => {
    setPicking(type);
    try {
      const aspect = type === 'logo' ? [1, 1] : [16, 9];
      const uri = await pickFromGallery({ allowsEditing: true, aspect, quality: 0.85 });
      if (uri) {
        if (type === 'logo') setLogoUri(uri);
        else setCoverUri(uri);
      }
    } catch (e) {
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    } finally {
      setPicking(null);
    }
  };

  const handleNext = () => {
    navigation.navigate('BusinessAbout', { ...params, logoUri, coverUri });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.step}>2 / 3</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Görsel ve İletişim</Text>
            <Text style={styles.subtitle}>İşletme logosu ve kapak fotoğrafı ekleyin</Text>
          </View>
        </View>

        {/* Logo */}
        <Text style={styles.label}>Logo *</Text>
        <TouchableOpacity
          style={styles.logoBox}
          onPress={() => pickImage('logo')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Logo seç"
        >
          {picking === 'logo' ? (
            <ActivityIndicator color="#6C47FF" />
          ) : logoUri ? (
            <>
              <Image source={{ uri: logoUri }} style={styles.logoImg} contentFit="cover" />
              <View style={styles.changeOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.changeText}>Değiştir</Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="business-outline" size={36} color="#ccc" />
              <Text style={styles.addText}>Logo Ekle</Text>
              <Text style={styles.addSub}>Kare · Önerilen</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Kapak */}
        <Text style={styles.label}>Kapak Fotoğrafı</Text>
        <TouchableOpacity
          style={styles.coverBox}
          onPress={() => pickImage('cover')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Kapak fotoğrafı seç"
        >
          {picking === 'cover' ? (
            <ActivityIndicator color="#6C47FF" />
          ) : coverUri ? (
            <>
              <Image source={{ uri: coverUri }} style={styles.coverImg} contentFit="cover" />
              <View style={styles.changeOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.changeText}>Değiştir</Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="image-outline" size={36} color="#ccc" />
              <Text style={styles.addText}>Kapak Fotoğrafı Ekle</Text>
              <Text style={styles.addSub}>Opsiyonel · 16:9</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !logoUri && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!logoUri}
        >
          <Text style={styles.buttonText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const PRIMARY = '#6C47FF';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 28 },
  headerLeft: { alignItems: 'center', gap: 4, paddingTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  step: { color: '#aaa', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 10 },
  logoBox: {
    width: 120, height: 120, borderRadius: 16,
    backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#e8e8e8',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', marginBottom: 28,
  },
  logoImg: { width: '100%', height: '100%' },
  coverBox: {
    height: 160, borderRadius: 16,
    backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#e8e8e8',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', marginBottom: 32,
  },
  coverImg: { width: '100%', height: '100%' },
  changeOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 8,
  },
  changeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  addText: { fontSize: 14, fontWeight: '600', color: '#aaa', marginTop: 8 },
  addSub: { fontSize: 12, color: '#ccc', marginTop: 3 },
  button: {
    backgroundColor: PRIMARY, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    marginTop: 'auto', marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
