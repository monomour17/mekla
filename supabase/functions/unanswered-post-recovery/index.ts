// Supabase Edge Function: unanswered-post-recovery
// Deploy: supabase functions deploy unanswered-post-recovery --no-verify-jwt
//
// Cron tetikleyici: Önerilen — her 3 saatte bir
// Supabase Dashboard → Edge Functions → unanswered-post-recovery → Schedules → "0 */3 * * *"
//
// Mantık:
//   1. community_id'si dolu, 24 saatten eski, hiç yorum almamış ve daha önce
//      bildirim atılmamış gönderileri bul
//   2. Her gönderi için o alanın üyelerine (yazar hariç) "notifications" tablosuna
//      tek satır ekle — push'u kendimiz göndermiyoruz, mevcut send-notification
//      Database Webhook'u bu INSERT'i yakalayıp kullanıcının community_post
//      tercihine göre otomatik push atıyor (bkz. supabase/functions/send-notification)
//   3. İşlenen gönderileri unanswered_notified_at ile işaretle (aynı gönderi
//      için ikinci kez bildirim atılmasını engeller)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UNANSWERED_HOURS = 24;
const CANDIDATE_LIMIT = 200;
const INSERT_BATCH_SIZE = 200;

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const cutoff = new Date(Date.now() - UNANSWERED_HOURS * 60 * 60 * 1000);

  // 1. Aday gönderiler: alana ait, eşikten eski, henüz işaretlenmemiş
  const { data: candidates, error: candErr } = await supabase
    .from('posts')
    .select('id, author_id, community_id, content, created_at')
    .not('community_id', 'is', null)
    .lt('created_at', cutoff.toISOString())
    .is('unanswered_notified_at', null)
    .order('created_at', { ascending: true })
    .limit(CANDIDATE_LIMIT);

  if (candErr) {
    console.error('[unanswered-recovery] Aday gönderi çekme hatası:', candErr.message);
    return json({ error: candErr.message }, 500);
  }

  if (!candidates || candidates.length === 0) {
    return json({ skipped: true, reason: 'Aday gönderi yok' });
  }

  // 2. Hangi adayların en az bir yorumu var — onları eleyeceğiz
  const candidateIds = candidates.map((p) => p.id);
  const { data: commentRows, error: commentErr } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', candidateIds);

  if (commentErr) {
    console.error('[unanswered-recovery] Yorum kontrolü hatası:', commentErr.message);
    return json({ error: commentErr.message }, 500);
  }

  const answeredIds = new Set((commentRows ?? []).map((c) => c.post_id));
  const unanswered = candidates.filter((p) => !answeredIds.has(p.id));

  if (unanswered.length === 0) {
    return json({ skipped: true, reason: 'Tüm adaylar zaten cevaplanmış' });
  }

  // 3. İlgili alanların adlarını ve üyelerini çek
  const communityIds = [...new Set(unanswered.map((p) => p.community_id as string))];

  const { data: communities } = await supabase
    .from('communities')
    .select('id, name')
    .in('id', communityIds);
  const communityNameMap = Object.fromEntries((communities ?? []).map((c) => [c.id, c.name]));

  const { data: members, error: memErr } = await supabase
    .from('user_communities')
    .select('user_id, community_id')
    .in('community_id', communityIds);

  if (memErr) {
    console.error('[unanswered-recovery] Üye çekme hatası:', memErr.message);
    return json({ error: memErr.message }, 500);
  }

  const membersByCommunity: Record<string, string[]> = {};
  for (const m of members ?? []) {
    const list = membersByCommunity[m.community_id] ?? (membersByCommunity[m.community_id] = []);
    list.push(m.user_id);
  }

  // 4. Bildirim satırlarını oluştur (yazar hariç)
  const notificationRows: Array<{ user_id: string; type: string; title: string; body: string; data: unknown }> = [];
  for (const post of unanswered) {
    const communityName = communityNameMap[post.community_id as string] ?? 'Alanın';
    const recipients = (membersByCommunity[post.community_id as string] ?? []).filter((id) => id !== post.author_id);
    const snippet = (post.content ?? '').slice(0, 80);

    for (const userId of recipients) {
      notificationRows.push({
        user_id: userId,
        type: 'community_post',
        title: `${communityName} alanında cevapsız bir soru var`,
        body: snippet,
        data: { postId: post.id, communityId: post.community_id, screen: 'PostDetail' },
      });
    }
  }

  let inserted = 0;
  for (let i = 0; i < notificationRows.length; i += INSERT_BATCH_SIZE) {
    const batch = notificationRows.slice(i, i + INSERT_BATCH_SIZE);
    const { error: insErr } = await supabase.from('notifications').insert(batch);
    if (insErr) {
      console.error('[unanswered-recovery] Bildirim insert hatası:', insErr.message);
      continue;
    }
    inserted += batch.length;
  }

  // 5. İşlenen gönderileri işaretle — ikinci kez bildirim atılmasın
  const { error: markErr } = await supabase
    .from('posts')
    .update({ unanswered_notified_at: new Date().toISOString() })
    .in('id', unanswered.map((p) => p.id));

  if (markErr) {
    console.error('[unanswered-recovery] İşaretleme hatası:', markErr.message);
  }

  return json({ success: true, postsProcessed: unanswered.length, notificationsInserted: inserted });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
