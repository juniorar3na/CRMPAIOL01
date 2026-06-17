
-- 1. Adicionar vínculo de usuário com clínica/unidade no user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS clinica_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid;

-- 2. Helpers
CREATE OR REPLACE FUNCTION public.is_agencia(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'agencia')
$$;

CREATE OR REPLACE FUNCTION public.user_clinica_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinica_id FROM public.user_roles WHERE user_id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_unidade_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unidade_id FROM public.user_roles WHERE user_id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 3. Clínicas
CREATE TABLE public.clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  rede text,
  cnpj text,
  responsavel text,
  telefone text,
  email text,
  plano text,
  status_contrato text NOT NULL DEFAULT 'ativo',
  status text NOT NULL DEFAULT 'ativo',
  data_cadastro timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clinicas_updated BEFORE UPDATE ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "clinicas select" ON public.clinicas FOR SELECT TO authenticated
  USING (public.is_agencia(auth.uid()) OR id = public.user_clinica_id(auth.uid()));
CREATE POLICY "clinicas insert agencia" ON public.clinicas FOR INSERT TO authenticated
  WITH CHECK (public.is_agencia(auth.uid()));
CREATE POLICY "clinicas update" ON public.clinicas FOR UPDATE TO authenticated
  USING (public.is_agencia(auth.uid()) OR id = public.user_clinica_id(auth.uid()));
CREATE POLICY "clinicas delete agencia" ON public.clinicas FOR DELETE TO authenticated
  USING (public.is_agencia(auth.uid()));

-- 4. Unidades
CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  endereco text,
  cidade text,
  bairro text,
  horario_funcionamento text,
  atende_24h boolean NOT NULL DEFAULT false,
  whatsapp text,
  google_maps_url text,
  laboratorio_url text,
  servicos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_unidades_updated BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_unidades_clinica ON public.unidades(clinica_id);

