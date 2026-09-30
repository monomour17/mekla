import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Share, Platform, Linking, Dimensions, Modal, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { Alert } from 'react-native';
import Avatar from '../../components/Avatar';
import { formatDate } from '../../utils/dateFormat';
import { COLORS, SHADOWS } from '../../constants/colors';
import LoadingState from '../../components/LoadingState';
import { LABELS } from '../../constants/strings';
import { calculateOrganizerBadge } from '../../utils/organizerBadge';

// Extracted components
import { RatingModal, FullScreenPhotoModal, JoinRequestModal, ActionSheetModal, ReportModal } from '../../components/event/EventModals';
import { PendingRequestsList, ParticipantsGrid, WaitingList } from '../../components/event/EventParticipants';
import EventGallery from '../../components/event/EventGallery';
import EventQA from '../../components/event/EventQA';
import OrganizerSummaryPanel from '../../components/event/OrganizerSummaryPanel';
import EventWeather from '../../components/event/EventWeather';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Custom hook — tüm veri ve iş mantığı
import { useEventDetail } from '../../hooks/useEventDetail';

const PAYMENT_LABELS = { free: 'Ücretsiz', dutch: 'Alman Usulü', organizer: 'Organizatör Karşılar' };
const ACCOUNT_LABELS = { couple: 'Çiftler', individual: 'Bireysel Ebeveynler' };

function PulseOverlay() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();
  }, []);
  return (
    <Animated.View
      style={{ position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 18, borderWidth: 2.5, borderColor: COLORS.primary, opacity: anim }}
      pointerEvents="none"
    />
  );
}


