import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { MONTHS_FULL, DAYS_TR } from '../utils/dateFormat';
import { LABELS } from '../constants/strings';

function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function DateTimePicker({
  visible,
  onCancel,
  onConfirm,
  pickerStep,
  setPickerStep,
  pickerMonth,
  pickerDay,
  pickerHour,
  pickerMinute,
  adjustMonth,
  adjustDay,
  adjustHour,
  adjustMinute,
  pickerYear,
  pickerDayName,
  isNextYear,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.pickerOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} accessibilityRole="button" accessibilityLabel={LABELS.close} />

        <View style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={onCancel} style={styles.pickerHeaderBtn} accessibilityRole="button" accessibilityLabel={LABELS.cancel}>
              <Text style={styles.pickerCancel}>{LABELS.cancel}</Text>
            </TouchableOpacity>
            <View style={styles.pickerSteps}>
              <View style={[styles.pickerStep, pickerStep === 'date' && styles.pickerStepActive]}>
                <Text style={[styles.pickerStepText, pickerStep === 'date' && styles.pickerStepTextActive]}>{'📅 Tarih'}</Text>
              </View>
              <View style={styles.pickerStepLine} />
              <View style={[styles.pickerStep, pickerStep === 'time' && styles.pickerStepActive]}>
                <Text style={[styles.pickerStepText, pickerStep === 'time' && styles.pickerStepTextActive]}>{'🕐 Saat'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onConfirm} style={styles.pickerHeaderBtn} accessibilityRole="button" accessibilityLabel={pickerStep === 'date' ? 'İleri' : 'Tamam'}>
              <Text style={styles.pickerDone}>{pickerStep === 'date' ? 'İleri →' : 'Tamam'}</Text>
            </TouchableOpacity>
          </View>

          {/* DATE STEP */}
          {pickerStep === 'date' && (
            <View style={styles.pickerBody}>
              {/* Month row */}
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={() => adjustMonth(-1)} style={styles.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Önceki ay">
                  <Ionicons name="chevron-back-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.pickerMonthText}>{MONTHS_FULL[pickerMonth]}</Text>
                <TouchableOpacity onPress={() => adjustMonth(1)} style={styles.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Sonraki ay">
                  <Ionicons name="chevron-forward-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {/* Day row */}
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={() => adjustDay(-1)} style={styles.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Önceki gün">
                  <Ionicons name="chevron-back-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.pickerDayBlock}>
                  <Text style={styles.pickerDayNumber}>{pickerDay}</Text>
                  <Text style={styles.pickerDayName}>{pickerDayName}</Text>
                </View>
                <TouchableOpacity onPress={() => adjustDay(1)} style={styles.pickerArrowBtn} accessibilityRole="button" accessibilityLabel="Sonraki gün">
                  <Ionicons name="chevron-forward-circle" size={36} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {/* Next year badge */}
              {isNextYear && (
                <View style={styles.yearBadge}>
                  <Text style={styles.yearBadgeText}>{pickerYear} yılı</Text>
                </View>
              )}
            </View>
          )}

          {/* TIME STEP */}
          {pickerStep === 'time' && (
            <View style={styles.pickerBody}>
              <View style={styles.timeRow}>
                {/* Hour */}
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => adjustHour(1)} style={styles.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Saati artır">
                    <Ionicons name="chevron-up-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeNumber}>{String(pickerHour).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => adjustHour(-1)} style={styles.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Saati azalt">
                    <Ionicons name="chevron-down-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeLabel}>Saat</Text>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                {/* Minute */}
                <View style={styles.timeUnit}>
                  <TouchableOpacity onPress={() => adjustMinute(1)} style={styles.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Dakikayı artır">
                    <Ionicons name="chevron-up-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeNumber}>{String(pickerMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => adjustMinute(-1)} style={styles.timeArrowBtn} accessibilityRole="button" accessibilityLabel="Dakikayı azalt">
                    <Ionicons name="chevron-down-circle" size={36} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.timeLabel}>Dakika (5dk)</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
