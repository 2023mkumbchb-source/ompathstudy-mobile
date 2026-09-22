-- Harden mutable search_path warnings without changing function behavior.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public._slugify(text) SET search_path = public;

-- Public learners only need published content. Writes must be admin-only.
DROP POLICY IF EXISTS "Allow all operations for managing flashcard_sets" ON public.flashcard_sets;
DROP POLICY IF EXISTS "Anyone can read published flashcard_sets" ON public.flashcard_sets;
CREATE POLICY "Anyone can read published flashcard_sets"
  ON public.flashcard_sets
  FOR SELECT
  TO anon, authenticated
  USING (published = true AND deleted_at IS NULL);
CREATE POLICY "Admins can manage flashcard_sets"
  ON public.flashcard_sets
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Allow all operations for managing mcq_sets" ON public.mcq_sets;
DROP POLICY IF EXISTS "Anyone can read published mcq_sets" ON public.mcq_sets;
CREATE POLICY "Anyone can read published mcq_sets"
  ON public.mcq_sets
  FOR SELECT
  TO anon, authenticated
  USING (published = true AND deleted_at IS NULL);
CREATE POLICY "Admins can manage mcq_sets"
  ON public.mcq_sets
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
