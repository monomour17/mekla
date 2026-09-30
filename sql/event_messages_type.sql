---
## Migration: event_messages type kolonu

Sistem mesajları (katılım onayı, etkinlik güncellemesi vb.) için `type` kolonu eklenir.
Varsayılan değer 'text' olduğundan mevcut mesajlar etkilenmez.

```sql
-- type kolonu: 'text' (normal mesaj) veya 'system' (sistem mesajı)
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text';
```
