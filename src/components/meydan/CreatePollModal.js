import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;

/**
 * CreatePollModal — Topluluk yöneticisi için anket oluşturma formu.
 *
 * Props:
 *   visible    : bool
 *   loading    : bool
 *   onSubmit   : ({ question, options, endsIn }) => void
 *   onClose    : () => void
 */
export default function CreatePollModal({ visible, loading, onSubmit, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState('24h'); // '24h' | '3d' | '7d' | null

  const DURATIONS = [
    { id: '24h', label: '1 Gün' },
    { id: '3d',  label: '3 Gün' },
    { id: '7d',  label: '7 Gün' },
    { id: null,  label: 'Süresiz' },
  ];

  const endsAt = () => {
    if (!duration) return null;
    const d = new Date();
    if (duration === '24h') d.setHours(d.getHours() + 24);
    else if (duration === '3d') d.setDate(d.getDate() + 3);
    else if (duration === '7d') d.setDate(d.getDate() + 7);
    return d.toISOString();
  };

  const updateOption = (idx, val) => {
    setOptions((prev) => { const next = [...prev]; next[idx] = val; return next; });
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, '']);
  };

  const removeOption = (idx) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const isValid =
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= MIN_OPTIONS;

  const handleSubmit = () => {
    if (!isValid || loading) return;
    onSubmit({
      question: question.trim(),
      options: options.filter((o) => o.trim().length > 0).map((text) => ({ text })),
      ends_at: endsAt(),
    });
  };

  const handleClose = () => {
    setQuestion('');
    setOptions(['', '']);
    setDuration('24h');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Anket Oluştur</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Kapat">
                <Ionicons name="close" size={22} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Soru *</Text>
              <TextInput
                style={styles.questionInput}
                placeholder="Örn: Bu hafta sonu ne yapalım?"
                placeholderTextColor="#aaa"
                value={question}
                onChangeText={setQuestion}
                maxLength={200}
                multiline
                accessibilityLabel="Anket sorusu"
              />

              <Text style={styles.fieldLabel}>Seçenekler *</Text>
              {options.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                  <TextInput
                    style={styles.optionInput}
                    placeholder={`Seçenek ${idx + 1}`}
                    placeholderTextColor="#bbb"
                    value={opt}
                    onChangeText={(v) => updateOption(idx, v)}
                    maxLength={80}
                    accessibilityLabel={`Seçenek ${idx + 1}`}
                  />
                  {options.length > MIN_OPTIONS && (
                    <TouchableOpacity onPress={() => removeOption(idx)} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel="Seçeneği kaldır">
                      <Ionicons name="close-circle" size={20} color="#ccc" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {options.length < MAX_OPTIONS && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={addOption} accessibilityRole="button" accessibilityLabel="Seçenek ekle">
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.addOptionText}>Seçenek Ekle</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.fieldLabel}>Süre</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={String(d.id)}
                    style={[styles.durationChip, duration === d.id && styles.durationChipActive]}
                    onPress={() => setDuration(d.id)}
                    accessibilityRole="button"
                    accessibilityLabel={d.label}
                    accessibilityState={{ selected: duration === d.id }}
                  >
                    <Text style={[styles.durationText, duration === d.id && styles.durationTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || loading}
              accessibilityRole="button"
              accessibilityLabel="Anketi yayınla"
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <><Ionicons name="bar-chart" size={18} color={COLORS.white} style={{ marginRight: 8 }} /><Text style={styles.submitBtnText}>Anketi Yayınla</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, maxHeight: '88%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionInput: {
    backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.textBody,
    minHeight: 64, textAlignVertical: 'top', marginBottom: 20,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  optionInput: {
    flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.textBody,
  },
  removeBtn: { padding: 4 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 20 },
  addOptionText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  durationChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee',
  },
  durationChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  durationText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  durationTextActive: { color: COLORS.primary },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16, marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
