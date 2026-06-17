import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageScopeFilter } from "@/components/PageScopeFilter";
import { supabase } from "@/integrations/supabase/client";
import { useScope, useCurrentScope } from "@/lib/scope";
import type { DbConversa, DbExame, DbInternacao } from "@/lib/db-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell
} from "recharts";
import { Sparkles, BrainCircuit, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/agencia/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Agência" }] }),
  component: RelatoriosPage,
});

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// --- DADOS MOCKADOS (Exemplos) ---
const mockAssuntos = [
  { name: "Vacinas", value: 120 },
  { name: "Consultas", value: 98 },
  { name: "Exames", value: 86 },
  { name: "Preço", value: 65 },
  { name: "Castração", value: 45 },
  { name: "Internação", value: 32 },
  { name: "Emergência", value: 20 },
];

const mockDias = [
  { name: "Seg", volume: 150 },
  { name: "Ter", volume: 130 },
  { name: "Qua", volume: 140 },
  { name: "Qui", volume: 120 },
  { name: "Sex", volume: 170 },
  { name: "Sáb", volume: 200 },
  { name: "Dom", volume: 80 },
];

const mockHorarios = [
  { time: "06h", volume: 10 },
  { time: "08h", volume: 80 },
  { time: "10h", volume: 130 },
  { time: "12h", volume: 90 },
  { time: "14h", volume: 110 },
  { time: "16h", volume: 140 },
  { time: "18h", volume: 80 },
  { time: "20h", volume: 40 },
];

const mockServicos = [
  { name: "V10", perc: 85 },
  { name: "Consulta clínica", perc: 70 },
  { name: "Ultrassom", perc: 55 },
  { name: "Exame de sangue", perc: 40 },
  { name: "Castração", perc: 30 },
];

const mockPalavras = ["preço", "vacina", "exame", "internação", "urgente", "consulta", "resultado"];

