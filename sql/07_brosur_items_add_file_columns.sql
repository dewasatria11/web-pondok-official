-- Tambahan kolom untuk simpan metadata file PDF brosur (upload storage)
alter table if exists public.brosur_items
  add column if not exists file_path text,
  add column if not exists file_mime text,
  add column if not exists file_size bigint;

-- Optional: set default icon jika null
update public.brosur_items
set icon_class = coalesce(icon_class, 'bi bi-file-earmark-arrow-down')
where icon_class is null;
