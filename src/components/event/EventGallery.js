import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../EmptyState';
import { COLORS } from '../../constants/colors';

export default function EventGallery({ photos, canUpload, uploading, noAccessMessage, onUpload, onPhotoPress }) {
  return (
    <View style={s.gallerySection}>
      <View style={s.gallerySectionHeader}>
        <Text style={s.sectionTitle}>Etkinlik Anıları</Text>
        {canUpload && (
          <TouchableOpacity style={s.galleryAddBtn} onPress={onUpload} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                <Text style={s.galleryAddText}>Fotoğraf Ekle</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.galleryScroll}>
          {photos.map((photo) => (
            <TouchableOpacity key={photo.id} onPress={() => onPhotoPress(photo)} style={s.galleryThumb}>
              <Image source={{ uri: photo.url }} style={s.galleryThumbImg} contentFit="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <EmptyState icon="images-outline" title="Henüz fotoğraf yok" description="Henüz fotoğraf eklenmemiş." />
      )}
      {noAccessMessage && <Text style={s.galleryNoAccess}>{noAccessMessage}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 10, marginTop: 8 },
  gallerySection: { marginTop: 8, marginBottom: 16 },
  gallerySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  galleryAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  galleryAddText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  galleryScroll: { marginBottom: 8 },
  galleryThumb: { marginRight: 10, borderRadius: 12, overflow: 'hidden' },
  galleryThumbImg: { width: 120, height: 90, borderRadius: 12 },
  galleryNoAccess: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 4 },
});
