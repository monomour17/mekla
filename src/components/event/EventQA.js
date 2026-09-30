import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import Avatar from '../Avatar';
import { lightImpact, successNotification } from '../../utils/haptics';

export default function EventQA({ questions, isCreator, myId, onAskQuestion, onAnswerQuestion, onDeleteQuestion }) {
  const [newQuestion, setNewQuestion] = useState('');
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitQuestion = async () => {
    if (!newQuestion.trim()) return;
    setSubmitting(true);
    lightImpact();
    await onAskQuestion(newQuestion.trim());
    successNotification();
    setNewQuestion('');
    setSubmitting(false);
  };

  const handleSubmitAnswer = async (questionId) => {
    if (!answerText.trim()) return;
    setSubmitting(true);
    await onAnswerQuestion(questionId, answerText.trim());
    setAnsweringId(null);
    setAnswerText('');
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Soru & Cevap</Text>

      {questions.length === 0 && (
        <Text style={styles.emptyText}>
          {isCreator ? 'Henüz soru sorulmamış.' : 'Henüz soru yok. İlk soruyu sen sor!'}
        </Text>
      )}

      {questions.map((q) => (
        <View key={q.id} style={styles.questionCard}>
          {/* Soru */}
          <View style={styles.questionRow}>
            <Avatar
              profile={q.profiles}
              size={28}
              style={{ marginRight: 8, marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.askerName}>{q.profiles?.display_name ?? 'Kullanıcı'}</Text>
              <Text style={styles.questionText}>{q.question}</Text>
            </View>
            {myId === q.user_id && !q.answer && (
              <TouchableOpacity onPress={() => onDeleteQuestion(q.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Cevap */}
          {q.answer ? (
            <View style={styles.answerBox}>
              <Ionicons name="chatbubble-ellipses" size={15} color={COLORS.primary} style={{ marginTop: 2 }} />
              <Text style={styles.answerText}>{q.answer}</Text>
            </View>
          ) : isCreator ? (
            answeringId === q.id ? (
              <View style={styles.answerInputBox}>
                <TextInput
                  style={styles.answerInput}
                  value={answerText}
                  onChangeText={setAnswerText}
                  placeholder="Cevabını yaz..."
                  placeholderTextColor={COLORS.textPlaceholder}
                  multiline
                  maxLength={500}
                />
                <View style={styles.answerBtns}>
                  <TouchableOpacity
                    onPress={() => { setAnsweringId(null); setAnswerText(''); }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSubmitAnswer(q.id)}
                    style={[styles.submitBtn, (!answerText.trim() || submitting) && { opacity: 0.5 }]}
                    disabled={!answerText.trim() || submitting}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color={COLORS.white} />
                      : <Text style={styles.submitBtnText}>Cevapla</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.answerTrigger}
                onPress={() => { setAnsweringId(q.id); setAnswerText(''); }}
              >
                <Ionicons name="chatbubble-outline" size={13} color={COLORS.primary} />
                <Text style={styles.answerTriggerText}>Cevapla</Text>
              </TouchableOpacity>
            )
          ) : (
            <Text style={styles.pendingText}>Henüz cevaplanmadı</Text>
          )}
        </View>
      ))}

      {/* Soru sor kutusu — sadece organizatör dışındaki giriş yapan kullanıcılar */}
      {myId && !isCreator && (
        <View style={styles.askBox}>
          <TextInput
            style={styles.questionInput}
            value={newQuestion}
            onChangeText={setNewQuestion}
            placeholder="Aklındaki soruyu herkesle paylaş..."
            placeholderTextColor={COLORS.textPlaceholder}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.askBtn, (!newQuestion.trim() || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmitQuestion}
            disabled={!newQuestion.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={styles.askBtnText}>Gönder</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginBottom: 12 },

  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start' },
  askerName: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 3 },
  questionText: { fontSize: 15, color: COLORS.textBody, lineHeight: 21 },

  answerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: 10,
  },
  answerText: { flex: 1, fontSize: 14, color: COLORS.textBody, lineHeight: 20 },

  answerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  answerTriggerText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  pendingText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, fontStyle: 'italic' },

  answerInputBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  answerInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: COLORS.textBody,
    minHeight: 60,
    backgroundColor: COLORS.inputBackground,
    textAlignVertical: 'top',
  },
  answerBtns: { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  submitBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.primary },
  submitBtnText: { fontSize: 14, color: COLORS.white, fontWeight: '700' },

  askBox: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 4,
  },
  questionInput: {
    fontSize: 15,
    color: COLORS.textBody,
    minHeight: 56,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  askBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  askBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
