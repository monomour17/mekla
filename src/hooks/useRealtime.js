import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

export function useRealtime({ table, filter, event = 'INSERT', onData }) {
  const channelRef = useRef(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    const channelName = `${table}:${filter || 'all'}:${Date.now()}`;
    const config = {
      event,
      schema: 'public',
      table,
    };
    if (filter) config.filter = filter;

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', config, (payload) => {
        onDataRef.current(payload);
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, event]);

  return channelRef;
}
