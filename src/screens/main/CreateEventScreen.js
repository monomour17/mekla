import React, { useCallback, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Platform, Alert, ActivityIndicator, Image, ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import { COLORS } from '../../constants/colors';
import { MONTHS, DAYS_TR } from '../../utils/dateFormat';
import { uploadPhoto, pickFromGallery, pickFromCamera } from '../../utils/photos';
import { geocodeAddress, getPlaceSuggestions, getPlaceDetails, extractRoughLocation } from '../../utils/geocoding';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import { track, EVENTS } from '../../services/analytics';
import { createNotification } from '../../utils/createNotification';
import { LABELS, PLACEHOLDERS } from '../../constants/strings';
import DateTimePicker from '../../components/event/DateTimePicker';

const CATEGORIES = [
  '🧸 Oyun Grubu', '🍷 Çift Buluşması', '🏕️ Doğa/Kamp',
  '👩 Sadece Anneler', '👨 Sadece Babalar', '👨‍👩‍👧 Aile Etkinliği',
  '🧑 Tekler Buluşması', '🎉 Diğer',
];

const PAYMENT_OPTIONS = [
  { id: 'free', label: 'Ücretsiz', icon: '🆓' },
  { id: 'dutch', label: 'Alman Usulü', icon: '💳' },
  { id: 'organizer', label: 'Organizatör Karşılar', icon: '🎁' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { id: 'couple', label: '👫 Çiftler' },
  { id: 'individual', label: '🧑 Bireysel Ebeveyn' },
];

const LOOKING_FOR_OPTIONS = [
  { id: 'family', label: '👨‍👩‍👧 Aile Buluşmaları' },
  { id: 'couple', label: '🥂 Çift Buluşmaları' },
  { id: 'both', label: '✨ Her İkisi' },
];

function formatEventDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${DAYS_TR[d.getDay()]},  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

function makeDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(15, 0, 0, 0);
  return d;
}

export default function CreateEventScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const myCity = useAppStore((s) => s.myCity);

  // Edit modu: EventDetailScreen'den event prop'u gelirse formu doldur
  const editEvent = route?.params?.event ?? null;
  // Gönderiden etkinliğe çevirme: sadece alanları doldurur, UPDATE/INSERT kararını
  // etkilemez (bu karar hep editEvent'e bağlı kalır — bkz. handleCreate)
  const prefill = route?.params?.prefill ?? null;
  const sourcePostId = route?.params?.sourcePostId ?? null;
  // Alan içinden açılırsa (CommunityScreen) veya gönderiden çevrilirse, etkinlik o alana bağlanır
  const communityId = route?.params?.communityId ?? editEvent?.community_id ?? prefill?.communityId ?? null;
  const communityName = route?.params?.communityName ?? null;

  const [title, setTitle] = useState(editEvent?.title ?? prefill?.title ?? '');
  const [description, setDescription] = useState(editEvent?.description ?? prefill?.description ?? '');
  const [category, setCategory] = useState(editEvent?.category ?? CATEGORIES[0]);
  const [eventDate, setEventDate] = useState(editEvent ? new Date(editEvent.event_date) : makeDefaultDate);
  const [locationDetail, setLocationDetail] = useState(editEvent?.location_detail ?? '');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null); // öneriden seçilince geocoding'i atlar
  const [locationEdited, setLocationEdited] = useState(false);
  // Offline durumda Zustand cache'inden başla; DB sorgusu gelince üstüne yazar
  const [city, setCity] = useState(editEvent?.city ?? myCity ?? '');
  const [maxParticipants, setMaxParticipants] = useState(editEvent ? String(editEvent.max_participants) : '10');
  const [paymentType, setPaymentType] = useState(editEvent?.payment_type ?? 'free');
  const [requiresChildren, setRequiresChildren] = useState(editEvent?.requires_children ?? false);
  const [autoApprove, setAutoApprove] = useState(editEvent?.auto_approve ?? false);
  const [allowedAccountTypes, setAllowedAccountTypes] = useState(editEvent?.allowed_account_types ?? ['couple', 'individual']);
  const [allowedLookingFor, setAllowedLookingFor] = useState(editEvent?.allowed_looking_for ?? ['family', 'couple', 'both']);
  const [coverPhotoUri, setCoverPhotoUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isBusinessAccount, setIsBusinessAccount] = useState(false);

  // Custom date picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState('date');
  const [pickerMonth, setPickerMonth] = useState(0);
  const [pickerDay, setPickerDay] = useState(1);
  const [pickerHour, setPickerHour] = useState(15);
  const [pickerMinute, setPickerMinute] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('city, account_type')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.city) setCity(data.city);
        if (data?.account_type === 'business') setIsBusinessAccount(true);
      });
  }, [user]);

  // Düzenleme modunda tam konum artık events tablosunda değil — RLS'in
  // izin verdiği (biz organizatörüz) event_locations'tan çekilir
  useEffect(() => {
    if (!editEvent?.id) return;
    supabase
      .from('event_locations')
      .select('location_detail, latitude, longitude')
      .eq('event_id', editEvent.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.location_detail) setLocationDetail(data.location_detail);
        if (data?.latitude != null) setSelectedPlace({ latitude: data.latitude, longitude: data.longitude, addressComponents: null });
      });
  }, [editEvent?.id]);

  // Konum önerileri — kullanıcı yazmayı bırakınca 300ms sonra sorar
  useEffect(() => {
    if (selectedPlace) return; // öneriden seçildiyse yeniden arama
    if (locationDetail.trim().length < 3) { setLocationSuggestions([]); return; }
    const handle = setTimeout(async () => {
      const results = await getPlaceSuggestions(locationDetail.trim(), city);
      setLocationSuggestions(results);
    }, 300);
    return () => clearTimeout(handle);
  }, [locationDetail, city, selectedPlace]);

  const handlePickSuggestion = async (suggestion) => {
    setShowSuggestions(false);
    setLocationDetail(suggestion.description);
    setLocationEdited(true);
    const details = await getPlaceDetails(suggestion.placeId);
    if (details) setSelectedPlace(details);
  };

  const getAutoYear = useCallback((m, d) => {
    const now = new Date();
    const thisYear = now.getFullYear();
    return new Date(thisYear, m, d, 23, 59) >= now ? thisYear : thisYear + 1;
  }, []);

  const openDatePicker = () => {
    setPickerMonth(eventDate.getMonth());
    setPickerDay(eventDate.getDate());
    setPickerHour(eventDate.getHours());
    setPickerMinute(eventDate.getMinutes());
    setPickerStep('date');
    setPickerVisible(true);
  };

  const adjustMonth = (delta) => {
    setPickerMonth((prev) => {
      const next = (prev + delta + 12) % 12;
      const yr = getAutoYear(next, pickerDay);
      const max = daysInMonth(next, yr);
      if (pickerDay > max) setPickerDay(max);
      return next;
    });
  };

  const adjustDay = (delta) => {
    setPickerDay((prev) => {
      const yr = getAutoYear(pickerMonth, prev);
      const max = daysInMonth(pickerMonth, yr);
      const next = prev + delta;
      if (next < 1) return max;
      if (next > max) return 1;
      return next;
    });
  };

  const adjustHour = (delta) => setPickerHour((h) => (h + delta + 24) % 24);

  const adjustMinute = (delta) =>
    setPickerMinute((m) => {
      const rounded = Math.round(m / 5) * 5;
      return (rounded + delta * 5 + 60) % 60;
    });

  const confirmPicker = () => {
    if (pickerStep === 'date') {
      setPickerStep('time');
    } else {
      const yr = getAutoYear(pickerMonth, pickerDay);
      setEventDate(new Date(yr, pickerMonth, pickerDay, pickerHour, pickerMinute, 0, 0));
      setPickerVisible(false);
      setPickerStep('date');
    }
  };

  const cancelPicker = () => {
    setPickerVisible(false);
    setPickerStep('date');
  };

  const toggleAccountType = (id) =>
    setAllowedAccountTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  const toggleLookingFor = (id) =>
    setAllowedLookingFor((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  const pickCoverPhoto = () => {
    const handlePick = async (source) => {
      const uri = source === 'camera'
        ? await pickFromCamera({ allowsEditing: true, aspect: [16, 9] })
        : await pickFromGallery({ allowsEditing: true, aspect: [16, 9], quality: 1 });
      if (uri) setCoverPhotoUri(uri);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['İptal', 'Kameradan Çek', 'Galeriden Seç'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) handlePick('camera'); else if (idx === 2) handlePick('gallery'); },
      );
    } else {
      Alert.alert('Fotoğraf Ekle', undefined, [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kameradan Çek', onPress: () => handlePick('camera') },
        { text: 'Galeriden Seç', onPress: () => handlePick('gallery') },
      ]);
    }
  };

  const isValid =
    title.trim().length > 0 &&
    locationDetail.trim().length > 0 &&
    parseInt(maxParticipants) >= 2 &&
    allowedAccountTypes.length > 0 &&
    allowedLookingFor.length > 0;

  const handleCreate = async () => {
    if (!isValid || !user || submitting) return;
    setSubmitting(true);
    try {
      let coverPhotoUrl = null;
      if (coverPhotoUri) {
        try {
          coverPhotoUrl = await runWithBackgroundRetry(() => uploadPhoto('photos', `${user.id}/events`, coverPhotoUri));
        } catch (e) {
          if (__DEV__) console.error(e);
          handleError('Kapak fotoğrafı yükle', e, { silent: true });
        }
      }

      // Konum: alan-scoped, kaba (herkese açık) + tam (sadece organizatör/onaylı
      // katılımcı — event_locations'a RLS ile korunarak yazılır, bkz. aşağı)
      let locationRough = editEvent?.location_rough ?? null;
      let roughLatitude = editEvent?.rough_latitude ?? null;
      let roughLongitude = editEvent?.rough_longitude ?? null;
      let exactPlace = null;

      if (!editEvent || locationEdited) {
        exactPlace = selectedPlace ?? await geocodeAddress(locationDetail.trim(), city).catch(() => null);
        locationRough = extractRoughLocation(exactPlace?.addressComponents, city);
        roughLatitude = exactPlace?.latitude != null ? Math.round(exactPlace.latitude * 100) / 100 : null;
        roughLongitude = exactPlace?.longitude != null ? Math.round(exactPlace.longitude * 100) / 100 : null;
      } else if (selectedPlace) {
        exactPlace = selectedPlace; // düzenleme modunda değişmedi, mevcut tam konum korunuyor
      }

      const eventPayload = {
        title: title.trim(),
        description: description.trim() || '',
        category,
        event_date: eventDate.toISOString(),
        location_rough: locationRough,
        rough_latitude: roughLatitude,
        rough_longitude: roughLongitude,
        city,
        max_participants: parseInt(maxParticipants),
        payment_type: paymentType,
        requires_children: requiresChildren,
        auto_approve: autoApprove,
        allowed_account_types: allowedAccountTypes,
        allowed_looking_for: allowedLookingFor,
        community_id: communityId,
        ...(coverPhotoUrl ? { cover_photo_url: coverPhotoUrl } : {}),
      };

      // Tam konumu ayrı, RLS korumalı tabloya yaz — organizatör ve onaylı
      // katılımcı dışında kimse göremez
      const saveExactLocation = async (eventId) => {
        if (!exactPlace) return;
        await runWithBackgroundRetry(() =>
          supabase.from('event_locations').upsert({
            event_id: eventId,
            location_detail: locationDetail.trim(),
            latitude: exactPlace.latitude ?? null,
            longitude: exactPlace.longitude ?? null,
          })
        );
      };

      // Edit modu: güncelle
      if (editEvent) {
        const { error } = await runWithBackgroundRetry(() =>
          supabase.from('events').update(eventPayload).eq('id', editEvent.id)
        );
        if (error) { handleError('Etkinlik güncelle', error, { onRetry: handleCreate }); return; }
        await saveExactLocation(editEvent.id).catch(() => {});
        navigation.goBack();
        return;
      }

      // Yeni etkinlik: ekle
      const { data: newEvent, error } = await runWithBackgroundRetry(() =>
        supabase.from('events').insert({
          creator_id: user.id,
          ...eventPayload,
          status: 'open',
          business_id: isBusinessAccount ? user.id : null,
        }).select('id').single()
      );

      if (error) { handleError('Etkinlik oluştur', error, { onRetry: handleCreate }); return; }

      // Etkinlik artık sunucuda var. Buradan sonrası (tam konum, gönderi→
      // etkinlik bağlama, takipçi bildirimi) en iyi-çaba: başarısız olsa da
      // etkinliği yeniden oluşturmaya çalışmayız — mükerrer kayıt olur.
      try {
        if (newEvent?.id) await saveExactLocation(newEvent.id).catch(() => {});

        track(EVENTS.EVENT_CREATED, { event_id: newEvent?.id, is_business: isBusinessAccount });

        // Bir gönderiden çevrildiyse: gönderiyi yeni etkinliğe bağla, gönderiye
        // yorum yapanları (organizatör hariç) otomatik katılımcı yap ve haber ver.
        if (sourcePostId && newEvent?.id) {
          try {
            await runWithBackgroundRetry(() =>
              supabase.from('posts').update({ related_event_id: newEvent.id }).eq('id', sourcePostId)
            );

            const { data: commentRows } = await runWithBackgroundRetry(() =>
              supabase.from('post_comments').select('author_id').eq('post_id', sourcePostId)
            );

            const commenterIds = [...new Set((commentRows ?? []).map((c) => c.author_id))]
              .filter((id) => id !== user.id);

            if (commenterIds.length > 0) {
              const capacity = parseInt(maxParticipants);
              const participantRows = commenterIds.map((participantId, i) => ({
                event_id: newEvent.id,
                user_id: participantId,
                status: i < capacity ? 'approved' : 'waiting',
                join_message: null,
              }));
              await runWithBackgroundRetry(() => supabase.from('event_participants').insert(participantRows));

              await Promise.all(commenterIds.map((participantId) =>
                createNotification({
                  userId: participantId,
                  type: 'post_became_event',
                  title: 'Yorum yaptığın fikir etkinliğe dönüştü! 🎉',
                  body: title.trim(),
                  data: { eventId: newEvent.id },
                })
              ));
            }
          } catch (e) {
            if (__DEV__) console.warn('Gönderi→etkinlik bağlama başarısız:', e);
          }
        }

        // İşletme hesabı ise takipçilere bildirim gönder — sunucu tarafında işlenir
        if (isBusinessAccount && newEvent?.id) {
          supabase.functions.invoke('notify-business-event', {
            body: {
              eventId: newEvent.id,
              businessId: user.id,
              eventTitle: title.trim(),
              city,
              locationDetail: locationDetail.trim(),
            },
          }).catch((e) => {
            if (__DEV__) console.warn('Takipçi bildirimi gönderilemedi:', e);
          });
        }
      } catch (postCreateErr) {
        if (__DEV__) console.error('Etkinlik sonrası işlemler başarısız:', postCreateErr);
        handleError('Etkinlik oluşturuldu ama bazı adımlar tamamlanamadı', postCreateErr, { silent: true });
      }

      navigation.goBack();
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError(editEvent ? 'Etkinlik güncellenirken' : 'Etkinlik oluşturulurken', err, { onRetry: handleCreate });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={LABELS.close}>
          <Ionicons name="close" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik Aç'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {communityName && (
          <View style={styles.communityBadge}>
            <Ionicons name="people" size={14} color={COLORS.primary} />
            <Text style={styles.communityBadgeText}>{communityName} alanı için oluşturuyorsun</Text>
          </View>
        )}

        {/* Cover Photo */}
        <TouchableOpacity style={styles.coverPhotoBtn} onPress={pickCoverPhoto} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={coverPhotoUri ? "Kapak fotoğrafını değiştir" : "Kapak fotoğrafı ekle"}>
          {coverPhotoUri ? (
            <>
              <Image source={{ uri: coverPhotoUri }} style={styles.coverPhotoImg} />
              <View style={styles.coverPhotoOverlay}>
                <Ionicons name="camera" size={20} color={COLORS.white} />
                <Text style={styles.coverPhotoOverlayText}>Değiştir</Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="image-outline" size={36} color="#ccc" />
              <Text style={styles.coverPhotoPlaceholder}>Kapak Fotoğrafı Ekle</Text>
              <Text style={styles.coverPhotoSub}>Opsiyonel · 16:9</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

        <Text style={styles.label}>Başlık *</Text>
        <TextInput style={styles.input} placeholder="Örn: Moda Sahil Pikniği" placeholderTextColor="#aaa" value={title} onChangeText={setTitle} maxLength={80} accessibilityLabel="Başlık" />

        <Text style={styles.label}>Açıklama</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder={PLACEHOLDERS.eventDescription} placeholderTextColor="#aaa" multiline value={description} onChangeText={setDescription} maxLength={500} accessibilityLabel="Açıklama" />

        <Text style={styles.label}>Kategori *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} style={[styles.catPill, category === cat && styles.catPillActive]} onPress={() => setCategory(cat)} accessibilityRole="button" accessibilityLabel={cat} accessibilityState={{ selected: category === cat }}>
              <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Zaman & Konum</Text>

        <Text style={styles.label}>Tarih & Saat *</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={openDatePicker} accessibilityRole="button" accessibilityLabel="Tarih ve saat seç">
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={{ marginRight: 10 }} />
          <Text style={styles.dateBtnText}>{formatEventDate(eventDate)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#aaa" />
        </TouchableOpacity>

        <Text style={styles.label}>Konum Detayı *</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Moda Sahili, Güneş Parkı girişi"
          placeholderTextColor="#aaa"
          value={locationDetail}
          onChangeText={(t) => { setLocationDetail(t); setSelectedPlace(null); setShowSuggestions(true); setLocationEdited(true); }}
          onFocus={() => setShowSuggestions(true)}
          maxLength={150}
          accessibilityLabel="Konum detayı"
        />
        {showSuggestions && locationSuggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {locationSuggestions.map((s) => (
              <TouchableOpacity
                key={s.placeId}
                style={styles.suggestionItem}
                onPress={() => handlePickSuggestion(s)}
                accessibilityRole="button"
                accessibilityLabel={s.description}
              >
                <Ionicons name="location-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.suggestionText} numberOfLines={1}>{s.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>{LABELS.city}</Text>
        <View style={[styles.input, styles.cityRow]}>
          <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.cityText}>{city || 'Profilinden alınıyor...'}</Text>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Kapasite & Ücret</Text>

        <Text style={styles.label}>Maksimum Katılımcı Sayısı *</Text>
        <TextInput style={[styles.input, { width: 140 }]} placeholder="10" placeholderTextColor="#aaa" keyboardType="numeric" value={maxParticipants} onChangeText={(t) => setMaxParticipants(t.replace(/[^0-9]/g, ''))} maxLength={3} accessibilityLabel="Maksimum katılımcı sayısı" />

        <Text style={styles.label}>Ücret Durumu *</Text>
        <View style={styles.chipRow}>
          {PAYMENT_OPTIONS.map((p) => (
            <TouchableOpacity key={p.id} style={[styles.filterChip, paymentType === p.id && styles.filterChipActive]} onPress={() => setPaymentType(p.id)} accessibilityRole="button" accessibilityLabel={p.label} accessibilityState={{ selected: paymentType === p.id }}>
              <Text style={styles.chipEmoji}>{p.icon}</Text>
              <Text style={[styles.filterChipText, paymentType === p.id && styles.filterChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Katılım Şartları</Text>
        <Text style={styles.sectionSub}>Bu filtreler kimlerin istek gönderebileceğini belirler.</Text>

        <Text style={styles.label}>Hesap Türü</Text>
        <View style={styles.chipRow}>
          {ACCOUNT_TYPE_OPTIONS.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.filterChip, allowedAccountTypes.includes(t.id) && styles.filterChipActive]} onPress={() => toggleAccountType(t.id)} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: allowedAccountTypes.includes(t.id) }}>
              <Text style={[styles.filterChipText, allowedAccountTypes.includes(t.id) && styles.filterChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {allowedAccountTypes.length === 0 && <Text style={styles.validationHint}>En az bir tür seçilmeli</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>Arama Tipi</Text>
        <View style={styles.chipRow}>
          {LOOKING_FOR_OPTIONS.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.filterChip, allowedLookingFor.includes(t.id) && styles.filterChipActive]} onPress={() => toggleLookingFor(t.id)} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: allowedLookingFor.includes(t.id) }}>
              <Text style={[styles.filterChipText, allowedLookingFor.includes(t.id) && styles.filterChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {allowedLookingFor.length === 0 && <Text style={styles.validationHint}>En az bir tür seçilmeli</Text>}

        <View style={[styles.switchRow, { marginTop: 20 }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.switchLabel}>Çocuk Zorunlu</Text>
            <Text style={styles.switchSub}>Sadece çocuğu olan aileler görebilsin.</Text>
          </View>
          <Switch
            value={requiresChildren}
            onValueChange={setRequiresChildren}
            trackColor={{ false: '#e1e1e1', true: COLORS.avatarFallback }}
            thumbColor={requiresChildren ? COLORS.primary : COLORS.white}
            accessibilityRole="switch"
            accessibilityLabel="Çocuk zorunlu"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.switchLabel}>⚡ Katılımları Otomatik Onayla</Text>
            <Text style={styles.switchSub}>Katılmak isteyen herkes onay beklemeden anında katılır.</Text>
          </View>
          <Switch
            value={autoApprove}
            onValueChange={setAutoApprove}
            trackColor={{ false: '#e1e1e1', true: COLORS.avatarFallback }}
            thumbColor={autoApprove ? COLORS.primary : COLORS.white}
            accessibilityRole="switch"
            accessibilityLabel="Katılımları otomatik onayla"
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.createBtn, (!isValid || submitting) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!isValid || submitting}
          accessibilityRole="button"
          accessibilityLabel="Oluştur ve yayınla"
        >
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.createBtnText}>Oluştur ve Yayınla</Text>}
        </TouchableOpacity>
      </View>

      <DateTimePicker
        visible={pickerVisible}
        step={pickerStep}
        month={pickerMonth}
        day={pickerDay}
        hour={pickerHour}
        minute={pickerMinute}
        onAdjustMonth={adjustMonth}
        onAdjustDay={adjustDay}
        onAdjustHour={adjustHour}
        onAdjustMinute={adjustMinute}
        onConfirm={confirmPicker}
        onCancel={cancelPicker}
        getAutoYear={getAutoYear}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  content: { flex: 1, padding: 20 },
  communityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  communityBadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  coverPhotoBtn: {
    height: 160, borderRadius: 16, backgroundColor: '#f5f5f5',
    borderWidth: 1.5, borderColor: '#e8e8e8', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 28, overflow: 'hidden',
  },
  coverPhotoImg: { width: '100%', height: '100%' },
  coverPhotoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.overlay, paddingVertical: 8,
  },
  coverPhotoOverlayText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  coverPhotoPlaceholder: { fontSize: 15, fontWeight: '600', color: '#aaa', marginTop: 10 },
  coverPhotoSub: { fontSize: 12, color: '#ccc', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark, marginBottom: 16 },
  sectionSub: { fontSize: 13, color: '#888', marginTop: -12, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  input: {
    backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15, marginBottom: 20, color: '#333',
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 13 },
  suggestionsList: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#eee', borderRadius: 12,
    marginTop: -14, marginBottom: 20, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  suggestionText: { fontSize: 14, color: '#333', flex: 1 },
  categoryScroll: { marginBottom: 20 },
  catPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 10 },
  catPillActive: { backgroundColor: COLORS.primary },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#666' },
  catPillTextActive: { color: COLORS.white },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
  },
  dateBtnText: { flex: 1, fontSize: 15, color: COLORS.textDark, fontWeight: '600' },
  cityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  cityText: { fontSize: 15, color: '#888' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee',
  },
  filterChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: COLORS.primary },
  chipEmoji: { fontSize: 14 },
  validationHint: { fontSize: 12, color: COLORS.error, marginTop: -14, marginBottom: 16 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9',
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  switchSub: { fontSize: 12, color: '#888' },
  bottomBar: {
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  createBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
