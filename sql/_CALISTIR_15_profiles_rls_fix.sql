-- _CALISTIR_15_profiles_rls_fix.sql
-- profiles tablosu için eksik INSERT ve UPDATE policy'leri ekler.
-- Bu olmadan onboarding'de profil oluşturulamıyor.

-- INSERT: kullanıcı sadece kendi profilini oluşturabilir
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- UPDATE: kullanıcı sadece kendi profilini güncelleyebilir
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
