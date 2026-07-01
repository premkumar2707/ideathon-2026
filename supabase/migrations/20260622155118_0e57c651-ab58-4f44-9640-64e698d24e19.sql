
CREATE POLICY "admins read submissions storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage submissions storage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'admin'));
