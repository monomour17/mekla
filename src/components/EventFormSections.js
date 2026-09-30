import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/* ── Cover Photo Section ─────────────────────────────────────── */

export function CoverPhotoSection({ coverPhoto, onPickCover }) {
  return (
    <TouchableOpacity style={styles.coverPhotoBtn} onPress={onPickCover} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={coverPhoto ? "Kapak fotoğrafını değiştir" : "Kapak fotoğrafı ekle"}>
      {coverPhoto ? (
        <>
          <Image source={{ uri: coverPhoto }} style={styles.coverPhotoImg} />
          <View style={styles.coverPhotoOverlay}>
            <Ionicons name="camera" size={20} color={COLORS.white} />
            <Text style={styles.coverPhotoOverlayText}>Değiştir</Text>
          </View>
        </>
      ) : (
        <>
          <Ionicons name="image-outline" size={36} color="#ccc" />
          <Text style={styles.coverPhotoPlaceholder}>Kapak Fotoğrafı Ekle</Text>
          <Text style={styles.coverPhotoSub}>Opsiyonel · 16:9</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ── Participation Terms Section ─────────────────────────────── */

export function ParticipationTermsSection({
  selectedAccountTypes,
  toggleAccountType,
  selectedLookingFor,
  toggleLookingFor,
  requireChildren,
  setRequireChildren,
  accountTypeOptions,
  lookingForOptions,
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Katılım Şartları</Text>
      <Text style={styles.sectionSub}>Bu filtreler kimlerin istek gönderebileceğini belirler.</Text>

      <Text style={styles.label}>Hesap Türü</Text>
      <View style={styles.chipRow}>
        {accountTypeOptions.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filterChip, selectedAccountTypes.includes(t.id) && styles.filterChipActive]}
            onPress={() => toggleAccountType(t.id)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: selectedAccountTypes.includes(t.id) }}
          >
            <Text style={[styles.filterChipText, selectedAccountTypes.includes(t.id) && styles.filterChipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedAccountTypes.length === 0 && (
        <Text style={styles.validationHint}>En az bir tür seçilmeli</Text>
      )}

      <Text style={[styles.label, { marginTop: 16 }]}>Arama Tipi</Text>
      <View style={styles.chipRow}>
        {lookingForOptions.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filterChip, selectedLookingFor.includes(t.id) && styles.filterChipActive]}
            onPress={() => toggleLookingFor(t.id)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: selectedLookingFor.includes(t.id) }}
          >
            <Text style={[styles.filterChipText, selectedLookingFor.includes(t.id) && styles.filterChipTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {selectedLookingFor.length === 0 && (
        <Text style={styles.validationHint}>En az bir tür seçilmeli</Text>
      )}

      <View style={[styles.switchRow, { marginTop: 20 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.switchLabel}>Çocuk Zorunlu</Text>
          <Text style={styles.switchSub}>Sadece çocuğu olan aileler görebilsin.</Text>
        </View>
        <Switch
          value={requireChildren}
          onValueChange={setRequireChildren}
          trackColor={{ false: '#e1e1e1', true: COLORS.avatarFallback }}
          thumbColor={requireChildren ? COLORS.primary : COLORS.white}
          accessibilityRole="switch"
          accessibilityLabel="Çocuk zorunlu"
        />
      </View>
    </>
  );
}

/* ── Styles ───────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  // Cover photo
  coverPhotoBtn: {
    height: 160, borderRadius: 16, backgroundColor: '#f5f5f5',
    borderWidth: 1.5, borderColor: '#e8e8e8', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 28, overflow: 'hidden',
  },
  coverPhotoImg: { width: '100%', height: '100%' },
  coverPhotoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.overlay, paddingVertical: 8,
  },
  coverPhotoOverlayText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  coverPhotoPlaceholder: { fontSize: 15, fontWeight: '600', color: '#aaa', marginTop: 10 },
  coverPhotoSub: { fontSize: 12, color: '#ccc', marginTop: 4 },

  // Participation terms
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  sectionSub: { fontSize: 13, color: '#888', marginTop: -12, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee',
  },
  filterChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: COLORS.primary },

  validationHint: { fontSize: 12, color: COLORS.error, marginTop: -14, marginBottom: 16 },

  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9',
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  switchSub: { fontSize: 12, color: '#888' },
});
