-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Add AI configuration to whatsapp_sessoes
ALTER TABLE public.whatsapp_sessoes
  ADD COLUMN IF NOT EXISTS ia_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_prompt text;

-- 2. Create whatsapp_ia_pdfs table to store uploaded PDFs metadata
CREATE TABLE public.whatsapp_ia_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.whatsapp_sessoes(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  caminho_storage text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_ia_pdfs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_whatsapp_ia_pdfs_updated BEFORE UPDATE ON public.whatsapp_ia_pdfs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "wa_pdfs select" ON public.whatsapp_ia_pdfs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_sessoes ws WHERE ws.id = sessao_id AND (
        public.is_agencia(auth.uid()) OR ws.clinica_id = public.user_clinica_id(auth.uid())
      )
    )
  );

CREATE POLICY "wa_pdfs insert" ON public.whatsapp_ia_pdfs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_sessoes ws WHERE ws.id = sessao_id AND (
        public.is_agencia(auth.uid()) OR ws.clinica_id = public.user_clinica_id(auth.uid())
      )
    )
  );

CREATE POLICY "wa_pdfs delete" ON public.whatsapp_ia_pdfs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_sessoes ws WHERE ws.id = sessao_id AND (
        public.is_agencia(auth.uid()) OR ws.clinica_id = public.user_clinica_id(auth.uid())
      )
    )
  );


-- 3. Create whatsapp_ia_embeddings table to store vector chunks
CREATE TABLE public.whatsapp_ia_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.whatsapp_sessoes(id) ON DELETE CASCADE,
  pdf_id uuid NOT NULL REFERENCES public.whatsapp_ia_pdfs(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_ia_embeddings ENABLE ROW LEVEL SECURITY;

-- Creating an index on the embedding column for faster similarity searches
CREATE INDEX ON public.whatsapp_ia_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RLS for embeddings
CREATE POLICY "wa_embeddings select" ON public.whatsapp_ia_embeddings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_sessoes ws WHERE ws.id = sessao_id AND (
        public.is_agencia(auth.uid()) OR ws.clinica_id = public.user_clinica_id(auth.uid())
      )
    )
  );

-- Function to match documents
CREATE OR REPLACE FUNCTION match_whatsapp_ia_documents(
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter_sessao_id uuid DEFAULT null
)
RETURNS TABLE (
  id uuid,
  sessao_id uuid,
  pdf_id uuid,
  conteudo text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    sessao_id,
    pdf_id,
    conteudo,
    1 - (whatsapp_ia_embeddings.embedding <=> query_embedding) AS similarity
  FROM whatsapp_ia_embeddings
  WHERE (filter_sessao_id IS NULL OR whatsapp_ia_embeddings.sessao_id = filter_sessao_id)
  ORDER BY whatsapp_ia_embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- 4. Create Supabase Storage Bucket for Knowledge Base PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('knowledge_base', 'knowledge_base', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for 'knowledge_base' bucket
CREATE POLICY "kb_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'knowledge_base');
CREATE POLICY "kb_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge_base');
CREATE POLICY "kb_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'knowledge_base');
CREATE POLICY "kb_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'knowledge_base');
