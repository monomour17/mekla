import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import useAppStore from '../store/useAppStore';
import { handleError } from '../utils/errorHandler';
import { runWithBackgroundRetry } from '../utils/backgroundRetry';
import { pickFromGallery } from '../utils/photos';
import { mediumImpact, successNotification, heavyImpact } from '../utils/haptics';
import { fetchOrganizerStats } from '../utils/organizerBadge';
import { createNotification } from '../utils/createNotification';
import { scheduleEventReminders, cancelEventReminders } from '../utils/eventReminders';
import { track, EVENTS } from '../services/analytics';

/**
 * Etkinlik detay verisini ve tüm CRUD işlemlerini yöneten custom hook.
 * EventDetailScreen'den çıkarılmıştır.
 */
export function useEventDetail(eventId, navigation) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const profileVersion = useAppStore((s) => s.profileVersion);

  // ── Core State ─────────────────────────────────────────
  const [event, setEvent] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [highlightUserIds, setHighlightUserIds] = useState([]);
  // Tam konum — event_locations'tan gelir, RLS izin vermezse null kalır
  // (organizatör/onaylı katılımcı değilsek burası hep null, kaba konuma düşülür)
  const [exactLocation, setExactLocation] = useState(null);

  // ── Join Modal ─────────────────────────────────────────
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  // ── Action Sheet ───────────────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // ── Report ─────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportTargetId, setReportTargetId] = useState(null);

  // ── Banned ─────────────────────────────────────────────
  const [isBannedByCreator, setIsBannedByCreator] = useState(false);

  // ── Creator Rating ─────────────────────────────────────
  const [creatorAvgRating, setCreatorAvgRating] = useState(null);
  const [creatorReviewCount, setCreatorReviewCount] = useState(0);

  // ── Rating ─────────────────────────────────────────────
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [existingReview, setExistingReview] = useState(null);

  // ── Gallery ────────────────────────────────────────────
  const [eventPhotos, setEventPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);

  // ── Q&A ────────────────────────────────────────────────
  const [questions, setQuestions] = useState([]);

  // ── Computed ────────────────────────────────────────────
  const isCreator = event?.creator_id === myId;
  const myParticipation = participants.find((p) => p.user_id === myId);
  const pendingRequests = participants.filter((p) => p.status === 'pending');
  const approvedParticipants = participants.filter(
    (p) => p.status === 'approved' || p.status === 'attended' || p.status === 'no_show',
  );
  const waitingParticipants = participants.filter((p) => p.status === 'waiting');
  const eventPassed = event ? new Date(event.event_date) < new Date() : false;
  const isFull = event ? approvedParticipants.length + 1 >= event.max_participants : false;
  const isOpen = event?.status === 'open';
  const creatorName = creatorProfile?.display_name ?? '?';
  const canUploadPhoto =
    eventPassed &&
    (isCreator ||
      (myParticipation &&
        (myParticipation.status === 'attended' || myParticipation.status === 'approved')));
  const selectedProfile = selectedUserId ? participantProfiles[selectedUserId] : null;

  const isEligible = (() => {
    if (isCreator || !event || !myProfile) return true;
    if (isBannedByCreator) return false;
    if (
      myParticipation &&
      (myParticipation.status === 'removed' || myParticipation.status === 'banned_global')
    )
      return false;
    if (
      event.allowed_account_types &&
      !event.allowed_account_types.includes(myProfile.account_type)
    )
      return false;
    if (event.allowed_looking_for && !event.allowed_looking_for.includes(myProfile.looking_for))
      return false;
    if (event.requires_children && !myProfile.has_children) return false;
    return true;
  })();

  // ── Data Loading ───────────────────────────────────────

  const refreshParticipants = useCallback(async () => {
    try {
      const { data: parts, error } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId);
      if (error) return; // sessizce geç, eski veri ekranda kalır
      const allParts = parts ?? [];
      setParticipants(allParts);
      const uids = [...new Set(allParts.map((p) => p.user_id))];
      if (uids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', uids);
        setParticipantProfiles(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])));
      }
    } catch {
      // Ağ hatası — katılımcı listesi eski haliyle kalır
    }
  }, [eventId]);

  const loadAll = useCallback(async () => {
    if (!myId) return;
    try {
      // Önceden bu 8 çağrı sırayla await ediliyordu (ekrana her odaklanışta
      // 10+ ardışık network round-trip) — özellikle zayıf bağlantıda çok
      // yavaş hissettiriyordu. Aralarında bağımlılık olmayanları paralel
      // çalıştırıyoruz; refreshParticipants kendi state'ini kendi güncelliyor.
      const [batch] = await Promise.all([
        Promise.all([
          supabase
            .from('profiles')
            .select('account_type, looking_for, has_children, photos, notification_prefs')
            .eq('id', user.id)
            .single(),
          supabase.from('events').select('*').eq('id', eventId).single(),
          // Tam konum — RLS bunu sadece organizatöre ve onaylı/katılmış kullanıcıya
          // döner, aksi halde null gelir; client-side ayrıca kontrol etmiyoruz çünkü
          // asıl güvenlik sınırı burada, veritabanı seviyesinde
          supabase
            .from('event_locations')
            .select('location_detail, latitude, longitude')
            .eq('event_id', eventId)
            .maybeSingle(),
          supabase
            .from('event_participants')
            .select('status')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('event_reviews')
            .select('*')
            .eq('event_id', eventId)
            .eq('reviewer_id', user.id)
            .maybeSingle(),
          supabase
            .from('event_photos')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false }),
          supabase
            .from('event_questions')
            .select('*, profiles(display_name, photos)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true }),
        ]),
        refreshParticipants(),
      ]);
      const [{ data: mp }, { data: ev }, { data: loc }, { data: myPart }, { data: myReview }, { data: photos }, { data: qs }] = batch;

      setMyProfile(mp);
      if (!ev) return;
      setEvent(ev);
      setExactLocation(loc ?? null);

      // Eğer kullanıcı bu etkinliğe approved/attended ise reminder'ı zamanla
      // (idempotent — zaten varsa cancel + reschedule)
      if (myPart && (myPart.status === 'approved' || myPart.status === 'attended')) {
        scheduleEventReminders(ev, mp?.notification_prefs);
      }

      if (myReview) {
        setExistingReview(myReview);
        setMyRating(myReview.rating);
        setMyComment(myReview.comment ?? '');
      }

      setEventPhotos(photos ?? []);
      setQuestions(qs ?? []);

      // Bunlar ev.creator_id'ye bağımlı, ev gelmeden başlayamaz — aralarında
      // birbirine bağımlılık yok, paralel çalışabilirler.
      const [{ data: cp }, orgStats] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', ev.creator_id).single(),
        fetchOrganizerStats(ev.creator_id),
        (async () => {
          // Banned check
          if (ev.creator_id === user.id) return;
          const { data: creatorEventIds } = await supabase
            .from('events')
            .select('id')
            .eq('creator_id', ev.creator_id);
          if (!creatorEventIds?.length) return;
          const { data: banCheck } = await supabase
            .from('event_participants')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'banned_global')
            .in('event_id', creatorEventIds.map((e) => e.id))
            .limit(1);
          setIsBannedByCreator(!!(banCheck?.length));
        })(),
      ]);
      setCreatorProfile(cp);
      if (orgStats.avgRating !== null) {
        setCreatorAvgRating(orgStats.avgRating);
        setCreatorReviewCount(orgStats.reviewCount);
      }
    } catch (e) {
      if (__DEV__) console.error('loadAll error:', e);
      handleError('Etkinlik detayı', e, { silent: true });
    } finally {
      setLoading(false);
    }
  }, [myId, eventId, refreshParticipants]);

  // ── Effects ────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  useEffect(() => {
    if (profileVersion > 0 && myId) loadAll();
  }, [profileVersion, myId, loadAll]);

  // Realtime
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`event-detail-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_participants',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          refreshParticipants();
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            const uid = payload.new.user_id;
            setHighlightUserIds((prev) => [...prev, uid]);
            setTimeout(
              () => setHighlightUserIds((prev) => prev.filter((id) => id !== uid)),
              4000,
            );
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [eventId, myId, refreshParticipants]);

  // ── Handlers ───────────────────────────────────────────

  const autoPromoteWaiting = async () => {
    const { data: nextWaiting } = await runWithBackgroundRetry(() =>
      supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1)
    );
    if (nextWaiting?.length) {
      const w = nextWaiting[0];
      await runWithBackgroundRetry(() =>
        supabase.from('event_participants').update({ status: 'approved' }).eq('id', w.id)
      );
      const { data: wp } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', w.user_id)
        .single();
      supabase.from('event_messages').insert({
        event_id: eventId,
        sender_id: myId,
        content: `${wp?.display_name ?? '?'} bekleme listesinden gruba katıldı!`,
        type: 'system',
      });
    }
  };

  const handleSubmitRating = async () => {
    if (myRating === 0) {
      Alert.alert('Hata', 'Lütfen bir puan seçin.');
      return;
    }
    const payload = {
      event_id: eventId,
      reviewer_id: myId,
      rating: myRating,
      comment: myComment.trim() || null,
    };
    try {
      if (existingReview) {
        const { error } = await runWithBackgroundRetry(() =>
          supabase.from('event_reviews').update({ rating: myRating, comment: payload.comment }).eq('id', existingReview.id)
        );
        if (error) throw error;
        setExistingReview({ ...existingReview, rating: myRating, comment: payload.comment });
      } else {
        const { data, error } = await runWithBackgroundRetry(() =>
          supabase.from('event_reviews').insert(payload).select().single()
        );
        if (error) throw error;
        setExistingReview(data);
      }
      setShowRatingModal(false);
      successNotification();
      Alert.alert('Teşekkürler!', 'Değerlendirmen kaydedildi.');
    } catch (error) {
      handleError(existingReview ? 'Değerlendirme güncelle' : 'Değerlendirme gönder', error, { onRetry: handleSubmitRating });
    }
  };

  const handleUploadMemoryPhoto = async () => {
    const uri = await pickFromGallery({ allowsEditing: true, aspect: [4, 3] });
    if (!uri) return;
    setUploadingPhoto(true);
    try {
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `event_memories/${eventId}/${myId}_${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await runWithBackgroundRetry(() =>
        supabase.storage.from('photos').upload(fileName, arrayBuffer, {
          contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        })
      );
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('photos').getPublicUrl(fileName);
      const { data: newPhoto, error: insertError } = await runWithBackgroundRetry(() =>
        supabase.from('event_photos').insert({ event_id: eventId, user_id: myId, url: publicUrl }).select().single()
      );
      if (insertError) throw insertError;
      setEventPhotos((prev) => [newPhoto, ...prev]);
    } catch (e) {
      handleError('Fotoğraf yükle', e);
    }
    setUploadingPhoto(false);
  };

  const deletePhoto = async (photoId) => {
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('event_photos').delete().eq('id', photoId)
      );
      if (error) throw error;
      setEventPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setFullScreenPhoto(null);
    } catch (e) {
      handleError('Fotoğraf silinirken', e, { onRetry: () => deletePhoto(photoId) });
    }
  };

  const handleDeletePhoto = (photoId) => {
    Alert.alert('Fotoğrafı Sil', 'Bu fotoğrafı silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deletePhoto(photoId) },
    ]);
  };

  const handleSendRequest = async () => {
    // Fotoğrafsız profille başvuru yapılamaz — organizatör seni tanıyamaz
    if (!myProfile?.photos?.length) {
      setShowJoinModal(false);
      Alert.alert(
        'Fotoğraf Gerekli',
        'Etkinliğe başvurmak için profilinde en az 1 fotoğraf olmalı. Organizatör seni tanıyabilsin.',
        [{ text: 'Tamam', style: 'default' }]
      );
      return;
    }
    setActionLoading(true);
    try {
      // Otomatik onaylı etkinlik: onay beklemeden doğrudan katıl.
      // Kontenjan doluysa yine bekleme listesine düşer.
      const isAutoApprove = Boolean(event?.auto_approve);
      const status = isAutoApprove ? (isFull ? 'waiting' : 'approved') : 'pending';

      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('event_participants').insert({
          event_id: eventId,
          user_id: myId,
          status,
          join_message: joinMessage.trim() || null,
        })
      );
      setShowJoinModal(false);
      setJoinMessage('');
      if (error) {
        handleError('Katılma isteği gönder', error);
      } else {
        successNotification();
        track(EVENTS.EVENT_APPLIED, {
          event_id: eventId,
          has_message: Boolean(joinMessage.trim()),
          auto_approve: isAutoApprove,
        });
        if (event?.creator_id && event.creator_id !== myId) {
          const myName = myProfile?.display_name ?? 'Bir kullanıcı';
          createNotification({
            userId: event.creator_id,
            type: 'new_participant',
            title: status === 'approved' ? 'Yeni katılımcı' : 'Yeni katılım isteği',
            body: status === 'approved'
              ? `${myName}, ${event.title} etkinliğine katıldı.`
              : `${myName}, ${event.title} etkinliğine katılmak istiyor.`,
            data: { eventId },
          });
        }
        await loadAll();
      }
    } catch (e) {
      handleError('Katılma isteği gönder', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = () => {
    const wasApproved =
      myParticipation?.status === 'approved' || myParticipation?.status === 'attended';
    const wasWaiting = myParticipation?.status === 'waiting';
    const alertTitle = wasApproved
      ? 'Etkinlikten Ayrıl'
      : wasWaiting
        ? 'Bekleme Listesinden Çık'
        : 'İsteği Geri Çek';
    const alertMsg = wasApproved
      ? 'Etkinlikten ayrılmak istiyor musun?'
      : wasWaiting
        ? 'Bekleme listesinden çıkmak istiyor musun?'
        : 'Katılma isteğini geri çekmek istiyor musun?';
    Alert.alert(alertTitle, alertMsg, [
      { text: 'İptal', style: 'cancel' },
      {
        text: wasApproved ? 'Ayrıl' : wasWaiting ? 'Çık' : 'Geri Çek',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const { error } = await runWithBackgroundRetry(() =>
              supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', myId)
            );
            if (error) throw error;
            await cancelEventReminders(eventId);
            if (wasApproved) await autoPromoteWaiting();
            await loadAll();
          } catch (error) {
            handleError('Etkinlikten ayrılma', error);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleApprove = (userId) => {
    const prof = participantProfiles[userId];
    const name = prof?.display_name ?? 'Bu kişi';
    const currentApproved = approvedParticipants.length;
    const full = event ? currentApproved + 1 >= event.max_participants : false;
    const newStatus = full ? 'waiting' : 'approved';
    Alert.alert(
      full ? 'Bekleme Listesine Ekle' : 'Onayla',
      full
        ? `Kontenjan dolu. ${name} bekleme listesine eklensin mi?`
        : `${name} adlı kişiyi onaylamak istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: full ? 'Beklemeye Al' : 'Onayla',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await runWithBackgroundRetry(() =>
                supabase.from('event_participants').update({ status: newStatus }).eq('event_id', eventId).eq('user_id', userId)
              );
              if (error) throw error;
              successNotification();
              await refreshParticipants();
              supabase.from('event_messages').insert({
                event_id: eventId,
                sender_id: myId,
                content: full
                  ? `${name} bekleme listesine eklendi.`
                  : `${name} gruba katıldı!`,
                type: 'system',
              });
              // Onaylanan kullanıcıya bildirim
              createNotification({
                userId,
                type: full ? 'request_rejected' : 'request_approved',
                title: full ? 'Bekleme listesine eklendin' : 'Etkinlik onaylandı! 🎉',
                body: full
                  ? `${event.title} kontenjanı dolu, bir yer açıldığında otomatik onaylanacaksın.`
                  : `${event.title} etkinliğine katılımın onaylandı.`,
                data: { eventId },
              });
            } catch (error) {
              handleError('Katılımcı onayla', error, { onRetry: () => handleApprove(userId) });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = (userId) => {
    const name = participantProfiles[userId]?.display_name ?? 'Bu kişi';
    Alert.alert('Reddet', `${name} adlı kişinin isteğini reddetmek istiyor musun?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const { error } = await runWithBackgroundRetry(() =>
              supabase.from('event_participants').update({ status: 'rejected' }).eq('event_id', eventId).eq('user_id', userId)
            );
            if (error) throw error;
            heavyImpact();
            await refreshParticipants();
            createNotification({
              userId,
              type: 'request_rejected',
              title: 'Katılım isteğin onaylanmadı',
              body: `${event.title} için yapılan başvurun reddedildi.`,
              data: { eventId },
            });
          } catch (error) {
            handleError('Katılımcı reddet', error, { onRetry: () => handleReject(userId) });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleKick = (userId) => {
    const name = participantProfiles[userId]?.display_name ?? 'Bu kişi';
    setShowActionSheet(false);
    Alert.alert(
      'Etkinlikten Çıkar',
      `${name} bu etkinliğe tekrar katılamayacak. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await runWithBackgroundRetry(() =>
                supabase.from('event_participants').update({ status: 'removed' }).eq('event_id', eventId).eq('user_id', userId)
              );
              if (error) throw error;
              await supabase.from('event_messages').insert({
                event_id: eventId,
                sender_id: myId,
                content: `${name} gruptan çıkarıldı.`,
                type: 'system',
              });
              await autoPromoteWaiting();
              await refreshParticipants();
            } catch (error) {
              handleError('Katılımcı çıkar', error, { onRetry: () => handleKick(userId) });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleBanGlobal = (userId) => {
    const name = participantProfiles[userId]?.display_name ?? 'Bu kişi';
    setShowActionSheet(false);
    Alert.alert(
      'Tüm Etkinliklerden Engelle',
      `${name} senin hiçbir etkinliğine katılamayacak. Emin misin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await runWithBackgroundRetry(() =>
                supabase.from('event_participants').update({ status: 'banned_global' }).eq('event_id', eventId).eq('user_id', userId)
              );
              if (error) throw error;
              await supabase.from('event_messages').insert({
                event_id: eventId,
                sender_id: myId,
                content: `${name} tüm etkinliklerden engellendi.`,
                type: 'system',
              });
              await autoPromoteWaiting();
              await refreshParticipants();
            } catch (error) {
              handleError('Kullanıcı engelle', error, { onRetry: () => handleBanGlobal(userId) });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleMarkAttendance = async (userId, attended) => {
    setShowActionSheet(false);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('event_participants').update({ status: attended ? 'attended' : 'no_show' }).eq('event_id', eventId).eq('user_id', userId)
      );
      if (error) throw error;
      await refreshParticipants();
    } catch (error) {
      handleError('Katılım durumu güncelle', error, { onRetry: () => handleMarkAttendance(userId, attended) });
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      Alert.alert('Hata', 'Lütfen bir sebep seçin.');
      return;
    }
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('reports').insert({
          reporter_id: myId,
          reported_user_id: reportTargetId,
          event_id: eventId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        })
      );
      if (error) throw error;
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
      setReportTargetId(null);
      Alert.alert('Bildirildi', 'Raporun incelenmek üzere iletildi. Teşekkürler.');
    } catch (error) {
      handleError('Rapor gönder', error, { onRetry: handleReport });
    }
  };

  const handleCancelEvent = () => {
    Alert.alert('Etkinliği İptal Et', 'Bu etkinliği iptal etmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await runWithBackgroundRetry(() =>
              supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId)
            );
            if (error) throw error;
            supabase.from('event_messages').insert({
              event_id: eventId,
              sender_id: myId,
              content: 'Etkinlik iptal edildi.',
              type: 'system',
            });
            // Onaylı/bekleyen herkese bildirim + kendi reminder'larını temizle
            const targets = participants.filter(
              (p) => ['approved', 'pending', 'waiting'].includes(p.status) && p.user_id !== myId,
            );
            for (const t of targets) {
              createNotification({
                userId: t.user_id,
                type: 'event_cancelled',
                title: 'Etkinlik iptal edildi',
                body: `${event.title} organizatör tarafından iptal edildi.`,
                data: { eventId },
              });
            }
            await cancelEventReminders(eventId);
            navigation.goBack();
          } catch (error) {
            handleError('Etkinlik iptal et', error, { onRetry: handleCancelEvent });
          }
        },
      },
    ]);
  };

  const handleCloseRegistration = async () => {
    setActionLoading(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('events').update({ status: 'closed' }).eq('id', eventId)
      );
      if (error) throw error;
      await loadAll();
      supabase.from('event_messages').insert({
        event_id: eventId,
        sender_id: myId,
        content: 'Kayıtlar kapandı.',
        type: 'system',
      });
    } catch (error) {
      handleError('Kayıtları kapat', error, { onRetry: handleCloseRegistration });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRegistration = async () => {
    setActionLoading(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('events').update({ status: 'open' }).eq('id', eventId)
      );
      if (error) throw error;
      await loadAll();
      supabase.from('event_messages').insert({
        event_id: eventId,
        sender_id: myId,
        content: 'Kayıtlar tekrar açıldı.',
        type: 'system',
      });
    } catch (error) {
      handleError('Kayıtları aç', error, { onRetry: handleOpenRegistration });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAskQuestion = async (questionText) => {
    try {
      const { data, error } = await runWithBackgroundRetry(() =>
        supabase.from('event_questions').insert({ event_id: eventId, user_id: myId, question: questionText }).select('*, profiles(display_name, photos)').single()
      );
      if (error) throw error;
      setQuestions((prev) => [...prev, data]);
      successNotification();
      // Organizatöre bildirim
      if (event?.creator_id && event.creator_id !== myId) {
        createNotification({
          userId: event.creator_id,
          type: 'new_question',
          title: 'Etkinliğine yeni soru geldi',
          body: questionText.length > 80 ? questionText.slice(0, 80) + '…' : questionText,
          data: { eventId },
        });
      }
    } catch (error) {
      handleError('Soru gönder', error, { onRetry: () => handleAskQuestion(questionText) });
    }
  };

  const handleAnswerQuestion = async (questionId, answerText) => {
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('event_questions').update({ answer: answerText, answered_at: new Date().toISOString() }).eq('id', questionId)
      );
      if (error) throw error;
      const target = questions.find((q) => q.id === questionId);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, answer: answerText, answered_at: new Date().toISOString() } : q,
        ),
      );
      successNotification();
      // Soruyu soran kişiye bildirim
      if (target?.user_id && target.user_id !== myId) {
        createNotification({
          userId: target.user_id,
          type: 'question_answered',
          title: 'Sorunuz cevaplandı',
          body: `${event.title}: ${answerText.length > 80 ? answerText.slice(0, 80) + '…' : answerText}`,
          data: { eventId },
        });
      }
    } catch (error) {
      handleError('Soruyu cevapla', error, { onRetry: () => handleAnswerQuestion(questionId, answerText) });
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('event_questions').delete().eq('id', questionId)
      );
      if (error) throw error;
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (error) {
      handleError('Soruyu sil', error, { onRetry: () => handleDeleteQuestion(questionId) });
    }
  };

  const handleDeleteEvent = () => {
    Alert.alert('Etkinliği Sil', 'Bu etkinliği kalıcı olarak silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await runWithBackgroundRetry(() =>
              supabase.from('events').delete().eq('id', eventId)
            );
            if (error) throw error;
            navigation.goBack();
          } catch (error) {
            handleError('Etkinlik sil', error, { onRetry: handleDeleteEvent });
          }
        },
      },
    ]);
  };

  return {
    // State
    event,
    exactLocation,
    creatorProfile,
    participants,
    participantProfiles,
    loading,
    actionLoading,
    myProfile,
    highlightUserIds,
    myId,

    // Join modal
    showJoinModal, setShowJoinModal,
    joinMessage, setJoinMessage,

    // Action sheet
    selectedUserId, setSelectedUserId,
    showActionSheet, setShowActionSheet,
    selectedProfile,

    // Report
    showReportModal, setShowReportModal,
    reportReason, setReportReason,
    reportDetails, setReportDetails,
    reportTargetId, setReportTargetId,

    // Banned / Creator rating
    isBannedByCreator,
    creatorAvgRating,
    creatorReviewCount,

    // Rating
    showRatingModal, setShowRatingModal,
    myRating, setMyRating,
    myComment, setMyComment,
    existingReview,

    // Gallery
    eventPhotos,
    uploadingPhoto,
    fullScreenPhoto, setFullScreenPhoto,

    // Q&A
    questions,
    handleAskQuestion,
    handleAnswerQuestion,
    handleDeleteQuestion,

    // Computed
    isCreator,
    myParticipation,
    pendingRequests,
    approvedParticipants,
    waitingParticipants,
    eventPassed,
    isFull,
    isOpen,
    creatorName,
    isEligible,
    canUploadPhoto,

    // Handlers
    handleSubmitRating,
    handleUploadMemoryPhoto,
    handleDeletePhoto,
    handleSendRequest,
    handleWithdraw,
    handleApprove,
    handleReject,
    handleKick,
    handleBanGlobal,
    handleMarkAttendance,
    handleReport,
    handleCancelEvent,
    handleCloseRegistration,
    handleOpenRegistration,
    handleDeleteEvent,
    loadAll,
  };
}
