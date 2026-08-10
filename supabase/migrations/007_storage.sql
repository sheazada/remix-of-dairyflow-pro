
-- ============================================================
-- BUCKETS
-- ============================================================

-- Storage buckets used by the app: purchase challans & proof-of-delivery
INSERT INTO storage.buckets (id, name, public)
VALUES ('challans', 'challans', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pod', 'pod', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- STORAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "challans finance delete" ON storage.objects;
CREATE POLICY "challans finance delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance insert" ON storage.objects;
CREATE POLICY "challans finance insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance read" ON storage.objects;
CREATE POLICY "challans finance read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance update" ON storage.objects;
CREATE POLICY "challans finance update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid()))) WITH CHECK (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "pod manager delete" ON storage.objects;
CREATE POLICY "pod manager delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'pod'::text) AND public.can_manage_sales(auth.uid())));


DROP POLICY IF EXISTS "pod owner or manager update" ON storage.objects;
CREATE POLICY "pod owner or manager update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'pod'::text) AND ((owner = auth.uid()) OR public.can_manage_sales(auth.uid())))) WITH CHECK (((bucket_id = 'pod'::text) AND ((owner = auth.uid()) OR public.can_manage_sales(auth.uid()))));


DROP POLICY IF EXISTS "pod staff insert" ON storage.objects;
CREATE POLICY "pod staff insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'pod'::text) AND public.is_internal_staff(auth.uid()) AND (owner = auth.uid())));


DROP POLICY IF EXISTS "pod staff read" ON storage.objects;
CREATE POLICY "pod staff read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'pod'::text) AND public.is_internal_staff(auth.uid())));

