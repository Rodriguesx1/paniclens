
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', split_part(NEW.email, '@', 1) || '''s workspace');
  org_slug := lower(regexp_replace(org_name || '-' || substr(NEW.id::text, 1, 8), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.organizations(name, slug) VALUES (org_name, org_slug) RETURNING id INTO new_org_id;

  INSERT INTO public.profiles(id, full_name, email, default_org_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, new_org_id);

  INSERT INTO public.memberships(user_id, org_id, role) VALUES (NEW.id, new_org_id, 'org_admin');
  INSERT INTO public.memberships(user_id, org_id, role) VALUES (NEW.id, new_org_id, 'premium_technician');

  RETURN NEW;
END; $$;
