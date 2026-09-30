import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { LABELS } from '../constants/strings';

const { width: SW } = Dimensions.get('window');
const SLOT_GAP = 8;
const SLOT_SIZE = (SW - 40 - SLOT_GAP * 2) / 3;
const MAX_PHOTOS = 6;

const LOOKING_OPTIONS = [
  { id: 'family', label: 'Aile Buluşmaları' },
  { id: 'couple', label: 'Çift Buluşmaları' },
  { id: 'both', label: 'Her İkisi' },
];
const AGE_GROUPS = [
  { id: '0-2', label: '0–2 yaş', emoji: '👶' },
  { id: '3-5', label: '3–5 yaş', emoji: '🧒' },
  { id: '6-10', label: '6–10 yaş', emoji: '🧑' },
  { id: '11+', label: '11+ yaş', emoji: '👦' },
];
const COUNTS = ['1', '2', '3', '4+'];

export default function ProfileEditForm({
  photos,
  editFields,
  setEditFields,
  onSave,
  onCancel,
  onAddPhoto,
  onRemovePhoto,
  onMovePhoto,
  photoUploading,
  saving,
  isValid,
}) {
  const { name, bio, city, lookingFor, hasChildren, childCount, childrenAges } = editFields;

  const setField = (key, value) => setEditFields((prev) => ({ ...prev, [key]: value }));

  const toggleAge = (id) => {
    const max = childCount === '4+' ? 4 : childCount ? parseInt(childCount) : 0;
    setEditFields((prev) => {
      const ages = prev.childrenAges;
      if (ages.includes(id)) return { ...prev, childrenAges: ages.filter((a) => a !== id) };
      if (ages.length >= max) return prev;
      return { ...prev, childrenAges: [...ages, id] };
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.editHeader}>
        <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
          <Text style={styles.editHeaderCancel}>{LABELS.cancel}</Text>
        </TouchableOpacity>
        <Text style={styles.editHeaderTitle}>Profili Düzenle</Text>
        <TouchableOpacity onPress={onSave} disabled={!isValid || saving} accessibilityRole="button" accessibilityLabel={LABELS.save}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={[styles.editHeaderSave, (!isValid || saving) && { opacity: 0.4 }]}>
              {LABELS.save}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.editScroll}>
        {/* Fotoğraflar */}
        <Text style={[styles.fieldLabel, { marginTop: 0 }]}>
          {LABELS.photos} ({photos.length}/{MAX_PHOTOS})
        </Text>
        <View style={styles.photoGrid}>
          {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
            const photo = photos[i];
            return (
              <TouchableOpacity
                key={i}
                style={styles.photoSlot}
                onPress={() => !photo && !photoUploading && onAddPhoto()}
                activeOpacity={photo ? 1 : 0.7}
                accessibilityRole="button"
                accessibilityLabel={photo ? `Fotoğraf ${i + 1}` : 'Fotoğraf ekle'}
              >
                {photo ? (
                  <>
                    <Image source={{ uri: photo }} style={styles.slotImage} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.slotRemove}
                      onPress={() => onRemovePhoto(photo)}
                      accessibilityRole="button"
                      accessibilityLabel={`Fotoğraf ${i + 1} sil`}
                    >
                      <Text style={styles.slotRemoveText}>✕</Text>
                    </TouchableOpacity>
                    {i === 0 && (
                      <View style={styles.slotMainBadge}>
                        <Text style={styles.slotMainText}>Ana</Text>
                      </View>
                    )}
                    {photos.length > 1 && (
                      <View style={styles.slotArrows}>
                        {i > 0 && (
                          <TouchableOpacity
                            style={styles.arrowBtn}
                            onPress={() => onMovePhoto(i, i - 1)}
                            accessibilityRole="button"
                            accessibilityLabel="Fotoğrafı sola taşı"
                          >
                            <Text style={styles.arrowText}>‹</Text>
                          </TouchableOpacity>
                        )}
                        {i < photos.length - 1 && (
                          <TouchableOpacity
                            style={styles.arrowBtn}
                            onPress={() => onMovePhoto(i, i + 1)}
                            accessibilityRole="button"
                            accessibilityLabel="Fotoğrafı sağa taşı"
                          >
                            <Text style={styles.arrowText}>›</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.slotAddIcon}>+</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {photoUploading && (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
        )}

        {/* İsim */}
        <Text style={styles.fieldLabel}>İsim</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(v) => setField('name', v)}
          placeholder="Adınız"
          placeholderTextColor="#aaa"
          accessibilityLabel="İsim"
        />

        {/* Hakkımızda */}
        <Text style={styles.fieldLabel}>Hakkımızda</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={(v) => setField('bio', v)}
          placeholder="Kendinizi / çiftinizi kısaca tanıtın..."
          placeholderTextColor="#aaa"
          multiline
          maxLength={300}
          accessibilityLabel="Hakkımızda"
        />
        <Text style={styles.charCount}>{bio.length}/300</Text>

        {/* Şehir */}
        <Text style={styles.fieldLabel}>Şehir</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={(v) => setField('city', v)}
          placeholder="Şehriniz"
          placeholderTextColor="#aaa"
          accessibilityLabel="Şehir"
        />

        {/* Arıyor */}
        <Text style={styles.fieldLabel}>Ne arıyorsunuz?</Text>
        <View style={styles.optionRow}>
          {LOOKING_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.optionChip, lookingFor === o.id && styles.optionChipSelected]}
              onPress={() => setField('lookingFor', o.id)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: lookingFor === o.id }}
            >
              <Text style={[styles.optionText, lookingFor === o.id && styles.optionTextSelected]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Çocuk */}
        <Text style={styles.fieldLabel}>Çocuğunuz var mı?</Text>
        <View style={styles.yesNo}>
          <TouchableOpacity
            style={[styles.choice, hasChildren && styles.choiceSelected]}
            onPress={() => setField('hasChildren', true)}
            accessibilityRole="button"
            accessibilityLabel="Evet"
            accessibilityState={{ selected: hasChildren }}
          >
            <Text style={styles.choiceText}>Evet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choice, !hasChildren && styles.choiceSelected]}
            onPress={() => {
              setEditFields((prev) => ({
                ...prev,
                hasChildren: false,
                childCount: null,
                childrenAges: [],
              }));
            }}
            accessibilityRole="button"
            accessibilityLabel="Hayır"
            accessibilityState={{ selected: !hasChildren }}
          >
            <Text style={styles.choiceText}>Hayır</Text>
          </TouchableOpacity>
        </View>

        {hasChildren && (
          <>
            <Text style={styles.fieldLabel}>Kaç çocuğunuz var?</Text>
            <View style={styles.countRow}>
              {COUNTS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.countChip, childCount === c && styles.countChipSelected]}
                  onPress={() => {
                    const max = c === '4+' ? 4 : parseInt(c);
                    setEditFields((prev) => ({
                      ...prev,
                      childCount: c,
                      childrenAges: prev.childrenAges.slice(0, max),
                    }));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${c} çocuk`}
                  accessibilityState={{ selected: childCount === c }}
                >
                  <Text style={[styles.countText, childCount === c && styles.countTextSelected]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Hangi yaş gruplarında?</Text>
            <View style={styles.ageGrid}>
              {AGE_GROUPS.map((ag) => {
                const isSelected = childrenAges.includes(ag.id);
                const max = childCount === '4+' ? 4 : childCount ? parseInt(childCount) : 0;
                const isDisabled = !isSelected && childrenAges.length >= max;
                return (
                  <TouchableOpacity
                    key={ag.id}
                    style={[
                      styles.ageChip,
                      isSelected && styles.ageChipSelected,
                      isDisabled && styles.ageChipDisabled,
                    ]}
                    onPress={() => toggleAge(ag.id)}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={ag.label}
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  >
                    <Text style={styles.ageEmoji}>{ag.emoji}</Text>
                    <Text
                      style={[
                        styles.ageText,
                        isSelected && styles.ageTextSelected,
                        isDisabled && styles.ageTextDisabled,
                      ]}
                    >
                      {ag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },

  // Edit mode header
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: COLORS.white,
  },
  editHeaderTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  editHeaderCancel: { fontSize: 15, color: '#888' },
  editHeaderSave: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP },
  photoSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * 1.3,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  slotImage: { width: '100%', height: '100%' },
  slotRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotRemoveText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  slotMainBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slotMainText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  slotArrows: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 2,
  },
  arrowBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginTop: -1 },
  slotAddIcon: { fontSize: 28, color: '#ccc', fontWeight: '300' },

  // Edit mode form
  editScroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 20 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  bioInput: { height: 80, textAlignVertical: 'top', paddingTop: 13 },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4 },
  optionRow: { gap: 8 },
  optionChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
    alignItems: 'center',
  },
  optionChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, fontWeight: '600', color: '#555' },
  optionTextSelected: { color: COLORS.primary },
  yesNo: { flexDirection: 'row', gap: 12 },
  choice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
    alignItems: 'center',
  },
  choiceSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  choiceText: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  countRow: { flexDirection: 'row', gap: 10 },
  countChip: {
    width: 56,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  countText: { fontSize: 16, fontWeight: '600', color: '#555' },
  countTextSelected: { color: COLORS.primary },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: 6,
  },
  ageChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  ageChipDisabled: { opacity: 0.35 },
  ageEmoji: { fontSize: 16 },
  ageText: { fontSize: 14, color: '#555' },
  ageTextSelected: { color: COLORS.primary, fontWeight: '600' },
  ageTextDisabled: { color: '#bbb' },
});
