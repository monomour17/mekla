import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';
import { track, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { uploadPhoto, pickFromGallery, pickFromCamera } from '../../utils/photos';
import { COLORS } from '../../constants/colors';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import { markChatRead } from '../../utils/chatReadState';
import { LABELS, PLACEHOLDERS } from '../../constants/strings';

// memo olmadan her mesaj, listedeki HERHANGİ bir state değişiminde
// (yazı yazma, başka bir mesajı düzenleme) yeniden render oluyordu.
const ChatMessageBubble = memo(function ChatMessageBubble({
  item, isMe, senderProfile, isEditing, editingText,
  onEditTextChange, onSaveEdit, onCancelEdit, onLongPress, onImagePress, onLocationPress,
}) {
  if (item.type === 'system') {
    return (
      <View style={styles.systemMsgWrapper}>
        <View style={styles.systemMsgBubble}>
          <Ionicons name="information-circle-outline" size={14} color="#888" style={{ marginRight: 4 }} />
          <Text style={styles.systemMsgText}>{item.content}</Text>
        </View>
      </View>
    );
  }

  const msgType = item.type || 'text';
  const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
      {!isMe && (
        <View style={styles.avatarContainer}>
          <Avatar profile={senderProfile} size={30} />
        </View>
      )}
      <View style={{ maxWidth: '75%' }}>
        {!isMe && <Text style={styles.senderName}>{senderProfile?.display_name || 'Kullanıcı'}</Text>}

        {isEditing ? (
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
            <TextInput
              style={[styles.editInput, isMe && { color: COLORS.white, borderColor: 'rgba(255,255,255,0.4)' }]}
              value={editingText}
              onChangeText={onEditTextChange}
              multiline
              autoFocus
              maxLength={1000}
              accessibilityLabel="Mesajı düzenle"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity onPress={onCancelEdit} style={styles.editCancelBtn} accessibilityRole="button" accessibilityLabel="İptal">
                <Text style={{ fontSize: 12, color: isMe ? 'rgba(255,255,255,0.7)' : COLORS.textMuted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onSaveEdit(item.id)} style={styles.editSaveBtn} accessibilityRole="button" accessibilityLabel="Kaydet">
                <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '600' }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : msgType === 'image' && item.media_url ? (
          <Pressable onLongPress={() => onLongPress(item)} delayLongPress={300} onPress={() => onImagePress(item.media_url)} accessibilityRole="button" accessibilityLabel="Fotoğrafı büyüt veya seçenekler için basılı tut">
            <Image source={{ uri: item.media_url }} style={styles.msgImage} />
          </Pressable>
        ) : msgType === 'location' && item.media_url ? (
          <Pressable
            style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}
            onPress={() => onLocationPress(item.media_url)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel="Konumu haritada aç veya seçenekler için basılı tut"
          >
            <View style={styles.locationContent}>
              <Ionicons name="location" size={22} color={isMe ? COLORS.white : COLORS.primary} />
              <View style={{ marginLeft: 8, flexShrink: 1 }}>
                <Text style={[styles.locationLabel, isMe && { color: COLORS.white }]} numberOfLines={2}>
                  {item.content || 'Konum'}
                </Text>
                <Text style={[styles.locationLink, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                  Haritada Aç →
                </Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}
            onLongPress={() => onLongPress(item)}
            delayLongPress={300}
            accessibilityRole="button"
            accessibilityLabel="Mesaj seçenekleri için basılı tut"
          >
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>{item.content}</Text>
          </Pressable>
        )}

        <Text style={[styles.timeText, isMe && { textAlign: 'right' }]}>{time}</Text>
      </View>
    </View>
  );
});

export default function EventChatScreen({ route, navigation }) {
  const { eventId, eventTitle } = route.params;

  // Sohbet açık kaldığı sürece gelen mesajlar da okunmuş sayılır:
  // girişte ve çıkışta okundu damgası at (push ile direkt gelinen yol dahil)
  useEffect(() => {
    markChatRead(eventId);
    return () => { markChatRead(eventId); };
  }, [eventId]);

  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Ek menü & konum seçici
  const [showAttach, setShowAttach] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [sendingCurrentLocation, setSendingCurrentLocation] = useState(false);

  // Tam ekran fotoğraf
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Long-press context menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMessage, setMenuMessage] = useState(null);

  // Report
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportTargetId, setReportTargetId] = useState(null);
  const [reporting, setReporting] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Pagination
  const PAGE_SIZE = 30;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const oldestCursorRef = useRef(null);

  const flatListRef = useRef(null);
  const pendingPickerRef = useRef(null); // 'gallery' | 'camera' | null


  useEffect(() => {
    if (!currentUser) return;
    loadMessages();

    const channel = supabase
      .channel(`public:event_messages:event_id=eq.${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          fetchProfiles([newMsg.sender_id]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, currentUser]);

  const fetchProfiles = async (userIds) => {
    const uniqueIds = [...new Set(userIds)];
    const missingIds = uniqueIds.filter((id) => !profiles[id]);
    if (missingIds.length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, photos')
      .in('id', missingIds);

    if (data) {
      setProfiles((prev) => {
        const newProfiles = { ...prev };
        data.forEach((p) => { newProfiles[p.id] = p; });
        return newProfiles;
      });
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('event_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      oldestCursorRef.current = data[data.length - 1]?.created_at ?? null;
      setHasMore(data.length === PAGE_SIZE);
      setMessages([...data].reverse());
      await fetchProfiles(data.map((m) => m.sender_id));
    }
    setLoading(false);
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || !oldestCursorRef.current) return;
    setLoadingMore(true);
    const { data, error } = await supabase
      .from('event_messages')
      .select('*')
      .eq('event_id', eventId)
      .lt('created_at', oldestCursorRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data && data.length > 0) {
      oldestCursorRef.current = data[data.length - 1]?.created_at ?? null;
      setHasMore(data.length === PAGE_SIZE);
      setMessages((prev) => [...[...data].reverse(), ...prev]);
      await fetchProfiles(data.map((m) => m.sender_id));
    } else if (!error) {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  // --- Mesaj gönderme (text, image, location) ---
  const sendMessage = async (type = 'text', content = null, mediaUrl = null) => {
    const msgContent = content ?? inputText.trim();
    if (!msgContent && !mediaUrl) return;
    if (!currentUser) return;

    if (type === 'text') setInputText('');

    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      event_id: eventId,
      sender_id: currentUser.id,
      content: msgContent,
      type,
      media_url: mediaUrl,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    flatListRef.current?.scrollToEnd({ animated: true });

    const insertObj = {
      event_id: eventId,
      sender_id: currentUser.id,
      content: msgContent,
      type,
    };
    if (mediaUrl) insertObj.media_url = mediaUrl;

    const { data, error } = await runWithBackgroundRetry(() =>
      supabase.from('event_messages').insert(insertObj).select().single()
    );

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('Gönderilemedi', 'Mesaj gönderilemedi, lütfen tekrar dene.');
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      track(EVENTS.EVENT_CHAT_MESSAGE_SENT, { event_id: eventId, type });
    }
  };

  // --- Asıl picker mantığı (modal tamamen kapandıktan sonra çağrılır) ---
  const executePendingPicker = async () => {
    const action = pendingPickerRef.current;
    pendingPickerRef.current = null;
    if (!action) return;

    if (action === 'gallery') {
      const uri = await pickFromGallery();
      if (!uri) return;
      await uploadAndSend(uri);
    } else if (action === 'camera') {
      const uri = await pickFromCamera();
      if (!uri) return;
      await uploadAndSend(uri);
    }
  };

  const uploadAndSend = async (rawUri) => {
    setUploading(true);
    try {
      const publicUrl = await uploadPhoto('photos', `event_chat/${eventId}`, rawUri);
      await sendMessage('image', 'Fotoğraf', publicUrl);
    } catch (e) {
      handleError('Fotoğraf gönder', e);
    }
    setUploading(false);
  };

  // Butona basınca sadece pending'i set et ve modal'ı kapat.
  // iOS: onDismiss tetiklenince executePendingPicker çalışır.
  // Android: animasyon çakışması olmadığı için direkt çalıştır.
  const handlePickPhoto = () => {
    pendingPickerRef.current = 'gallery';
    setShowAttach(false);
    if (Platform.OS === 'android') executePendingPicker();
  };

  const handleTakePhoto = () => {
    pendingPickerRef.current = 'camera';
    setShowAttach(false);
    if (Platform.OS === 'android') executePendingPicker();
  };

  // --- Konum: Yer arama ---
  const handleSearchLocation = async () => {
    const query = locationSearch.trim();
    if (!query) return;
    setSearchingLocation(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results?.length) {
        // Reverse geocode ile adres bilgisi al
        const enriched = await Promise.all(
          results.slice(0, 5).map(async (r) => {
            const reverse = await Location.reverseGeocodeAsync({ latitude: r.latitude, longitude: r.longitude });
            const addr = reverse?.[0];
            const label = addr
              ? [addr.name, addr.street, addr.district, addr.city, addr.region].filter(Boolean).join(', ')
              : `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`;
            return { ...r, label };
          })
        );
        setLocationResults(enriched);
      } else {
        setLocationResults([]);
        Alert.alert('Sonuç Yok', 'Bu arama için konum bulunamadı. Daha detaylı yazmayı dene.');
      }
    } catch (e) {
      handleError('Konum araması', e);
    }
    setSearchingLocation(false);
  };

  const handleSelectLocation = async (loc) => {
    setShowLocationPicker(false);
    setLocationSearch('');
    setLocationResults([]);
    const mapUrl = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
    await sendMessage('location', loc.label || 'Konum', mapUrl);
  };

  const handleSendCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Konumunu göndermek için konum iznine ihtiyaç var.');
      return;
    }
    setSendingCurrentLocation(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addr = reverse?.[0];
      const label = addr
        ? [addr.name, addr.street, addr.district, addr.city].filter(Boolean).join(', ')
        : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setShowLocationPicker(false);
      setLocationSearch('');
      setLocationResults([]);
      const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      await sendMessage('location', label, mapUrl);
    } catch (e) {
      handleError('Mevcut konum', e);
    } finally {
      setSendingCurrentLocation(false);
    }
  };

  const openMapUrl = async (url) => {
    if (!url) return;
    try {
      const match = url.match(/q=([-\d.]+),([-\d.]+)/);
      if (match) {
        const lat = match[1];
        const lon = match[2];

        if (Platform.OS === 'ios') {
          // comgooglemaps:// çalışması için Info.plist'te LSApplicationQueriesSchemes olması lazım
          const googleUrl = `comgooglemaps://?q=${lat},${lon}&zoom=15`;
          const canOpenGoogle = await Linking.canOpenURL(googleUrl);
          await Linking.openURL(canOpenGoogle ? googleUrl : `maps:?q=${lat},${lon}`);
        } else {
          // Android: Google Maps uygulaması
          await Linking.openURL(`https://maps.google.com/?q=${lat},${lon}`);
        }
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert('Hata', 'Harita açılamadı.');
    }
  };

  // --- Context menu ---
  const openMenu = (item) => { setMenuMessage(item); setMenuVisible(true); };
  const closeMenu = () => { setMenuVisible(false); setMenuMessage(null); };

  const handleCopy = async () => {
    if (menuMessage?.content) await Clipboard.setStringAsync(menuMessage.content);
    closeMenu();
  };

  const handleEditFromMenu = () => {
    setEditingId(menuMessage.id);
    setEditingText(menuMessage.content ?? '');
    closeMenu();
  };

  const deleteMessage = async (id) => {
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('event_messages').delete().eq('id', id)
    );
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
    else handleError('Mesaj silinirken', error, { onRetry: () => deleteMessage(id) });
  };

  const handleDeleteFromMenu = () => {
    const id = menuMessage.id;
    closeMenu();
    Alert.alert('Mesajı Sil', 'Bu mesajı silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMessage(id) },
    ]);
  };

  const handleReportFromMenu = () => {
    const targetId = menuMessage?.sender_id;
    closeMenu();
    setReportTargetId(targetId);
    setReportReason('');
    setReportVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportTargetId) return;
    setReporting(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('reports').insert({
          reporter_id: currentUser.id,
          reported_user_id: reportTargetId,
          reason: reportReason,
          details: 'Etkinlik sohbet mesajı',
        })
      );
      if (error) throw error;
      setReportVisible(false);
      Alert.alert('Teşekkürler', 'Şikayetiniz iletildi. Ekibimiz en kısa sürede inceleyecek.');
    } catch (err) {
      handleError('Şikayet gönderilirken', err, { onRetry: handleSubmitReport });
    } finally {
      setReporting(false);
    }
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('event_messages').update({ content: trimmed }).eq('id', id)
    );
    if (!error) {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: trimmed } : m));
    } else {
      handleError('Mesaj düzenlenirken', error, { onRetry: () => handleSaveEdit(id) });
      return;
    }
    setEditingId(null);
    setEditingText('');
  };

  // --- Render ---
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  // ChatMessageBubble memo() ile sarılı — bu her render'da yeniden
  // oluşturulursa memo etkisiz kalır.
  const renderMessage = useCallback(({ item }) => (
    <ChatMessageBubble
      item={item}
      isMe={item.sender_id === currentUser?.id}
      senderProfile={profiles[item.sender_id]}
      isEditing={editingId === item.id}
      editingText={editingText}
      onEditTextChange={setEditingText}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelEdit}
      onLongPress={openMenu}
      onImagePress={setFullScreenImage}
      onLocationPress={openMapUrl}
    />
  ), [currentUser?.id, profiles, editingId, editingText, handleCancelEdit]);

  // Farklı şekilli mesaj tiplerini (metin/fotoğraf/konum/sistem) ayrı
  // recycling pool'larına ayırır — FlashList'in tek pool'da sürekli
  // yeniden ölçüm yapmasını önler.
  const getMessageItemType = useCallback((item) => item.type || 'text', []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={LABELS.back}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerTitleContainer}
          onPress={() => navigation.navigate('EventDetail', { eventId })}
          accessibilityRole="button"
          accessibilityLabel="Etkinlik detayına git"
        >
          <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle || 'Etkinlik Sohbeti'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={styles.headerSubtitle}>Grup Sohbeti</Text>
            <Ionicons name="chevron-forward" size={11} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
        <View style={{ width: 44 }} />
      </View>

      {/* MESSAGES + INPUT wrapped together so the list shrinks when keyboard opens */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.chatContainer}>
          {loading ? (
            <View style={styles.center}><LoadingState /></View>
          ) : messages.length === 0 ? (
            <View style={styles.center}>
              <EmptyState icon="chatbubbles-outline" title="Sohbeti Başlat" description="Gruba ilk mesajı sen gönder!" />
            </View>
          ) : (
            <FlashList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              getItemType={getMessageItemType}
              estimatedItemSize={70}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
              onStartReached={loadMoreMessages}
              onStartReachedThreshold={0.3}
              ListHeaderComponent={
                loadingMore
                  ? <ActivityIndicator size="small" color={COLORS.primary} style={{ margin: 12 }} />
                  : null
              }
            />
          )}
        </View>

        {/* Uploading indicator */}
        {uploading && (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.uploadingText}>Gönderiliyor...</Text>
          </View>
        )}

        {/* INPUT BOX */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttach(true)} accessibilityRole="button" accessibilityLabel="Dosya ekle">
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={PLACEHOLDERS.writeMessage}
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            accessibilityLabel="Mesaj yaz"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel={LABELS.send}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ====== ATTACHMENT MODAL ====== */}
      <Modal
        visible={showAttach}
        transparent
        animationType="fade"
        onDismiss={() => { if (Platform.OS === 'ios') executePendingPicker(); }}
      >
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={styles.attachCard}>
            <TouchableOpacity style={styles.attachOption} onPress={handlePickPhoto} accessibilityRole="button" accessibilityLabel="Galeriden fotoğraf seç">
              <View style={[styles.attachIconCircle, { backgroundColor: '#F5F2FF' }]}>
                <Ionicons name="images" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.attachOptionText}>Galeriden Fotoğraf</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto} accessibilityRole="button" accessibilityLabel="Kamera ile fotoğraf çek">
              <View style={[styles.attachIconCircle, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="camera" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.attachOptionText}>Kamera ile Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttach(false); setShowLocationPicker(true); }} accessibilityRole="button" accessibilityLabel="Konum gönder">
              <View style={[styles.attachIconCircle, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="location" size={24} color="#10b981" />
              </View>
              <Text style={styles.attachOptionText}>Konum Gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachCancelBtn} onPress={() => setShowAttach(false)} accessibilityRole="button" accessibilityLabel="Vazgeç">
              <Text style={styles.attachCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ====== LOCATION PICKER MODAL ====== */}
      <Modal visible={showLocationPicker} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.locationPickerOverlay}>
            <View style={styles.locationPickerCard}>
              <View style={styles.locationPickerHeader}>
                <Text style={styles.locationPickerTitle}>Konum Gönder</Text>
                <TouchableOpacity onPress={() => { setShowLocationPicker(false); setLocationSearch(''); setLocationResults([]); }} accessibilityRole="button" accessibilityLabel={LABELS.close}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Mevcut konumu gönder */}
              <TouchableOpacity
                style={styles.currentLocationBtn}
                onPress={handleSendCurrentLocation}
                disabled={sendingCurrentLocation}
                accessibilityRole="button"
                accessibilityLabel="Mevcut konumumu gönder"
              >
                {sendingCurrentLocation ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="navigate" size={18} color={COLORS.white} />
                    <Text style={styles.currentLocationBtnText}>Mevcut Konumumu Gönder</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.locationOrDivider}>— veya yer ara —</Text>

              <View style={styles.locationSearchRow}>
                <TextInput
                  style={styles.locationSearchInput}
                  placeholder="Yer ara... (Örn: Kadıköy Moda Sahili)"
                  placeholderTextColor="#aaa"
                  value={locationSearch}
                  onChangeText={setLocationSearch}
                  onSubmitEditing={handleSearchLocation}
                  returnKeyType="search"
                  accessibilityLabel="Konum ara"
                />
                <TouchableOpacity style={styles.locationSearchBtn} onPress={handleSearchLocation} disabled={searchingLocation} accessibilityRole="button" accessibilityLabel="Ara">
                  {searchingLocation ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons name="search" size={20} color={COLORS.white} />
                  )}
                </TouchableOpacity>
              </View>

              {locationResults.length > 0 ? (
                <FlatList
                  data={locationResults}
                  keyExtractor={(_, i) => String(i)}
                  style={styles.locationResultsList}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.locationResultItem} onPress={() => handleSelectLocation(item)} accessibilityRole="button" accessibilityLabel={`${item.label} konumunu gönder`}>
                      <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.locationResultText} numberOfLines={2}>{item.label}</Text>
                      <Ionicons name="send" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View style={styles.locationEmptyState}>
                  <Ionicons name="map-outline" size={48} color="#ddd" />
                  <Text style={styles.locationEmptyText}>Bir yer adı veya adres yazıp ara</Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ====== LONG-PRESS CONTEXT MENU ====== */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Kopyala">
              <Ionicons name="copy-outline" size={20} color={COLORS.textBody} />
              <Text style={styles.menuItemText}>Kopyala</Text>
            </TouchableOpacity>
            {menuMessage?.sender_id === currentUser?.id && menuMessage?.type !== 'image' && menuMessage?.type !== 'location' && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleEditFromMenu} accessibilityRole="button" accessibilityLabel="Düzenle">
                  <Ionicons name="create-outline" size={20} color={COLORS.textBody} />
                  <Text style={styles.menuItemText}>Düzenle</Text>
                </TouchableOpacity>
              </>
            )}
            {menuMessage?.sender_id === currentUser?.id && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteFromMenu} accessibilityRole="button" accessibilityLabel="Sil">
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  <Text style={[styles.menuItemText, { color: COLORS.error }]}>Sil</Text>
                </TouchableOpacity>
              </>
            )}
            {menuMessage?.sender_id !== currentUser?.id && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleReportFromMenu} accessibilityRole="button" accessibilityLabel="Şikayet et">
                  <Ionicons name="flag-outline" size={20} color={COLORS.warning} />
                  <Text style={[styles.menuItemText, { color: COLORS.warning }]}>Şikayet Et</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ====== REPORT MODAL ====== */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setReportVisible(false)}>
          <View style={styles.reportSheet}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.reportTitle}>Şikayet Nedeni</Text>
            <Text style={styles.reportSub}>Lütfen bir neden seçin</Text>
            {['Uygunsuz davranış', 'Spam / Reklam', 'Taciz veya zorbalık', 'Sahte profil', 'Diğer'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonItem, reportReason === reason && styles.reasonItemSelected]}
                onPress={() => setReportReason(reason)}
                accessibilityRole="button"
                accessibilityLabel={reason}
              >
                <View style={[styles.reasonRadio, reportReason === reason && styles.reasonRadioSelected]}>
                  {reportReason === reason && <View style={styles.reasonRadioDot} />}
                </View>
                <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextSelected]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.reportSubmitBtn, !reportReason && styles.reportSubmitBtnDisabled]}
              onPress={handleSubmitReport}
              disabled={!reportReason || reporting}
              accessibilityRole="button"
              accessibilityLabel="Şikayeti gönder"
            >
              {reporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Gönder</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportVisible(false)} accessibilityRole="button" accessibilityLabel="Vazgeç">
              <Text style={styles.reportCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ====== FULL SCREEN IMAGE ====== */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade">
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenImage(null)} accessibilityRole="button" accessibilityLabel={LABELS.close}>
            <Ionicons name="close-circle" size={36} color={COLORS.white} />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },

  chatContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 20 },

  msgWrapper: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  msgWrapperMe: { justifyContent: 'flex-end' },
  msgWrapperOther: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8, marginBottom: 16 },
  senderName: { fontSize: 11, color: '#888', marginLeft: 4, marginBottom: 4, fontWeight: '600' },

  msgBubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  msgBubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },

  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: COLORS.white },
  msgTextOther: { color: '#333' },

  // Image message
  msgImage: { width: 200, height: 200, borderRadius: 16 },

  // Location message
  locationContent: { flexDirection: 'row', alignItems: 'center' },
  locationLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  locationLink: { fontSize: 12, color: COLORS.primary, marginTop: 2 },

  timeText: { fontSize: 10, color: '#aaa', marginTop: 4, marginHorizontal: 4 },

  // System message
  systemMsgWrapper: { alignItems: 'center', marginVertical: 12 },
  systemMsgBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  systemMsgText: { fontSize: 13, color: '#888', fontWeight: '500' },

  // Uploading
  uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 8 },
  uploadingText: { fontSize: 12, color: '#888' },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  input: {
    flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 15, color: '#333', maxHeight: 120, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },

  // Attachment Modal
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  attachCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  attachOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  attachIconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  attachOptionText: { fontSize: 16, fontWeight: '600', color: '#333' },
  attachCancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  attachCancelText: { fontSize: 16, color: '#888' },

  // Location Picker
  locationPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  locationPickerCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: '70%' },
  locationPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  locationPickerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  currentLocationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', borderRadius: 14,
    paddingVertical: 14, marginBottom: 12,
  },
  currentLocationBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  locationOrDivider: { textAlign: 'center', color: '#aaa', fontSize: 12, marginBottom: 12 },
  locationSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  locationSearchInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#333' },
  locationSearchBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  locationResultsList: { maxHeight: 300 },
  locationResultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  locationResultText: { flex: 1, fontSize: 15, color: '#333' },
  locationEmptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  locationEmptyText: { fontSize: 14, color: '#aaa' },

  // Full Screen Image
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullScreenImg: { width: '100%', height: '70%' },

  // Inline edit
  editInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 8, fontSize: 15, color: '#333', minHeight: 36 },
  editCancelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
  editSaveBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.primary },

  // Report sheet
  reportSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  reportTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  reportSub: { fontSize: 14, color: '#888', marginBottom: 16 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  reasonItemSelected: { backgroundColor: '#faf8ff' },
  reasonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  reasonRadioSelected: { borderColor: COLORS.primary },
  reasonRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  reasonText: { fontSize: 15, color: '#444' },
  reasonTextSelected: { color: COLORS.primary, fontWeight: '600' },
  reportSubmitBtn: { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  reportSubmitBtnDisabled: { backgroundColor: '#c4b5fd' },
  reportSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  reportCancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 14 },
  reportCancelText: { fontSize: 15, color: '#666', fontWeight: '600' },

  // Long-press context menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 6,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#333' },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 12 },
});
