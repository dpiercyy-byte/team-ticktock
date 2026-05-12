
CREATE OR REPLACE FUNCTION public.verify_hash(plain text, hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(plain, hash) = hash;
$$;

CREATE OR REPLACE FUNCTION public.hash_password(plain text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(plain, gen_salt('bf'));
$$;

REVOKE ALL ON FUNCTION public.verify_hash(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_password(text) FROM anon, authenticated;
