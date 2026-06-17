CREATE TABLE public.agencia_configuracoes (
  id integer PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  openai_api_key text,
  openai_model text DEFAULT 'gpt-4o-mini',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agencia_configuracoes ENABLE ROW LEVEL SECURITY;

-- Allow only agencies to read and write (which also means they can view the key in the Super Admin panel)
CREATE POLICY "agencia_all" ON public.agencia_configuracoes
  FOR ALL TO authenticated
  USING (public.is_agencia(auth.uid()))
  WITH CHECK (public.is_agencia(auth.uid()));

-- Insert the default single row
INSERT INTO public.agencia_configuracoes (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Trigger to update updated_at
CREATE TRIGGER trg_agencia_config_updated BEFORE UPDATE ON public.agencia_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
