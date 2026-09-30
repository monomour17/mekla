import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 dk — veri "taze" sayılır
      gcTime: 1000 * 60 * 10,         // 10 dk — cache'te tutulur
      retry: 2,
      refetchOnWindowFocus: false,      // RN'de window focus yok
    },
  },
});
