-- =====================================================
-- HERO CAROUSEL IMAGES TABLE (GAMBAR SANTRI)
-- Tabel TERPISAH untuk gambar santri PNG transparan
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Create hero_carousel_images table (separate from hero_images)
CREATE TABLE IF NOT EXISTS hero_carousel_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_order INTEGER NOT NULL DEFAULT 1 CHECK (slide_order >= 1 AND slide_order <= 3),
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255) DEFAULT 'Santri Al Ikhsan Beji',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add index for ordering
CREATE INDEX IF NOT EXISTS idx_hero_carousel_order ON hero_carousel_images(slide_order ASC);

-- 3. Enable Row Level Security
ALTER TABLE hero_carousel_images ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow public read access
CREATE POLICY "Public read hero carousel images"
  ON hero_carousel_images FOR SELECT
  USING (true);

-- 5. Policy: Allow anon users to manage
CREATE POLICY "Anon can insert hero carousel"
  ON hero_carousel_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can update hero carousel"
  ON hero_carousel_images FOR UPDATE
  USING (true);

CREATE POLICY "Anon can delete hero carousel"
  ON hero_carousel_images FOR DELETE
  USING (true);

-- =====================================================
-- STORAGE BUCKET for carousel images
-- =====================================================

-- 6. Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-carousel', 'hero-carousel', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies
CREATE POLICY "Public read hero carousel storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-carousel');

CREATE POLICY "Anon can upload hero carousel"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hero-carousel');

CREATE POLICY "Anon can update hero carousel storage"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'hero-carousel');

CREATE POLICY "Anon can delete hero carousel"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'hero-carousel');