const COVER_HEIGHT = 300;

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const h = useEventDetail(eventId, navigation);
  const insets = useSafeAreaInsets();

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);

  // Katılım isteği gönderildiğinde Story paylaşım teşviki göster
  const prevMyParticipation = useRef(undefined);
  useEffect(() => {
    if (prevMyParticipation.current === undefined) {
      prevMyParticipation.current = h.myParticipation;
      return;
    }
    if (prevMyParticipation.current === null && h.myParticipation !== null && !h.isCreator) {
      const t = setTimeout(() => setShareModalVisible(true), 600);
      return () => clearTimeout(t);
    }
    prevMyParticipation.current = h.myParticipation;
  }, [h.myParticipation, h.isCreator]);

  const handleShare = async () => {
    const shareUrl = `https://meklasocial.com/event/${eventId}`;
    const message = `${h.event.title}\n${formatDate(h.event.event_date)} - ${h.event.location_rough || h.event.city}\n\n${shareUrl}`;
    try { await Share.share({ message, title: h.event.title }); } catch (_) { }
  };

  // Kapak fotoğrafını cache'e indir → paylaşım sayfasını aç
  const handleStoryShare = async () => {
    setSharingInProgress(true);
    setShareModalVisible(false);
    try {
      const coverUrl = h.event?.cover_photo_url;
      if (coverUrl && (await Sharing.isAvailableAsync())) {
        const ext = coverUrl.includes('.png') ? 'png' : 'jpg';
        const localUri = FileSystem.cacheDirectory + `share_event_${eventId}.${ext}`;
        const { uri } = await FileSystem.downloadAsync(coverUrl, localUri);
        await Sharing.shareAsync(uri, {
          mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
          dialogTitle: 'Story olarak paylaş',
        });
      } else {
        // Kapak fotoğrafı yoksa metin paylaş
        await handleShare();
      }
    } catch (_) {
      await handleShare();
    } finally {
      setSharingInProgress(false);
    }
  };

  // Tehlikeli organizatör aksiyonları — yanlışlıkla dokunmayı önlemek için
  // ana akıştan çıkarılıp sağ üstteki ⋯ menüsüne taşındı.
  const showOrganizerMenu = () => {
    const options = [
      { text: LABELS.cancel, style: 'cancel' },
      { text: 'Etkinliği İptal Et', style: 'destructive', onPress: h.handleCancelEvent },
      { text: 'Etkinliği Sil', style: 'destructive', onPress: h.handleDeleteEvent },
    ];
    Alert.alert('Etkinlik Yönetimi', 'Bu işlemler geri alınamaz.', options);
  };

  const handleAddToCalendar = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Takvime eklemek için takvim izni vermeniz gerekiyor.'); return; }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCal = Platform.OS === 'ios'
      ? calendars.find((c) => c.allowsModifications && c.source?.name === 'iCloud') || calendars.find((c) => c.allowsModifications) || calendars[0]
      : calendars.find((c) => c.accessLevel === 'owner') || calendars[0];
    if (!defaultCal) { Alert.alert('Hata', 'Uygun bir takvim bulunamadı.'); return; }
    const start = new Date(h.event.event_date);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await Calendar.createEventAsync(defaultCal.id, { title: h.event.title, location: h.exactLocation?.location_detail || h.event.location_rough || h.event.city, startDate: start, endDate: end, notes: h.event.description || '' });
    Alert.alert('Takvime Eklendi!', 'Etkinlik takvimine kaydedildi.');
  };

  // ── Render ─────────────────────────────────────────────
  if (h.loading) return <View style={styles.center}><LoadingState /></View>;

  if (!h.event) {
    return (
      <View style={styles.root}>
        <View style={styles.center}><Text style={{ color: COLORS.textMuted }}>Etkinlik bulunamadı.</Text></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* ── COVER (edge-to-edge) ── */}
        <View style={styles.coverWrap}>
          {h.event.cover_photo_url ? (
            <Image source={{ uri: h.event.cover_photo_url }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <View style={styles.coverScrim} />

          {/* Floating nav */}
          <View style={[styles.floatingNav, { top: insets.top + 10 }]}>
            <TouchableOpacity style={styles.floatBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.floatBtn} onPress={() => setShareModalVisible(true)}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              {h.isCreator && !h.eventPassed && (
                <TouchableOpacity style={styles.floatBtn} onPress={() => navigation.navigate('CreateEvent', { event: h.event })}>
                  <Ionicons name="create-outline" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {h.isCreator && (
                <TouchableOpacity
                  style={styles.floatBtn}
                  onPress={showOrganizerMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Etkinlik yönetimi"
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}><Text style={styles.catBadgeText}>{h.event.category}</Text></View>
            {h.event.auto_approve && !h.eventPassed && (
              <View style={[styles.categoryBadge, { backgroundColor: '#fff7ed' }]}>
                <Text style={[styles.catBadgeText, { color: '#c2410c' }]}>⚡ Anında Katılım</Text>
              </View>
            )}
            <View style={[styles.statusBadge, h.eventPassed ? styles.statusBadgeFinished : !h.isOpen ? styles.statusBadgeClosed : null]}>
              <Text style={[styles.statusBadgeText, h.eventPassed ? { color: COLORS.white } : !h.isOpen ? { color: COLORS.warningText } : null]}>
                {h.eventPassed ? 'Bitti' : h.event.status === 'open' ? 'Açık' : h.event.status === 'closed' ? 'Kayıt Kapandı' : h.event.status}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{h.event.title}</Text>

          {/* ── Mini info cards (3 sütun) ── */}
          <View style={styles.infoCardsRow}>
            <View style={styles.infoMiniCard}>
              <View style={styles.infoMiniIcon}><Ionicons name="calendar" size={18} color={COLORS.primary} /></View>
              <Text style={styles.infoMiniLabel}>Tarih</Text>
              <Text style={styles.infoMiniValue} numberOfLines={2}>{formatDate(h.event.event_date)}</Text>
            </View>
            <View style={styles.infoMiniCard}>
              <View style={styles.infoMiniIcon}><Ionicons name="location" size={18} color={COLORS.primary} /></View>
              <Text style={styles.infoMiniLabel}>Mekan</Text>
              <Text style={styles.infoMiniValue} numberOfLines={2}>{h.exactLocation?.location_detail || h.event.location_rough || h.event.city}</Text>
              {h.exactLocation?.latitude && h.exactLocation?.longitude ? (
                <TouchableOpacity onPress={() => {
                  const url = Platform.select({ ios: `maps:0,0?q=${h.exactLocation.latitude},${h.exactLocation.longitude}`, android: `geo:0,0?q=${h.exactLocation.latitude},${h.exactLocation.longitude}(${encodeURIComponent(h.exactLocation.location_detail || h.event.title)})` });
                  Linking.openURL(url);
                }}>
                  <Text style={styles.mapLinkText}>Haritada Aç →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.mapLinkHint}>Onaylanınca tam konum açılır</Text>
              )}
            </View>
            <View style={styles.infoMiniCard}>
              <View style={styles.infoMiniIcon}><Ionicons name="people" size={18} color={COLORS.primary} /></View>
              <Text style={styles.infoMiniLabel}>Kontenjan</Text>
              <Text style={styles.infoMiniValue} numberOfLines={2}>{h.isFull ? `Dolu` : `${h.approvedParticipants.length + 1}/${h.event.max_participants}`}</Text>
              <View style={styles.infoMiniSub}><Ionicons name="wallet-outline" size={12} color={COLORS.textMuted} /><Text style={styles.infoMiniSubText}>{PAYMENT_LABELS[h.event.payment_type] ?? h.event.payment_type}</Text></View>
            </View>
          </View>

          {/* Organizer */}
          <TouchableOpacity style={styles.organizerBox} activeOpacity={0.7} onPress={() => h.creatorProfile && navigation.navigate('ProfileDetail', { profile: h.creatorProfile })}>
            <Avatar profile={h.creatorProfile} size={48} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.orgLabel}>Organizatör</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.orgName}>{h.creatorName}</Text>
                {h.creatorAvgRating !== null && (
                  <View style={styles.orgRatingBadge}>
                    <Ionicons name="star" size={12} color={COLORS.warning} />
                    <Text style={styles.orgRatingText}>{h.creatorAvgRating}</Text>
                  </View>
                )}
                {calculateOrganizerBadge(h.creatorAvgRating, h.creatorReviewCount).hasBadge && (
                  <View style={styles.trustBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={COLORS.white} />
                    <Text style={styles.trustBadgeText}>Mekla Yıldızı</Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textPlaceholder} />
          </TouchableOpacity>

          {/* Weather (sadece geçmemişse) */}
          {!h.eventPassed && h.event.city && h.event.event_date && (
            <EventWeather city={h.event.city} eventDate={h.event.event_date} />
          )}

          {/* Description */}
          {h.event.description ? (<><Text style={styles.sectionTitle}>Hakkında</Text><Text style={styles.descText}>{h.event.description}</Text></>) : null}

          {/* Rules */}
          <Text style={styles.sectionTitle}>Katılım Şartları</Text>
          <View style={styles.rulesBox}>
            <View style={styles.ruleItem}>
              <Ionicons name="people-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.ruleText}>{(h.event.allowed_account_types ?? []).map((t) => ACCOUNT_LABELS[t] ?? t).join(', ')}</Text>
            </View>
            <View style={styles.ruleItem}>
              <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.ruleText}>Arama Tipi: {(h.event.allowed_looking_for ?? []).map((t) => (t === 'family' ? 'Aile Buluşmaları' : t === 'couple' ? 'Çift Buluşmaları' : 'Her İkisi')).join(', ')}</Text>
            </View>
            {h.event.requires_children && (
              <View style={styles.ruleItem}>
                <Ionicons name="happy-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.ruleText}>Çocuklu aile/ebeveynlere özel</Text>
              </View>
            )}
          </View>

          {/* ====== Q&A ====== */}
          <EventQA
            questions={h.questions}
            isCreator={h.isCreator}
            myId={h.myId}
            onAskQuestion={h.handleAskQuestion}
            onAnswerQuestion={h.handleAnswerQuestion}
            onDeleteQuestion={h.handleDeleteQuestion}
          />

          {/* ====== ORGANIZER PANEL ====== */}
          {h.isCreator && (
            <>
              <OrganizerSummaryPanel
                pendingRequests={h.pendingRequests}
                approvedParticipants={h.approvedParticipants}
                waitingParticipants={h.waitingParticipants}
                maxParticipants={h.event.max_participants}
              />
              {!h.eventPassed && <PendingRequestsList requests={h.pendingRequests} profiles={h.participantProfiles} highlightUserIds={h.highlightUserIds} actionLoading={h.actionLoading} onApprove={h.handleApprove} onReject={h.handleReject} onViewProfile={(prof) => prof && navigation.navigate('ProfileDetail', { profile: prof })} PulseOverlayComponent={<PulseOverlay />} />}

              <View style={styles.creatorActions}>
                <TouchableOpacity style={styles.chatBtn} onPress={() => navigation.navigate('EventChat', { eventId, eventTitle: h.event.title })}>
                  <Ionicons name="chatbubbles" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.chatBtnText}>Grup Sohbeti</Text>
                </TouchableOpacity>
                {!h.eventPassed && (
                  <>
                    {h.isOpen ? (
                      <TouchableOpacity style={[styles.secondaryBtn, h.actionLoading && { opacity: 0.5 }]} onPress={h.handleCloseRegistration} disabled={h.actionLoading}>
                        <Text style={styles.secondaryBtnText}>Kayıtları Kapat</Text>
                      </TouchableOpacity>
                    ) : h.event.status === 'closed' ? (
                      <TouchableOpacity style={[styles.secondaryBtn, h.actionLoading && { opacity: 0.5 }]} onPress={h.handleOpenRegistration} disabled={h.actionLoading}>
                        <Text style={styles.secondaryBtnText}>Kayıtları Tekrar Aç</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
                {/* İptal ve Sil sağ üstteki ⋯ menüsüne taşındı */}
              </View>
            </>
          )}

          {/* ====== PARTICIPANTS ====== */}
          <ParticipantsGrid participants={h.approvedParticipants} profiles={h.participantProfiles} total={h.approvedParticipants.length + 1} maxParticipants={h.event.max_participants} waitingCount={h.waitingParticipants.length} onPress={(uid) => { h.setSelectedUserId(uid); h.setShowActionSheet(true); }} />

          {h.isCreator && <WaitingList participants={h.waitingParticipants} profiles={h.participantProfiles} onPress={(uid) => { h.setSelectedUserId(uid); h.setShowActionSheet(true); }} />}

          {/* ====== USER STATUS ====== */}
          {!h.isCreator && h.myParticipation && (
            <View style={styles.myStatusBox}>
              {h.myParticipation.status === 'pending' && (<><View style={[styles.myStatusBadge, { backgroundColor: COLORS.warningBg }]}><Text style={{ color: COLORS.warningText, fontWeight: '700' }}>İsteğin Değerlendiriliyor</Text></View><Text style={styles.myStatusNote}>Organizatör isteğini onayladığında bilgilendirileceksin.</Text></>)}
              {(h.myParticipation.status === 'approved' || h.myParticipation.status === 'attended') && (
                <>
                  <View style={[styles.myStatusBadge, { backgroundColor: h.eventPassed ? COLORS.inputBackground : '#d1fae5' }]}>
                    <Text style={{ color: h.eventPassed ? COLORS.textSecondary : '#065f46', fontWeight: '700' }}>{h.eventPassed ? 'Bu etkinliğe katıldın' : 'Katılımın Onaylandı ✓'}</Text>
                  </View>
                  <TouchableOpacity style={styles.userChatBtn} onPress={() => navigation.navigate('EventChat', { eventId, eventTitle: h.event.title })}>
                    <Ionicons name="chatbubbles" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.userChatBtnText}>Grup Sohbetine Git</Text>
                  </TouchableOpacity>
                  {!h.eventPassed && (
                    <TouchableOpacity style={styles.calendarBtn} onPress={handleAddToCalendar}>
                      <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.calendarBtnText}>Takvime Ekle</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {h.myParticipation.status === 'waiting' && (<><View style={[styles.myStatusBadge, { backgroundColor: COLORS.warningBg }]}><Text style={{ color: COLORS.warningText, fontWeight: '700' }}>Bekleme Listesinde</Text></View><Text style={styles.myStatusNote}>Kontenjan dolu. Bir yer açıldığında otomatik olarak onaylanacaksın.</Text></>)}
              {h.myParticipation.status === 'rejected' && (<View style={[styles.myStatusBadge, { backgroundColor: '#fee2e2' }]}><Text style={{ color: COLORS.error, fontWeight: '700' }}>İsteğin Reddedildi</Text></View>)}
              {h.myParticipation.status === 'removed' && (<View style={[styles.myStatusBadge, { backgroundColor: '#fee2e2' }]}><Text style={{ color: COLORS.error, fontWeight: '700' }}>Etkinlikten çıkarıldın</Text></View>)}
              {h.myParticipation.status === 'banned_global' && (<View style={[styles.myStatusBadge, { backgroundColor: '#fee2e2' }]}><Text style={{ color: COLORS.error, fontWeight: '700' }}>Bu organizatörün etkinliklerine katılamazsın</Text></View>)}
              {!h.eventPassed && (h.myParticipation.status === 'pending' || h.myParticipation.status === 'approved' || h.myParticipation.status === 'waiting') && (
                <TouchableOpacity style={[styles.leaveBtn, { marginTop: 12 }]} onPress={h.handleWithdraw} disabled={h.actionLoading}>
                  {h.actionLoading ? <ActivityIndicator color={COLORS.error} /> : (
                    <Text style={styles.leaveBtnText}>{h.myParticipation.status === 'pending' ? 'İsteği Geri Çek' : h.myParticipation.status === 'waiting' ? 'Bekleme Listesinden Çık' : 'Etkinlikten Ayrıl'}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ====== RATING ====== */}
          {h.eventPassed && !h.isCreator && h.myParticipation && (h.myParticipation.status === 'approved' || h.myParticipation.status === 'attended') && (
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Nasıl Geçti?</Text>
              {h.existingReview ? (
                <View style={styles.ratingExisting}>
                  <View style={styles.starsRow}>{[1, 2, 3, 4, 5].map((s) => (<Ionicons key={s} name={s <= h.existingReview.rating ? 'star' : 'star-outline'} size={22} color={COLORS.warning} />))}</View>
                  {h.existingReview.comment ? <Text style={styles.ratingComment}>"{h.existingReview.comment}"</Text> : null}
                  <TouchableOpacity onPress={() => h.setShowRatingModal(true)}><Text style={styles.ratingEditLink}>Değerlendirmeni Düzenle</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.ratingBtn} onPress={() => h.setShowRatingModal(true)}>
                  <Ionicons name="star-outline" size={20} color={COLORS.warning} style={{ marginRight: 8 }} />
                  <Text style={styles.ratingBtnText}>Etkinliği Değerlendir</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ====== GALLERY ====== */}
          {h.eventPassed && (
            <EventGallery
              photos={h.eventPhotos}
              canUpload={h.canUploadPhoto}
              uploading={h.uploadingPhoto}
              noAccessMessage={!h.canUploadPhoto && h.myParticipation?.status === 'no_show' ? 'Etkinliğe katılmadığın için fotoğraf yükleyemezsin.' : null}
              onUpload={h.handleUploadMemoryPhoto}
              onPhotoPress={h.setFullScreenPhoto}
            />
          )}

        </View>
      </ScrollView>

      {/* ── Sticky Bottom Bar ── */}
      {!h.isCreator && !h.eventPassed && !h.myParticipation && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {h.isBannedByCreator ? (
            <View style={[styles.joinBtn, { backgroundColor: COLORS.border }]}><Text style={[styles.joinBtnText, { color: COLORS.textMuted, fontSize: 14 }]}>Bu etkinliğe katılamazsın</Text></View>
          ) : !h.isEligible ? (
            <View style={[styles.joinBtn, { backgroundColor: COLORS.border }]}><Text style={[styles.joinBtnText, { color: COLORS.textMuted, fontSize: 14 }]}>Bu etkinliğin katılım şartlarını karşılamıyorsun</Text></View>
          ) : h.isOpen ? (
            <TouchableOpacity
              style={[styles.joinBtn, h.isFull && styles.joinBtnWaiting]}
              onPress={() => (h.event.auto_approve && !h.isFull ? h.handleSendRequest() : h.setShowJoinModal(true))}
              disabled={h.actionLoading}
            >
              {h.actionLoading
                ? <ActivityIndicator color={COLORS.white} />
                : h.isFull
                  ? <><Ionicons name="time-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} /><Text style={styles.joinBtnText}>Bekleme Listesine Gir</Text></>
                  : h.event.auto_approve
                    ? <><Ionicons name="flash" size={18} color={COLORS.white} style={{ marginRight: 8 }} /><Text style={styles.joinBtnText}>Katıl</Text></>
                    : <Text style={styles.joinBtnText}>Katılma İsteği Gönder</Text>
              }
            </TouchableOpacity>
          ) : (
            <View style={[styles.joinBtn, { backgroundColor: COLORS.textPlaceholder }]}><Text style={styles.joinBtnText}>Kayıt Kapandı</Text></View>
          )}
        </View>
      )}

      {/* ====== MODALS ====== */}
      <RatingModal visible={h.showRatingModal} myRating={h.myRating} setMyRating={h.setMyRating} myComment={h.myComment} setMyComment={h.setMyComment} existingReview={h.existingReview} onSubmit={h.handleSubmitRating} onClose={() => h.setShowRatingModal(false)} />
      <FullScreenPhotoModal photo={h.fullScreenPhoto} isCreator={h.isCreator} myId={h.myId} onClose={() => h.setFullScreenPhoto(null)} onDelete={h.handleDeletePhoto} />
      <JoinRequestModal visible={h.showJoinModal} joinMessage={h.joinMessage} setJoinMessage={h.setJoinMessage} actionLoading={h.actionLoading} onSubmit={h.handleSendRequest} onClose={() => { h.setShowJoinModal(false); h.setJoinMessage(''); }} />
      <ActionSheetModal visible={h.showActionSheet} selectedProfile={h.selectedProfile} selectedUserId={h.selectedUserId} myId={h.myId} isCreator={h.isCreator} eventPassed={h.eventPassed} onClose={() => h.setShowActionSheet(false)} onViewProfile={() => { h.setShowActionSheet(false); h.selectedProfile && navigation.navigate('ProfileDetail', { profile: h.selectedProfile }); }} onMarkAttendance={h.handleMarkAttendance} onKick={h.handleKick} onBanGlobal={h.handleBanGlobal} onReport={(uid) => { h.setShowActionSheet(false); h.setReportTargetId(uid); h.setShowReportModal(true); }} />
      <ReportModal visible={h.showReportModal} reportReason={h.reportReason} setReportReason={h.setReportReason} reportDetails={h.reportDetails} setReportDetails={h.setReportDetails} onSubmit={h.handleReport} onClose={() => { h.setShowReportModal(false); h.setReportReason(''); h.setReportDetails(''); }} />

      {/* ====== STORY SHARE MODAL ====== */}
      <Modal visible={shareModalVisible} animationType="slide" transparent onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.shareOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShareModalVisible(false)} />
          <View style={styles.shareSheet}>
            <View style={styles.shareSheetHandle} />
            {h.myParticipation !== null && !h.isCreator ? (
              <>
                <Text style={styles.shareSheetTitle}>🎉 Etkinliğe katıldın!</Text>
                <Text style={styles.shareSheetSub}>Arkadaşlarına da duyur, birlikte git!</Text>
              </>
            ) : (
              <Text style={styles.shareSheetTitle}>Paylaş</Text>
            )}
            {/* Önizleme kartı */}
            <View style={styles.shareCardPreview}>
              {h.event?.cover_photo_url ? (
                <Image source={{ uri: h.event.cover_photo_url }} style={styles.sharePreviewImg} contentFit="cover" />
              ) : (
                <View style={[styles.sharePreviewImg, styles.sharePreviewPlaceholder]}>
                  <Text style={{ fontSize: 40 }}>{h.event?.category?.split(' ')[0] ?? '📅'}</Text>
                </View>
              )}
              <View style={styles.sharePreviewOverlay}>
                <View style={styles.sharePreviewBrand}>
                  <Text style={styles.sharePreviewBrandText}>mekla</Text>
                </View>
                <Text style={styles.sharePreviewTitle} numberOfLines={2}>{h.event?.title}</Text>
                <Text style={styles.sharePreviewMeta}>
                  📍 {h.event?.location_rough || h.event?.city}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.storyShareBtn, sharingInProgress && { opacity: 0.6 }]}
              onPress={handleStoryShare}
              disabled={sharingInProgress}
              activeOpacity={0.85}
            >
              {sharingInProgress
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                  <Ionicons name="logo-instagram" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.storyShareBtnText}>
                    {h.event?.cover_photo_url ? 'Fotoğrafı Paylaş' : 'Story Olarak Paylaş'}
                  </Text>
                </>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.plainShareBtn} onPress={() => { setShareModalVisible(false); handleShare(); }}>
              <Ionicons name="share-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.plainShareBtnText}>Metin Olarak Paylaş</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  /* Cover */
  coverWrap: { height: COVER_HEIGHT, position: 'relative' },
  coverImage: { width: '100%', height: COVER_HEIGHT },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.25)' },

  /* Floating nav */
  floatingNav: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floatBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'center', alignItems: 'center' },

  content: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  categoryBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  catBadgeText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  statusBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeClosed: { backgroundColor: COLORS.warningBg },
  statusBadgeFinished: { backgroundColor: COLORS.textMuted },
  statusBadgeText: { color: '#065f46', fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textDark, marginBottom: 20, letterSpacing: -0.5 },

  /* Mini info cards */
  infoCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  infoMiniCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, gap: 4,
    ...SHADOWS.card,
  },
  infoMiniIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  infoMiniLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted },
  infoMiniValue: { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  infoMiniSub: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  infoMiniSubText: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted },
  mapLinkText: { color: COLORS.primary, fontSize: 11, fontWeight: '600', marginTop: 4 },
  mapLinkHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  organizerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 16, marginBottom: 24, ...SHADOWS.card },
  orgLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginBottom: 2 },
  orgName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  orgRatingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  orgRatingText: { fontSize: 13, fontWeight: '700', color: COLORS.warningText },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  trustBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 10, marginTop: 8 },
  descText: { fontSize: 15, fontWeight: '400', color: COLORS.textSecondary, lineHeight: 24, marginBottom: 24 },
  rulesBox: { backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 16, gap: 12, marginBottom: 24 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleText: { fontSize: 14, fontWeight: '500', color: COLORS.textBody, flex: 1 },
  creatorActions: { gap: 12, marginTop: 16, marginBottom: 16 },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.primary },
  secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.warning },
  cancelBtnText: { color: COLORS.warning, fontSize: 15, fontWeight: '600' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.error },
  deleteBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '600' },
  myStatusBox: { marginTop: 8, marginBottom: 16 },
  myStatusBadge: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  myStatusNote: { fontSize: 13, fontWeight: '400', color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: 20, paddingTop: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
  },
  joinBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  joinBtnWaiting: { backgroundColor: '#f97316' },
  joinBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  leaveBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.error, backgroundColor: COLORS.white },
  leaveBtnText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  chatBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  chatBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  userChatBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, marginTop: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  userChatBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  calendarBtn: { flexDirection: 'row', marginTop: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white },
  calendarBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  ratingSection: { marginTop: 8, marginBottom: 16 },
  ratingExisting: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, ...SHADOWS.subtle, alignItems: 'center' },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  ratingComment: { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 8, textAlign: 'center' },
  ratingEditLink: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  ratingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: COLORS.warning },
  ratingBtnText: { color: COLORS.warning, fontSize: 15, fontWeight: '700' },

  shareOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  shareSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, alignItems: 'center',
  },
  shareSheetHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, marginBottom: 20 },
  shareSheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 },
  shareSheetSub: { fontSize: 13, fontWeight: '400', color: COLORS.textSecondary, marginBottom: 20, textAlign: 'center' },
  shareCardPreview: {
    width: '100%', borderRadius: 20, overflow: 'hidden',
    ...SHADOWS.elevated,
    marginBottom: 24, height: 200,
  },
  sharePreviewImg: { width: '100%', height: '100%' },
  sharePreviewPlaceholder: {
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  sharePreviewOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14, backgroundColor: 'rgba(30,10,80,0.65)',
  },
  sharePreviewBrand: {
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6,
  },
  sharePreviewBrandText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  sharePreviewTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sharePreviewMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '400' },
  storyShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: 56, borderRadius: 16, marginBottom: 12,
    backgroundColor: '#E1306C',
  },
  storyShareBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  plainShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  plainShareBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
