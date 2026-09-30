-- İşletme profili için adres/ilçe alanı ekler
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_address TEXT;
