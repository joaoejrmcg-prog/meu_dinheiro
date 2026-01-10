-- =====================================================
-- Add Income Categories
-- Execute in Supabase SQL Editor
-- =====================================================

-- Add missing income categories
INSERT INTO categories (name, icon, is_default) VALUES
  ('Freelance', '💼', true),
  ('Presente', '🎁', true),
  ('Vendas', '🏷️', true),
  ('Renda Extra', '💵', true),
  ('Reembolso', '↩️', true)
ON CONFLICT DO NOTHING;

-- Verify
SELECT name, icon FROM categories WHERE is_default = true ORDER BY name;
