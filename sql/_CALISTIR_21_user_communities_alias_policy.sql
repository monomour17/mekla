-- ============================================
-- Meydan/Mekla: Eksik UPDATE politikası düzeltmesi
-- user_communities'te SELECT/INSERT/DELETE vardı ama UPDATE yoktu —
-- takma ad kaydetme (alias_display_name) bu yüzden sessizce başarısız oluyordu.
-- ============================================

CREATE POLICY "Users can update own community membership"
  ON user_communities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
