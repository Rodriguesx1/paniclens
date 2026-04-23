-- Seed the organization required by the enterprise license backfill.
-- This keeps the later license seed migration from failing on a clean database.
INSERT INTO public.organizations (id, name, slug)
SELECT
  'd5630083-a872-49e9-860f-8c2cb7bd9eb0',
  'OnTec',
  'ontec'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organizations
  WHERE id = 'd5630083-a872-49e9-860f-8c2cb7bd9eb0'
);
