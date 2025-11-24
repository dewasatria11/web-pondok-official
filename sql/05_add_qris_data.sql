-- Add qris_data column to payment_settings table
ALTER TABLE payment_settings 
ADD COLUMN IF NOT EXISTS qris_data TEXT;

-- Comment on column
COMMENT ON COLUMN payment_settings.qris_data IS 'Raw QRIS payload string for dynamic generation';
