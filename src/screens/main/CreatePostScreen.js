import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import { COLORS } from '../../constants/colors';
import { LABELS, MESSAGES, PLACEHOLDERS } from '../../constants/strings';
import { MONTHS } from '../../utils/dateFormat';
import { uploadPhoto, pickFromGallery } from '../../utils/photos';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import { track, EVENTS } from '../../services/analytics';

const MAX_PHOTOS = 6;

async function uploadPostPhoto(userId, uri) {
  return uploadPhoto('post-photos', userId, uri);
}

export default function CreatePostScreen({ route, navigation }) {
  const { postType, communityId, editPost, editMedia } = route.params || {};
  const isEditing = !!editPost;
  const { user } = useAuth();
  const setFeedStale = useAppStore((s) => s.setFeedStale);
  const setPendingNewPost = useAppStore((s) => s.setPendingNewPost);

  const [content, setContent] = useState(editPost?.content ?? '');
  const [locationText, setLocationText] = useState(editPost?.location_text ?? '');
  const [photos, setPhotos] = useState(() => {
    if (editMedia?.length) return editMedia.map((m) => ({ uri: m.media_url, uploaded: true, id: m.id }));
    return [];
  });
  const [selectedEventId, setSelectedEventId] = useState(editPost?.related_event_id ?? null);
  const [pastEvents, setPastEvents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const effectiveType = editPost?.post_type ?? postType;
  const isMoment = effectiveType === 'moment';
  const isNotice = effectiveType === 'notice';
  const isPost = effectiveType === 'post'; // free-form community post

  // Load past events for moment type
  useEffect(() => {
    if (!isMoment || !user) return;
    setLoadingEvents(true);
    loadPastEvents().finally(() => setLoadingEvents(false));
  }, [isMoment, user]);

  const loadPastEvents = async () => {
    try {
      const now = new Date().toISOString();

      // Events I created
      const { data: created, error: createdError } = await supabase
        .from('events')
        .select('id, title, event_date')
        .eq('creator_id', user.id)
        .lt('event_date', now)
        .order('event_date', { ascending: false })
        .limit(20);

      if (createdError) throw createdError;

      // Events I participated in
      const { data: participated, error: participatedError } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      if (participatedError) throw participatedError;

      const partEventIds = (participated ?? []).map((p) => p.event_id);

      let partEvents = [];
      if (partEventIds.length > 0) {
        const { data, error: partEventsError } = await supabase
          .from('events')
          .select('id, title, event_date')
          .in('id', partEventIds)
          .lt('event_date', now)
          .order('event_date', { ascending: false })
          .limit(20);

        if (partEventsError) throw partEventsError;
        partEvents = data ?? [];
      }

      // Merge & deduplicate
      const allMap = new Map();
      [...(created ?? []), ...partEvents].forEach((e) => allMap.set(e.id, e));

      const sorted = [...allMap.values()].sort(
        (a, b) => new Date(b.event_date) - new Date(a.event_date)
      );

      setPastEvents(sorted);
    } catch (err) {
      if (__DEV__) console.error('loadPastEvents error:', err);
      handleError('Geçmiş etkinlikleri yükle', err, { silent: true });
      setPastEvents([]);
    }
  };

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin.`);
      return;
    }

    const allowMultiple = isMoment || isPost;
    const maxToSelect = allowMultiple ? MAX_PHOTOS - photos.length : 1 - photos.length;
    if (maxToSelect <= 0) return;

    const result = await pickFromGallery({
      allowsMultipleSelection: allowMultiple,
      selectionLimit: maxToSelect,
      quality: 1,
    });
    if (!result) return;

    const uris = Array.isArray(result) ? result : [result];
    const newPhotos = uris.map((u) => ({ uri: u, uploaded: false }));
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, allowMultiple ? MAX_PHOTOS : 1));
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Hata', 'İçerik yazmalısın.');
      return;
    }
    if (isMoment && !selectedEventId) {
      Alert.alert('Hata', 'Bir etkinlik seçmelisin.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        // --- UPDATE existing post ---
        const updateData = {
          content: content.trim(),
          related_event_id: isMoment ? selectedEventId : null,
          location_text: isNotice && locationText.trim() ? locationText.trim() : null,
        };

        const { error: updateError } = await runWithBackgroundRetry(() =>
          supabase.from('posts').update(updateData).eq('id', editPost.id)
        );

        if (updateError) throw updateError;

        // İçerik güncellemesi sunucuda tamam. Medya değişiklikleri (silme/
        // yükleme) en iyi-çaba: başarısız olursa tüm düzenlemeyi (ve
        // dolayısıyla medya insert'ini) yeniden denemek yerine sessizce
        // devam ederiz — tekrar denemek aynı fotoğrafları ikinci kez
        // ekleyip mükerrer satır oluşturabilir.
        try {
          const existingIds = photos.filter((p) => p.uploaded && p.id).map((p) => p.id);
          const oldIds = (editMedia ?? []).map((m) => m.id);
          const removedIds = oldIds.filter((id) => !existingIds.includes(id));

          if (removedIds.length > 0) {
            await runWithBackgroundRetry(() => supabase.from('post_media').delete().in('id', removedIds));
          }

          const newPhotos = photos.filter((p) => !p.uploaded);
          if (newPhotos.length > 0) {
            const startOrder = existingIds.length;
            const uploadPromises = newPhotos.map(async (photo, index) => {
              const url = await runWithBackgroundRetry(() => uploadPostPhoto(user.id, photo.uri));
              return { post_id: editPost.id, media_url: url, media_order: startOrder + index };
            });
            const mediaRows = await Promise.all(uploadPromises);
            await runWithBackgroundRetry(() => supabase.from('post_media').insert(mediaRows));
          }
        } catch (mediaErr) {
          if (__DEV__) console.error('Medya güncellemesi başarısız:', mediaErr);
          handleError('Gönderi güncellendi ama fotoğraflar tamamlanamadı', mediaErr, { silent: true });
        }

        setFeedStale(true);
        navigation.goBack();
      } else {
        // --- CREATE new post ---
        const postData = {
          author_id: user.id,
          post_type: isPost ? 'post' : postType,
          content: content.trim(),
          related_event_id: isMoment ? selectedEventId : null,
          community_id: communityId || null,
          location_text: isNotice && locationText.trim() ? locationText.trim() : null,
          expires_at: isNotice ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        };

        const { data: newPost, error: postError } = await runWithBackgroundRetry(() =>
          supabase.from('posts').insert(postData).select('id, created_at').single()
        );

        if (postError) throw postError;

        track(EVENTS.MOMENT_POSTED, {
          post_type: postData.post_type,
          has_photos: photos.length > 0,
          is_event_moment: Boolean(postData.related_event_id),
        });

        // Gönderi artık sunucuda var. Buradan sonrası (fotoğraf yükleme,
        // profil/takma ad zenginleştirme) en iyi-çaba: biri başarısız olursa
        // gönderiyi yeniden oluşturmaya çalışmadan sessizce devam ederiz —
        // feed yenilenince gönderi zaten sunucudan gelecek.
        try {
          let uploadedMedia = [];
          if (photos.length > 0) {
            const uploadPromises = photos.map(async (photo, index) => {
              const url = await runWithBackgroundRetry(() => uploadPostPhoto(user.id, photo.uri));
              return { post_id: newPost.id, media_url: url, media_order: index };
            });
            const mediaRows = await Promise.all(uploadPromises);
            const { error: mediaError } = await runWithBackgroundRetry(() =>
              supabase.from('post_media').insert(mediaRows)
            );
            if (mediaError) { if (__DEV__) console.error(mediaError); }
            uploadedMedia = mediaRows;
          }

          // Fetch own profile for the local post object
          const { data: myProfile } = await runWithBackgroundRetry(() =>
            supabase.from('profiles').select('id, display_name, photos, city').eq('id', user.id).single()
          );

          // Alandaysa kendi takma adım varsa uygula — kendi gönderimi de
          // başkalarının göreceği gibi görürüm
          let displayProfile = myProfile;
          if (communityId && myProfile) {
            const { data: alias } = await runWithBackgroundRetry(() =>
              supabase
                .from('user_communities')
                .select('alias_display_name, alias_avatar_url')
                .eq('user_id', user.id)
                .eq('community_id', communityId)
                .maybeSingle()
            );
            if (alias?.alias_display_name) {
              displayProfile = {
                ...myProfile,
                display_name: alias.alias_display_name,
                photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null,
              };
            }
          }

          // Build enriched post object and store for instant UI update
          setPendingNewPost({
            ...postData,
            id: newPost.id,
            created_at: newPost.created_at,
            author: displayProfile,
            media: uploadedMedia,
            likeCount: 0,
            isLiked: false,
            commentCount: 0,
          });
        } catch (postProcessErr) {
          if (__DEV__) console.error('Gönderi sonrası zenginleştirme başarısız:', postProcessErr);
          handleError('Gönderi paylaşıldı ama tamamlanamadı', postProcessErr, { silent: true });
        }

        setFeedStale(true);
        navigation.goBack();
      }
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError(isEditing ? 'Gönderi düzenlenirken' : 'Gönderi oluşturulurken', err, { onRetry: handleSubmit });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => { const dt = new Date(d); return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={LABELS.close}>
            <Ionicons name="close" size={26} color={COLORS.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Gönderiyi Düzenle' : isPost ? 'Gönderi Paylaş' : isMoment ? 'Anı Paylaş' : 'Sesleniş'}</Text>
          <TouchableOpacity
            style={[styles.submitBtn, (!content.trim() || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!content.trim() || submitting}
            accessibilityRole="button"
            accessibilityLabel={LABELS.share}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>{isEditing ? LABELS.save : LABELS.share}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* Moment: Event Picker */}
          {isMoment && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Etkinlik Seç</Text>
              {loadingEvents ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
              ) : pastEvents.length === 0 ? (
                <Text style={styles.noEventsText}>Geçmiş etkinliğin bulunmuyor.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {pastEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[styles.eventChip, selectedEventId === ev.id && styles.eventChipActive]}
                      onPress={() => setSelectedEventId(ev.id)}
                      accessibilityRole="button"
                      accessibilityLabel={ev.title}
                      accessibilityState={{ selected: selectedEventId === ev.id }}
                    >
                      <Text style={[styles.eventChipText, selectedEventId === ev.id && styles.eventChipTextActive]}>
                        {ev.title}
                      </Text>
                      <Text style={[styles.eventChipDate, selectedEventId === ev.id && { color: 'rgba(255,255,255,0.7)' }]}>
                        {fmtDate(ev.event_date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Content Input */}
          <View style={styles.section}>
            <TextInput
              style={styles.contentInput}
              multiline
              placeholder={isPost ? PLACEHOLDERS.writePost : isMoment ? PLACEHOLDERS.writeMoment : PLACEHOLDERS.writeNotice}
              placeholderTextColor={COLORS.textMuted}
              value={content}
              onChangeText={setContent}
              maxLength={1000}
              accessibilityLabel="İçerik"
            />
          </View>

          {/* Notice: Location */}
          {isNotice && (
            <View style={styles.section}>
              <View style={styles.locationInputRow}>
                <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.locationInput}
                  placeholder={PLACEHOLDERS.location}
                  placeholderTextColor={COLORS.textMuted}
                  value={locationText}
                  onChangeText={setLocationText}
                  maxLength={100}
                  accessibilityLabel="Konum"
                />
              </View>
            </View>
          )}

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {LABELS.photos} {(isMoment || isPost) ? `(${photos.length}/${MAX_PHOTOS})` : photos.length > 0 ? '(1/1)' : '(opsiyonel)'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumbImage} contentFit="cover" />
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(i)} accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1} sil`}>
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {((isMoment || isPost) ? photos.length < MAX_PHOTOS : photos.length < 1) && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhotos} accessibilityRole="button" accessibilityLabel="Fotoğraf ekle">
                  <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Ekle</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Notice info */}
          {isNotice && (
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={16} color={COLORS.warning} />
              <Text style={styles.infoText}>Sesleniş gönderileri 24 saat sonra otomatik olarak kaybolur.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBackground,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },
  submitBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textBody },

  noEventsText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8 },

  eventChip: {
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    minWidth: 100,
  },
  eventChipActive: { backgroundColor: COLORS.primary },
  eventChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textBody },
  eventChipTextActive: { color: COLORS.white },
  eventChipDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  contentInput: {
    fontSize: 16,
    color: COLORS.textDark,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 8,
    lineHeight: 24,
  },

  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  locationInput: { flex: 1, fontSize: 15, color: COLORS.textDark },

  photoThumb: { width: 80, height: 80, borderRadius: 12, marginRight: 8, position: 'relative' },
  photoThumbImage: { width: 80, height: 80, borderRadius: 12 },
  photoRemoveBtn: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    backgroundColor: COLORS.warningBg,
    borderRadius: 12,
  },
  infoText: { fontSize: 13, color: COLORS.warningText, flex: 1 },
});
