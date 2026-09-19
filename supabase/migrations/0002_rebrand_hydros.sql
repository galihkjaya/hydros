-- Hydros rebrand: new storage bucket.
--
-- The old investigation-images bucket stays readable so existing rows don't
-- 404; new uploads go to hydros-images. Apply with the Supabase CLI
-- (`supabase db push`) or by pasting into the SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hydros-images',
  'hydros-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