CREATE POLICY "unidades select" ON public.unidades FOR SELECT TO authenticated
  USING (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "unidades insert" ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "unidades update" ON public.unidades FOR UPDATE TO authenticated
  USING (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "unidades delete agencia" ON public.unidades FOR DELETE TO authenticated
  USING (public.is_agencia(auth.uid()));

-- 5. Base de conhecimento
CREATE TABLE public.base_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_base_conhecimento_updated BEFORE UPDATE ON public.base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "bc select" ON public.base_conhecimento FOR SELECT TO authenticated
  USING (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR unidade_id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "bc insert" ON public.base_conhecimento FOR INSERT TO authenticated
  WITH CHECK (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "bc update" ON public.base_conhecimento FOR UPDATE TO authenticated
  USING (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "bc delete" ON public.base_conhecimento FOR DELETE TO authenticated
  USING (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));

-- 6. Regras IA
CREATE TABLE public.regras_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  mensagem_boas_vindas text,
  tom_de_voz text,
  quando_responder_sozinha text,
  quando_chamar_humano text,
  palavras_urgencia text[] NOT NULL DEFAULT '{}',
  servicos_precisam_humano text[] NOT NULL DEFAULT '{}',
  informacoes_proibidas text,
  mensagem_casos_sensiveis text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.regras_ia ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_regras_ia_updated BEFORE UPDATE ON public.regras_ia
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "regras select" ON public.regras_ia FOR SELECT TO authenticated
  USING (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR unidade_id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "regras insert" ON public.regras_ia FOR INSERT TO authenticated
  WITH CHECK (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "regras update" ON public.regras_ia FOR UPDATE TO authenticated
  USING (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));
CREATE POLICY "regras delete" ON public.regras_ia FOR DELETE TO authenticated
  USING (public.is_agencia(auth.uid()) OR clinica_id = public.user_clinica_id(auth.uid()));

-- 7. Conversas
CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tutor text NOT NULL,
  telefone text,
  cpf text,
  pet text,
  especie text,
  raca text,
  idade text,
  motivo text,
  sintomas text[] NOT NULL DEFAULT '{}',
  servico_recomendado text,
  prioridade text NOT NULL DEFAULT 'Normal',
  status text NOT NULL DEFAULT 'IA respondendo',
  resumo_ia text,
  proxima_acao text,
  origem text NOT NULL DEFAULT 'simulacao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_conversas_updated BEFORE UPDATE ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_conversas_unidade ON public.conversas(unidade_id);
CREATE INDEX idx_conversas_clinica ON public.conversas(clinica_id);
CREATE INDEX idx_conversas_status ON public.conversas(status);

CREATE POLICY "conversas select" ON public.conversas FOR SELECT TO authenticated
  USING (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR unidade_id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "conversas insert" ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR unidade_id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "conversas update" ON public.conversas FOR UPDATE TO authenticated
  USING (
    public.is_agencia(auth.uid())
    OR clinica_id = public.user_clinica_id(auth.uid())
    OR unidade_id = public.user_unidade_id(auth.uid())
  );
CREATE POLICY "conversas delete agencia" ON public.conversas FOR DELETE TO authenticated
  USING (public.is_agencia(auth.uid()));

-- 8. Mensagens
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente text NOT NULL,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'enviada',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mensagens_conversa ON public.mensagens(conversa_id, created_at);

CREATE POLICY "mensagens select" ON public.mensagens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversas c WHERE c.id = mensagens.conversa_id AND (
      public.is_agencia(auth.uid())
      OR c.clinica_id = public.user_clinica_id(auth.uid())
      OR c.unidade_id = public.user_unidade_id(auth.uid())
    )
  ));
CREATE POLICY "mensagens insert" ON public.mensagens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversas c WHERE c.id = mensagens.conversa_id AND (
      public.is_agencia(auth.uid())
      OR c.clinica_id = public.user_clinica_id(auth.uid())
      OR c.unidade_id = public.user_unidade_id(auth.uid())
    )
  ));

-- 9. Dados iniciais (clinicas, unidades, base, regras, conversas, mensagens)
DO $seed$
DECLARE
  c_paiol uuid := gen_random_uuid();
  c_amigos uuid := gen_random_uuid();
  c_petlife uuid := gen_random_uuid();
  u_itaqua uuid := gen_random_uuid();
  u_santana uuid := gen_random_uuid();
  u_vilamara uuid := gen_random_uuid();
  u_mogi uuid := gen_random_uuid();
  u_amigos_centro uuid := gen_random_uuid();
  conv1 uuid := gen_random_uuid();
  conv2 uuid := gen_random_uuid();
  conv3 uuid := gen_random_uuid();
  conv4 uuid := gen_random_uuid();
  conv5 uuid := gen_random_uuid();
  conv6 uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.clinicas (id, nome, rede, cnpj, responsavel, telefone, email, plano, status_contrato, status) VALUES
    (c_paiol, 'Paiol Veterinária', 'Rede Paiol', '12.345.678/0001-90', 'Dr. Marcos Paiol', '(11) 4002-8922', 'contato@paiol.vet', 'Premium', 'ativo', 'ativo'),
    (c_amigos, 'Clínica Amigos Pet', 'Amigos Pet', '23.456.789/0001-01', 'Dra. Júlia Reis', '(11) 3344-5566', 'contato@amigospet.com.br', 'Standard', 'ativo', 'ativo'),
    (c_petlife, 'PetLife Veterinária', 'PetLife', '34.567.890/0001-12', 'Dr. Carlos Lima', '(11) 5566-7788', 'contato@petlife.vet', 'Premium', 'ativo', 'ativo');

  INSERT INTO public.unidades (id, clinica_id, nome, endereco, cidade, bairro, horario_funcionamento, atende_24h, whatsapp, google_maps_url, laboratorio_url, servicos, status) VALUES
    (u_itaqua, c_paiol, 'Paiol Itaqua', 'Av. Itaquera, 1200', 'São Paulo', 'Itaquera', '24h', true, '(11) 98821-4490', 'https://maps.google.com/?q=Paiol+Itaqua', 'https://lab.paiol.vet', ARRAY['Consulta','Vacina','Exame','Internação','Emergência 24h'], 'ativo'),
    (u_santana, c_paiol, 'Paiol Santana', 'R. Voluntários da Pátria, 500', 'São Paulo', 'Santana', 'Seg-Sáb 08h-20h', false, '(11) 99432-1107', 'https://maps.google.com/?q=Paiol+Santana', 'https://lab.paiol.vet', ARRAY['Consulta','Vacina','Exame','Banho e tosa'], 'ativo'),
    (u_vilamara, c_paiol, 'Paiol Vila Mara', 'R. Itapema, 88', 'São Paulo', 'Vila Mara', 'Seg-Sex 08h-19h', false, '(11) 97766-3321', 'https://maps.google.com/?q=Paiol+Vila+Mara', 'https://lab.paiol.vet', ARRAY['Consulta','Internação','Castração'], 'ativo'),
    (u_mogi, c_paiol, 'Paiol Mogi', 'Av. Cívica, 200', 'Mogi das Cruzes', 'Centro Cívico', 'Seg-Sáb 08h-20h', false, '(11) 98123-7788', 'https://maps.google.com/?q=Paiol+Mogi', 'https://lab.paiol.vet', ARRAY['Consulta','Vacina','Exame'], 'ativo'),
    (u_amigos_centro, c_amigos, 'Amigos Pet Centro', 'R. da Liberdade, 320', 'São Paulo', 'Liberdade', 'Seg-Sex 09h-18h', false, '(11) 3344-5566', 'https://maps.google.com/?q=Amigos+Pet+Centro', NULL, ARRAY['Consulta','Vacina','Banho e tosa'], 'ativo');

  INSERT INTO public.base_conhecimento (clinica_id, unidade_id, categoria, titulo, conteudo) VALUES
    (c_paiol, NULL, 'Consulta', 'Valor da consulta clínica', 'Consulta clínica geral: R$ 180. Retornos em até 15 dias são gratuitos.'),
    (c_paiol, NULL, 'Vacinas', 'Tabela de vacinas caninas', 'V10: R$ 120 · Antirrábica: R$ 80 · Gripe canina: R$ 95.'),
    (c_paiol, u_itaqua, 'Emergência 24h', 'Atendimento 24h Itaqua', 'A unidade Itaqua atende emergências 24h, 7 dias por semana. Taxa de urgência: R$ 250.'),
    (c_paiol, NULL, 'Formas de pagamento', 'Formas de pagamento aceitas', 'Pix, dinheiro, cartão de débito e crédito em até 3x sem juros.'),
    (c_amigos, NULL, 'Banho e tosa', 'Pacote banho + tosa', 'Banho a partir de R$ 60 · Tosa higiênica R$ 45 · Pacote mensal com 10% off.');

  INSERT INTO public.regras_ia (clinica_id, unidade_id, mensagem_boas_vindas, tom_de_voz, quando_responder_sozinha, quando_chamar_humano, palavras_urgencia, servicos_precisam_humano, informacoes_proibidas, mensagem_casos_sensiveis) VALUES
    (c_paiol, NULL,
     'Olá! Sou a assistente do Hospital Paiol Veterinária. Como posso ajudar você e o seu pet hoje?',
     'Acolhedor, claro e profissional',
     'Dúvidas sobre valores, horários, agendamentos simples e informações da clínica',
     'Quando o tutor descrever sintomas, pedir resultado de exame, falar em internação ou usar palavras de urgência',
     ARRAY['vômito','sangue','desmaio','convulsão','engasgo','atropelado','intoxicação'],
     ARRAY['Emergência 24h','Internação','Resultado de exame'],
     'Não dar diagnósticos, não prescrever medicamentos, não estimar gravidade clínica',
     'Entendi que é um momento delicado. Vou chamar agora um profissional da nossa equipe para te atender com mais cuidado.'),
    (c_amigos, NULL,
     'Oi! Sou a recepção virtual da Amigos Pet. Posso te ajudar com agendamentos e informações.',
     'Carinhoso e informal',
     'Agendamentos, valores e endereço',
     'Sintomas, urgências e exames',
     ARRAY['vômito','sangue','convulsão'],
     ARRAY['Emergência 24h','Internação'],
     'Não dar diagnósticos',
     'Vou te transferir para um humano da equipe agora.');

  INSERT INTO public.conversas (id, clinica_id, unidade_id, tutor, telefone, cpf, pet, especie, raca, idade, motivo, sintomas, servico_recomendado, prioridade, status, resumo_ia, proxima_acao, origem) VALUES
    (conv1, c_paiol, u_itaqua, 'Camila Reis', '(11) 98821-4490', '324.118.992-04', 'Thor', 'Canino', 'Labrador', '4 anos', 'Vômito e apatia', ARRAY['Vômito (3x em 1h)','Apatia','Recusa alimentar'], 'Emergência 24h', 'Urgente', 'Aguardando humano',
     'Tutora relata pet vomitando há 1h, apático e sem comer desde ontem. IA classificou como urgente e acionou a recepção.',
     'Transferir para veterinário de plantão e orientar deslocamento até Paiol Itaqua.', 'simulacao'),
    (conv2, c_paiol, u_santana, 'João Mendes', '(11) 99432-1107', '187.554.321-90', 'Mel', 'Felino', 'SRD', '7 anos', 'Resultado de exame', ARRAY[]::text[], 'Envio de link do laboratório', 'Normal', 'Em atendimento',
     'Tutor solicitou resultado do hemograma da Mel. CPF conferido, link do laboratório enviado.',
     'Confirmar recebimento do PDF e agendar retorno se necessário.', 'simulacao'),
    (conv3, c_paiol, u_vilamara, 'Roberto Lima', '(11) 97766-3321', '402.998.110-55', 'Bob', 'Canino', 'Bulldog', '9 anos', 'Atualização de internação', ARRAY['Pós-cirúrgico','Internação 2º dia'], 'Atualização clínica autorizada', 'Alta', 'Aguardando humano',
     'Tutor pediu notícias do Bob, internado após cirurgia ontem. Aguardando retorno da equipe clínica.',
     'Recepção deve coletar update com o veterinário responsável e responder ao tutor.', 'simulacao'),
    (conv4, c_paiol, u_mogi, 'Patrícia Souza', '(11) 98123-7788', NULL, 'Nina', 'Canino', 'Poodle', '2 anos', 'Preço de vacina V10', ARRAY[]::text[], 'Agendamento de vacina', 'Baixa', 'IA respondendo',
     'Tutora perguntou preço e disponibilidade da V10. IA informou valor (R$120) e horários disponíveis.',
     'Confirmar agendamento na quarta-feira às 09:30.', 'simulacao'),
    (conv5, c_paiol, u_itaqua, 'Amanda Castro', '(11) 99544-2210', NULL, 'Luna', 'Felino', 'Persa', '5 anos', 'Agendar consulta', ARRAY[]::text[], 'Consulta de rotina', 'Normal', 'IA respondendo',
     'Primeiro contato. Tutora quer agendar consulta de rotina para a Luna.',
     'Oferecer agenda da semana e confirmar horário.', 'simulacao'),
    (conv6, c_paiol, u_santana, 'Ricardo Pinto', '(11) 94422-8810', NULL, 'Pretinha', 'Canino', 'SRD', '6 anos', 'Diarreia com sangue', ARRAY['Diarreia com sangue','Várias evacuações','Pet abatida'], 'Emergência', 'Urgente', 'Aguardando humano',
     'Tutor relata diarreia com sangue desde cedo. Caso classificado como urgente pela IA.',
     'Encaminhar à unidade mais próxima e avisar veterinário de plantão.', 'simulacao');

  INSERT INTO public.mensagens (conversa_id, remetente, conteudo, created_at) VALUES
    (conv1, 'tutor', 'Oi, meu cachorro está vomitando desde ontem e está bem quietinho.', now() - interval '8 minutes'),
    (conv1, 'ia', 'Sinto muito por isso. Vou te ajudar a organizar esse atendimento. Qual o nome do pet?', now() - interval '7 minutes'),
    (conv1, 'tutor', 'Thor.', now() - interval '6 minutes'),
    (conv1, 'ia', 'Obrigado. Ele está se alimentando normalmente? Teve diarreia ou sangue no vômito?', now() - interval '5 minutes'),
    (conv1, 'tutor', 'Não quer comer e está só deitado.', now() - interval '4 minutes'),
    (conv1, 'ia', 'Entendi. Pelo que você descreveu, vou sinalizar como prioridade para a recepção da unidade.', now() - interval '2 minutes'),

    (conv2, 'tutor', 'Bom dia! Saiu o exame da Mel?', now() - interval '20 minutes'),
    (conv2, 'ia', 'Bom dia João! Deixa eu conferir aqui pra você.', now() - interval '19 minutes'),
    (conv2, 'ia', 'Achei sim, hemograma já liberado. Pode confirmar seu CPF, por favor?', now() - interval '18 minutes'),
    (conv2, 'tutor', '187.554.321-90', now() - interval '17 minutes'),
    (conv2, 'ia', 'Confirmado. Vou pedir pra recepcionista te enviar o PDF agora.', now() - interval '15 minutes'),

    (conv3, 'tutor', 'Bom dia, como o Bob passou a noite?', now() - interval '14 minutes'),
    (conv3, 'ia', 'Bom dia Roberto! Vou puxar o boletim da enfermaria do Bob.', now() - interval '13 minutes'),
    (conv3, 'ia', 'Última atualização às 06:30: dormiu bem, aceitou água e está estável.', now() - interval '12 minutes'),

    (conv4, 'tutor', 'Oi, quanto custa a vacina V10 pra cachorro pequeno?', now() - interval '3 minutes'),
    (conv4, 'ia', 'Oi Patrícia! A V10 está R$ 120 à vista, ou 2x de R$ 65 no cartão.', now() - interval '2 minutes'),

    (conv5, 'tutor', 'Oi, vocês atendem gato?', now() - interval '5 minutes'),
    (conv5, 'ia', 'Atendemos sim! Como é o nome do seu pet?', now() - interval '4 minutes'),
    (conv5, 'tutor', 'Luna, persa de 5 anos.', now() - interval '3 minutes'),

    (conv6, 'tutor', 'Socorro, minha cachorra tá com diarreia com sangue', now() - interval '2 minutes'),
    (conv6, 'ia', 'Sinto muito, Ricardo. Quantas vezes ela já evacuou hoje?', now() - interval '1 minute');
END $seed$;
