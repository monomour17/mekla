import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

export default function AttachmentModal({
  visible,
  onClose,
  onPickGallery,
  onPickCamera,
  onPickLocation,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.attachOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.attachCard}>
          <TouchableOpacity style={styles.attachOption} onPress={onPickGallery} accessibilityRole="button" accessibilityLabel="Galeriden foto\u011Fraf se\u00E7">
            <View style={[styles.attachIconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="images" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.attachOptionText}>Galeriden Foto{'\u011F'}raf</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={onPickCamera} accessibilityRole="button" accessibilityLabel="Kamera ile foto\u011Fraf \u00E7ek">
            <View style={[styles.attachIconCircle, { backgroundColor: COLORS.warningBg }]}>
              <Ionicons name="camera" size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.attachOptionText}>Kamera ile {'\u00C7'}ek</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={onPickLocation}
            accessibilityRole="button"
            accessibilityLabel="Konum g\u00F6nder"
          >
            <View style={[styles.attachIconCircle, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="location" size={24} color="#10b981" />
            </View>
            <Text style={styles.attachOptionText}>Konum G{'\u00F6'}nder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachCancelBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Vazge\u00E7">
            <Text style={styles.attachCancelText}>Vazge{'\u00E7'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  attachOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  attachCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36,
  },
  attachOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  attachIconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  attachOptionText: { fontSize: 16, fontWeight: '600', color: COLORS.textBody },
  attachCancelBtn: { paddingVertical: 14, alignItems: 'center' },
  attachCancelText: { fontSize: 16, color: COLORS.textSecondary },
});
