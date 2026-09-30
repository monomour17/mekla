/**
 * Supabase veritabanı tipleri.
 * Proje büyüdükçe `supabase gen types typescript` komutuyla otomatik üretilebilir.
 * Şimdilik en kritik tablolar elle tanımlanmıştır.
 */

export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  city: string;
  photos: string[];
  account_type: 'couple' | 'individual';
  looking_for: 'family' | 'couple' | 'both';
  has_children: boolean;
  child_count: number | null;
  children_ages: string | null;
  push_token: string | null;
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  post_type: 'moment' | 'notice';
  content: string;
  related_event_id: string | null;
  community_id: string | null;
  location_text: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface EnrichedPost extends Post {
  author: Pick<Profile, 'id' | 'display_name' | 'photos' | 'city' | 'is_active'> | null;
  eventName: string | null;
  media: PostMedia[];
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
}

export interface PostMedia {
  id: string;
  post_id: string;
  media_url: string;
  media_order: number;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface Event {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  event_date: string;
  city: string;
  location_detail: string | null;
  latitude: number | null;
  longitude: number | null;
  max_participants: number;
  status: 'open' | 'closed' | 'cancelled';
  payment_type: 'free' | 'dutch' | 'organizer';
  cover_photo_url: string | null;
  category: string;
  allowed_account_types: string[] | null;
  allowed_looking_for: string[] | null;
  requires_children: boolean;
  created_at: string;
}

export type ParticipantStatus =
  | 'pending'
  | 'approved'
  | 'waiting'
  | 'rejected'
  | 'removed'
  | 'banned_global'
  | 'attended'
  | 'no_show';

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: ParticipantStatus;
  join_message: string | null;
  created_at: string;
}

export interface EventReview {
  id: string;
  event_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface EventPhoto {
  id: string;
  event_id: string;
  user_id: string;
  url: string;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface EventMessage {
  id: string;
  event_id: string;
  sender_id: string;
  content: string;
  type?: 'system' | 'user';
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
}

export interface SavedPost {
  user_id: string;
  post_id: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  event_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
}
