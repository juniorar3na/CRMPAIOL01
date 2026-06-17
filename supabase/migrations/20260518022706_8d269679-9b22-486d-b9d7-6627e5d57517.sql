CREATE TABLE public.whatsapp_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  unidade_id uuid NOT NULL UNIQUE,
  instance_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'desconectado',
  numero_conectado text,
  qr_code text,
  connected_at timestamptz,
  last_seen_at timestamptz,
  api_token text,
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa select" ON public.whatsapp_sessoes
FOR SELECT TO authenticated
USING (
  public.is_agencia(auth.uid())
  OR clinica_id = public.user_clinica_id(auth.uid())
  OR unidade_id = public.user_unidade_id(auth.uid())
);

CREATE POLICY "wa insert" ON public.whatsapp_sessoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_agencia(auth.uid())
  OR clinica_id = public.user_clinica_id(auth.uid())
);

CREATE POLICY "wa update" ON public.whatsapp_sessoes
FOR UPDATE TO authenticated
USING (
  public.is_agencia(auth.uid())
  OR clinica_id = public.user_clinica_id(auth.uid())
  OR unidade_id = public.user_unidade_id(auth.uid())
);

CREATE POLICY "wa delete" ON public.whatsapp_sessoes
FOR DELETE TO authenticated
USING (
  public.is_agencia(auth.uid())
  OR clinica_id = public.user_clinica_id(auth.uid())
);

CREATE TRIGGER trg_whatsapp_sessoes_updated_at
BEFORE UPDATE ON public.whatsapp_sessoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_whatsapp_sessoes_clinica ON public.whatsapp_sessoes(clinica_id);
CREATE INDEX idx_whatsapp_sessoes_status ON public.whatsapp_sessoes(status);