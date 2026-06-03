-- 1) plans: catálogo público de planos — SELECT para anon e authenticated
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;

CREATE POLICY "plans_public_read"
ON public.plans
FOR SELECT
TO anon, authenticated
USING (is_active IS DISTINCT FROM false);

-- 2) is_workspace_member: revogar EXECUTE de anon (não faz sentido sem auth.uid())
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO service_role;