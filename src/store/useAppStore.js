/**
 * useAppStore — Global UI & auth state (Zustand)
 *
 * KURAL: Zustand sadece UI state ve oturum flag'leri içindir.
 *
 * ✅ Zustand'a GİREN şeyler:
 *   - Auth & profil flags (hasProfile, isFrozen)
 *   - Onboarding geçici verisi
 *   - UI türevleri: feedStale, pendingNewPost, commentCountUpdates
 *   - Hafif self-cache: myCity (profil sorgusunu tekrar yapmamak için)
 *   - Erişilebilirlik: colorBlindMode
 *
 * ❌ Zustand'a GİRMEMESİ gereken şeyler (server state = React Query):
 *   - Etkinlik listeleri         → useDiscoverEventsQuery(), useMyEventsQuery()
 *   - Feed gönderileri           → useFeedQuery()
 *   - Topluluk listeleri         → useCommunitiesQuery()
 *   - Kaydedilen gönderiler      → useSavedPostIdsQuery()
 *   - Etkinlik sohbet listesi    → ChatsScreen kendi state'i
 */
import { create } from 'zustand';

const useAppStore = create((set) => ({
  // ── Auth & Profil Flags ──────────────────────────────────
  hasProfile: false,
  isFrozen: false,

  // ── Onboarding Geçici Verisi ─────────────────────────────
  onboarding: {},

  // ── UI State ─────────────────────────────────────────────
  feedStale: false,
  pendingNewPost: null,       // Yeni oluşturulan post → feed'e öne ekle
  commentCountUpdates: {},    // { [postId]: newCount } — realtime güncelleme

  // ── Hafif Cache (logout'ta temizlenir) ───────────────────
  myCity: '',                 // Profile'dan çekilen şehir (N+1 sorguyu önler)
  joinedCommunities: [],      // MeydanScreen — katıldığım topluluklar

  // ── Profil Versiyon Sayacı ───────────────────────────────
  // Profil kaydedildiğinde artırılır; diğer screen'ler bunu dinler
  profileVersion: 0,

  // ── Sohbet Rozeti ────────────────────────────────────────
  unreadChatCount: 0,       // Tab bar rozeti — ChatsScreen hesaplar

  // ── Erişilebilirlik ──────────────────────────────────────
  colorBlindMode: false,

  // ── Setters ──────────────────────────────────────────────
  setHasProfile: (val) => set({ hasProfile: val }),
  setIsFrozen: (val) => set({ isFrozen: val }),
  updateOnboarding: (data) =>
    set((state) => ({ onboarding: { ...state.onboarding, ...data } })),
  setFeedStale: (val) => set({ feedStale: val }),

  setMyCity: (val) => set({ myCity: val }),
  setJoinedCommunities: (val) => set({ joinedCommunities: val }),
  setPendingNewPost: (val) => set({ pendingNewPost: val }),
  setCommentCountUpdate: (postId, count) =>
    set((s) => ({ commentCountUpdates: { ...s.commentCountUpdates, [postId]: count } })),
  clearCommentCountUpdate: (postId) =>
    set((s) => {
      const u = { ...s.commentCountUpdates };
      delete u[postId];
      return { commentCountUpdates: u };
    }),

  // Logout'ta cache'i temizle
  clearDataCache: () =>
    set({
      myCity: '',
      joinedCommunities: [],
      pendingNewPost: null,
      commentCountUpdates: {},
      unreadChatCount: 0,
    }),

  setUnreadChatCount: (val) => set({ unreadChatCount: val }),

  bumpProfileVersion: () => set((s) => ({ profileVersion: s.profileVersion + 1 })),
  setColorBlindMode: (val) => set({ colorBlindMode: val }),
}));

export default useAppStore;
