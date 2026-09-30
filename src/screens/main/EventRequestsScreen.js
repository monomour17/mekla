import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { track, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import EmptyState from '../../components/EmptyState';
import Avatar from '../../components/Avatar';
import LoadingState from '../../components/LoadingState';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import { LABELS } from '../../constants/strings';

const RequestCard = memo(function RequestCard({ item, isActioning, onViewEvent, onViewProfile, onApprove, onReject }) {
    return (
        <View style={styles.requestCard}>
            {/* Etkinlik Başlığı */}
            <TouchableOpacity
                style={styles.eventHeader}
                onPress={() => onViewEvent(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item._event?.title} etkinliğini görüntüle`}
            >
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.eventTitle} numberOfLines={1}>{item._event?.title}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>

            {/* İstek Atan Kişi ve Mesajı */}
            <TouchableOpacity
                style={styles.userContainer}
                activeOpacity={0.7}
                onPress={() => onViewProfile(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item._profile?.display_name ?? 'Kullanıcı'} profilini görüntüle`}
            >
                <Avatar profile={item._profile} size={50} />
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item._profile?.display_name ?? 'Bilinmeyen Kullanıcı'}</Text>
                    {item.join_message ? (
                        <View style={styles.msgBubble}>
                            <Text style={styles.msgText}>"{item.join_message}"</Text>
                        </View>
                    ) : (
                        <Text style={styles.noMsgText}>Mesaj bırakmadı</Text>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>

            {/* Aksiyon Butonları */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => onApprove(item)}
                    disabled={isActioning}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.approve}
                >
                    {isActioning ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.approveBtnText}>{LABELS.approve}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => onReject(item)}
                    disabled={isActioning}
                    accessibilityRole="button"
                    accessibilityLabel={LABELS.reject}
                >
                    <Text style={styles.rejectBtnText}>{LABELS.reject}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function EventRequestsScreen({ navigation }) {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState(null);
    const myEventIdsRef = useRef([]);

    useEffect(() => {
        loadRequests();

        // Realtime: yeni istekleri aninda goster
        const channel = supabase
            .channel('event-requests-screen')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'event_participants' },
                (payload) => {
                    const eid = payload.new?.event_id || payload.old?.event_id;
                    if (myEventIdsRef.current.includes(eid)) {
                        loadRequests();
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);

            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Önce benim oluşturduğum (creator_id) etkinliklerin ID'lerini bul
            const { data: myEvents, error: eventsError } = await supabase
                .from('events')
                .select('id, title, status')
                .eq('creator_id', user.id)
                .neq('status', 'cancelled')
                .gte('event_date', new Date().toISOString()); // Sadece gelecekteki etkinlikler

            if (eventsError || !myEvents || myEvents.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            const eventIds = myEvents.map((e) => e.id);
            myEventIdsRef.current = eventIds;
            const eventMap = Object.fromEntries(myEvents.map((e) => [e.id, e]));

            // 2. Bu etkinliklere gelmiş ve durumu "pending" olan istekleri çek
            const { data: pendingParticipants, error: partsError } = await supabase
                .from('event_participants')
                .select('*')
                .in('event_id', eventIds)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (partsError || !pendingParticipants || pendingParticipants.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            // 3. İstek atan kişilerin profillerini çek
            const userIds = [...new Set(pendingParticipants.map((p) => p.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', userIds);

            const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

            // 4. Verileri Birleştir
            const enrichedRequests = pendingParticipants.map((req) => ({
                ...req,
                _event: eventMap[req.event_id],
                _profile: profileMap[req.user_id],
            }));

            setRequests(enrichedRequests);
        } catch (error) {
            if (__DEV__) console.error(error);
            handleError('İstekleri yükle', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = useCallback(async (reqId, eventId, userId) => {
        setActioningId(reqId);
        try {
            const { error } = await runWithBackgroundRetry(() =>
                supabase.from('event_participants').update({ status: 'approved' }).eq('event_id', eventId).eq('user_id', userId)
            );
            if (error) throw error;
            track(EVENTS.EVENT_REQUEST_APPROVED, { event_id: eventId });
            setRequests((prev) => prev.filter((req) => req.id !== reqId));
        } catch (error) {
            handleError('Katılım onaylama', error, { onRetry: () => handleApprove(reqId, eventId, userId) });
        } finally {
            setActioningId(null);
        }
    }, []);

    const handleReject = useCallback(async (reqId, eventId, userId) => {
        setActioningId(reqId);
        try {
            const { error } = await runWithBackgroundRetry(() =>
                supabase.from('event_participants').update({ status: 'rejected' }).eq('event_id', eventId).eq('user_id', userId)
            );
            if (error) throw error;
            track(EVENTS.EVENT_REQUEST_REJECTED, { event_id: eventId });
            setRequests((prev) => prev.filter((req) => req.id !== reqId));
        } catch (error) {
            handleError('Katılım reddetme', error, { onRetry: () => handleReject(reqId, eventId, userId) });
        } finally {
            setActioningId(null);
        }
    }, []);

    // RequestCard memo() ile sarılı — bu handler'lar her render'da yeniden
    // oluşturulursa memo etkisiz kalır.
    const onViewEvent = useCallback((item) => {
        navigation.navigate('EventDetail', { eventId: item.event_id });
    }, [navigation]);

    const onViewProfile = useCallback((item) => {
        if (item._profile) navigation.navigate('ProfileDetail', { profile: item._profile });
    }, [navigation]);

    const onApprove = useCallback((item) => handleApprove(item.id, item.event_id, item.user_id), [handleApprove]);
    const onReject = useCallback((item) => handleReject(item.id, item.event_id, item.user_id), [handleReject]);

    const renderRequest = useCallback(({ item }) => (
        <RequestCard
            item={item}
            isActioning={actioningId === item.id}
            onViewEvent={onViewEvent}
            onViewProfile={onViewProfile}
            onApprove={onApprove}
            onReject={onReject}
        />
    ), [actioningId, onViewEvent, onViewProfile, onApprove, onReject]);

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={LABELS.back}>
                    <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Gelen Katılım İstekleri</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* CONTENT */}
            {loading ? (
                <View style={styles.center}>
                    <LoadingState />
                </View>
            ) : requests.length === 0 ? (
                <View style={styles.center}>
                    <EmptyState icon="checkmark-circle-outline" title="Yeni İstek Yok" description="Bekleyen etkinlik katılım isteğiniz bulunmuyor." />
                </View>
            ) : (
                <FlashList
                    data={requests}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRequest}
                    estimatedItemSize={220}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.white,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },

    listContent: { padding: 16 },

    requestCard: {
        backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginBottom: 16,
        shadowColor: COLORS.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    },
    eventHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 12 },
    eventTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.primary, marginHorizontal: 8 },

    userContainer: { flexDirection: 'row', marginBottom: 16 },
    userInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
    userName: { fontSize: 16, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 },

    msgBubble: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 12, borderBottomLeftRadius: 0, alignSelf: 'flex-start' },
    msgText: { fontSize: 13, color: COLORS.textBody, fontStyle: 'italic' },
    noMsgText: { fontSize: 13, color: COLORS.textMuted },

    actions: { flexDirection: 'row', gap: 12 },
    approveBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
    approveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
    rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.error },
    rejectBtnText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },

});
