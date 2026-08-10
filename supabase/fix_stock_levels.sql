-- Fix Stock Levels for Dairy Products
-- This sets realistic stock levels and minimum stock thresholds

-- First, let's see what products we have
SELECT id, name, category, current_stock, min_stock, status 
FROM products 
ORDER BY name;

-- Set stock levels based on product type
-- Update current_stock and min_stock for active products
UPDATE products 
SET 
  current_stock = CASE 
    WHEN name ILIKE '%milk%' AND name ILIKE '%toned%' THEN 80
    WHEN name ILIKE '%milk%' AND name ILIKE '%full cream%' THEN 60
    WHEN name ILIKE '%milk%' AND name ILIKE '%double toned%' THEN 50
    WHEN name ILIKE '%milk%' THEN 100
    WHEN name ILIKE '%curd%' OR name ILIKE '%dahi%' THEN 40
    WHEN name ILIKE '%paneer%' THEN 25
    WHEN name ILIKE '%ghee%' THEN 30
    WHEN name ILIKE '%lassi%' THEN 35
    WHEN name ILIKE '%buttermilk%' OR name ILIKE '%chaas%' THEN 45
    WHEN name ILIKE '%sweet%' THEN 20
    WHEN name ILIKE '%flavored%' OR name ILIKE '%flavour%' THEN 30
    ELSE 50
  END,
  min_stock = CASE 
    WHEN name ILIKE '%milk%' THEN 20
    WHEN name ILIKE '%curd%' OR name ILIKE '%dahi%' THEN 10
    WHEN name ILIKE '%paneer%' THEN 8
    WHEN name ILIKE '%ghee%' THEN 10
    WHEN name ILIKE '%lassi%' THEN 12
    WHEN name ILIKE '%buttermilk%' OR name ILIKE '%chaas%' THEN 15
    ELSE 15
  END
WHERE status = 'active' 
  AND (current_stock IS NULL OR current_stock = 0 OR current_stock < min_stock);

-- For products that are NULL or 0, set a default
UPDATE products 
SET current_stock = 25, min_stock = 10
WHERE status = 'active' 
  AND (current_stock IS NULL OR current_stock = 0);

-- Verify the changes
SELECT 
  name, 
  category,
  current_stock,
  min_stock,
  CASE 
    WHEN current_stock <= min_stock THEN '⚠️ LOW'
    WHEN current_stock = 0 THEN '❌ OUT'
    ELSE '✅ OK'
  END as status_check
FROM products 
WHERE status = 'active'
ORDER BY 
  CASE 
    WHEN current_stock <= min_stock THEN 1
    WHEN current_stock = 0 THEN 2
    ELSE 3
  END,
  name;
