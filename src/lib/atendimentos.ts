export type Prioridade = "Urgente" | "Alta" | "Normal" | "Baixa";
export type StatusAtend =
  | "Aguardando humano"
  | "Em atendimento"
  | "Finalizado"
  | "IA respondendo";

export type EventoTimeline = {
  hora: string;
  evento: string;
  ator: "tutor" | "ia" | "recepcao" | "sistema";
};

export type Mensagem = { de: "tutor" | "ia" | "recepcao"; texto: string; hora: string };

export type Atendimento = {
  id: string;
  tutor: string;
  pet: string;
  unidadeId: string;
  unidade: string;
  motivo: string;
  status: StatusAtend;
  prioridade: Prioridade;
  tempo: string;
  telefone: string;
  cpf?: string;
  especie: string;
  sintomas: string[];
  servicoRecomendado: string;
  resumo: string;
  proximaAcao: string;
  timeline: EventoTimeline[];
  mensagens: Mensagem[];
};

export const ATENDIMENTOS: Atendimento[] = [
  {
    id: "a-001",
    tutor: "Camila Reis",
    pet: "Thor",
    unidadeId: "itaqua",
    unidade: "Paiol Itaqua",
    motivo: "Vômito e apatia",
    status: "Aguardando humano",
    prioridade: "Urgente",
    tempo: "2 min",
    telefone: "(11) 98821-4490",
    cpf: "324.118.992-04",
    especie: "Canino — Labrador, 4 anos",
    sintomas: ["Vômito (3× em 1h)", "Apatia", "Recusa alimentar"],
    servicoRecomendado: "Emergência 24h",
    resumo:
      "Tutora relata pet vomitando há 1h, apático e sem comer desde ontem. IA classificou como urgente e acionou a recepção.",
    proximaAcao: "Transferir para veterinário de plantão e orientar deslocamento até Paiol Itaqua.",
    timeline: [
      { hora: "14:02", evento: "Tutor iniciou conversa no WhatsApp", ator: "tutor" },
      { hora: "14:02", evento: "IA respondeu boas-vindas e pediu nome do pet", ator: "ia" },
      { hora: "14:04", evento: "Tutor descreveu sintomas", ator: "tutor" },
      { hora: "14:04", evento: "IA identificou palavras de urgência (vômito + apatia)", ator: "sistema" },
      { hora: "14:05", evento: "Caso classificado como URGENTE", ator: "sistema" },
      { hora: "14:05", evento: "Conversa entregue à recepção", ator: "sistema" },
    ],
    mensagens: [
      { de: "tutor", texto: "Oi, meu cachorro tá vomitando muito", hora: "14:02" },
      { de: "ia", texto: "Olá! Sou a assistente da Paiol Veterinária. Qual o nome do seu pet?", hora: "14:02" },
      { de: "tutor", texto: "Thor, labrador 4 anos", hora: "14:03" },
      { de: "ia", texto: "Há quanto tempo o Thor está vomitando? Ele está comendo normal?", hora: "14:03" },
      { de: "tutor", texto: "Vomitou 3 vezes na última hora e não quer comer desde ontem. Tá bem caidão.", hora: "14:04" },
      { de: "ia", texto: "Entendi. Pelos sinais, classifiquei como URGENTE. Já estou chamando a recepção da unidade Itaqua.", hora: "14:05" },
    ],
  },
  {
    id: "a-002",
    tutor: "João Mendes",
    pet: "Mel",
    unidadeId: "santana",
    unidade: "Paiol Santana",
    motivo: "Resultado de exame",
    status: "Em atendimento",
    prioridade: "Normal",
    tempo: "8 min",
    telefone: "(11) 99432-1107",
    cpf: "187.554.321-90",
    especie: "Felino — SRD, 7 anos",
    sintomas: [],
    servicoRecomendado: "Envio de link do laboratório",
    resumo: "Tutor solicitou resultado do hemograma da Mel. CPF conferido, link do laboratório enviado.",
    proximaAcao: "Confirmar recebimento do PDF e agendar retorno se necessário.",
    timeline: [
      { hora: "13:50", evento: "Tutor pediu resultado de exame", ator: "tutor" },
      { hora: "13:51", evento: "IA solicitou CPF para validação", ator: "ia" },
      { hora: "13:53", evento: "CPF validado — paciente Mel encontrada", ator: "sistema" },
      { hora: "13:54", evento: "Link do laboratório enviado", ator: "ia" },
      { hora: "13:58", evento: "Recepcionista assumiu atendimento", ator: "recepcao" },
    ],
    mensagens: [
      { de: "tutor", texto: "Boa tarde, queria o resultado do exame da Mel", hora: "13:50" },
      { de: "ia", texto: "Olá! Pra liberar, preciso confirmar seu CPF, por favor.", hora: "13:51" },
      { de: "tutor", texto: "187.554.321-90", hora: "13:52" },
      { de: "ia", texto: "Confirmado! Aqui está o link do laboratório: https://lab.paiol.vet/mel", hora: "13:54" },
      { de: "tutor", texto: "Recebi, obrigado!", hora: "13:57" },
    ],
  },
  {
    id: "a-003",
    tutor: "Roberto Lima",
    pet: "Bob",
    unidadeId: "vilamara",
    unidade: "Paiol Vila Mara",
    motivo: "Atualização de internação",
    status: "Aguardando humano",
    prioridade: "Alta",
    tempo: "5 min",
    telefone: "(11) 97766-3321",
    cpf: "402.998.110-55",
    especie: "Canino — Bulldog, 9 anos",
    sintomas: ["Pós-cirúrgico", "Internação 2º dia"],
    servicoRecomendado: "Atualização clínica autorizada",
    resumo: "Tutor pediu notícias do Bob, internado após cirurgia ontem. Aguardando retorno da equipe clínica.",
    proximaAcao: "Recepção deve coletar update com o veterinário responsável e responder ao tutor.",
    timeline: [
      { hora: "13:45", evento: "Tutor pediu atualização", ator: "tutor" },
      { hora: "13:46", evento: "IA reconheceu Bob como paciente internado", ator: "sistema" },
      { hora: "13:46", evento: "IA acionou a recepção (regra: internação)", ator: "sistema" },
    ],
    mensagens: [
      { de: "tutor", texto: "Como tá o Bob? Passou bem a noite?", hora: "13:45" },
      { de: "ia", texto: "Olá Roberto! Vou pedir um update da equipe clínica e te respondo em instantes.", hora: "13:46" },
    ],
  },
  {
    id: "a-004",
    tutor: "Patrícia Souza",
    pet: "Nina",
    unidadeId: "mogi",
    unidade: "Paiol Mogi",
    motivo: "Vacina V10",
    status: "IA respondendo",
    prioridade: "Baixa",
    tempo: "1 min",
    telefone: "(11) 98123-7788",
    especie: "Canino — Poodle, 2 anos",
    sintomas: [],
    servicoRecomendado: "Agendamento de vacina",
    resumo: "Tutora perguntou preço e disponibilidade da V10. IA informou valor (R$120) e horários disponíveis.",
    proximaAcao: "Confirmar agendamento na quarta-feira às 09:30.",
    timeline: [
      { hora: "14:08", evento: "Tutor pediu valor da V10", ator: "tutor" },
      { hora: "14:08", evento: "IA respondeu valor e horários", ator: "ia" },
    ],
    mensagens: [
      { de: "tutor", texto: "Bom dia, quanto custa a V10?", hora: "14:08" },
      { de: "ia", texto: "Bom dia! A V10 sai por R$120 à vista. Tenho horário quarta às 09:30 ou sexta às 15:00. Qual prefere?", hora: "14:08" },
    ],
  },
  {
    id: "a-005",
    tutor: "Amanda Castro",
    pet: "Luna",
    unidadeId: "itaqua",
    unidade: "Paiol Itaqua",
    motivo: "Agendar consulta",
    status: "IA respondendo",
    prioridade: "Normal",
    tempo: "3 min",
    telefone: "(11) 99544-2210",
    especie: "Felino — Persa, 5 anos",
    sintomas: [],
    servicoRecomendado: "Consulta de rotina",
    resumo: "Primeiro contato. Tutora quer agendar consulta de rotina para a Luna.",
    proximaAcao: "Oferecer agenda da semana e confirmar horário.",
    timeline: [
      { hora: "14:06", evento: "Novo contato", ator: "tutor" },
      { hora: "14:06", evento: "IA pediu nome e espécie do pet", ator: "ia" },
    ],
    mensagens: [
      { de: "tutor", texto: "Oi, gostaria de marcar uma consulta", hora: "14:06" },
      { de: "ia", texto: "Olá! Qual o nome do seu pet e qual a espécie?", hora: "14:06" },
      { de: "tutor", texto: "Luna, gata persa de 5 anos", hora: "14:07" },
    ],
  },
  {
    id: "a-006",
    tutor: "Fernanda Alves",
    pet: "Mike",
    unidadeId: "santana",
    unidade: "Paiol Santana",
    motivo: "Castração — orçamento",
    status: "Em atendimento",
    prioridade: "Normal",
    tempo: "12 min",
    telefone: "(11) 98800-1122",
    especie: "Canino — SRD, 1 ano",
    sintomas: [],
    servicoRecomendado: "Orçamento de castração",
    resumo: "Tutora pediu orçamento de castração. Recepção assumiu para passar valores e datas.",
    proximaAcao: "Enviar tabela e abrir agenda de pré-anestésico.",
    timeline: [
      { hora: "13:42", evento: "Tutor pediu valor de castração", ator: "tutor" },
      { hora: "13:43", evento: "IA informou faixa de valores", ator: "ia" },
      { hora: "13:50", evento: "Recepção assumiu para fechar orçamento", ator: "recepcao" },
    ],
    mensagens: [
      { de: "tutor", texto: "Oi, quanto fica pra castrar um cachorro pequeno?", hora: "13:42" },
      { de: "ia", texto: "Oi! Pra cães de até 10kg, fica entre R$580 e R$720 dependendo do porte. Vou te passar pra recepção pra confirmar tudo certinho.", hora: "13:43" },
    ],
  },
];

export function getAtendimento(id: string) {
  return ATENDIMENTOS.find((a) => a.id === id);
}
