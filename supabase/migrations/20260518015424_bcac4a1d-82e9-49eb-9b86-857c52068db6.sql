
-- Tables for reception: exames (exam result requests) and internacoes (hospitalization updates)

CREATE TABLE public.exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  unidade_id uuid,
  tutor text NOT NULL,
  cpf text,
  pet text NOT NULL,
  tipo text,
  link_lab text,
  login_informado boolean NOT NULL DEFAULT false,
  senha_informada boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'aguardando',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exames select" ON public.exames FOR SELECT TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "exames insert" ON public.exames FOR INSERT TO authenticated
WITH CHECK (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "exames update" ON public.exames FOR UPDATE TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "exames delete" ON public.exames FOR DELETE TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE TRIGGER exames_touch BEFORE UPDATE ON public.exames
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE public.internacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL,
  unidade_id uuid,
  tutor text NOT NULL,
  cpf text,
  pet text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'aguardando equipe',
  observacoes text,
  mensagem_autorizada text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internacoes select" ON public.internacoes FOR SELECT TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "internacoes insert" ON public.internacoes FOR INSERT TO authenticated
WITH CHECK (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "internacoes update" ON public.internacoes FOR UPDATE TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE POLICY "internacoes delete" ON public.internacoes FOR DELETE TO authenticated
USING (is_agencia(auth.uid()) OR clinica_id = user_clinica_id(auth.uid()) OR unidade_id = user_unidade_id(auth.uid()));

CREATE TRIGGER internacoes_touch BEFORE UPDATE ON public.internacoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
