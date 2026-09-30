import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';

export default function CreatePostModal({ visible, onClose, onSelectType }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={LABELS.close}>
        <View style={s.content}>
          <Text style={s.title}>Ne paylaşmak istersin?</Text>

          <TouchableOpacity
            style={s.option}
            onPress={() => { onClose(); onSelectType('moment'); }}
            accessibilityRole="button"
            accessibilityLabel="Anı Paylaş"
          >
            <View style={[s.optionIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Text style={{ fontSize: 24 }}>📸</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Anı Paylaş</Text>
              <Text style={s.optionDesc}>Geçmiş etkinliklerden fotoğraf ve notlar</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPlaceholder} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.option}
            onPress={() => { onClose(); onSelectType('notice'); }}
            accessibilityRole="button"
            accessibilityLabel="Sesleniş"
          >
            <View style={[s.optionIcon, { backgroundColor: COLORS.warningBg }]}>
              <Text style={{ fontSize: 24 }}>📢</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Sesleniş</Text>
              <Text style={s.optionDesc}>Anlık plan veya çağrı (24 saat görünür)</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPlaceholder} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  content: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 20, textAlign: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  optionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  optionDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
});
