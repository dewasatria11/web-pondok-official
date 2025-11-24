-- Add gelombang column to pendaftar table
ALTER TABLE pendaftar 
ADD COLUMN IF NOT EXISTS gelombang TEXT;

-- Optional: Add comment
COMMENT ON COLUMN pendaftar.gelombang IS 'Nama gelombang pendaftaran saat mendaftar (snapshot)';