function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("7d");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const { unidades } = useScope();
  const [conversas, setConversas] = useState<DbConversa[]>([]);
  const [exames, setExames] = useState<DbExame[]>([]);
  const [internacoes, setInternacoes] = useState<DbInternacao[]>([]);

  const { clinicaId, unidadeId } = useCurrentScope();

  useEffect(() => {
    (async () => {
      let qConv = supabase.from("conversas").select("*");
      let qExam = supabase.from("exames").select("*");
      let qInte = supabase.from("internacoes").select("*");

      if (clinicaId && clinicaId !== "all") {
        qConv = qConv.eq("clinica_id", clinicaId);
        qExam = qExam.eq("clinica_id", clinicaId);
        qInte = qInte.eq("clinica_id", clinicaId);
      }
      if (unidadeId) {
        qConv = qConv.eq("unidade_id", unidadeId);
        qExam = qExam.eq("unidade_id", unidadeId);
        qInte = qInte.eq("unidade_id", unidadeId);
      }

      const [{ data: c }, { data: e }, { data: i }] = await Promise.all([
        qConv,
        qExam,
        qInte,
      ]);
      setConversas(c ?? []);
      setExames(e ?? []);
      setInternacoes(i ?? []);
    })();
  }, [clinicaId, unidadeId]);

  const metrics = useMemo(() => {
    const urgencias = conversas.filter((c) => c.prioridade === "Urgente").length;
    const matchMotivo = (re: RegExp) =>
      conversas.filter((c) => re.test(c.motivo ?? "")).length;
    const finalizadasIA = conversas.filter(
      (c) => c.status === "Finalizado" && c.origem !== "humano",
    ).length;
    const assumidas = conversas.filter((c) => c.status === "Em atendimento").length;
    // Lógica simplificada/mockada para espera prolongada
    const esperaProlongada = conversas.filter((c) => c.status === "Aguardando").length + 2; 

    const motivoMap = new Map<string, number>();
    for (const c of conversas) {
      const m = (c.motivo ?? "").trim();
      if (!m) continue;
      motivoMap.set(m, (motivoMap.get(m) ?? 0) + 1);
    }
    const topMotivo =
      [...motivoMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return {
      atendimentos: conversas.length,
      urgencias,
      esperaProlongada,
      precos: matchMotivo(/preç|valor/i),
      consultas: matchMotivo(/consulta/i),
      vacinas: matchMotivo(/vacina/i),
      finalizadasIA,
      assumidas,
      topMotivo,
    };
  }, [conversas]);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Relatório", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: [
        ['Atendimentos', metrics.atendimentos.toString()],
        ['Urgências', metrics.urgencias.toString()],
        ['Espera Prolongada', metrics.esperaProlongada.toString()],
        ['Pedidos de Preço', metrics.precos.toString()],
        ['Pedidos de Consulta', metrics.consultas.toString()],
        ['Pedidos de Vacina', metrics.vacinas.toString()],
        ['Pedidos de Exame', exames.length.toString()],
        ['Pedidos de Internação', internacoes.length.toString()],
        ['Conversas finalizadas pela IA', metrics.finalizadasIA.toString()],
        ['Assumidas pela recepção', metrics.assumidas.toString()],
      ],
    });

    let finalY = (doc as any).lastAutoTable.finalY || 40;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Assuntos Mais Falados', 'Volume']],
      body: mockAssuntos.map(a => [a.name, a.value.toString()]),
    });
    finalY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Dias com Maior Procura', 'Volume']],
      body: mockDias.map(d => [d.name, d.volume.toString()]),
    });
    finalY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Horários de Pico', 'Volume de Mensagens']],
      body: mockHorarios.map(h => [h.time, h.volume.toString()]),
    });
    finalY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: finalY + 10,
      head: [['Serviços Mais Buscados', 'Popularidade (%)']],
      body: mockServicos.map(s => [s.name, s.perc.toString() + '%']),
    });
    finalY = (doc as any).lastAutoTable.finalY;
    
    doc.setFontSize(14);
    
    // Checar se há espaço na página para o resumo, senão pular página
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.text("Resumo Inteligente", 14, finalY + 15);
    
    doc.setFontSize(10);
    const resumo = [
      "- 32% das conversas desta semana foram sobre vacinas.",
      "- Segunda-feira foi o dia com maior procura por V10.",
      "- 18 tutores perguntaram sobre exame de sangue.",
      "- 7 urgências ficaram aguardando humano por mais de 10 minutos.",
      "- Castração teve aumento de 22% nas buscas."
    ];
    
    let currentY = finalY + 22;
    resumo.forEach(item => {
      doc.text(item, 14, currentY);
      currentY += 6;
    });

    doc.save("relatorio_agencia.pdf");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Relatórios"
        description="Indicadores consolidados de atendimentos, motivos e desempenho da IA."
        actions={
          <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 bg-white">
            <Download className="size-4" />
            Baixar PDF
          </Button>
        }
      />
      
      <div className="flex flex-col sm:flex-row gap-4 items-start mb-6">
        <PageScopeFilter allowAllClinicas />
        
        <div className="flex-1 space-y-1.5 max-w-sm">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Período
          </label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="15d">15 dias</option>
            <option value="30d">30 dias</option>
            <option value="mes">Esse mês</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        {periodo === "personalizado" && (
          <div className="flex gap-4 items-end flex-1 max-w-sm">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-slate-700"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-slate-700"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sugestões da IA */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100 shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-indigo-800 text-lg">
            <Sparkles className="size-5 text-indigo-600" />
            Sugestões da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-indigo-900/80 leading-relaxed">
            Com base nos dados desta semana, o serviço mais buscado é a <strong>Vacina V10</strong>. 
            <br/><br/>
            <strong>Sugestão de Campanha:</strong> Crie um disparo no WhatsApp para clientes cujos pets estão com a vacina atrasada, oferecendo um pacote de "Checkup Clínico + Vacina V10" com condição especial válida até o final do mês.
          </p>
        </CardContent>
      </Card>

      {/* Resumo Inteligente */}
      <Card className="border-slate-200 shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
            <BrainCircuit className="size-5 text-emerald-600" />
            Resumo Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <ChevronRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <span><strong>32%</strong> das conversas desta semana foram sobre vacinas.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <span><strong>Segunda-feira</strong> foi o dia com maior procura por V10.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <span><strong>18 tutores</strong> perguntaram sobre exame de sangue.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <span><strong>7 urgências</strong> ficaram aguardando humano por mais de 10 minutos.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <span><strong>Castração</strong> teve aumento de 22% nas buscas.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Atendimentos" value={metrics.atendimentos} />
        <MetricCard label="Urgências" value={metrics.urgencias} />
        <MetricCard label="Espera prolongada" value={metrics.esperaProlongada} tone="urgent" />
        <MetricCard label="Pedidos de preço" value={metrics.precos} />
        <MetricCard label="Pedidos de consulta" value={metrics.consultas} />
        <MetricCard label="Pedidos de vacina" value={metrics.vacinas} />
        <MetricCard label="Pedidos de exame" value={exames.length} />
        <MetricCard label="Pedidos de internação" value={internacoes.length} />
        <MetricCard label="Tempo médio até humano" value="—" />
        <MetricCard label="Conversas finalizadas pela IA" value={metrics.finalizadasIA} tone="success" />
        <MetricCard label="Assumidas pela recepção" value={metrics.assumidas} />
        <MetricCard label="Motivo mais comum" value={metrics.topMotivo} />
        <MetricCard label="Atendimentos por unidade" value={unidades.length} hint="unidades ativas" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assuntos mais falados */}
        <Card>
          <CardHeader>
            <CardTitle>Assuntos mais falados</CardTitle>
            <CardDescription>Volume de mensagens por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockAssuntos} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'currentColor' }} width={80} />
                  <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="var(--color-primary, #10b981)" radius={[0, 4, 4, 0]}>
                    {mockAssuntos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : "#6ee7b7"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Dias com maior procura */}
        <Card>
          <CardHeader>
            <CardTitle>Dias com maior procura</CardTitle>
            <CardDescription>Tendência de atendimentos ao longo da semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockDias} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Horários de pico */}
        <Card>
          <CardHeader>
            <CardTitle>Horários de pico</CardTitle>
            <CardDescription>Volume de mensagens por horário do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockHorarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="volume" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Serviços mais buscados e Palavras-chave */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Serviços mais buscados</CardTitle>
              <CardDescription>Ranking de serviços com base nas menções</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockServicos.map((svc) => (
                  <div key={svc.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{svc.name}</span>
                      <span className="text-slate-500 font-semibold">{svc.perc}%</span>
                    </div>
                    <Progress value={svc.perc} className="h-2 bg-slate-100" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Palavras-chave recorrentes</CardTitle>
              <CardDescription>Termos mais digitados pelos clientes nas mensagens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mockPalavras.map((palavra, i) => (
                  <Badge 
                    key={palavra} 
                    variant={i < 3 ? "default" : "secondary"}
                    className="text-sm px-3 py-1 font-normal"
                  >
                    {palavra}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
