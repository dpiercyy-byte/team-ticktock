CREATE POLICY "Lead sources deny browser access" ON public.lead_sources FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Lead qualification rules deny browser access" ON public.lead_qualification_rules FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Lead records deny browser access" ON public.lead_records FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Lead activities deny browser access" ON public.lead_activities FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);