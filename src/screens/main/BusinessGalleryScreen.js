import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Dimensions, ActivityIndicator, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { pickFromGallery, uploadPhoto } from '../../utils/photos';
import { COLORS } from '../../constants/colors';
import FullScreenImageModal from '../../components/FullScreenImageModal';

const { width: SW } = Dimensions.get('window');
const GAP = 3;
const COLS = 3;
const ITEM_SIZE = (SW - GAP * (COLS - 1)) / COLS;

export default function BusinessGalleryScreen({ navigation, route }) {
  const { businessId } = route.params ?? {};
  const { user } = useAuth();
  const isOwner = !businessId || businessId === user?.id;
  const targetId = businessId ?? user?.id;

  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState({ visible: false, index: 0 });

  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('photos')
        .eq('id', targetId)
        .single();
      if (error) throw error;
      const photos = data?.photos ?? [];
      setLogoUrl(photos[0] ?? null);
      setGalleryPhotos(photos.slice(1));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const uri = await pickFromGallery({ quality: 0.85 });
      if (!uri) return;
      const publicUrl = await uploadPhoto('photos', `${user.id}/gallery`, uri);
      const updated = [...galleryPhotos, publicUrl];
      const newPhotos = logoUrl ? [logoUrl, ...updated] : updated;
      await supabase.from('profiles').update({ photos: newPhotos }).eq('id', user.id);
      setGalleryPhotos(updated);
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (uri) => {
    Alert.alert('Fotoğrafı Sil', 'Galeriden kaldırmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          const updated = galleryPhotos.filter((p) => p !== uri);
          const newPhotos = logoUrl ? [logoUrl, ...updated] : updated;
          setGalleryPhotos(updated); // optimistic
          const { error } = await supabase.from('profiles').update({ photos: newPhotos }).eq('id', user.id);
          if (error) {
            setGalleryPhotos(galleryPhotos); // rollback
            Alert.alert('Hata', 'Fotoğraf silinemedi.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.item}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setViewer({ visible: true, index })}
        style={{ flex: 1 }}
      >
        <Image source={{ uri: item }} style={styles.photo} contentFit="cover" />
      </TouchableOpacity>
      {isOwner && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAddTile = () => {
    if (!isOwner) return null;
    return (
      <TouchableOpacity style={styles.addTile} onPress={handleAdd} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <Ionicons name="add" size={32} color={COLORS.primary} />
            <Text style={styles.addTileText}>Ekle</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galeri</Text>
        {isOwner ? (
          <TouchableOpacity style={styles.addHeaderBtn} onPress={handleAdd} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Ionicons name="add" size={26} color={COLORS.primary} />
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color="#ccc" />
          <Text style={{ color: '#aaa', marginTop: 12, fontSize: 15 }}>Galeri yüklenemedi</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={isOwner ? ['__add__', ...galleryPhotos] : galleryPhotos}
          keyExtractor={(item, i) => item === '__add__' ? 'add' : `${i}-${item}`}
          numColumns={COLS}
          renderItem={({ item }) =>
            item === '__add__' ? renderAddTile() : renderItem({ item })
          }
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={48} color="#ddd" />
              <Text style={styles.emptyTitle}>Henüz fotoğraf yok</Text>
              {isOwner && (
                <TouchableOpacity style={styles.emptyBtn} onPress={handleAdd}>
                  <Text style={styles.emptyBtnText}>İlk fotoğrafı ekle</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          columnWrapperStyle={{ gap: GAP }}
        />
      )}

      <FullScreenImageModal
        uris={galleryPhotos}
        initialIndex={viewer.index}
        visible={viewer.visible}
        onClose={() => setViewer({ visible: false, index: 0 })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  addHeaderBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  grid: { padding: GAP },

  item: { width: ITEM_SIZE, height: ITEM_SIZE, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  deleteBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12,
  },

  addTile: {
    width: ITEM_SIZE, height: ITEM_SIZE,
    backgroundColor: '#f5f2ff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd6fe', borderStyle: 'dashed',
    gap: 4,
  },
  addTileText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyTitle: { fontSize: 16, color: '#aaa', fontWeight: '600' },
  emptyBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
