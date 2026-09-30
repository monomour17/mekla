import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { MONTHS_FULL, DAYS_TR } from '../../utils/dateFormat';
import { LABELS } from '../../constants/strings';

function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function DateTimePicker({
  visible, step, month, day, hour, minute,
  onAdjustMonth, onAdjustDay, onAdjustHour, onAdjustMinute,
  onConfirm, onCancel, getAutoYear,
}) {
  const pickerYear = getAutoYear(month, day);
  const pickerDayName = DAYS_TR[new Date(pickerYear, month, day).getDay()];
  const isNextYear = pickerYear !== new Date().getFullYear();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={s.pickerOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} accessibilityRole="button" accessibilityLabel={LABELS.close} />

        <View style={s.pickerContainer}>
          {/* Header */}
          <View style={s.pickerHeader}>
            <TouchableOpacity onPress={onCancel} style={s.pickerHeaderBtn} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
              <Text style={s.pickerCancel}>{LABELS.cancel}</Text>
            </TouchableOpacity>
            <View style={s.pickerSteps}>
              <View style={[s.pickerStep, step === 'date' && s.pickerStepActive]}>
                <Text style={[s.pickerStepText, step === 'date' && s.pickerStepTextActive]}>📅 Tarih</Text>
              </View>
              <View style={s.pickerStepLine} />
              <View style={[s.pickerStep, step === 'time' && s.pickerStepActive]}>
                <Text style={[s.pickerStepText, step === 'time' && s.pickerStepTextActive]}>🕐 Saat</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onConfirm} style={s.pickerHeaderBtn} accessibilityRole="button" accessibilityLabel={step === 'date' ? 'İleri' : 'Tamam'}>
              <Text style={s.pickerDone}>{step === 'date' ? 'İleri →' : 'Tamam'}</Text>
            </TouchableOpacity>
          </View>

          {/* DATE STEP */}
          {step === 'date' && (
            <View style={s.pickerBody}>
              <View style={s.pickerRow}>
                <TouchableOpacity onPress={() => onAdjustMonth(-1)} style={s.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Önceki ay">
                  <Ionicons name="chevron-back-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={s.pickerMonthText}>{MONTHS_FULL[month]}</Text>
                <TouchableOpacity onPress={() => onAdjustMonth(1)} style={s.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Sonraki ay">
                  <Ionicons name="chevron-forward-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={s.pickerRow}>
                <TouchableOpacity onPress={() => onAdjustDay(-1)} style={s.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Önceki gün">
                  <Ionicons name="chevron-back-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={s.pickerDayBlock}>
                  <Text style={s.pickerDayNumber}>{day}</Text>
                  <Text style={s.pickerDayName}>{pickerDayName}</Text>
                </View>
                <TouchableOpacity onPress={() => onAdjustDay(1)} style={s.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Sonraki gün">
                  <Ionicons name="chevron-forward-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {isNextYear && (
                <View style={s.yearBadge}>
                  <Text style={s.yearBadgeText}>{pickerYear} yılı</Text>
                </View>
              )}
            </View>
          )}

          {/* TIME STEP */}
          {step === 'time' && (
            <View style={s.pickerBody}>
              <View style={s.timeRow}>
                <View style={s.timeUnit}>
                  <TouchableOpacity onPress={() => onAdjustHour(1)} style={s.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Saati artır">
                    <Ionicons name="chevron-up-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeNumber}>{String(hour).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => onAdjustHour(-1)} style={s.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Saati azalt">
                    <Ionicons name="chevron-down-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeLabel}>Saat</Text>
                </View>

                <Text style={s.timeSeparator}>:</Text>

                <View style={s.timeUnit}>
                  <TouchableOpacity onPress={() => onAdjustMinute(1)} style={s.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Dakikayı artır">
                    <Ionicons name="chevron-up-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeNumber}>{String(minute).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => onAdjustMinute(-1)} style={s.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Dakikayı azalt">
                    <Ionicons name="chevron-down-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={s.timeLabel}>Dakika (5dk)</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  pickerOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  pickerContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  pickerHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 72 },
  pickerCancel: { fontSize: 15, color: '#888' },
  pickerDone: { fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'right' },
  pickerSteps: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  pickerStep: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f0f0f0' },
  pickerStepActive: { backgroundColor: COLORS.primary },
  pickerStepText: { fontSize: 13, fontWeight: '600', color: '#999' },
  pickerStepTextActive: { color: COLORS.white },
  pickerStepLine: { width: 16, height: 1, backgroundColor: '#ddd', marginHorizontal: 4 },
  pickerBody: { paddingVertical: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerArrowBtn: { padding: 4 },
  pickerMonthText: { fontSize: 26, fontWeight: '800', color: COLORS.textDark, flex: 1, textAlign: 'center' },
  pickerDayBlock: { flex: 1, alignItems: 'center' },
  pickerDayNumber: { fontSize: 56, fontWeight: '900', color: COLORS.primary, lineHeight: 60 },
  pickerDayName: { fontSize: 13, color: '#888', fontWeight: '600', marginTop: 2 },
  yearBadge: {
    alignSelf: 'center', backgroundColor: '#FFF3E0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginTop: -4,
  },
  yearBadgeText: { fontSize: 13, fontWeight: '700', color: '#E65100' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  timeUnit: { alignItems: 'center', width: 100 },
  timeArrowBtn: { padding: 6 },
  timeNumber: { fontSize: 56, fontWeight: '900', color: COLORS.textDark, lineHeight: 64 },
  timeLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', marginTop: 4 },
  timeSeparator: { fontSize: 48, fontWeight: '900', color: COLORS.textDark, marginBottom: 28 },
});
