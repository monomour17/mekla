# Mekla

A location-based social networking and event app that helps parents connect and organize events. I designed and built it on my own with React Native and Supabase. It was never released.

## What it does

- **Events:** create events, find them on a map and join them. Participant management with approvals, event Q&A, and ratings and a photo gallery after the event.
- **Chat:** real-time group chats for each event, with photos and media, plus direct conversations.
- **Communities:** communities with a feed of posts, polls, likes and saved posts.
- **Businesses:** business profiles with addresses on the map, and notifications about business events.
- **Notifications:** push notifications and a weekly event reminder.
- **Safety and privacy:** row-level security policies, block and report, location privacy controls, and rate limiting on SMS.
- **Share links:** a Cloudflare Pages site renders share pages for events and businesses and handles iOS universal links and Android app links.

## Stack

| Layer | Tools |
|---|---|
| App | React Native 0.81, Expo SDK 54, React 19, React Navigation, TanStack Query, Zustand, FlashList, Reanimated, react-native-maps |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions (TypeScript); SQL migrations with row-level security policies and RPCs |
| Web | Cloudflare Pages Functions for share pages and deep links |
| Monitoring | Sentry, PostHog |
| Builds | EAS Build, EAS Update |

## Layout

- `src/`: the app (screens, components, hooks, services, store)
- `sql/`, `supabase/`: database schema, policies, RPCs and edge functions
- `claudflare/`: website and share-link functions
- `scripts/`: seed scripts for test data

## License

Copyright (c) 2026 Ali Rıza Kurt. All rights reserved. This repository is published for viewing only. No permission is granted to use, copy, modify or distribute any part of it. See [LICENSE](LICENSE).
