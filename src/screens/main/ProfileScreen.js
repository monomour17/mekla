import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl,
  Animated, Linking, Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import useAppStore from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';
import { pickAndUploadPhoto, removePhoto, pickFromGallery, uploadPhoto } from '../../utils/photos';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import LoadingState from '../../components/LoadingState';
import ProfileEditForm from '../../components/profile/ProfileEditForm';
import HeaderBell from '../../components/HeaderBell';
import { fetchOrganizerStats, calculateOrganizerBadge } from '../../utils/organizerBadge';
import { membershipDuration } from '../../utils/dateFormat';

const ACCOUNT_LABELS = { couple: 'Çift', individual: 'Bireysel Ebeveyn', business: 'İşletme' };
const LOOKING_OPTIONS = [
  { id: 'family', label: 'Aile Buluşmaları' },
  { id: 'couple', label: 'Çift Buluşmaları' },
  { id: 'both', label: 'Her İkisi' },
];
const AGE_LABELS = { '0-2': '0–2 yaş', '3-5': '3–5 yaş', '6-10': '6–10 yaş', '11+': '11+ yaş' };

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * Profil tamamlama yüzdesini hesaplar ve gösterir.
 * Güven sinyali: %100 profil = etkinliklerde daha yüksek onay oranı.
 */
function calcCompletion(profile, photos) {
  const checks = [
    { label: 'İsim', done: !!profile.display_name },
    { label: 'Şehir', done: !!profile.city },
    { label: 'Fotoğraf', done: photos.length > 0 },
    { label: 'Hakkımda', done: !!profile.bio?.trim() },
    { label: 'Arayış', done: !!profile.looking_for },
  ];
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  return { pct, checks };
}

