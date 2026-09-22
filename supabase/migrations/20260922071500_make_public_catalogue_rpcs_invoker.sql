-- Catalogue RPCs expose only published metadata already protected by
-- table-level public SELECT policies, so they do not need SECURITY DEFINER.
ALTER FUNCTION public.category_counts() SECURITY INVOKER;
ALTER FUNCTION public.home_recent(integer) SECURITY INVOKER;
