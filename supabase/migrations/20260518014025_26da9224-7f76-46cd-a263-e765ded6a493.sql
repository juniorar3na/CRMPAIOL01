
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_agencia(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_clinica_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_unidade_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_agencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_clinica_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_unidade_id(uuid) TO authenticated;
