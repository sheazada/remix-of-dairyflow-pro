-- 020_sudha_rate_list_products.sql
-- SUDHA (Vikramshila) rate list eff. 25.05.2026: distributor/retailer/MRP per pack.
-- Prices given per kg in the rate list are converted to per-pack values.
INSERT INTO public.products (name, brand, category, unit, hsn, mrp, selling_price, purchase_price, gst_rate, current_stock, min_stock, status)
SELECT 'Sudha Balusahi 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 45.0, 41.0, 38.9, 5.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 100 gm')
UNION ALL
SELECT 'Sudha Balusahi 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 105.0, 96.5, 91.9, 5.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 250 gm')
UNION ALL
SELECT 'Sudha Balusahi 500 gm cup', 'Sudha', 'sweets', '500 gm cup', '1901', 190.0, 175.0, 166.67, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 500 gm cup')
UNION ALL
SELECT 'Sudha Balusahi 500 gm tin', 'Sudha', 'sweets', '500 gm tin', '1901', 130.0, 117.0, 111.43, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 500 gm tin')
UNION ALL
SELECT 'Sudha Balusahi 1 kg tin', 'Sudha', 'sweets', '1 kg tin', '1901', 250.0, 225.0, 214.29, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 1 kg tin')
UNION ALL
SELECT 'Sudha Balusahi 5 kg jar', 'Sudha', 'sweets', '5 kg jar', '1901', 1500.0, 1435.0, 1366.65, 5.0, 12, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 5 kg jar')
UNION ALL
SELECT 'Sudha Balusahi 10 kg jar', 'Sudha', 'sweets', '10 kg jar', '1901', 2800.0, 2690.0, 2561.9, 5.0, 6, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Balusahi 10 kg jar')
UNION ALL
SELECT 'Sudha Rasogulla 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 42.0, 38.0, 35.9, 5.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 100 gm')
UNION ALL
SELECT 'Sudha Rasogulla 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 100.0, 92.0, 88.17, 5.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 250 gm')
UNION ALL
SELECT 'Sudha Rasogulla 500 gm cup', 'Sudha', 'sweets', '500 gm cup', '1901', 185.0, 171.0, 164.18, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 500 gm cup')
UNION ALL
SELECT 'Sudha Rasogulla 500 gm tin', 'Sudha', 'sweets', '500 gm tin', '1901', 125.0, 113.0, 108.22, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 500 gm tin')
UNION ALL
SELECT 'Sudha Rasogulla 1 kg tin', 'Sudha', 'sweets', '1 kg tin', '1901', 240.0, 217.0, 207.82, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 1 kg tin')
UNION ALL
SELECT 'Sudha Rasogulla 5 kg jar', 'Sudha', 'sweets', '5 kg jar', '1901', 1300.0, 1250.0, 1223.75, 5.0, 12, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 5 kg jar')
UNION ALL
SELECT 'Sudha Rasogulla 10 kg jar', 'Sudha', 'sweets', '10 kg jar', '1901', 2500.0, 2410.0, 2362.8, 5.0, 6, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Rasogulla 10 kg jar')
UNION ALL
SELECT 'Sudha Gulabjamun 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 45.0, 41.0, 28.9, 5.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 100 gm')
UNION ALL
SELECT 'Sudha Gulabjamun 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 105.0, 96.5, 92.3, 5.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 250 gm')
UNION ALL
SELECT 'Sudha Gulabjamun 500 gm cup', 'Sudha', 'sweets', '500 gm cup', '1901', 190.0, 175.0, 168.44, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 500 gm cup')
UNION ALL
SELECT 'Sudha Gulabjamun 500 gm tin', 'Sudha', 'sweets', '500 gm tin', '1901', 130.0, 117.0, 112.01, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 500 gm tin')
UNION ALL
SELECT 'Sudha Gulabjamun 1 kg tin', 'Sudha', 'sweets', '1 kg tin', '1901', 250.0, 225.0, 215.55, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 1 kg tin')
UNION ALL
SELECT 'Sudha Gulabjamun 5 kg jar', 'Sudha', 'sweets', '5 kg jar', '1901', 1500.0, 1435.0, 1398.25, 5.0, 12, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 5 kg jar')
UNION ALL
SELECT 'Sudha Gulabjamun 10 kg jar', 'Sudha', 'sweets', '10 kg jar', '1901', 2800.0, 2690.0, 2627.0, 5.0, 6, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gulabjamun 10 kg jar')
UNION ALL
SELECT 'Sudha Lassi 140 ml', 'Sudha', 'milk', '140 ml', '0401', 12.0, 11.1, 10.63, 0.0, 200, 40, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Lassi 140 ml')
UNION ALL
SELECT 'Sudha Lassi 200 ml Tetra', 'Sudha', 'milk', '200 ml Tetra', '0401', 20.0, 18.1, 17.37, 0.0, 150, 30, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Lassi 200 ml Tetra')
UNION ALL
SELECT 'Sudha Chach (Spiced Butter Milk) 200 ml Tetra', 'Sudha', 'milk', '200 ml Tetra', '0401', 15.0, 14.0, 13.58, 0.0, 150, 30, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Chach (Spiced Butter Milk) 200 ml Tetra')
UNION ALL
SELECT 'Sudha Ghee 200 ml Pet Jar', 'Sudha', 'ghee_butter', '200 ml Pet Jar', '0405', 135.0, 124.2, 120.63, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 200 ml Pet Jar')
UNION ALL
SELECT 'Sudha Ghee 200 ml Pouch', 'Sudha', 'ghee_butter', '200 ml Pouch', '0405', 145.0, 134.0, 128.75, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 200 ml Pouch')
UNION ALL
SELECT 'Sudha Ghee 500 ml Pouch', 'Sudha', 'ghee_butter', '500 ml Pouch', '0405', 325.0, 301.0, 292.6, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 500 ml Pouch')
UNION ALL
SELECT 'Sudha Ghee 1 kg Tin', 'Sudha', 'ghee_butter', '1 kg Tin', '0405', 650.0, 605.0, 588.2, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 1 kg Tin')
UNION ALL
SELECT 'Sudha Ghee 500 ml Pet Jar', 'Sudha', 'ghee_butter', '500 ml Pet Jar', '0405', 330.0, 306.0, 297.34, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 500 ml Pet Jar')
UNION ALL
SELECT 'Sudha Ghee 15 kg Tin', 'Sudha', 'ghee_butter', '15 kg Tin', '0405', 9570.0, 9075.0, 8823.0, 5.0, 4, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Ghee 15 kg Tin')
UNION ALL
SELECT 'Sudha Spl. Cow Ghee 1 kg PET Jar', 'Sudha', 'ghee_butter', '1 kg PET Jar', '0405', 650.0, 605.0, 588.2, 5.0, 30, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Spl. Cow Ghee 1 kg PET Jar')
UNION ALL
SELECT 'Sudha Peda 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 55.0, 50.0, 47.9, 5.0, 90, 18, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Peda 100 gm')
UNION ALL
SELECT 'Sudha Peda 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 125.0, 115.0, 111.06, 5.0, 70, 14, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Peda 250 gm')
UNION ALL
SELECT 'Sudha Khoa Plain 5 kg', 'Sudha', 'sweets', '5 kg', '1901', 2125.0, 2015.0, 1952.0, 5.0, 10, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Khoa Plain 5 kg')
UNION ALL
SELECT 'Sudha Kalakand 500 gm', 'Sudha', 'sweets', '500 gm', '1901', 240.0, 224.0, 218.22, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Kalakand 500 gm')
UNION ALL
SELECT 'Sudha Kalakand 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 55.0, 50.0, 47.9, 5.0, 90, 18, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Kalakand 100 gm')
UNION ALL
SELECT 'Sudha Milk Cake 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 125.0, 115.0, 111.06, 5.0, 70, 14, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Milk Cake 250 gm')
UNION ALL
SELECT 'Sudha Milk Cake 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 55.0, 50.0, 47.9, 5.0, 90, 18, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Milk Cake 100 gm')
UNION ALL
SELECT 'Sudha Paneer (Vacuum) 200 gm', 'Sudha', 'paneer', '200 gm', '0406', 95.0, 85.0, 82.5, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Paneer (Vacuum) 200 gm')
UNION ALL
SELECT 'Sudha Paneer (Vacuum) 500 gm', 'Sudha', 'paneer', '500 gm', '0406', 220.0, 201.0, 195.5, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Paneer (Vacuum) 500 gm')
UNION ALL
SELECT 'Sudha Paneer (Thermopack) 200 gm', 'Sudha', 'paneer', '200 gm', '0406', 95.0, 85.0, 82.5, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Paneer (Thermopack) 200 gm')
UNION ALL
SELECT 'Sudha Paneer (Thermopack) 500 gm', 'Sudha', 'paneer', '500 gm', '0406', 220.0, 201.0, 195.5, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Paneer (Thermopack) 500 gm')
UNION ALL
SELECT 'Sudha Surbhi 80 gm', 'Sudha', 'sweets', '80 gm', '1901', 22.0, 20.25, 19.28, 5.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Surbhi 80 gm')
UNION ALL
SELECT 'Sudha Soan Papdi 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 110.0, 100.0, 95.43, 5.0, 70, 14, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Soan Papdi 250 gm')
UNION ALL
SELECT 'Sudha Soan Papdi 400 gm', 'Sudha', 'sweets', '400 gm', '1901', 160.0, 145.0, 138.71, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Soan Papdi 400 gm')
UNION ALL
SELECT 'Sudha Table Butter 100 gm', 'Sudha', 'ghee_butter', '100 gm', '0405', 62.0, 57.0, 55.17, 5.0, 90, 18, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Table Butter 100 gm')
UNION ALL
SELECT 'Sudha Table Butter 500 gm', 'Sudha', 'ghee_butter', '500 gm', '0405', 305.0, 286.0, 276.55, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Table Butter 500 gm')
UNION ALL
SELECT 'Sudha Misti Dahi 80 gm', 'Sudha', 'dahi', '80 gm', '0403', 12.0, 11.1, 10.5, 0.0, 250, 50, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Misti Dahi 80 gm')
UNION ALL
SELECT 'Sudha Raskadam 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 120.0, 110.0, 106.85, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Raskadam 250 gm')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 200 gm Cup', 'Sudha', 'dahi', '200 gm Cup', '0403', 30.0, 27.0, 25.42, 0.0, 150, 30, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 200 gm Cup')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 400 gm Cup', 'Sudha', 'dahi', '400 gm Cup', '0403', 55.0, 51.0, 48.9, 0.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 400 gm Cup')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 400 gm (P)', 'Sudha', 'dahi', '400 gm (P)', '0403', 35.0, 32.15, 30.89, 0.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 400 gm (P)')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 1 kg (P)', 'Sudha', 'dahi', '1 kg (P)', '0403', 78.0, 74.2, 72.57, 0.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 1 kg (P)')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 1 kg Jar', 'Sudha', 'dahi', '1 kg Jar', '0403', 120.0, 110.8, 105.97, 0.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 1 kg Jar')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 2 kg Jar', 'Sudha', 'dahi', '2 kg Jar', '0403', 230.0, 214.0, 205.86, 0.0, 30, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 2 kg Jar')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 5 kg Jar', 'Sudha', 'dahi', '5 kg Jar', '0403', 550.0, 515.0, 498.2, 0.0, 12, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 5 kg Jar')
UNION ALL
SELECT 'Sudha Plain Dahi (Premium) 15 kg', 'Sudha', 'dahi', '15 kg', '0403', 1575.0, 1485.0, 1437.75, 0.0, 4, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Premium) 15 kg')
UNION ALL
SELECT 'Sudha Plain Dahi (Smart) 200 gm Pouch', 'Sudha', 'dahi', '200 gm Pouch', '0403', 20.0, 18.35, 17.62, 0.0, 150, 30, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Smart) 200 gm Pouch')
UNION ALL
SELECT 'Sudha Plain Dahi (Smart) 400 gm Pouch', 'Sudha', 'dahi', '400 gm Pouch', '0403', 35.0, 32.15, 30.89, 0.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Smart) 400 gm Pouch')
UNION ALL
SELECT 'Sudha Plain Dahi (Smart) 1 kg Pouch', 'Sudha', 'dahi', '1 kg Pouch', '0403', 78.0, 74.2, 72.57, 0.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Smart) 1 kg Pouch')
UNION ALL
SELECT 'Sudha Plain Dahi (Smart) 5 kg Jar', 'Sudha', 'dahi', '5 kg Jar', '0403', 450.0, 419.0, 405.35, 0.0, 12, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Smart) 5 kg Jar')
UNION ALL
SELECT 'Sudha Plain Dahi (Smart) 15 kg', 'Sudha', 'dahi', '15 kg', '0403', 1300.05, 1230.0, 1194.6, 0.0, 4, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Dahi (Smart) 15 kg')
UNION ALL
SELECT 'Sudha Flavoured Milk (Tetra) 200 ml', 'Sudha', 'beverages', '200 ml', '2202', 20, 17.8, 17.01, 5.0, 200, 40, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Flavoured Milk (Tetra) 200 ml')
UNION ALL
SELECT 'Sudha Flavoured Milk (Glass) 200 ml', 'Sudha', 'beverages', '200 ml', '2202', 28, 22.5, 21.45, 5.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Flavoured Milk (Glass) 200 ml')
UNION ALL
SELECT 'Sudha Flavoured Milk (PET) 200 ml', 'Sudha', 'beverages', '200 ml', '2202', 25, 21.5, 20.66, 5.0, 120, 24, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Flavoured Milk (PET) 200 ml')
UNION ALL
SELECT 'Sudha Chamcham 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 95.0, 87.0, 83.85, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Chamcham 250 gm')
UNION ALL
SELECT 'Sudha Thekua 60 gm', 'Sudha', 'sweets', '60 gm', '1901', 15.0, 13.44, 12.82, 5.0, 100, 20, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Thekua 60 gm')
UNION ALL
SELECT 'Sudha Thekua 250 gm', 'Sudha', 'sweets', '250 gm', '1901', 55.0, 49.87, 47.84, 5.0, 70, 14, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Thekua 250 gm')
UNION ALL
SELECT 'Sudha Spl. Gift Pack 130 gm', 'Sudha', 'sweets', '130 gm', '1901', 55.0, 50.84, 48.98, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Spl. Gift Pack 130 gm')
UNION ALL
SELECT 'Sudha Tetrapak Apple Juice 200 ml', 'Sudha', 'beverages', '200 ml', '2202', 24, 17.5, 16.14, 5.0, 150, 30, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Tetrapak Apple Juice 200 ml')
UNION ALL
SELECT 'Sudha Special Peda (MAP Pack) 100 gm', 'Sudha', 'sweets', '100 gm', '1901', 55.0, 50.0, 47.62, 5.0, 80, 16, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Special Peda (MAP Pack) 100 gm')
UNION ALL
SELECT 'Sudha Special Peda (MAP Pack) 200 gm', 'Sudha', 'sweets', '200 gm', '1901', 105.0, 97.0, 92.38, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Special Peda (MAP Pack) 200 gm')
UNION ALL
SELECT 'Sudha Honey 50 gm', 'Sudha', 'others', '50 gm', '0409', 30.0, 26.0, 24.69, 5.0, 60, 12, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Honey 50 gm')
UNION ALL
SELECT 'Sudha Honey 100 gm', 'Sudha', 'others', '100 gm', '0409', 55.0, 48.0, 45.9, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Honey 100 gm')
UNION ALL
SELECT 'Sudha Honey 250 gm', 'Sudha', 'others', '250 gm', '0409', 115.0, 102.0, 98.06, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Honey 250 gm')
UNION ALL
SELECT 'Sudha Honey 500 gm', 'Sudha', 'others', '500 gm', '0409', 220.0, 196.0, 188.65, 5.0, 30, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Honey 500 gm')
UNION ALL
SELECT 'Sudha Dairy Whitner 25 gm', 'Sudha', 'milk_powder', '25 gm', '0402', 12, 10.75, 10.38, 5.0, 200, 40, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Dairy Whitner 25 gm')
UNION ALL
SELECT 'Sudha Dairy Whitner 12 gm', 'Sudha', 'milk_powder', '12 gm', '0402', 6, 5.25, 5.04, 5.0, 200, 40, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Dairy Whitner 12 gm')
UNION ALL
SELECT 'Sudha Plain Tilkut 400 gm', 'Sudha', 'sweets', '400 gm', '1901', 150.0, 135.0, 128.7, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Plain Tilkut 400 gm')
UNION ALL
SELECT 'Sudha Khoa Tilkut 400 gm', 'Sudha', 'sweets', '400 gm', '1901', 200.0, 180.0, 171.6, 5.0, 40, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Khoa Tilkut 400 gm')
UNION ALL
SELECT 'Sudha Gujia 500 gm', 'Sudha', 'sweets', '500 gm', '1901', 215.0, 197.0, 189.13, 5.0, 50, 10, 'active' WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = 'Sudha Gujia 500 gm');
