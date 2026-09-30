import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { timeAgo } from '../../utils/dateFormat';

/**
 * PollCard — Topluluk anketlerini gösterir ve oy kullanmayı sağlar.
 *
 * Props:
 *   poll      : community_polls satırı + options + myVote + voteCounts
 *   userId    : mevcut kullanıcı ID'si
 *   isCreator : kullanıcı bu anketin oluşturucusu mu?
 *   onDelete  : () => void — anket silinince çağrılır
 */
export default function PollCard({ poll, userId, isCreator, onDelete }) {
  const [myVote, setMyVote] = useState(poll.myVote ?? null);
  const [voteCounts, setVoteCounts] = useState(poll.voteCounts ?? {});
  const [voting, setVoting] = useState(false);

  const totalVotes = Object.values(voteCounts).reduce((s, c) => s + c, 0);
  const options = poll.options ?? [];
  const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
  const hasVoted = myVote !== null;

  const handleVote = useCallback(async (idx) => {
    if (voting || isExpired) return;
    setVoting(true);
    try {
      if (hasVoted) {
        // Oyu değiştir
        await supabase
          .from('community_poll_votes')
          .update({ option_index: idx })
          .eq('poll_id', poll.id)
          .eq('user_id', userId);
        setVoteCounts((prev) => {
          const next = { ...prev };
          next[myVote] = Math.max(0, (next[myVote] ?? 1) - 1);
          next[idx] = (next[idx] ?? 0) + 1;
          return next;
        });
      } else {
        // İlk oy
        await supabase
          .from('community_poll_votes')
          .insert({ poll_id: poll.id, user_id: userId, option_index: idx });
        setVoteCounts((prev) => ({ ...prev, [idx]: (prev[idx] ?? 0) + 1 }));
      }
      setMyVote(idx);
    } catch (_) {}
    setVoting(false);
  }, [voting, isExpired, hasVoted, myVote, poll.id, userId]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(poll.id);
  }, [onDelete, poll.id]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="bar-chart" size={16} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.questionLabel}>ANKET</Text>
          <Text style={styles.question}>{poll.question}</Text>
        </View>
        {isCreator && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Anketi sil">
            <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Seçenekler */}
      <View style={styles.options}>
        {options.map((opt, idx) => {
          const count = voteCounts[idx] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = myVote === idx;
          const showResult = hasVoted || isExpired;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.option, isSelected && styles.optionSelected, isExpired && styles.optionExpired]}
              onPress={() => handleVote(idx)}
              disabled={voting || isExpired}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${opt.text} seçeneği, ${pct}%`}
              accessibilityState={{ selected: isSelected }}
            >
              {/* Doluluk çubuğu (arka plan) */}
              {showResult && (
                <View style={[styles.optionFill, { width: `${pct}%` }, isSelected && styles.optionFillSelected]} />
              )}
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {isSelected ? '✓ ' : ''}{opt.text}
                </Text>
                {showResult && (
                  <Text style={[styles.optionPct, isSelected && styles.optionTextSelected]}>
                    {pct}%
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {voting && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />}
        <Text style={styles.footerText}>
          {totalVotes} oy{isExpired ? ' · Sona erdi' : hasVoted ? ' · Oyunu değiştirebilirsin' : ''}
        </Text>
        {poll.ends_at && !isExpired && (
          <Text style={styles.endsAt}>· {timeAgo(poll.ends_at)}'de biter</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 10,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  question: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  deleteBtn: { padding: 6 },

  options: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  option: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    backgroundColor: '#fafafa',
    minHeight: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  optionSelected: { borderColor: COLORS.primary },
  optionExpired: { opacity: 0.85 },
  optionFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
  },
  optionFillSelected: { backgroundColor: '#ddd6fe' },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 1,
  },
  optionText: { fontSize: 14, fontWeight: '600', color: COLORS.textBody, flex: 1 },
  optionTextSelected: { color: COLORS.primary, fontWeight: '700' },
  optionPct: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginLeft: 8 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  footerText: { fontSize: 12, color: COLORS.textMuted },
  endsAt: { fontSize: 12, color: COLORS.textMuted, marginLeft: 4 },
});
