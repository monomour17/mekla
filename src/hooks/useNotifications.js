import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Kullanıcının bildirim listesini ve okunmamış sayısını yönetir.
 * Realtime: yeni bildirim insert edildiğinde otomatik güncellenir.
 */
export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const instanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).current;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    const list = data ?? [];
    setNotifications(list);
    setUnreadCount(list.filter((n) => !n.read_at).length);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notifications-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          if (!payload.new.read_at) setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, load, instanceId]);

  const markAsRead = async (id) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!userId || unreadCount === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
  };

  const remove = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  return { notifications, unreadCount, loading, refresh: load, markAsRead, markAllAsRead, remove };
}

/**
 * Sadece okunmamış sayısını dinleyen hafif hook — Profil tab badge için.
 */
export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [count, setCount] = useState(0);
  // Her instance için benzersiz ID — aynı sayfada birden fazla HeaderBell olsa bile çakışmaz
  const instanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).current;

  const load = useCallback(async () => {
    if (!userId) return;
    const { count: c } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    setCount(c ?? 0);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notif-count-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, load, instanceId]);

  return count;
}
