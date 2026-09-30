import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';
import CityPickerModal from '../CityPickerModal';

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
  photos, photoUploading,
  name, setName, bio, setBio, city, setCity,
  lookingFor, setLookingFor,
  hasChildren, setHasChildren,
  childCount, setChildCount,
  childrenAges, setChildrenAges,
  saving, isValid,
  onSave, onCancel, onAddPhoto, onRemovePhoto, onMovePhoto,
}) {
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  const toggleAge = (id) => {
    const max = childCount === '4+' ? 4 : childCount ? parseInt(childCount) : 0;
    setChildrenAges((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.editHeader}>
        <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
          <Text style={s.editHeaderCancel}>{LABELS.cancel}</Text>
        </TouchableOpacity>
        <Text style={s.editHeaderTitle}>Profili Düzenle</Text>
        <TouchableOpacity onPress={onSave} disabled={!isValid || saving} accessibilityRole="button" accessibilityLabel={LABELS.save}>
          {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
            <Text style={[s.editHeaderSave, (!isValid || saving) && { opacity: 0.4 }]}>{LABELS.save}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.editScroll}>
        {/* Photos */}
        <Text style={[s.fieldLabel, { marginTop: 0 }]}>{LABELS.photos} ({photos.length}/{MAX_PHOTOS})</Text>
        <View style={s.photoGrid}>
          {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
            const photo = photos[i];
            return (
              <TouchableOpacity key={i} style={s.photoSlot} onPress={() => !photo && !photoUploading && onAddPhoto()} activeOpacity={photo ? 1 : 0.7} accessibilityRole="button" accessibilityLabel={photo ? `Fotoğraf ${i + 1}` : 'Fotoğraf ekle'}>
                {photo ? (
                  <>
                    <Image source={{ uri: photo }} style={s.slotImage} contentFit="cover" />
                    <TouchableOpacity style={s.slotRemove} onPress={() => onRemovePhoto(photo)} accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1} sil`}>
                      <Text style={s.slotRemoveText}>✕</Text>
                    </TouchableOpacity>
                    {i === 0 && <View style={s.slotMainBadge}><Text style={s.slotMainText}>Ana</Text></View>}
                    {photos.length > 1 && (
                      <View style={s.slotArrows}>
                        {i > 0 && <TouchableOpacity style={s.arrowBtn} onPress={() => onMovePhoto(i, i - 1)} accessibilityRole="button" accessibilityLabel="Sola taşı"><Text style={s.arrowText}>‹</Text></TouchableOpacity>}
                        {i < photos.length - 1 && <TouchableOpacity style={s.arrowBtn} onPress={() => onMovePhoto(i, i + 1)} accessibilityRole="button" accessibilityLabel="Sağa taşı"><Text style={s.arrowText}>›</Text></TouchableOpacity>}
                      </View>
                    )}
                  </>
                ) : <Text style={s.slotAddIcon}>+</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        {photoUploading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />}

        {/* Name */}
        <Text style={s.fieldLabel}>İsim</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Adınız" placeholderTextColor="#aaa" accessibilityLabel="İsim" />

        {/* Bio */}
        <Text style={s.fieldLabel}>Hakkımızda</Text>
        <TextInput style={[s.input, s.bioInput]} value={bio} onChangeText={setBio} placeholder="Kendinizi / çiftinizi kısaca tanıtın..." placeholderTextColor="#aaa" multiline maxLength={300} accessibilityLabel="Hakkımızda" />
        <Text style={s.charCount}>{bio.length}/300</Text>

        {/* City — serbest metin yerine 81 il seçici */}
        <Text style={s.fieldLabel}>Şehir</Text>
        <TouchableOpacity
          style={[s.input, s.cityButton]}
          onPress={() => setCityPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Şehir seç"
        >
          <Text style={city ? s.cityValue : s.cityPlaceholder}>{city || 'Şehir seçin'}</Text>
          <Text style={s.cityChevron}>›</Text>
        </TouchableOpacity>
        <CityPickerModal
          visible={cityPickerVisible}
          onSelect={(c) => { setCity(c); setCityPickerVisible(false); }}
          onClose={() => setCityPickerVisible(false)}
        />

        {/* Looking For */}
        <Text style={s.fieldLabel}>Hangi buluşmalar?</Text>
        <View style={s.optionRow}>
          {LOOKING_OPTIONS.map((o) => (
            <TouchableOpacity key={o.id} style={[s.optionChip, lookingFor === o.id && s.optionChipSelected]} onPress={() => setLookingFor(o.id)} accessibilityRole="button" accessibilityState={{ selected: lookingFor === o.id }}>
              <Text style={[s.optionText, lookingFor === o.id && s.optionTextSelected]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Children */}
        <Text style={s.fieldLabel}>Çocuğunuz var mı?</Text>
        <View style={s.yesNo}>
          <TouchableOpacity style={[s.choice, hasChildren && s.choiceSelected]} onPress={() => setHasChildren(true)} accessibilityRole="button" accessibilityState={{ selected: hasChildren }}>
            <Text style={s.choiceText}>Evet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.choice, !hasChildren && s.choiceSelected]} onPress={() => { setHasChildren(false); setChildCount(null); setChildrenAges([]); }} accessibilityRole="button" accessibilityState={{ selected: !hasChildren }}>
            <Text style={s.choiceText}>Hayır</Text>
          </TouchableOpacity>
        </View>

        {hasChildren && (
          <>
            <Text style={s.fieldLabel}>Kaç çocuğunuz var?</Text>
            <View style={s.countRow}>
              {COUNTS.map((c) => (
                <TouchableOpacity key={c} style={[s.countChip, childCount === c && s.countChipSelected]} onPress={() => { setChildCount(c); const max = c === '4+' ? 4 : parseInt(c); setChildrenAges((prev) => prev.slice(0, max)); }} accessibilityRole="button" accessibilityState={{ selected: childCount === c }}>
                  <Text style={[s.countText, childCount === c && s.countTextSelected]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Hangi yaş gruplarında?</Text>
            <View style={s.ageGrid}>
              {AGE_GROUPS.map((ag) => {
                const isSelected = childrenAges.includes(ag.id);
                const max = childCount === '4+' ? 4 : childCount ? parseInt(childCount) : 0;
                const isDisabled = !isSelected && childrenAges.length >= max;
                return (
                  <TouchableOpacity key={ag.id} style={[s.ageChip, isSelected && s.ageChipSelected, isDisabled && s.ageChipDisabled]} onPress={() => toggleAge(ag.id)} disabled={isDisabled} accessibilityRole="button" accessibilityState={{ selected: isSelected, disabled: isDisabled }}>
                    <Text style={s.ageEmoji}>{ag.emoji}</Text>
                    <Text style={[s.ageText, isSelected && s.ageTextSelected, isDisabled && s.ageTextDisabled]}>{ag.label}</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight || COLORS.background },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: COLORS.white },
  editHeaderTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  editHeaderCancel: { fontSize: 15, color: '#888' },
  editHeaderSave: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  editScroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: COLORS.textDark, borderWidth: 1, borderColor: '#e8e8e8' },
  bioInput: { height: 80, textAlignVertical: 'top', paddingTop: 13 },
  cityButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityValue: { fontSize: 15, color: COLORS.textDark },
  cityPlaceholder: { fontSize: 15, color: '#aaa' },
  cityChevron: { fontSize: 20, color: '#bbb' },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SLOT_GAP },
  photoSlot: { width: SLOT_SIZE, height: SLOT_SIZE * 1.3, borderRadius: 12, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  slotImage: { width: '100%', height: '100%' },
  slotRemove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  slotRemoveText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  slotMainBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  slotMainText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  slotArrows: { position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', gap: 2 },
  arrowBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  arrowText: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginTop: -1 },
  slotAddIcon: { fontSize: 28, color: '#ccc', fontWeight: '300' },
  optionRow: { gap: 8 },
  optionChip: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', alignItems: 'center' },
  optionChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, fontWeight: '600', color: '#555' },
  optionTextSelected: { color: COLORS.primary },
  yesNo: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', alignItems: 'center' },
  choiceSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  choiceText: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  countRow: { flexDirection: 'row', gap: 10 },
  countChip: { width: 56, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  countChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  countText: { fontSize: 16, fontWeight: '600', color: '#555' },
  countTextSelected: { color: COLORS.primary },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ageChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#eee', gap: 6 },
  ageChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  ageChipDisabled: { opacity: 0.35 },
  ageEmoji: { fontSize: 16 },
  ageText: { fontSize: 14, color: '#555' },
  ageTextSelected: { color: COLORS.primary, fontWeight: '600' },
  ageTextDisabled: { color: '#bbb' },
});
