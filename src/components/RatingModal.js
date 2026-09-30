import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const RATING_LABELS = {
  0: 'Puan Sec',
  1: 'Kotu',
  2: 'Fena Degil',
  3: 'Iyi',
  4: 'Cok Iyi',
  5: 'Harika!',
};

export default function RatingModal({
  visible,
  onClose,
  rating,
  setRating,
  comment,
  setComment,
  onSubmit,
  isEdit,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Etkinligi Degerlendir</Text>
          <Text style={styles.modalSub}>Bu etkinlik nasildi?</Text>
          <View style={styles.starsRowBig}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.starTouch}>
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={40} color={COLORS.warning} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {RATING_LABELS[rating] ?? RATING_LABELS[0]}
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Yorumun (opsiyonel)..."
            placeholderTextColor="#aaa"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={300}
          />
          <TouchableOpacity style={styles.modalSendBtn} onPress={onSubmit}>
            <Text style={styles.modalSendText}>{isEdit ? 'Guncelle' : 'Gonder'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelText}>Vazgec</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  modalSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalInput: { width: '100%', backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.textBody, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  modalSendBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  modalSendText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  modalCancelBtn: { paddingVertical: 8 },
  modalCancelText: { color: COLORS.textMuted, fontSize: 14 },
  starsRowBig: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  starTouch: { padding: 4 },
  ratingLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textBody, marginBottom: 16 },
});
