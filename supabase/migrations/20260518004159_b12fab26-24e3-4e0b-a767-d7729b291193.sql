
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM authenticated;
