-- ============================================
-- view_events_with_stats
-- Etkinlikleri organizatör + katılımcı istatistikleriyle birleştirir
-- ============================================
DROP VIEW IF EXISTS view_events_with_stats CASCADE;

CREATE VIEW view_events_with_stats WITH (security_invoker = true) AS
SELECT
  e.*,

  -- Organizatör bilgileri
  p.display_name AS creator_display_name,
  p.photos       AS creator_photos,

  -- Onaylı katılımcı sayısı (+1 organizatör dahil)
  COALESCE(stats.approved_count, 0) + 1 AS participant_count,

  -- Bekleyen istek sayısı
  COALESCE(stats.pending_count, 0) AS pending_count,

  -- İlk 3 onaylı katılımcının avatar bilgileri (JSON array)
  COALESCE(avatars.avatar_list, '[]'::jsonb) AS participant_avatars

FROM events e

-- Organizatör profili
LEFT JOIN profiles p ON p.id = e.creator_id

-- Katılımcı istatistikleri
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE ep.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE ep.status = 'pending')  AS pending_count
  FROM event_participants ep
  WHERE ep.event_id = e.id
) stats ON true

-- İlk 3 onaylı katılımcının avatarları
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', av_p.id,
      'photo', av_p.photos[1],
      'display_name', av_p.display_name
    )
  ) AS avatar_list
  FROM (
    SELECT ep2.user_id
    FROM event_participants ep2
    WHERE ep2.event_id = e.id AND ep2.status = 'approved'
    LIMIT 3
  ) top3
  JOIN profiles av_p ON av_p.id = top3.user_id
) avatars ON true;
