import React from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';

const SCREEN_W = require('react-native').Dimensions.get('window').width;

const REPORT_REASONS = [
  'Uygunsuz davranış',
  'Spam / Reklam',
  'Taciz veya zorbalık',
  'Sahte profil',
  'Diğer',
];

/* ====== RATING MODAL ====== */
export function RatingModal({ visible, myRating, setMyRating, myComment, setMyComment, existingReview, onSubmit, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Etkinliği Değerlendir</Text>
          <Text style={s.modalSub}>Bu etkinlik nasıldı?</Text>
          <View style={s.starsRowBig}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setMyRating(star)} style={s.starTouch}>
                <Ionicons name={star <= myRating ? 'star' : 'star-outline'} size={40} color={COLORS.warning} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.ratingLabel}>
            {myRating === 1 ? 'Kötü' : myRating === 2 ? 'Fena Değil' : myRating === 3 ? 'İyi' : myRating === 4 ? 'Çok İyi' : myRating === 5 ? 'Harika!' : 'Puan Seç'}
          </Text>
          <TextInput
            style={s.modalInput}
            placeholder="Yorumun (opsiyonel)..."
            placeholderTextColor="#aaa"
            value={myComment}
            onChangeText={setMyComment}
            multiline
            maxLength={300}
          />
          <TouchableOpacity style={s.modalSendBtn} onPress={onSubmit}>
            <Text style={s.modalSendText}>{existingReview ? 'Güncelle' : 'Gönder'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
            <Text style={s.modalCancelText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ====== FULL SCREEN PHOTO MODAL ====== */
export function FullScreenPhotoModal({ photo, isCreator, myId, onClose, onDelete }) {
  return (
    <Modal visible={!!photo} transparent animationType="fade">
      <View style={s.fullScreenOverlay}>
        <TouchableOpacity style={s.fullScreenClose} onPress={onClose}>
          <Ionicons name="close-circle" size={36} color={COLORS.white} />
        </TouchableOpacity>
        {photo && (
          <>
            <Image source={{ uri: photo.url }} style={s.fullScreenImg} contentFit="contain" />
            {(photo.user_id === myId || isCreator) && (
              <TouchableOpacity style={s.fullScreenDelete} onPress={() => onDelete(photo.id)}>
                <Ionicons name="trash-outline" size={22} color={COLORS.white} />
                <Text style={s.fullScreenDeleteText}>{LABELS.delete}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

/* ====== JOIN REQUEST MODAL ====== */
export function JoinRequestModal({ visible, joinMessage, setJoinMessage, actionLoading, onSubmit, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Katılma İsteği</Text>
          <Text style={s.modalSub}>Organizatöre kısa bir mesaj bırakabilirsin (opsiyonel)</Text>
          <TextInput
            style={s.modalInput}
            placeholder="Merhaba, biz de katılmak isteriz..."
            placeholderTextColor="#aaa"
            value={joinMessage}
            onChangeText={setJoinMessage}
            multiline
            maxLength={200}
          />
          <TouchableOpacity style={s.modalSendBtn} onPress={onSubmit} disabled={actionLoading}>
            {actionLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.modalSendText}>{LABELS.send}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
            <Text style={s.modalCancelText}>{LABELS.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ====== ACTION SHEET MODAL ====== */
export function ActionSheetModal({
  visible, selectedProfile, selectedUserId, myId,
  isCreator, eventPassed,
  onClose, onViewProfile, onMarkAttendance, onKick, onBanGlobal, onReport,
}) {
  const name = selectedProfile?.display_name ?? '?';
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.sheetOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheetContent}>
          <View style={s.sheetHeader}>
            <Avatar profile={selectedProfile} size={40} />
            <Text style={s.sheetName}>{name}</Text>
          </View>
          <View style={s.sheetDivider} />

          <TouchableOpacity style={s.sheetOption} onPress={onViewProfile}>
            <Ionicons name="person-outline" size={20} color={COLORS.textBody} />
            <Text style={s.sheetOptionText}>Profilini Gör</Text>
          </TouchableOpacity>

          {isCreator && (
            <>
              {eventPassed && selectedUserId && (
                <>
                  <TouchableOpacity style={s.sheetOption} onPress={() => onMarkAttendance(selectedUserId, true)}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                    <Text style={[s.sheetOptionText, { color: COLORS.success }]}>Etkinliğe Geldi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.sheetOption} onPress={() => onMarkAttendance(selectedUserId, false)}>
                    <Ionicons name="close-circle-outline" size={20} color={COLORS.warning} />
                    <Text style={[s.sheetOptionText, { color: COLORS.warning }]}>Gelmedi (No-Show)</Text>
                  </TouchableOpacity>
                </>
              )}
              {!eventPassed && (
                <TouchableOpacity style={s.sheetOption} onPress={() => onKick(selectedUserId)}>
                  <Ionicons name="remove-circle-outline" size={20} color={COLORS.error} />
                  <Text style={[s.sheetOptionText, { color: COLORS.error }]}>Etkinlikten Çıkar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.sheetOption} onPress={() => onBanGlobal(selectedUserId)}>
                <Ionicons name="ban-outline" size={20} color={COLORS.error} />
                <Text style={[s.sheetOptionText, { color: COLORS.error }]}>Tüm Etkinliklerden Engelle</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={s.sheetOption} onPress={() => onReport(selectedUserId)}>
            <Ionicons name="flag-outline" size={20} color={COLORS.error} />
            <Text style={[s.sheetOptionText, { color: COLORS.error }]}>Raporla</Text>
          </TouchableOpacity>

          <View style={s.sheetDivider} />
          <TouchableOpacity style={s.sheetOption} onPress={onClose}>
            <Text style={[s.sheetOptionText, { color: COLORS.textMuted, textAlign: 'center', flex: 1 }]}>Vazgeç</Text>
          </TouchableOpacity>
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

/* ====== REPORT MODAL ====== */
export function ReportModal({ visible, reportReason, setReportReason, reportDetails, setReportDetails, onSubmit, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Kullanıcıyı Raporla</Text>
          <Text style={s.modalSub}>Neden raporlamak istiyorsun?</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[s.reportReasonBtn, reportReason === reason && s.reportReasonBtnActive]}
              onPress={() => setReportReason(reason)}
            >
              <Text style={[s.reportReasonText, reportReason === reason && s.reportReasonTextActive]}>{reason}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[s.modalInput, { marginTop: 12 }]}
            placeholder="Ek detay (opsiyonel)..."
            placeholderTextColor="#aaa"
            value={reportDetails}
            onChangeText={setReportDetails}
            multiline
            maxLength={500}
          />
          <TouchableOpacity style={s.modalSendBtn} onPress={onSubmit}>
            <Text style={s.modalSendText}>{LABELS.send}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
            <Text style={s.modalCancelText}>{LABELS.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Shared modal styles
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  modalSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalInput: { width: '100%', backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.textBody, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  modalSendBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  modalSendText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  modalCancelBtn: { paddingVertical: 8 },
  modalCancelText: { color: COLORS.textMuted, fontSize: 14 },

  // Rating
  starsRowBig: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  starTouch: { padding: 4 },
  ratingLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textBody, marginBottom: 16 },

  // Full Screen Photo
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullScreenImg: { width: SCREEN_W, height: SCREEN_W * 0.75 },
  fullScreenDelete: { position: 'absolute', bottom: 60, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  fullScreenDeleteText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // Action Sheet
  sheetOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sheetName: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  sheetDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  sheetOptionText: { fontSize: 16, fontWeight: '600', color: COLORS.textBody },

  // Report
  reportReasonBtn: { width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: COLORS.inputBackground, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.inputBackground },
  reportReasonBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  reportReasonText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  reportReasonTextActive: { color: COLORS.primary },
});
