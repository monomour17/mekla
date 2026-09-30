import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pickFromGallery, pickFromCamera } from '../../utils/photos';

export default function PhotoScreen({ navigation, route }) {
  const params = route.params;
  const [photoUri, setPhotoUri] = useState(null);

  const pickerOptions = { allowsEditing: true, aspect: [1, 1] };

  const handlePick = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', 'Fotoğraf Çek', 'Galeriden Seç'],
          cancelButtonIndex: 0,
        },
        async (index) => {
          if (index === 1) {
            const uri = await pickFromCamera(pickerOptions);
            if (uri) setPhotoUri(uri);
          } else if (index === 2) {
            const uri = await pickFromGallery(pickerOptions);
            if (uri) setPhotoUri(uri);
          }
        },
      );
    } else {
      Alert.alert('Profil Fotoğrafı', 'Nereden eklemek istersin?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Fotoğraf Çek', onPress: async () => { const uri = await pickFromCamera(pickerOptions); if (uri) setPhotoUri(uri); } },
        { text: 'Galeriden Seç', onPress: async () => { const uri = await pickFromGallery(pickerOptions); if (uri) setPhotoUri(uri); } },
      ]);
    }
  };

  const handleNext = () => {
    if (!photoUri) return;
    navigation.navigate('Finish', { ...params, photoUri });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Geri dön" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.step}>5 / 6</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Bir fotoğraf ekleyin</Text>
            <Text style={styles.subtitle}>
              Organizatörler katılım isteğinde fotoğrafını görür — fotoğraflı profiller çok daha hızlı onaylanır.
            </Text>
          </View>
        </View>

        <View style={styles.photoArea}>
          <TouchableOpacity
            style={styles.photoCircle}
            onPress={handlePick}
            accessibilityRole="button"
            accessibilityLabel={photoUri ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
            activeOpacity={0.8}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <>
                <Ionicons name="camera" size={40} color="#6C47FF" />
                <Text style={styles.photoHint}>Dokun ve ekle</Text>
              </>
            )}
          </TouchableOpacity>

          {photoUri && (
            <TouchableOpacity onPress={handlePick} accessibilityRole="button" accessibilityLabel="Fotoğrafı değiştir">
              <Text style={styles.changeLink}>Fotoğrafı değiştir</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, !photoUri && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!photoUri}
        >
          <Text style={styles.buttonText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 28 },
  headerLeft: { alignItems: 'center', gap: 4, paddingTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  step: { color: '#aaa', fontSize: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20 },
  photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  photoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F5F2FF',
    borderWidth: 2,
    borderColor: '#6C47FF',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  photo: { width: '100%', height: '100%' },
  photoHint: { color: '#6C47FF', fontSize: 14, fontWeight: '600' },
  changeLink: { color: '#6C47FF', fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: '#6C47FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
