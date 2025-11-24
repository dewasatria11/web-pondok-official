-- Add file_kk column to pendaftar table
ALTER TABLE pendaftar ADD COLUMN IF NOT EXISTS file_kk TEXT;
