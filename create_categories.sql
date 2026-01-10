-- =====================================================
-- Create Categories Table with Default Categories
-- Execute in Supabase SQL Editor
-- =====================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own and default categories" ON categories;
CREATE POLICY "Users can view own and default categories" ON categories 
FOR SELECT USING (user_id = auth.uid() OR is_default = true);

DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
CREATE POLICY "Users can manage own categories" ON categories 
FOR ALL USING (user_id = auth.uid());

-- Default categories (system-wide)
INSERT INTO categories (name, icon, is_default) VALUES
  ('Alimentação', '🍔', true),
  ('Transporte', '🚗', true),
  ('Moradia', '🏠', true),
  ('Saúde', '💊', true),
  ('Lazer', '🎬', true),
  ('Educação', '📚', true),
  ('Compras', '🛒', true),
  ('Serviços', '🔧', true),
  ('Salário', '💰', true),
  ('Investimentos', '📈', true),
  ('Outros', '📦', true)
ON CONFLICT DO NOTHING;

SELECT 'Categories criadas:', COUNT(*) FROM categories WHERE is_default = true;
