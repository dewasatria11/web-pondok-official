-- =====================================================
-- HERO IMAGES TABLE FOR SUPABASE
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Create hero_images table
CREATE TABLE IF NOT EXISTS hero_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_order INTEGER NOT NULL DEFAULT 1,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255) DEFAULT 'Santri Al Ikhsan Beji',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add index for ordering
CREATE INDEX IF NOT EXISTS idx_hero_images_order ON hero_images(slide_order ASC);

-- 3. Enable Row Level Security
ALTER TABLE hero_images ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow public read access (for active images only)
CREATE POLICY "Public read active hero images"
  ON hero_images FOR SELECT
  USING (is_active = true);

-- 5. Policy: Allow anon users to manage (for admin without auth)
-- Note: In production, change this to authenticated users only
CREATE POLICY "Anon users can insert hero images"
  ON hero_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon users can update hero images"
  ON hero_images FOR UPDATE
  USING (true);

CREATE POLICY "Anon users can delete hero images"
  ON hero_images FOR DELETE
  USING (true);

-- =====================================================
-- STORAGE BUCKET SETUP
-- Run this if bucket doesn't exist
-- =====================================================

-- 6. Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policy: Public read access
CREATE POLICY "Public read hero images storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images');

-- 8. Storage policy: Anon can upload
CREATE POLICY "Anon can upload hero images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hero-images');

-- 9. Storage policy: Anon can update
CREATE POLICY "Anon can update hero images storage"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'hero-images');

-- 10. Storage policy: Anon can delete
CREATE POLICY "Anon can delete hero images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'hero-images');

-- =====================================================
-- OPTIONAL: Insert sample data
-- =====================================================
-- INSERT INTO hero_images (slide_order, image_url, alt_text)
-- VALUES 
--   (1, 'https://your-supabase-url/storage/v1/object/public/hero-images/hero-1.png', 'Santri Al Ikhsan Beji - Slide 1'),
--   (2, 'https://your-supabase-url/storage/v1/object/public/hero-images/hero-2.png', 'Santri Al Ikhsan Beji - Slide 2'),
--   (3, 'https://your-supabase-url/storage/v1/object/public/hero-images/hero-3.png', 'Santri Al Ikhsan Beji - Slide 3');