function ProfileCompletion({ profile, photos, onEdit }) {
  const { pct, checks } = calcCompletion(profile, photos);
  if (pct === 100) return null; // Tam dolu profil widget göstermez

  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  const color = pct < 60 ? '#E65100' : '#f59e0b';

  return (
    <TouchableOpacity style={styles.completionCard} onPress={onEdit} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Profil %${pct} tamamlandı. Tamamlamak için dokun.`}>
      <View style={styles.completionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.completionTitle}>Profil Tamamlama</Text>
          <Text style={styles.completionSub}>Tam profil = daha yüksek onay oranı</Text>
        </View>
        <Text style={[styles.completionPct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.completionBar}>
        <View style={[styles.completionFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.completionMissing}>
        Eksik: {missing.join(' · ')} · <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Ekle →</Text>
      </Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const setFeedStale = useAppStore((state) => state.setFeedStale);
  const bumpProfileVersion = useAppStore((state) => state.bumpProfileVersion);

  // Photo state
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Edit state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [hasChildren, setHasChildren] = useState(false);
  const [childCount, setChildCount] = useState(null);
  const [childrenAges, setChildrenAges] = useState([]);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [eventStats, setEventStats] = useState({ created: 0, participating: 0, past: 0 });

  // İşletme düzenleme state
  const [bizEditVisible, setBizEditVisible] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizBio, setBizBio] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizWebsite, setBizWebsite] = useState('');
  const [bizInstagram, setBizInstagram] = useState('');
  const [bizSaving, setBizSaving] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [organizerStats, setOrganizerStats] = useState({ avgRating: null, reviewCount: 0 });

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    if (!user) return;
    const now = new Date().toISOString();

    // 4 bağımsız sorguyu paralel çalıştır (sıralı 6 sorgu → 2 round-trip)
    const [
      { data: profileData },
      { data: allCreatedEvents },
      { data: futureCreatedEvents },
      { data: myParticipations },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('events').select('id').eq('creator_id', user.id).neq('status', 'cancelled'),
      supabase.from('events').select('id').eq('creator_id', user.id).neq('status', 'cancelled').gte('event_date', now),
      supabase.from('event_participants').select('event_id').eq('user_id', user.id).eq('status', 'approved'),
    ]);

    setProfile(profileData);
    setPhotos(profileData?.photos ?? []);

    // Pending başvuru sayısı (organizatörün beklediği onay istekleri)
    let pendingCount = 0;
    if (allCreatedEvents?.length) {
      const eIds = allCreatedEvents.map((e) => e.id);
      const { count } = await supabase
        .from('event_participants')
        .select('*', { count: 'exact', head: true })
        .in('event_id', eIds)
        .eq('status', 'pending');
      pendingCount = count || 0;
    }
    setPendingRequestsCount(pendingCount);

    // Katılımcı olduğu gelecek etkinlikler
    let participatingCount = 0;
    if (myParticipations?.length) {
      const pEventIds = myParticipations.map((p) => p.event_id);
      const { count: pCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .in('id', pEventIds)
        .gte('event_date', now)
        .neq('status', 'cancelled');
      participatingCount = pCount ?? 0;
    }

    // Geçmiş etkinlik sayısı (katıldıkları + organize ettiği biten)
    let pastCount = 0;
    if (myParticipations?.length || allCreatedEvents?.length) {
      const allIds = [
        ...(myParticipations?.map((p) => p.event_id) ?? []),
        ...(allCreatedEvents?.map((e) => e.id) ?? []),
      ];
      const uniqIds = [...new Set(allIds)];
      if (uniqIds.length) {
        const { count: pCount } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .in('id', uniqIds)
          .lt('event_date', now);
        pastCount = pCount ?? 0;
      }
    }

    setEventStats({
      created: futureCreatedEvents?.length ?? 0,
      participating: participatingCount,
      past: pastCount,
    });

    // Organizatör puan ortalaması (kendi etkinliklerine alınan değerlendirmeler)
    const orgStats = await fetchOrganizerStats(user.id);
    setOrganizerStats({
      avgRating: orgStats.avgRating ?? null,
      reviewCount: orgStats.reviewCount ?? 0,
    });

    setLoading(false);
  };

  const startEdit = () => {
    setName(profile.display_name);
    setBio(profile.bio ?? '');
    setCity(profile.city);
    setLookingFor(profile.looking_for);
    setHasChildren(profile.has_children);
    setChildCount(profile.child_count ?? null);
    setChildrenAges(profile.children_ages ?? []);
    setEditing(true);
  };

  const isValid = name.trim().length > 0 && city.trim().length > 0 && lookingFor && (!hasChildren || (childCount !== null && childrenAges.length > 0));

  const startBizEdit = () => {
    setBizName(profile.business_name ?? profile.display_name ?? '');
    setBizBio(profile.business_bio ?? '');
    setBizAddress(profile.business_address ?? '');
    setBizWebsite(profile.business_website ?? '');
    setBizInstagram(profile.business_instagram ?? '');
    setBizEditVisible(true);
  };

  const handleBizSave = async () => {
    if (!bizName.trim() || bizSaving) return;
    setBizSaving(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('profiles').update({
          business_name: bizName.trim(),
          display_name: bizName.trim(),
          business_bio: bizBio.trim() || null,
          business_address: bizAddress.trim() || null,
          business_website: bizWebsite.trim() || null,
          business_instagram: bizInstagram.trim().replace('@', '') || null,
        }).eq('id', user.id)
      );
      if (error) throw error;
      await loadProfile();
      setBizEditVisible(false);
    } catch (e) {
      if (__DEV__) console.error(e);
      handleError('İşletme profili kaydedilirken', e, { onRetry: handleBizSave });
    } finally {
      setBizSaving(false);
    }
  };

  const MAX_GALLERY = 9;

  const handleAddGalleryPhoto = async () => {
    if (galleryUploading) return;
    const galleryCount = photos.slice(1).length;
    if (galleryCount >= MAX_GALLERY) {
      Alert.alert('Limit', `En fazla ${MAX_GALLERY} galeri fotoğrafı ekleyebilirsin.`);
      return;
    }
    setGalleryUploading(true);
    try {
      const uri = await pickFromGallery({ quality: 0.85 });
      if (!uri) return;
      const publicUrl = await uploadPhoto('photos', `${user.id}/gallery`, uri);
      const newPhotos = [...photos, publicUrl];
      await supabase.from('profiles').update({ photos: newPhotos }).eq('id', user.id);
      setPhotos(newPhotos);
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleRemoveGalleryPhoto = (photoUrl) => {
    Alert.alert('Fotoğrafı Sil', 'Galeriden kaldırmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => handleRemovePhoto(photoUrl) },
    ]);
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    const cityChanged = city.trim() !== profile.city;
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('profiles').update({
          display_name: name.trim(), bio: bio.trim(), city: city.trim(),
          looking_for: lookingFor, has_children: hasChildren,
          child_count: hasChildren ? childCount : null,
          children_ages: hasChildren ? childrenAges : [],
        }).eq('id', user.id)
      );
      if (error) throw error;
      if (cityChanged) setFeedStale(true);
      bumpProfileVersion();
      await loadProfile();
      setEditing(false);
    } catch (e) {
      if (__DEV__) console.error(e);
      handleError('Profil kaydedilirken', e, { onRetry: handleSave });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    setPhotoUploading(true);
    try {
      const newPhotos = await pickAndUploadPhoto(user.id, photos);
      if (newPhotos) { setPhotos(newPhotos); setFeedStale(true); }
    } catch (e) {
      if (__DEV__) console.error(e);
      handleError('Fotoğraf yükleme', e);
    }
    setPhotoUploading(false);
  };

  const handleRemovePhoto = async (url) => {
    try { const newPhotos = await removePhoto(user.id, url, photos); setPhotos(newPhotos); }
    catch (e) { if (__DEV__) console.error(e); handleError('Fotoğraf silme', e, { onRetry: () => handleRemovePhoto(url) }); }
  };

  const handleMovePhoto = async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const previousPhotos = photos;
    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, moved);
    setPhotos(newPhotos);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('profiles').update({ photos: newPhotos }).eq('id', user.id)
      );
      if (error) throw error;
    } catch (e) {
      if (__DEV__) console.error(e);
      setPhotos(previousPhotos);
      handleError('Fotoğraf sırası güncellenirken', e, { silent: true });
    }
  };

  // ===================== LOADING =====================
  if (loading) return <View style={styles.center}><LoadingState /></View>;

  // ===================== EDIT MODE =====================
  if (editing) {
    return (
      <ProfileEditForm
        photos={photos} photoUploading={photoUploading}
        name={name} setName={setName} bio={bio} setBio={setBio}
        city={city} setCity={setCity} lookingFor={lookingFor} setLookingFor={setLookingFor}
        hasChildren={hasChildren} setHasChildren={setHasChildren}
        childCount={childCount} setChildCount={setChildCount}
        childrenAges={childrenAges} setChildrenAges={setChildrenAges}
        saving={saving} isValid={isValid}
        onSave={handleSave} onCancel={() => setEditing(false)}
        onAddPhoto={handleAddPhoto} onRemovePhoto={handleRemovePhoto} onMovePhoto={handleMovePhoto}
      />
    );
  }

  // ===================== VIEW MODE =====================
  const initials = (profile.display_name ?? '?').split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?';

  const onRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileHeaderTitle}>Profil</Text>
        <HeaderBell />
      </View>

      {/* İşletme Düzenleme Modal */}
      <Modal visible={bizEditVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.bizModalHeader}>
            <TouchableOpacity onPress={() => setBizEditVisible(false)}>
              <Text style={styles.bizModalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.bizModalTitle}>İşletmeyi Düzenle</Text>
            <TouchableOpacity onPress={handleBizSave} disabled={!bizName.trim() || bizSaving}>
              <Text style={[styles.bizModalSave, (!bizName.trim() || bizSaving) && { opacity: 0.4 }]}>Kaydet</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.bizFieldLabel}>İşletme Adı *</Text>
            <TextInput style={styles.bizInput} value={bizName} onChangeText={setBizName} placeholder="İşletme adı" maxLength={80} />

            <Text style={styles.bizFieldLabel}>Kısa Açıklama</Text>
            <TextInput style={[styles.bizInput, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]} value={bizBio} onChangeText={setBizBio} placeholder="Müşterilerinize kendinizi tanıtın..." multiline maxLength={200} />

            <Text style={styles.bizFieldLabel}>Adres / İlçe</Text>
            <TextInput style={styles.bizInput} value={bizAddress} onChangeText={setBizAddress} placeholder="Örn: Bağdat Cad. No:12, Kadıköy" maxLength={150} />

            <Text style={styles.bizFieldLabel}>Web Sitesi</Text>
            <TextInput style={styles.bizInput} value={bizWebsite} onChangeText={setBizWebsite} placeholder="https://işletmeniz.com" keyboardType="url" autoCapitalize="none" />

            <Text style={styles.bizFieldLabel}>Instagram</Text>
            <TextInput style={styles.bizInput} value={bizInstagram} onChangeText={setBizInstagram} placeholder="@kullaniciadi" autoCapitalize="none" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
        <ProfileCompletion profile={profile} photos={photos} onEdit={profile.account_type === 'business' ? startBizEdit : startEdit} />

        <View style={styles.avatarWrap}>
          {photos[0] ? (
            <Image source={{ uri: photos[0] }} style={styles.avatarPhoto} contentFit="cover" />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          )}
          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.city}>📍 {profile.city}</Text>
          {profile.created_at && (
            <Text style={styles.membershipText}>{membershipDuration(profile.created_at)}</Text>
          )}
          {profile.bio ? <Text style={styles.bioView}>{profile.bio}</Text> : null}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={profile.account_type === 'business' ? startBizEdit : startEdit}
              accessibilityRole="button"
              accessibilityLabel="Profili düzenle"
            >
              <Text style={styles.editBtnText}>{LABELS.edit}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('EventRequests')} accessibilityRole="button" accessibilityLabel={`Etkinlik istekleri${pendingRequestsCount > 0 ? `, ${pendingRequestsCount} bekleyen` : ''}`}>
              <Ionicons name="mail-unread-outline" size={18} color="#888" style={{ marginRight: 6 }} />
              <Text style={styles.settingsBtnText}>İstekler</Text>
              {pendingRequestsCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('SavedPosts')} accessibilityRole="button" accessibilityLabel="Kaydedilen gönderiler">
              <Ionicons name="bookmark-outline" size={18} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')} accessibilityRole="button" accessibilityLabel={LABELS.settings}>
              <Ionicons name="settings-outline" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {profile.account_type === 'business' ? (
          /* ── İşletme bilgi kartı ── */
          <View style={styles.card}>
            <Row label="İşletme" value={profile.business_name ?? profile.display_name} />
            <Row label="Kategori" value={
              { cafe: '☕ Kafe', restaurant: '🍽️ Restoran', playground: '🧸 Oyun Alanı',
                sports: '⚽ Spor Merkezi', venue: '🎪 Etkinlik Mekanı', other: '🏪 İşletme' }
              [profile.business_category] ?? '—'
            } />
            {profile.business_website ? (
              <TouchableOpacity
                style={styles.rowTouchable}
                onPress={() => {
                  const url = profile.business_website.startsWith('http') ? profile.business_website : `https://${profile.business_website}`;
                  Linking.openURL(url);
                }}
              >
                <Text style={styles.rowLabel}>Web Sitesi</Text>
                <View style={styles.rowLinkValue}>
                  <Text style={styles.rowLinkText} numberOfLines={1}>{profile.business_website.replace(/https?:\/\//, '')}</Text>
                  <Ionicons name="open-outline" size={13} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            ) : null}
            {profile.business_instagram ? (
              <TouchableOpacity
                style={styles.rowTouchable}
                onPress={() => Linking.openURL(`https://instagram.com/${profile.business_instagram}`)}
              >
                <Text style={styles.rowLabel}>Instagram</Text>
                <View style={styles.rowLinkValue}>
                  <Text style={styles.rowLinkText}>@{profile.business_instagram}</Text>
                  <Ionicons name="logo-instagram" size={13} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          /* ── Bireysel / Çift bilgi kartı ── */
          <View style={styles.card}>
            <Row label="Hesap Türü" value={ACCOUNT_LABELS[profile.account_type]} />
            <Row label="Arıyor" value={LOOKING_OPTIONS.find((o) => o.id === profile.looking_for)?.label ?? '—'} />
            {profile.has_children ? (
              <>
                <Row label="Çocuk Sayısı" value={`${profile.child_count} çocuk`} />
                <Row label="Yaş Grupları" value={profile.children_ages?.length > 0 ? profile.children_ages.map((a) => AGE_LABELS[a]).join(', ') : '—'} />
              </>
            ) : (
              <Row label="Çocuk" value="Yok" />
            )}
          </View>
        )}

        {/* Konum chip — kartın dışında, tam genişlikte */}
        {profile.account_type === 'business' && (profile.business_address || profile.city) && (
          <TouchableOpacity
            style={styles.locationChip}
            onPress={() => {
              const q = encodeURIComponent(
                profile.business_address
                  ? `${profile.business_address}, ${profile.city}`
                  : profile.city
              );
              Linking.openURL(`https://maps.google.com/?q=${q}`);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.locationChipLeft}>
              <View style={styles.locationChipIcon}>
                <Ionicons name="location" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {profile.business_address ? (
                  <>
                    <Text style={styles.locationChipAddress}>{profile.business_address}</Text>
                    <Text style={styles.locationChipCity}>{profile.city}</Text>
                  </>
                ) : (
                  <Text style={styles.locationChipAddress}>{profile.city}</Text>
                )}
              </View>
            </View>
            <View style={styles.locationChipRight}>
              <Ionicons name="map" size={16} color={COLORS.primary} />
              <Text style={styles.locationChipOpen}>Haritada Gör</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* İşletme galerisi — tıklayınca tam galeri ekranı açılır */}
        {profile.account_type === 'business' && (() => {
          const galleryPhotos = photos.slice(1);
          const GSIZE = (Dimensions.get('window').width - 32 - 8) / 3;
          return (
            <View style={styles.bizGalleryWrap}>
              <View style={styles.bizGalleryHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.bizGalleryTitle}>📷 Galeri</Text>
                  {galleryPhotos.length > 0 && (
                    <Text style={styles.bizGalleryCount}>{galleryPhotos.length} fotoğraf</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.bizAddPhotoBtn}
                  onPress={() => navigation.navigate('BusinessGallery')}
                >
                  <Text style={styles.bizAddPhotoText}>Tümünü Gör →</Text>
                </TouchableOpacity>
              </View>
              {galleryPhotos.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('BusinessGallery')}
                >
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {galleryPhotos.slice(0, 3).map((uri, i) => (
                      <View key={i} style={{ flex: 1, height: GSIZE, position: 'relative' }}>
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%', borderRadius: 8 }}
                          contentFit="cover"
                        />
                        {/* 3. fotoğrafta "+X daha" overlay */}
                        {i === 2 && galleryPhotos.length > 3 && (
                          <View style={styles.moreOverlay}>
                            <Text style={styles.moreText}>+{galleryPhotos.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.bizGalleryEmpty}
                  onPress={() => navigation.navigate('BusinessGallery')}
                >
                  <Ionicons name="images-outline" size={32} color="#ccc" />
                  <Text style={styles.bizGalleryEmptyText}>Galeri fotoğrafı ekle</Text>
                  <Text style={styles.bizGalleryEmptySub}>Menü, mekan, etkinlik...</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        <TouchableOpacity style={styles.eventStatsCard} activeOpacity={0.7} onPress={() => navigation.navigate('Etkinlikler', { screen: 'EventsHome', params: { initialTab: 'mine' } })} accessibilityRole="button" accessibilityLabel="Etkinliklerim">
          <Text style={styles.eventStatsTitle}>Etkinliklerim</Text>
          <View style={styles.eventStatsRow}>
            <View style={styles.eventStatItem}>
              <Text style={styles.eventStatNumber}>{eventStats.participating}</Text>
              <Text style={styles.eventStatLabel}>Katılacağın</Text>
            </View>
            <View style={styles.eventStatDivider} />
            <View style={styles.eventStatItem}>
              <Text style={styles.eventStatNumber}>{eventStats.created}</Text>
              <Text style={styles.eventStatLabel}>Düzenlediğin</Text>
            </View>
            <View style={styles.eventStatDivider} />
            <View style={styles.eventStatItem}>
              <Text style={[styles.eventStatNumber, { color: COLORS.textSecondary }]}>{eventStats.past}</Text>
              <Text style={styles.eventStatLabel}>Geçmiş</Text>
            </View>
          </View>
          <View style={styles.eventStatsFooter}>
            <Text style={styles.eventStatsFooterText}>Tüm etkinliklerini gör</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        {/* Organizatör Puanı — sadece en az 1 değerlendirme aldıysa göster */}
        {organizerStats.reviewCount > 0 && (
          <View style={styles.ratingCard}>
            <View style={styles.ratingIconBox}>
              <Ionicons name="star" size={28} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ratingLabel}>Organizatör Puanın</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingValue}>
                  {organizerStats.avgRating?.toFixed(1) ?? '—'}
                </Text>
                <Text style={styles.ratingCount}>
                  · {organizerStats.reviewCount} değerlendirme
                </Text>
              </View>
              {calculateOrganizerBadge(organizerStats.avgRating, organizerStats.reviewCount).hasBadge && (
                <View style={styles.trustBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={COLORS.white} />
                  <Text style={styles.trustBadgeText}>Mekla Yıldızı</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Hiç değerlendirme yoksa: ipucu kartı (sadece en az 1 etkinlik düzenlemişse) */}
        {organizerStats.reviewCount === 0 && eventStats.created + eventStats.past > 0 && (
          <View style={styles.ratingHintCard}>
            <Ionicons name="star-outline" size={22} color={COLORS.textMuted} />
            <Text style={styles.ratingHintText}>
              Henüz değerlendirme almadın. Etkinlik sonrası katılımcıların puan vermesi seni güvenilir organizatör yapar.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight || COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileHeaderTitle: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  photoWarning: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, alignItems: 'center' },
  photoWarningText: { fontSize: 13, fontWeight: '600', color: '#E65100', textAlign: 'center' },
  avatarWrap: { alignItems: 'center', paddingVertical: 36 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44, marginBottom: 14 },
  name: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  city: { fontSize: 15, color: '#888', marginBottom: 8 },
  membershipText: { fontSize: 12, color: '#aaa', marginBottom: 8 },
  bioView: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 24 },
  actionRow: { flexDirection: 'row', gap: 10 },
  editBtn: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary },
  editBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: COLORS.white },
  settingsBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.error, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  card: { marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowLabel: { fontSize: 15, color: '#666' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', maxWidth: '55%', textAlign: 'right' },
  rowTouchable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },

  // Konum chip
  locationChip: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f0eeff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ddd6fe',
  },
  locationChipLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  locationChipIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center',
  },
  locationChipAddress: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  locationChipCity: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  locationChipRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  locationChipOpen: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // İşletme galeri
  bizGalleryWrap: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  bizGalleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  bizGalleryTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  bizGalleryCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  bizAddPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bizAddPhotoText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  bizGalleryEmpty: { alignItems: 'center', gap: 8, paddingVertical: 28, backgroundColor: '#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed' },
  bizGalleryEmptyText: { fontSize: 14, color: '#888', fontWeight: '600' },
  bizGalleryEmptySub: { fontSize: 12, color: '#bbb' },
  galleryDeleteBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 11,
  },
  moreOverlay: {
    position: 'absolute', inset: 0, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  moreText: { color: '#fff', fontSize: 20, fontWeight: '800' },

  // İşletme düzenleme modal
  bizModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  bizModalCancel: { fontSize: 16, color: COLORS.textSecondary },
  bizModalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },
  bizModalSave: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  bizFieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 16 },
  bizInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textDark, backgroundColor: '#fafafa' },
  rowLinkValue: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '55%' },
  rowLinkText: { fontSize: 15, fontWeight: '600', color: COLORS.primary, textAlign: 'right' },
  eventStatsCard: { marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 16 },
  eventStatsTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  eventStatsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  eventStatItem: { flex: 1, alignItems: 'center' },
  eventStatNumber: { fontSize: 28, fontWeight: '900', color: COLORS.primary, marginBottom: 4 },
  eventStatLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  eventStatDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  eventStatsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  eventStatsFooterText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginRight: 4 },

  // Organizatör Puanı kartı
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratingIconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: COLORS.warningBg,
    justifyContent: 'center', alignItems: 'center',
  },
  ratingLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  ratingValue: { fontSize: 24, fontWeight: '900', color: COLORS.warningText, marginRight: 6 },
  ratingCount: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, alignSelf: 'flex-start', marginTop: 6,
  },
  trustBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  ratingHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  ratingHintText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  // Profile Completion widget
  completionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 4,
  },
  completionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  completionTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  completionSub: { fontSize: 11, color: '#888', marginTop: 1 },
  completionPct: { fontSize: 26, fontWeight: '900' },
  completionBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  completionFill: { height: '100%', borderRadius: 3 },
  completionMissing: { fontSize: 12, color: '#666' },

  // Removed: photoWarning (merged into ProfileCompletion)
});
