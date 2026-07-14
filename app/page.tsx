"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  Headphones,
  LayoutDashboard,
  LineChart,
  Lock,
  MessageCircle,
  Languages,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Target,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";

const appConfig = {
  productName: "Uai Telecom",
  logoText: "U",
  company: "Supervisao IA",
  colors: {
    accent: "#ef2b2d",
    success: "#ffffff",
    warning: "#f28b8d",
    danger: "#ef2b2d",
    violet: "#a3a3a3",
  },
};

type Sector = "Comercial" | "Atendimento" | "Retencao";
type Channel = "WhatsApp" | "Chatbot" | "Audio" | "Ligacao" | "Multicanal";
type ReviewStatus = "Pendente" | "Revisado" | "Contestado" | "Atribuido";
type AlertStatus = "Aberto" | "Reconhecido" | "Resolvido";

type Conversation = {
  id: string;
  protocol: string;
  start: Date;
  end: Date;
  client: string;
  maskedPhone: string;
  attendant: string;
  team: string;
  sector: Sector;
  channel: Channel;
  duration: number;
  classification: string;
  eligible: boolean;
  ineligibleReason: string;
  score: number;
  adherence: number;
  sentiment: "Baixa tensao" | "Atencao" | "Critico";
  resolution: "Resolvido" | "Parcial" | "Nao resolvido" | "Indeterminado";
  recurrences: number;
  alerts: string[];
  reviewStatus: ReviewStatus;
  confidence: number;
  processVersion: string;
  process: string;
  firstResponse: number;
  responseTime: number;
  isMultichannelCase: boolean;
};

type AlertItem = {
  id: string;
  type: string;
  severity: "Critico" | "Alto" | "Medio" | "Baixo";
  owner: string;
  due: string;
  status: AlertStatus;
  evidence: string;
  conversationId: string;
};

type ProcessStep = {
  name: string;
  weight: number;
  status: "Cumpriu" | "Nao cumpriu" | "Nao aplicavel" | "Incerto";
  score: number;
  evidence: string;
  guidance: string;
};

type UserRole = "Administrador" | "Gestor" | "Operador";

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  team: string;
  status: "Ativo" | "Bloqueado";
};

type ManagedProcess = {
  id: number;
  name: string;
  sector: Sector;
  status: "Rascunho" | "Em revisao" | "Publicado" | "Arquivado";
  objective: string;
  steps: Array<{ name: string; weight: number; criterion: string }>;
};

type IntegrationConfig = {
  provider: "Blip" | "OpenAI" | "PBX SSH";
  status: "Nao configurado" | "Configurado" | "Erro";
  fields: Record<string, string>;
};

type ActionToast = {
  title: string;
  body: string;
};

type ManagedClassification = {
  value: string;
  label: string;
  description: string;
  active: boolean;
  nonScore: boolean;
  resolved: boolean;
};

type AgentRankingRow = {
  name: string;
  team: string;
  volume: number;
  score: number;
  adherence: number;
  trend: string;
};

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  facts?: string[];
  sources?: string[];
};

type AgentThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AgentMessage[];
};

const attendantNames = [
  "Ana Costa",
  "Bruno Lima",
  "Carla Souza",
  "Diego Rocha",
  "Elisa Martins",
  "Fabio Duarte",
  "Giovana Reis",
  "Henrique Alves",
  "Isabela Nunes",
  "Joao Pedro",
  "Karina Melo",
  "Lucas Moura",
  "Marina Lopes",
  "Nicolas Prado",
  "Olivia Freitas",
  "Paulo Rios",
  "Renata Campos",
  "Samuel Torres",
  "Tais Ribeiro",
  "Vitor Sales",
];

const classificationBySector: Record<Sector, string[]> = {
  Comercial: [
    "Venda concluida",
    "Lead potencial em andamento",
    "Sem cobertura",
    "Cliente parou de responder",
    "Contato invalido",
    "Sem interesse",
    "Retorno agendado",
  ],
  Atendimento: [
    "Resolvido no primeiro contato",
    "Escalado para visita tecnica",
    "OS aberta",
    "Aguardando cliente",
    "Nao resolvido",
    "Orientacao de upgrade",
  ],
  Retencao: [
    "Retido",
    "Cancelado",
    "Pendente",
    "Mudanca sem cobertura",
    "Preco",
    "Instabilidade/conexao",
    "Insatisfacao com atendimento",
  ],
};

const processSteps: Record<Sector, ProcessStep[]> = {
  Comercial: [
    {
      name: "Saudacao e identificacao",
      weight: 1,
      status: "Cumpriu",
      score: 9.4,
      evidence: "00:12 - 'Boa tarde, meu nome e Ana, falo da Uai Fibra.'",
      guidance: "Mantenha identificacao clara no primeiro contato.",
    },
    {
      name: "Descoberta da necessidade",
      weight: 2,
      status: "Nao cumpriu",
      score: 4.8,
      evidence: "01:40 - Plano foi ofertado antes de validar uso e dor.",
      guidance: "Pergunte uso, quantidade de pessoas e problema atual antes da oferta.",
    },
    {
      name: "Validacao de cobertura",
      weight: 2,
      status: "Cumpriu",
      score: 10,
      evidence: "03:08 - Consulta de cobertura registrada no IXC simulado.",
      guidance: "Continue confirmando endereco antes da proposta.",
    },
    {
      name: "Tratamento de objecoes",
      weight: 2,
      status: "Incerto",
      score: 6.6,
      evidence: "06:18 - Cliente mencionou preco, mas nao houve comparacao de valor.",
      guidance: "Conecte preco a beneficio e necessidade observada.",
    },
  ],
  Atendimento: [
    {
      name: "Acolhimento e empatia",
      weight: 1,
      status: "Cumpriu",
      score: 9.2,
      evidence: "00:22 - Atendente reconheceu a frustracao do cliente.",
      guidance: "Boa abertura; mantenha tom calmo.",
    },
    {
      name: "Diagnostico e testes",
      weight: 3,
      status: "Cumpriu",
      score: 8.6,
      evidence: "02:31 - Teste de sinal e reinicio do roteador orientados.",
      guidance: "Registre resultados do teste no protocolo.",
    },
    {
      name: "Confirmacao de resolucao",
      weight: 2,
      status: "Nao cumpriu",
      score: 4.2,
      evidence: "08:10 - Atendimento encerrado sem perguntar se a conexao voltou.",
      guidance: "Antes de encerrar, confirme se o problema do cliente foi resolvido.",
    },
    {
      name: "Escalonamento ou OS",
      weight: 2,
      status: "Cumpriu",
      score: 8.8,
      evidence: "09:02 - OS 74821 aberta para visita tecnica.",
      guidance: "Informe prazo e proxima etapa com clareza.",
    },
  ],
  Retencao: [
    {
      name: "Motivo do cancelamento",
      weight: 3,
      status: "Cumpriu",
      score: 9.1,
      evidence: "00:54 - Cliente informou instabilidade recorrente.",
      guidance: "Classifique motivo antes de propor desconto.",
    },
    {
      name: "Consulta historico e OS",
      weight: 2,
      status: "Cumpriu",
      score: 8.3,
      evidence: "02:19 - Historico de 3 OS em 14 dias consultado.",
      guidance: "Relacione visitas anteriores ao plano de acao.",
    },
    {
      name: "Tratar causa antes do desconto",
      weight: 3,
      status: "Nao cumpriu",
      score: 3.8,
      evidence: "04:16 - Desconto ofertado sem plano tecnico para instabilidade.",
      guidance: "Resolva a causa raiz antes de negociar preco.",
    },
    {
      name: "Confirmar decisao e desfecho",
      weight: 1,
      status: "Cumpriu",
      score: 8.9,
      evidence: "08:44 - Cliente aceitou visita e retorno em 48h.",
      guidance: "Registre compromisso e responsavel.",
    },
  ],
};

const pendingDecisions = [
  "Consulta de gravacoes depende do acesso SSH ao servidor PBX e das permissoes de leitura nos diretorios de chamadas.",
  "Campos IXC e correlacao de OS dependem da integracao real.",
  "Janela multicanal esta configurada em 24 horas e precisa validacao.",
  "OCR de documentos pessoais fica bloqueado na versao inicial por LGPD.",
  "Credenciais da Blip, OpenAI e PBX devem ser guardadas como segredo no ambiente de producao.",
];

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

function pick<T>(items: T[], seed: number) {
  return items[Math.floor(pseudoRandom(seed) * items.length) % items.length];
}

function generateConversations(): Conversation[] {
  const rows: Conversation[] = [];
  const today = new Date("2026-07-11T12:00:00-03:00");

  for (let index = 0; index < 1000; index += 1) {
    const sector = pick<Sector>(["Comercial", "Atendimento", "Retencao"], index + 2);
    const channel = pick<Channel>(
      ["WhatsApp", "Chatbot", "Audio", "Ligacao", "Multicanal"],
      index + 7,
    );
    const attendant = attendantNames[index % attendantNames.length];
    const team =
      sector === "Comercial"
        ? "Comercial Norte"
        : sector === "Atendimento"
          ? pick(["Suporte N1", "Qualidade"], index + 9)
          : "Retencao";
    const daysAgo = Math.floor(pseudoRandom(index + 11) * 90);
    const start = new Date(today);
    start.setDate(today.getDate() - daysAgo);
    start.setHours(8 + Math.floor(pseudoRandom(index + 13) * 11));
    start.setMinutes(Math.floor(pseudoRandom(index + 17) * 60));
    const duration = 4 + Math.floor(pseudoRandom(index + 19) * 42);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const eligible =
      !["Sem cobertura", "Contato invalido", "Cliente parou de responder"].includes(
        pick(classificationBySector[sector], index + 23),
      ) || pseudoRandom(index + 3) > 0.55;
    const base = 3 + pseudoRandom(index + 29) * 7;
    const score = eligible ? Number(base.toFixed(1)) : Number((4.5 + pseudoRandom(index) * 3).toFixed(1));
    const adherence = eligible
      ? Math.min(99, Math.round(score * 9.5 + pseudoRandom(index + 31) * 9))
      : Math.round(42 + pseudoRandom(index + 32) * 30);
    const classification = pick(classificationBySector[sector], index + 23);
    const recurrences =
      index % 57 === 0 ? 6 : index % 19 === 0 ? 3 : Math.floor(pseudoRandom(index + 37) * 2);
    const hasCriticalAlert = score < 5.2 || recurrences >= 3 || index % 41 === 0;

    rows.push({
      id: `att-${String(index + 1).padStart(4, "0")}`,
      protocol: `UAI-${String(93000 + index)}`,
      start,
      end,
      client: index % 57 === 0 ? "Cliente com reincidencia alta" : `Cliente ${String(index + 1).padStart(4, "0")}`,
      maskedPhone: `(**) *****-${String(1000 + (index * 37) % 8999)}`,
      attendant,
      team,
      sector,
      channel,
      duration,
      classification,
      eligible,
      ineligibleReason: eligible
        ? "Elegivel para avaliacao"
        : classification === "Sem cobertura"
          ? "Lead sem cobertura nao penaliza conversao"
          : "Interacao sem resposta suficiente do cliente",
      score,
      adherence,
      sentiment:
        hasCriticalAlert && score < 5.2
          ? "Critico"
          : recurrences >= 3
            ? "Atencao"
            : "Baixa tensao",
      resolution:
        sector === "Comercial"
          ? classification === "Venda concluida"
            ? "Resolvido"
            : classification === "Lead potencial em andamento"
              ? "Parcial"
              : "Indeterminado"
          : score > 7.5
            ? "Resolvido"
            : score > 5.5
              ? "Parcial"
              : "Nao resolvido",
      recurrences,
      alerts: hasCriticalAlert
        ? [
            score < 5.2 ? "Nota abaixo do limite" : "Alta reincidencia",
            index % 41 === 0 ? "Baixa confianca da IA" : "Risco operacional",
          ]
        : [],
      reviewStatus:
        index % 31 === 0
          ? "Contestado"
          : index % 13 === 0
            ? "Atribuido"
            : index % 5 === 0
              ? "Revisado"
              : "Pendente",
      confidence: Number((0.62 + pseudoRandom(index + 43) * 0.36).toFixed(2)),
      processVersion: `${sector.toLowerCase()}-v${1 + (index % 3)}.${index % 4}`,
      process: `Processo ${sector}`,
      firstResponse: 1 + Math.floor(pseudoRandom(index + 47) * 18),
      responseTime: 3 + Math.floor(pseudoRandom(index + 53) * 28),
      isMultichannelCase: channel === "Multicanal" || index % 57 === 0,
    });
  }

  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trend(now: number, previous: number) {
  const delta = now - previous;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
}

function buildAlerts(conversations: Conversation[]): AlertItem[] {
  return conversations
    .filter((conversation) => conversation.alerts.length > 0)
    .slice(0, 32)
    .map((conversation, index) => ({
      id: `alert-${index + 1}`,
      type: conversation.alerts[0],
      severity:
        conversation.score < 4.8 || conversation.recurrences >= 5
          ? "Critico"
          : conversation.score < 6
            ? "Alto"
            : conversation.confidence < 0.72
              ? "Medio"
              : "Baixo",
      owner: index % 3 === 0 ? "Gestor Suporte" : index % 3 === 1 ? "Qualidade" : "Comercial",
      due: index % 2 === 0 ? "Hoje" : "Amanha",
      status: index % 5 === 0 ? "Resolvido" : index % 3 === 0 ? "Reconhecido" : "Aberto",
      evidence: `${conversation.protocol}: ${conversation.alerts.join(", ")}`,
      conversationId: conversation.id,
    }));
}

const navItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard, count: 0 },
  { id: "conversations", label: "Conversas", icon: MessageCircle, count: 0 },
  { id: "agents", label: "Atendentes", icon: Users, count: 0 },
  { id: "kpis", label: "KPIs", icon: BarChart3, count: 0 },
  { id: "adherence", label: "Aderencia ao Script", icon: ClipboardCheck, count: 0 },
  { id: "recurrence", label: "Reincidencia", icon: RefreshCw, count: 0 },
  { id: "ai", label: "Agente de IA", icon: Bot, count: 0 },
  { id: "processes", label: "Processos", icon: FileText, count: 0 },
  { id: "classifications", label: "Classificacoes", icon: Target, count: 0 },
  { id: "alerts", label: "Alertas", icon: Bell, count: 0 },
];

const adminNavItems = [
  { id: "integrations", label: "Integracoes", icon: Activity, count: 0 },
  { id: "admin", label: "Administracao", icon: Settings, count: 0 },
];

export default function Home() {
  const conversations = useMemo(() => generateConversations(), []);
  const alerts = useMemo(() => buildAlerts(conversations), [conversations]);
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("Gestor");
  const [period, setPeriod] = useState("Mes atual");
  const [sector, setSector] = useState("Atendimento");
  const [channel, setChannel] = useState("Todos");
  const [search, setSearch] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [page, setPage] = useState(1);
  const [loadingState, setLoadingState] = useState<"ready" | "loading" | "error" | "empty">("ready");
  const [agentQuestion, setAgentQuestion] = useState("");
  const [toast, setToast] = useState<ActionToast | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [customPeriodOpen, setCustomPeriodOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [language, setLanguage] = useState<"PT" | "ES">("PT");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([
    { id: 1, name: "Gabriel Coordenador", email: "gestor@uaitelecom.com.br", role: "Gestor", team: "Qualidade", status: "Ativo" },
    { id: 2, name: "Ana Operadora", email: "ana@uaitelecom.com.br", role: "Operador", team: "Suporte N1", status: "Ativo" },
  ]);
  const [managedProcesses, setManagedProcesses] = useState<ManagedProcess[]>([
    {
      id: 1,
      name: "Atendimento - Suporte N1",
      sector: "Atendimento",
      status: "Publicado",
      objective: "Validar se o operador diagnosticou, registrou e confirmou a resolucao do problema.",
      steps: [
        { name: "Acolhimento", weight: 1, criterion: "Saudacao, empatia e identificacao do cliente." },
        { name: "Confirmacao de resolucao", weight: 2, criterion: "Perguntar se o problema foi resolvido antes de encerrar." },
      ],
    },
  ]);
  const [integrationConfigs, setIntegrationConfigs] = useState<IntegrationConfig[]>([
    { provider: "Blip", status: "Nao configurado", fields: { endpoint: "", botId: "", token: "" } },
    { provider: "OpenAI", status: "Nao configurado", fields: { model: "gpt-4.1-mini", apiKeyRef: "OPENAI_API_KEY" } },
    { provider: "PBX SSH", status: "Nao configurado", fields: { host: "", port: "22", username: "", recordingsPath: "/var/spool/asterisk/monitor" } },
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const query = params.get("q");
    const nextSector = params.get("sector");
    queueMicrotask(() => {
      if (view) setActiveView(view);
      if (query) setSearch(query);
      if (nextSector) setSector(nextSector);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", activeView);
    if (search) params.set("q", search);
    if (sector !== "Todos") params.set("sector", sector);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [activeView, search, sector]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeView]);

  const filtered = useMemo(() => {
    const periodDays = period === "Hoje" ? 1 : period === "Semana atual" || period === "7 dias" ? 7 : period === "14 dias" ? 14 : period === "Mes atual" ? 30 : 90;
    const maxDate = conversations[0]?.start ?? new Date();
    const minDate = new Date(maxDate);
    minDate.setDate(maxDate.getDate() - periodDays);
    return conversations.filter((conversation) => {
      const matchesPeriod = conversation.start >= minDate;
      const matchesSector = sector === "Todos" || conversation.sector === sector;
      const matchesChannel = channel === "Todos" || conversation.channel === channel;
      const matchesEligible = !onlyEligible || conversation.eligible;
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        [
          conversation.client,
          conversation.protocol,
          conversation.attendant,
          conversation.classification,
          conversation.sector,
          conversation.channel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesPeriod && matchesSector && matchesChannel && matchesEligible && matchesSearch;
    });
  }, [channel, conversations, onlyEligible, period, search, sector]);

  const selected = filtered.find((conversation) => conversation.id === selectedId) ?? filtered[0] ?? conversations[0];

  const trendData = useMemo(() => {
    const buckets = new Map<string, { date: string; volume: number; scoreTotal: number; adherenceTotal: number }>();
    filtered.forEach((conversation) => {
      const label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(conversation.start);
      const current = buckets.get(label) ?? { date: label, volume: 0, scoreTotal: 0, adherenceTotal: 0 };
      current.volume += 1;
      current.scoreTotal += conversation.score;
      current.adherenceTotal += conversation.adherence;
      buckets.set(label, current);
    });
    return Array.from(buckets.values())
      .slice(0, 14)
      .reverse()
      .map((bucket) => ({
        date: bucket.date,
        volume: bucket.volume,
        nota: Number((bucket.scoreTotal / bucket.volume).toFixed(1)),
        aderencia: Math.round(bucket.adherenceTotal / bucket.volume),
      }));
  }, [filtered]);

  const classificationData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((conversation) => counts.set(conversation.classification, (counts.get(conversation.classification) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filtered]);

  const attendantRanking = useMemo(() => {
    return attendantNames
      .map((name) => {
        const rows = filtered.filter((conversation) => conversation.attendant === name && conversation.eligible);
        return {
          name,
          team: rows[0]?.team ?? "Sem amostra",
          volume: rows.length,
          score: average(rows.map((conversation) => conversation.score)),
          adherence: average(rows.map((conversation) => conversation.adherence)),
          trend: trend(average(rows.slice(0, 5).map((conversation) => conversation.score)), average(rows.slice(5, 10).map((conversation) => conversation.score))),
        };
      })
      .filter((row) => row.volume > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [filtered]);

  const paginated = filtered.slice((page - 1) * 12, page * 12);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const notifications = useMemo(
    () => [
      ...alerts.slice(0, 8).map((alert) => ({
        id: alert.id,
        title: alert.type,
        body: alert.evidence,
        view: "alerts",
        targetId: alert.conversationId,
      })),
      ...filtered
        .filter((row) => row.recurrences >= 3)
        .slice(0, 5)
        .map((row) => ({
          id: `rec-${row.id}`,
          title: "Reincidencia alta",
          body: `${row.client}: ${row.recurrences} contatos em 14 dias`,
          view: "recurrence",
          targetId: row.id,
        })),
      ...managedProcesses
        .filter((process) => process.status !== "Publicado")
        .map((process) => ({
          id: `proc-${process.id}`,
          title: "Processo pendente",
          body: `${process.name} esta em ${process.status}`,
          view: "processes",
          targetId: String(process.id),
        })),
    ],
    [alerts, filtered, managedProcesses],
  );
  const unreadNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id));
  const operationalSector: Sector = sector === "Comercial" ? "Comercial" : sector === "Retencao" ? "Retencao" : "Atendimento";
  const peopleLabel = operationalSector === "Comercial" ? "Vendedores" : "Atendentes";
  const navLabel = (id: string, fallback: string) => id === "agents" ? peopleLabel : fallback;
  const navCounts = useMemo(
    () => ({
      conversations: filtered.filter((row) => row.reviewStatus === "Pendente").length,
      commercial: filtered.filter((row) => row.sector === "Comercial" && row.alerts.length).length,
      support: filtered.filter((row) => row.sector === "Atendimento" && row.alerts.length).length,
      retention: filtered.filter((row) => row.sector === "Retencao" && row.alerts.length).length,
      recurrence: filtered.filter((row) => row.recurrences >= 3).length,
      agents: attendantRanking.filter((row) => row.volume > 0).length,
      operator: filtered.filter((row) => row.attendant === "Ana Costa" && row.reviewStatus !== "Revisado").length,
      alerts: unreadNotifications.length,
      processes: managedProcesses.filter((process) => process.status !== "Publicado").length,
      integrations: integrationConfigs.filter((integration) => integration.status !== "Configurado").length,
    }),
    [attendantRanking, filtered, integrationConfigs, managedProcesses, unreadNotifications.length],
  );
  const activeTitle =
    activeView === "detail"
      ? "Detalhe do atendimento"
      : activeView === "operator"
        ? "Meu painel"
        : activeView === "agents"
          ? peopleLabel
          : [...navItems, ...adminNavItems].find((item) => item.id === activeView)?.label ?? "Dashboard";
  const activeSubtitle: Record<string, string> = {
    overview: operationalSector === "Comercial" ? "Visao geral da performance comercial" : operationalSector === "Retencao" ? "Visao geral da retencao e risco de churn" : "Visao geral da performance de atendimento",
    conversations: "Gerencie e analise conversas de atendimento",
    agents: operationalSector === "Comercial" ? "Acompanhe a performance dos vendedores" : "Acompanhe a performance dos atendentes",
    kpis: "Indicadores de performance da equipe",
    adherence: "Analise de execucao das etapas dos processos",
    recurrence: "Clientes que voltaram ao atendimento - sinal de FCR e risco de churn",
    ai: "Pergunte sobre seus dados, KPIs, alertas e muito mais",
    processes: "Configure os processos que a IA utiliza para avaliar conversas",
    classifications: "Gerencie as classificacoes usadas pela IA",
    alerts: "Insights gerados pelo Auditor IA sobre a performance da equipe",
    integrations: "Conecte Blip, OpenAI e o servidor PBX",
    admin: "Usuarios, perfis e acessos da Uai Telecom",
    operator: "Seu resumo de atendimentos, feedbacks e pendencias",
  };

  const notify = (title: string, body: string) => {
    setToast({ title, body });
    window.setTimeout(() => setToast(null), 3600);
  };

  const persistAction = (action: string, targetType: string, targetId: string, note: string) => {
    fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetType, targetId, note }),
    }).catch(() => undefined);
  };

  const openNotification = (notification: (typeof notifications)[number]) => {
    setReadNotificationIds((ids) => Array.from(new Set([...ids, notification.id])));
    setNotificationsOpen(false);
    if (notification.targetId.startsWith("att-")) setSelectedId(notification.targetId);
    setActiveView(notification.view);
    persistAction("mark_notification_read", "notification", notification.id, notification.title);
  };

  const openMetric = (label: string) => {
    if (label.includes("Alerta")) {
      setFocusedAlertId(null);
      setActiveView("alerts");
      return;
    }
    if (label.includes("Reincid")) {
      setActiveView("recurrence");
      return;
    }
    if (label.includes("Vendedor") || label.includes("Atendente")) {
      setActiveView("agents");
      return;
    }
    setActiveView("conversations");
    if (label.includes("Elegiveis")) setOnlyEligible(true);
  };

  const simulateLoading = (state: "loading" | "error" | "empty") => {
    setLoadingState(state);
    window.setTimeout(() => setLoadingState("ready"), 950);
  };

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Navegacao principal">
        <button className="brand" onClick={() => setActiveView("overview")} aria-label="Ir para visao geral">
          <span className="brand-mark">{appConfig.logoText}</span>
          <span>
            <strong>{appConfig.productName}</strong>
            <small>{appConfig.company}</small>
          </span>
        </button>
        <div className="sidebar-contexts">
          <select value={sector} onChange={(event) => { setSector(event.target.value); setPage(1); setSearch(""); setFocusedAlertId(null); }} aria-label="Area da operacao">
            {["Atendimento", "Comercial", "Retencao", "Todos"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} aria-label="Canal da operacao">
            {["Todos", "WhatsApp", "Chatbot", "Audio", "Ligacao", "Multicanal"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const dynamicCount = navCounts[item.id as keyof typeof navCounts] ?? item.count;
            const label = navLabel(item.id, item.label);
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => {
                  setActiveView(item.id);
                  setSidebarOpen(false);
                }}
                title={label}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {dynamicCount > 0 ? <b>{dynamicCount}</b> : null}
              </button>
            );
          })}
        </nav>
        {userRole === "Administrador" ? (
          <nav className="admin-nav" aria-label="Administracao">
            <small>ADMINISTRACAO</small>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const dynamicCount = navCounts[item.id as keyof typeof navCounts] ?? item.count;
              return (
                <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)} title={item.label}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {dynamicCount > 0 ? <b>{dynamicCount}</b> : null}
                </button>
              );
            })}
          </nav>
        ) : null}
        <div className="sidebar-footer">
          <button className="sidebar-collapse" onClick={() => setSidebarCollapsed((value) => !value)} title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{sidebarCollapsed ? "Expandir menu" : "Recolher menu"}</span>
          </button>
          <button className="sidebar-language" onClick={() => setLanguage((value) => value === "PT" ? "ES" : "PT")} title="Idioma">
            <Languages size={18} />
            <span>{language === "PT" ? "Portugues" : "Espanol"}</span>
            <b>{language}</b>
          </button>
          <button className="sidebar-user" onClick={() => setUserMenuOpen((open) => !open)} aria-label="Menu do usuario">
            <span className="avatar">{userRole === "Operador" ? "OP" : userRole === "Administrador" ? "AD" : "GT"}</span>
            <span><strong>Hiago Nunes</strong><small>{userRole}</small></span>
            <ChevronRight size={16} />
          </button>
          {userMenuOpen ? (
            <div className="popover sidebar-user-popover">
              <strong>Visualizacao atual</strong>
              <select value={userRole} onChange={(event) => setUserRole(event.target.value as UserRole)}>
                <option>Administrador</option>
                <option>Gestor</option>
                <option>Operador</option>
              </select>
              <button onClick={() => { setActiveView("operator"); setUserMenuOpen(false); }}>Meu resumo</button>
              <button onClick={() => { setUserRole("Administrador"); setActiveView("admin"); setUserMenuOpen(false); }}>Administracao</button>
              <button onClick={() => notify("Sessao encerrada", "O fluxo de saida foi validado. A autenticacao real sera conectada no deploy.")}><LogOut size={16} /> Sair</button>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu size={18} />
          </button>
          <button className="language-control" onClick={() => setLanguage((value) => value === "PT" ? "ES" : "PT")}>
            <Languages size={16} />
            {language === "PT" ? "Portugues" : "Espanol"}
          </button>
          <div className="period-control" role="group" aria-label="Periodo">
            {["Hoje", "Semana atual", "Mes atual"].map((item) => (
              <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>
            ))}
            <button className={customPeriodOpen ? "active custom-period" : "custom-period"} onClick={() => setCustomPeriodOpen(true)}>
              <CalendarDays size={15} /> Periodo customizado
            </button>
          </div>
          <button className="icon-button notification-button" aria-label="Notificacoes" onClick={() => setNotificationsOpen((open) => !open)}>
            <Bell size={18} />
            {unreadNotifications.length > 0 ? <b>{unreadNotifications.length}</b> : null}
          </button>
          {notificationsOpen ? (
            <div className="popover notifications-popover">
              <strong>Notificacoes nao vistas</strong>
              {notifications.slice(0, 12).map((notification) => (
                <button
                  key={notification.id}
                  className={readNotificationIds.includes(notification.id) ? "read" : ""}
                  onClick={() => openNotification(notification)}
                >
                  <span>{notification.title}</span>
                  <small>{notification.body}</small>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="view-header">
          <div>
            <h1>{activeTitle}</h1>
            <p>{activeSubtitle[activeView] ?? "Supervisao operacional da Uai Telecom"}</p>
          </div>
          <div className="header-actions view-tools">
            <label className="toggle">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(event) => setOnlyEligible(event.target.checked)}
              />
              Apenas elegiveis
            </label>
            <button className="icon-button" onClick={() => simulateLoading("loading")} title="Atualizar">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loadingState !== "ready" ? (
          <StatePanel state={loadingState} />
        ) : (
          <div className="view-transition" key={`${activeView}-${operationalSector}`}>
            {activeView === "overview" && (
              <Overview
                onMetricClick={openMetric}
                trendData={trendData}
                classificationData={classificationData}
                ranking={attendantRanking}
                alerts={alerts.filter((alert) => alert.status === "Aberto")}
                filteredCount={filtered.length}
                rows={filtered}
                sector={operationalSector}
                onAlertClick={(alertId) => {
                  setFocusedAlertId(alertId);
                  setActiveView("alerts");
                }}
              />
            )}
            {activeView === "conversations" && (
              <Conversations
                rows={paginated}
                total={filtered.length}
                page={page}
                totalPages={totalPages}
                selectedId={selected?.id}
                onPage={setPage}
                onOpen={(id) => {
                  setSelectedId(id);
                  setActiveView("detail");
                }}
                onAssign={(id) => setSelectedId(id)}
              />
            )}
            {activeView === "detail" && selected && <ConversationDetail conversation={selected} onNotify={notify} />}
            {["commercial", "support", "retention"].includes(activeView) && (
              <SectorView
                sector={activeView === "commercial" ? "Comercial" : activeView === "support" ? "Atendimento" : "Retencao"}
                rows={filtered}
                onOpen={(id) => {
                  setSelectedId(id);
                  setActiveView("detail");
                }}
              />
            )}
            {activeView === "recurrence" && <Recurrence rows={filtered} sector={operationalSector} onOpen={(id) => { setSelectedId(id); setActiveView("detail"); }} />}
            {activeView === "agents" && <Agents ranking={attendantRanking} rows={filtered} sector={operationalSector} />}
            {activeView === "kpis" && <Kpis ranking={attendantRanking} rows={filtered} sector={operationalSector} />}
            {activeView === "operator" && <OperatorPanel rows={filtered.filter((row) => row.attendant === "Ana Costa")} onOpen={(id) => { setSelectedId(id); setActiveView("detail"); }} />}
            {activeView === "adherence" && <Adherence rows={filtered} onOpen={(id) => { setSelectedId(id); setActiveView("detail"); }} />}
            {activeView === "alerts" && <AlertsCenter alerts={alerts} focusAlertId={focusedAlertId} onOpen={(id) => { setSelectedId(id); setActiveView("detail"); }} onNotify={notify} />}
            {activeView === "ai" && (
              <AiAgent
                rows={filtered}
                ranking={attendantRanking}
                alerts={alerts}
                period={period}
              />
            )}
            {activeView === "processes" && <Processes processes={managedProcesses} setProcesses={setManagedProcesses} onNotify={notify} />}
            {activeView === "classifications" && <Classifications sector={operationalSector} onNotify={notify} />}
            {activeView === "reports" && <Reports rows={filtered} />}
            {activeView === "integrations" && <Integrations configs={integrationConfigs} setConfigs={setIntegrationConfigs} onNotify={notify} />}
            {activeView === "admin" && (
              <Admin
                users={managedUsers}
                setUsers={setManagedUsers}
                configs={integrationConfigs}
                setConfigs={setIntegrationConfigs}
                onNotify={notify}
              />
            )}
          </div>
        )}
        {customPeriodOpen ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setCustomPeriodOpen(false)}>
            <section className="date-modal" role="dialog" aria-modal="true" aria-label="Periodo customizado" onClick={(event) => event.stopPropagation()}>
              <header><div><strong>Periodo customizado</strong><small>Escolha a data inicial e final</small></div><button className="icon-button" onClick={() => setCustomPeriodOpen(false)} title="Fechar"><X size={17} /></button></header>
              <div className="date-fields"><label>Data inicial<input type="date" defaultValue="2026-07-01" /></label><label>Data final<input type="date" defaultValue="2026-07-13" /></label></div>
              <div className="form-actions"><button onClick={() => { setPeriod("Periodo customizado"); setCustomPeriodOpen(false); notify("Periodo aplicado", "Os indicadores foram atualizados para 01/07/2026 a 13/07/2026."); }}>Aplicar periodo</button></div>
            </section>
          </div>
        ) : null}
        {activeView !== "ai" ? (
          <>
            <button className="assistant-fab" onClick={() => setAssistantOpen((open) => !open)} title={assistantOpen ? "Fechar Agente de IA" : "Abrir Agente de IA"}>
              {assistantOpen ? <X size={22} /> : <Bot size={22} />}
            </button>
            {assistantOpen ? (
              <aside className="assistant-panel" aria-label="Agente de IA">
                <header><span><Bot size={19} /></span><div><strong>Agente de IA</strong><small>Uai Assistant</small></div><button className="icon-button" onClick={() => setAssistantOpen(false)} title="Fechar"><X size={17} /></button></header>
                <div className="assistant-body">
                  <div className="assistant-welcome"><Bot size={28} /><strong>Como posso ajudar?</strong><p>Pergunte sobre operadores, conversoes, alertas ou metricas.</p></div>
                  {["Qual meu melhor operador esta semana?", "Quais sao as principais objecoes?", "Qual a projecao para o proximo mes?", "Tem algum alerta critico?"].map((prompt) => (
                    <button key={prompt} onClick={() => setAgentQuestion(prompt)}>{prompt}</button>
                  ))}
                  {agentQuestion ? <div className="assistant-answer"><strong>{agentQuestion}</strong><p>Encontrei dados relacionados no periodo atual. A integracao OpenAI podera substituir esta resposta demonstrativa mantendo as mesmas fontes e permissoes.</p></div> : null}
                </div>
                <footer><input value={agentQuestion} onChange={(event) => setAgentQuestion(event.target.value)} placeholder="Digite sua pergunta..." /><button className="icon-button" onClick={() => notify("Pergunta enviada", "O agente consultou os dados disponiveis.")} title="Enviar"><Send size={17} /></button></footer>
              </aside>
            ) : null}
          </>
        ) : null}
        {toast ? (
          <div className="toast" role="status">
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatePanel({ state }: { state: "loading" | "error" | "empty" }) {
  if (state === "loading") {
    return (
      <div className="grid skeleton-grid" role="status" aria-live="polite">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="skeleton-card" key={index} />
        ))}
      </div>
    );
  }

  return (
    <section className="state-panel">
      {state === "error" ? <AlertTriangle size={28} /> : <Search size={28} />}
      <h2>{state === "error" ? "Erro recuperavel na integracao" : "Nenhum resultado para os filtros"}</h2>
      <p>
        {state === "error"
          ? "O conector simulado retornou falha temporaria. A fila preserva idempotencia e permite tentar novamente."
          : "A busca nao encontrou atendimentos com estes filtros. Limpe filtros ou salve esta visualizacao vazia."}
      </p>
      <button> Tentar novamente </button>
    </section>
  );
}

function Overview({
  onMetricClick,
  trendData,
  classificationData,
  ranking,
  alerts,
  filteredCount,
  rows,
  sector,
  onAlertClick,
}: {
  onMetricClick: (label: string) => void;
  trendData: Array<{ date: string; volume: number; nota: number; aderencia: number }>;
  classificationData: Array<{ name: string; value: number }>;
  ranking: Array<{ name: string; team: string; volume: number; score: number; adherence: number; trend: string }>;
  alerts: AlertItem[];
  filteredCount: number;
  rows: Conversation[];
  sector: Sector;
  onAlertClick: (alertId: string) => void;
}) {
  const eligible = rows.filter((row) => row.eligible);
  const resolved = rows.filter((row) => row.resolution === "Resolvido");
  const sales = rows.filter((row) => row.classification === "Venda concluida");
  const retained = rows.filter((row) => row.classification === "Retido");
  const recurrent = rows.filter((row) => row.recurrences >= 3);
  const contextualMetrics = sector === "Comercial"
    ? [
        { label: "Leads recebidos", value: String(rows.length), detail: "Conversas comerciais no periodo.", formula: "contagem de leads", icon: MessageCircle },
        { label: "Vendas fechadas", value: String(sales.length), detail: "Classificacao Venda concluida.", formula: "vendas concluidas", icon: Target },
        { label: "Taxa de conversao", value: percent((sales.length / Math.max(eligible.length, 1)) * 100), detail: "Somente leads elegiveis.", formula: "vendas / leads elegiveis", icon: LineChart },
        { label: "Nota comercial", value: average(eligible.map((row) => row.score)).toFixed(1), detail: "Qualidade media das abordagens.", formula: "media das notas elegiveis", icon: Star },
        { label: "Aderencia ao processo", value: percent(average(eligible.map((row) => row.adherence))), detail: "Execucao do roteiro comercial.", formula: "aderencia media", icon: ClipboardCheck },
        { label: "Alertas comerciais", value: String(alerts.length), detail: "Riscos que exigem revisao.", formula: "alertas abertos", icon: AlertTriangle },
      ]
    : sector === "Retencao"
      ? [
          { label: "Atendimentos de retencao", value: String(rows.length), detail: "Contatos tratados no periodo.", formula: "contagem de atendimentos", icon: MessageCircle },
          { label: "Clientes retidos", value: String(retained.length), detail: "Desfecho classificado como Retido.", formula: "retidos", icon: UserCheck },
          { label: "Taxa de retencao", value: percent((retained.length / Math.max(eligible.length, 1)) * 100), detail: "Sobre casos elegiveis.", formula: "retidos / elegiveis", icon: LineChart },
          { label: "Reincidencias", value: String(recurrent.length), detail: "Clientes com 3 ou mais contatos.", formula: "casos reincidentes", icon: RefreshCw },
          { label: "Nota media", value: average(eligible.map((row) => row.score)).toFixed(1), detail: "Qualidade da negociacao.", formula: "media das notas", icon: Star },
          { label: "Alertas de churn", value: String(alerts.length), detail: "Riscos ativos no periodo.", formula: "alertas abertos", icon: AlertTriangle },
        ]
      : [
          { label: "Atendimentos recebidos", value: String(rows.length), detail: "Contatos de suporte no periodo.", formula: "contagem de atendimentos", icon: MessageCircle },
          { label: "Resolvidos", value: String(resolved.length), detail: "Resolvidos com evidencia na conversa.", formula: "desfechos resolvidos", icon: CheckCircle2 },
          { label: "Taxa de resolucao", value: percent((resolved.length / Math.max(rows.length, 1)) * 100), detail: "Resolucao sobre atendimentos analisados.", formula: "resolvidos / analisados", icon: UserCheck },
          { label: "Primeira resposta", value: `${Math.round(average(rows.map((row) => row.firstResponse)))} min`, detail: "Tempo ate a primeira resposta humana.", formula: "media da primeira resposta", icon: Clock3 },
          { label: "Reincidencias", value: String(recurrent.length), detail: "Clientes com 3 ou mais contatos em 14 dias.", formula: "casos reincidentes", icon: RefreshCw },
          { label: "Alertas de atendimento", value: String(alerts.length), detail: "Riscos operacionais em aberto.", formula: "alertas abertos", icon: AlertTriangle },
        ];
  const contextChart = sector === "Comercial"
    ? trendData.map((item) => ({ ...item, resultado: Math.max(0, Math.round(item.volume * 0.22 + item.nota / 3)) }))
    : sector === "Atendimento"
      ? trendData.map((item) => ({ ...item, resultado: Math.min(item.volume, Math.round(item.volume * (item.aderencia / 100))) }))
      : trendData.map((item) => ({ ...item, resultado: Math.max(0, Math.round(item.volume * 0.38)) }));
  const chartTitle = sector === "Comercial" ? "Leads e vendas por periodo" : sector === "Atendimento" ? "Atendimentos e resolucoes por periodo" : "Retencoes por periodo";
  const resultLabel = sector === "Comercial" ? "vendas" : sector === "Atendimento" ? "resolucoes" : "retencoes";
  const peopleTitle = sector === "Comercial" ? "Ranking de vendedores" : "Ranking de atendentes";
  const steps = processSteps[sector].map((step, index) => [step.name, Math.max(42, Math.round(86 - step.weight * 8 - index * 5))] as [string, number]);
  return (
    <div className="stack">
      <section className="metric-grid">
        {contextualMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button className="metric-card" key={metric.label} onClick={() => onMetricClick(metric.label)}>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
              <small title={`Formula: ${metric.formula}. Fonte: dados de demo. Atualizado em 11/07/2026 11:54.`}>{metric.label}</small>
              <strong>{metric.value}</strong>
              <em>{metric.detail}</em>
            </button>
          );
        })}
      </section>

      <section className="content-grid two-one">
        <article className="panel">
          <PanelTitle icon={LineChart} title={chartTitle} subtitle={`${filteredCount} registros analisados; clique nos indicadores para aprofundar.`} />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={contextChart}>
                <CartesianGrid stroke="#292929" vertical={false} />
                <XAxis dataKey="date" stroke="#9a9a9a" />
                <YAxis yAxisId="left" stroke="#9a9a9a" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 10]} stroke="#9a9a9a" />
                <Tooltip contentStyle={{ background: "#151515", border: "1px solid #363636", color: "#fff" }} />
                <Legend />
                <Bar yAxisId="left" dataKey="volume" fill={appConfig.colors.accent} radius={[4, 4, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="resultado" name={resultLabel} stroke={appConfig.colors.success} strokeWidth={3} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <PanelTitle icon={BarChart3} title={sector === "Comercial" ? "Desfechos comerciais" : sector === "Atendimento" ? "Desfechos de atendimento" : "Motivos de retencao"} subtitle="Classificacoes aplicadas no contexto atual." />
          <div className="chart-box small">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={classificationData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={2}>
                  {classificationData.map((_, index) => (
                    <Cell key={index} fill={["#ef2b2d", "#d72228", "#b91f24", "#8f2327", "#6f2a2d", "#5f5f5f", "#8b8b8b"][index % 7]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#211129", border: "1px solid #513160", color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-list">
            {classificationData.slice(0, 5).map((item) => (
              <span key={item.name}>
                <i />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <PanelTitle icon={Users} title={peopleTitle} subtitle="Sinaliza amostra pequena e usa somente atendimentos elegiveis." />
          <div className="ranking-list">
            {ranking.map((row, index) => (
              <div className="ranking-row" key={row.name}>
                <b>{index + 1}</b>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.team} - {row.volume < 8 ? "amostra pequena" : `${row.volume} casos elegiveis`}</small>
                </span>
                <em>{row.score.toFixed(1)}</em>
                <small>{percent(row.adherence)} aderencia</small>
                <small className={Number(row.trend) >= 0 ? "positive" : "negative"}>{row.trend}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelTitle icon={ClipboardCheck} title="Etapas com menor aderencia" subtitle="Clique nas celulas nas telas de aderencia para chegar aos atendimentos." />
          <div className="step-bars">
            {steps.map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <b>{value}%</b>
                <div><i style={{ width: `${value}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelTitle icon={AlertTriangle} title="Alertas recentes" subtitle="Ordenados por severidade, impacto e prazo." />
          <div className="alert-list">
            {alerts.slice(0, 6).map((alert) => (
              <button className={`alert-row ${alert.severity.toLowerCase()}`} key={alert.id} onClick={() => onAlertClick(alert.id)}>
                <span className="alert-severity">{alert.severity}</span>
                <div className="alert-copy">
                  <strong>{alert.type}</strong>
                  <small>{alert.evidence}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Conversations({
  rows,
  total,
  page,
  totalPages,
  selectedId,
  onPage,
  onOpen,
  onAssign,
}: {
  rows: Conversation[];
  total: number;
  page: number;
  totalPages: number;
  selectedId?: string;
  onPage: (page: number) => void;
  onOpen: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <PanelTitle icon={MessageCircle} title="Busca e auditoria de alto volume" subtitle={`${total.toLocaleString("pt-BR")} atendimentos nos filtros atuais.`} />
        <div>
          <button><SlidersHorizontal size={16} /> Colunas</button>
          <button><Download size={16} /> Exportar</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inicio</th>
              <th>Protocolo</th>
              <th>Cliente</th>
              <th>Atendente</th>
              <th>Setor</th>
              <th>Canal</th>
              <th>Classificacao IA</th>
              <th>Elegivel</th>
              <th>Nota</th>
              <th>Aderencia</th>
              <th>Resolucao</th>
              <th>Alertas</th>
              <th>Revisao</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.id === selectedId ? "selected" : ""}>
                <td>{formatDate(row.start)}</td>
                <td>{row.protocol}</td>
                <td>
                  <span className="masked"><Lock size={13} /> {row.client}</span>
                  <small>{row.maskedPhone}</small>
                </td>
                <td>{row.attendant}<small>{row.team}</small></td>
                <td>{row.sector}<small>{row.processVersion}</small></td>
                <td><ChannelPill channel={row.channel} /></td>
                <td>{row.classification}<small>{Math.round(row.confidence * 100)}% confianca</small></td>
                <td>{row.eligible ? "Sim" : "Nao"}<small>{row.ineligibleReason}</small></td>
                <td><ScoreBadge score={row.score} /></td>
                <td>{percent(row.adherence)}</td>
                <td>{row.resolution}</td>
                <td>{row.alerts.length}</td>
                <td>{row.reviewStatus}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onOpen(row.id)} title="Abrir detalhe"><Eye size={15} /></button>
                    <button onClick={() => onAssign(row.id)} title="Atribuir revisao"><UserCheck size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pagination">
        <span>Pagina {page} de {totalPages}</span>
        <button disabled={page === 1} onClick={() => onPage(Math.max(1, page - 1))}>Anterior</button>
        <button disabled={page === totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>Proxima</button>
      </footer>
    </section>
  );
}

function ConversationDetail({
  conversation,
  onNotify,
}: {
  conversation: Conversation;
  onNotify: (title: string, body: string) => void;
}) {
  const [tab, setTab] = useState("summary");
  const [feedback, setFeedback] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const steps = processSteps[conversation.sector];

  const sendAction = (action: string, note: string) => {
    fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetType: "conversation", targetId: conversation.id, note }),
    }).catch(() => undefined);
  };

  return (
    <section className="detail-layout">
      <article className="panel detail-hero">
        <div>
          <p className="eyebrow">{conversation.protocol} - {conversation.channel} - {conversation.processVersion}</p>
          <h2>{conversation.client}</h2>
          <p>{conversation.attendant} em {conversation.team} - {formatDate(conversation.start)} - {conversation.duration} min</p>
          <div className="pill-row">
            <span>{conversation.classification}</span>
            <span>{conversation.eligible ? "Elegivel" : "Inelegivel"}</span>
            <span>{conversation.resolution}</span>
            <span>{conversation.sentiment}</span>
          </div>
        </div>
        <div className="score-meter" style={{ "--score": `${conversation.score * 10}%` } as CSSProperties}>
          <strong>{conversation.score.toFixed(1)}</strong>
          <small>nota IA</small>
        </div>
        <div className="detail-actions">
          <button
            onClick={() => {
              const note = feedback || "Feedback rapido registrado para coaching.";
              setFeedback(note);
              sendAction("feedback", note);
              onNotify("Feedback registrado", `Feedback vinculado ao protocolo ${conversation.protocol}.`);
            }}
          >
            <MessageCircle size={16} /> Dar feedback
          </button>
          <button
            onClick={() => {
              sendAction("contest", "Operador contestou a avaliacao da IA.");
              onNotify("Contestacao aberta", "A avaliacao entrou na fila de revisao humana.");
            }}
          >
            <AlertTriangle size={16} /> Contestar avaliacao
          </button>
          <button
            onClick={() => {
              const note = reviewNote || "Revisao humana concluida pelo gestor.";
              setReviewNote(note);
              sendAction("review", note);
              onNotify("Atendimento revisado", "Status de revisao atualizado na trilha de auditoria.");
            }}
          >
            <CheckCircle2 size={16} /> Revisar
          </button>
          <button
            onClick={() => {
              setTicketOpen(true);
              sendAction("open_ticket", "Novo TC aberto a partir da supervisao.");
              onNotify("Novo TC aberto", `TC criado para o protocolo ${conversation.protocol}.`);
            }}
          >
            <ChevronRight size={16} /> Abrir novo TC
          </button>
        </div>
      </article>

      <article className="panel action-panel">
        <label>
          Feedback ao operador
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ex.: confirmou dados, mas nao validou resolucao antes de encerrar." />
        </label>
        <label>
          Nota da revisao
          <input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Ex.: revisado por amostragem do gestor." />
        </label>
        <span className={ticketOpen ? "status cumpriu" : "status incerto"}>
          {ticketOpen ? "TC aberto e vinculado" : "Nenhum TC aberto nesta revisao"}
        </span>
      </article>

      <article className="panel">
        <div className="tabs" role="tablist">
          {[
            ["summary", "Resumo da analise"],
            ["steps", "Avaliacao por etapas"],
            ["transcript", "Transcricao"],
            ["journey", "Jornada e reincidencia"],
            ["audit", "Metadados e auditoria"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <div className="summary-grid">
            {[
              ["Resumo", `Cliente buscou ${conversation.sector === "Comercial" ? "contratacao de internet" : conversation.sector === "Atendimento" ? "solucao para instabilidade" : "cancelamento ou renegociacao"}. Desfecho: ${conversation.resolution.toLowerCase()}.`],
              ["Pontos fortes", "Atendente manteve linguagem clara, registrou protocolo e explicou proximos passos quando havia base no processo."],
              ["Melhorias sugeridas", "Confirmar necessidade antes da oferta e validar resolucao antes do encerramento."],
              ["Riscos e oportunidades", conversation.recurrences >= 3 ? "Cliente reincidente com risco de churn; recomenda-se contato ativo apos OS." : "Sem risco critico, mas ha oportunidade de coaching por etapa."],
              ["Proxima acao", conversation.alerts.length ? "Atribuir revisao ao gestor e registrar feedback especifico." : "Marcar como revisado apos validacao amostral."],
              ["Diagnostico de resolucao", conversation.resolution],
            ].map(([title, body]) => (
              <div className="info-card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "steps" && (
          <div className="step-list">
            {steps.map((step) => (
              <div className="step-card" key={step.name}>
                <div>
                  <h3>{step.name}</h3>
                  <p>Peso {step.weight} - criterio versionado do processo {conversation.processVersion}</p>
                </div>
                <ScoreBadge score={step.score} />
                <span className={`status ${step.status.replace(" ", "-").toLowerCase()}`}>{step.status}</span>
                <p>{step.evidence}</p>
                <small>{step.guidance}</small>
              </div>
            ))}
          </div>
        )}

        {tab === "transcript" && <Transcript conversation={conversation} />}
        {tab === "journey" && <Journey conversation={conversation} />}
        {tab === "audit" && <Audit conversation={conversation} />}
      </article>
    </section>
  );
}

function Transcript({ conversation }: { conversation: Conversation }) {
  const lines = [
    ["00:02", "Sistema", "Atendimento importado do Blip e relacionado ao protocolo."],
    ["00:12", "Atendente", `Ola, sou ${conversation.attendant}. Vou te ajudar com esse atendimento.`],
    ["00:48", "Cliente", conversation.sector === "Comercial" ? "Quero saber se tem internet no meu endereco." : "Minha internet caiu de novo e ja abri chamado antes."],
    ["02:31", "Atendente", "Vou validar seus dados, consultar o historico e fazer alguns testes."],
    ["04:16", "Cliente", "Preciso de uma solucao definitiva, nao apenas reiniciar o roteador."],
    ["08:44", "Atendente", "Registrei a tratativa e o proximo passo. Voce recebera retorno no prazo informado."],
  ];

  return (
    <div className="transcript">
      <div className="audio-player">
        <Phone size={18} />
        <span>Player sincronizado permitido para perfis autorizados</span>
        <div><i style={{ width: `${conversation.duration * 2}%` }} /></div>
      </div>
      {lines.map(([time, actor, text], index) => (
        <button className={`message ${actor.toLowerCase()}`} key={`${time}-${index}`}>
          <b>{time}</b>
          <span>{actor}</span>
          <p>{text}</p>
        </button>
      ))}
    </div>
  );
}

function Journey({ conversation }: { conversation: Conversation }) {
  return (
    <div className="timeline">
      {[
        ["D-13", "WhatsApp", "Cliente relatou lentidao e recebeu orientacao inicial."],
        ["D-08", "Ligacao", "OS aberta apos testes. Visita tecnica pendente."],
        ["D-03", "Multicanal", "Cliente retornou sem resolucao percebida."],
        ["Hoje", conversation.channel, `Atendimento atual classificado como ${conversation.classification}.`],
      ].map(([date, channel, text]) => (
        <div key={`${date}-${channel}`}>
          <span>{date}</span>
          <strong>{channel}</strong>
          <p>{text}</p>
        </div>
      ))}
      <aside className="risk-box">
        <strong>Score de risco explicavel: {conversation.recurrences >= 3 ? "alto" : "moderado"}</strong>
        <p>Baseado em {conversation.recurrences} contatos em 14 dias, status de resolucao e existencia de OS.</p>
      </aside>
    </div>
  );
}

function Audit({ conversation }: { conversation: Conversation }) {
  return (
    <div className="audit-grid">
      {[
        ["Fontes", "Blip, PBX simulado e IXC simulado"],
        ["IDs externos", `${conversation.protocol}, ramal-22, blip-thread-${conversation.id}`],
        ["Versao do processo", conversation.processVersion],
        ["Modelo/prompt", "avaliador-v1.4 / schema qa-evaluation-v2"],
        ["Processamento", "2026-07-11 11:54 BRT"],
        ["Confianca", `${Math.round(conversation.confidence * 100)}%`],
        ["Revisoes", conversation.reviewStatus],
        ["LGPD", "Telefone e dados pessoais mascarados neste perfil"],
      ].map(([label, value]) => (
        <div className="info-card" key={label}>
          <h3>{label}</h3>
          <p>{value}</p>
        </div>
      ))}
    </div>
  );
}

function SectorView({ sector, rows, onOpen }: { sector: Sector; rows: Conversation[]; onOpen: (id: string) => void }) {
  const scoped = rows.filter((row) => row.sector === sector).slice(0, 10);
  return (
    <section className="stack">
      <article className="panel">
        <PanelTitle icon={Target} title={`Operacao de ${sector}`} subtitle="Metas, conversoes e gargalos por processo." />
        <div className="metric-grid compact">
          <MiniStat label="Volume elegivel" value={scoped.filter((row) => row.eligible).length.toString()} />
          <MiniStat label="Nota media" value={average(scoped.map((row) => row.score)).toFixed(1)} />
          <MiniStat label="Aderencia" value={percent(average(scoped.map((row) => row.adherence)))} />
          <MiniStat label="Alertas" value={scoped.reduce((sum, row) => sum + row.alerts.length, 0).toString()} />
        </div>
      </article>
      <article className="panel">
        <PanelTitle icon={MessageCircle} title="Atendimentos que sustentam os indicadores" subtitle="Abrir qualquer linha leva ao detalhe auditavel." />
        <div className="cards-list">
          {scoped.map((row) => (
            <button className="case-card" key={row.id} onClick={() => onOpen(row.id)}>
              <span><strong>{row.protocol}</strong><small>{row.client}</small></span>
              <span>{row.classification}<small>{row.channel}</small></span>
              <ScoreBadge score={row.score} />
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function Recurrence({ rows, sector, onOpen }: { rows: Conversation[]; sector: Sector; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<"Atendimento" | "Lead">("Atendimento");
  const recurrent = rows.filter((row) => row.recurrences >= 3);
  const recurrentClients = Array.from(new Map(recurrent.map((row) => [row.client, row])).values());
  const highRisk = recurrent.filter((row) => row.recurrences >= 5 || row.score < 5.5);
  const visibleRows = (mode === "Atendimento" ? recurrent : recurrentClients).slice(0, 14);
  return (
    <section className="stack recurrence-workspace">
      <div className="kpi-strip recurrence-stats">
        <MiniStat label="Atendimentos recorrentes" value={String(recurrent.length)} />
        <MiniStat label="Clientes reincidentes" value={String(recurrentClients.length)} />
        <MiniStat label="Taxa de reincidencia" value={percent((recurrent.length / Math.max(rows.length, 1)) * 100)} />
        <MiniStat label="Alto risco" value={String(highRisk.length)} />
      </div>
      <article className="panel recurrence-panel">
        <div className="recurrence-heading">
          <PanelTitle icon={RefreshCw} title="Atendimentos recorrentes" subtitle={`Contexto ${sector}: clientes que retornaram em ate 14 dias.`} />
          <div className="segmented-control" role="tablist" aria-label="Agrupamento da reincidencia">
            <button role="tab" aria-selected={mode === "Atendimento"} className={mode === "Atendimento" ? "active" : ""} onClick={() => setMode("Atendimento")}>Por atendimento</button>
            <button role="tab" aria-selected={mode === "Lead"} className={mode === "Lead" ? "active" : ""} onClick={() => setMode("Lead")}>Por lead</button>
          </div>
        </div>
        <div className="recurrence-table-head"><span>{mode === "Atendimento" ? "Atendimento" : "Cliente"}</span><span>Historico</span><span>Risco</span><span>Acao</span></div>
        <div className="cards-list recurrence-list">
          {visibleRows.map((row) => (
            <button className="recurrence-row" key={`${mode}-${row.id}`} onClick={() => onOpen(row.id)}>
              <span><strong>{mode === "Atendimento" ? row.protocol : row.client}</strong><small>{mode === "Atendimento" ? `${row.client} - ${row.channel}` : `${row.recurrences} contatos em 14 dias`}</small></span>
              <span><strong>{row.resolution}</strong><small>{row.classification}</small></span>
              <span className={row.recurrences >= 5 || row.score < 5.5 ? "risk high" : "risk"}>{row.recurrences >= 5 || row.score < 5.5 ? "Alto" : "Atencao"}</span>
              <span className="row-action">Abrir conversa <ChevronRight size={15} /></span>
            </button>
          ))}
          {!visibleRows.length ? <div className="empty-alerts"><RefreshCw size={22} /><strong>Nenhuma reincidencia no filtro atual</strong><p>Altere o periodo ou o contexto operacional.</p></div> : null}
        </div>
      </article>
    </section>
  );
}

function Agents({ ranking, rows, sector }: { ranking: AgentRankingRow[]; rows: Conversation[]; sector: Sector }) {
  const [selectedName, setSelectedName] = useState(ranking[0]?.name ?? "");
  const selected = ranking.find((row) => row.name === selectedName) ?? ranking[0];
  const personLabel = sector === "Comercial" ? "vendedor" : "atendente";
  const selectedRows = rows.filter((row) => row.attendant === selected?.name);
  const resolved = selectedRows.filter((row) => row.resolution === "Resolvido").length;
  const sales = selectedRows.filter((row) => row.classification === "Venda concluida").length;
  return (
    <section className="people-workspace">
      <article className="panel people-list-panel">
        <PanelTitle icon={Users} title={sector === "Comercial" ? "Vendedores" : "Atendentes"} subtitle={`Passe o mouse e selecione um ${personLabel} para abrir o resumo individual.`} />
        <div className="people-list">
          {ranking.map((row, index) => (
            <button className={selected?.name === row.name ? "active" : ""} key={row.name} onClick={() => setSelectedName(row.name)}>
              <b>{index + 1}</b>
              <span><strong>{row.name}</strong><small>{row.team} - {row.volume} elegiveis</small></span>
              <em>{row.score.toFixed(1)}</em>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </article>
      <article className="panel person-detail-panel" key={selected?.name}>
        <PanelTitle icon={UserCheck} title={selected?.name ?? (sector === "Comercial" ? "Vendedor" : "Atendente")} subtitle={`Resumo individual do ${personLabel} no periodo selecionado.`} />
        <div className="person-score-row">
          <div><small>Nota consolidada</small><strong>{selected?.score.toFixed(1) ?? "0.0"}</strong><span className="positive">{selected?.trend ?? "0.0"} no periodo</span></div>
          <MiniStat label="Aderencia" value={percent(selected?.adherence ?? 0)} />
          <MiniStat label={sector === "Comercial" ? "Vendas" : "Resolvidos"} value={String(sector === "Comercial" ? sales : resolved)} />
          <MiniStat label="Volume analisado" value={String(selectedRows.length)} />
        </div>
        <div className="person-progress"><span><strong>{sector === "Comercial" ? "Conversao" : "Taxa de resolucao"}</strong><b>{percent(((sector === "Comercial" ? sales : resolved) / Math.max(selectedRows.length, 1)) * 100)}</b></span><div><i style={{ width: `${Math.min(100, ((sector === "Comercial" ? sales : resolved) / Math.max(selectedRows.length, 1)) * 100)}%` }} /></div></div>
        <div className="info-card wide contextual-feedback">
          <h3>Feedback continuo</h3>
          <p>{sector === "Comercial" ? "Boa evolucao na apresentacao de planos. Priorize descoberta da necessidade antes da oferta e registre o motivo quando o lead nao avancar." : "Boa evolucao no acolhimento e diagnostico. Reforce a confirmacao de resolucao antes de encerrar e informe claramente o proximo passo ao cliente."}</p>
        </div>
      </article>
    </section>
  );
}

function Kpis({
  ranking,
  rows,
  sector,
}: {
  ranking: AgentRankingRow[];
  rows: Conversation[];
  sector: Sector;
}) {
  const eligible = rows.filter((row) => row.eligible);
  const sales = rows.filter((row) => row.classification === "Venda concluida");
  const resolved = rows.filter((row) => row.resolution === "Resolvido");
  const retained = rows.filter((row) => row.classification === "Retido");
  const recurrent = rows.filter((row) => row.recurrences >= 3);
  const cards = sector === "Comercial"
    ? [
        { label: "Leads elegiveis", value: String(eligible.length), detail: "Base valida para conversao", icon: MessageCircle },
        { label: "Vendas fechadas", value: String(sales.length), detail: "Desfechos de venda concluida", icon: Target },
        { label: "Conversao", value: percent((sales.length / Math.max(eligible.length, 1)) * 100), detail: "Vendas sobre leads elegiveis", icon: LineChart },
        { label: "Aderencia comercial", value: percent(average(eligible.map((row) => row.adherence))), detail: "Execucao do processo de vendas", icon: ClipboardCheck },
      ]
    : sector === "Retencao"
      ? [
          { label: "Casos elegiveis", value: String(eligible.length), detail: "Atendimentos avaliaveis", icon: MessageCircle },
          { label: "Clientes retidos", value: String(retained.length), detail: "Desfecho Retido", icon: UserCheck },
          { label: "Taxa de retencao", value: percent((retained.length / Math.max(eligible.length, 1)) * 100), detail: "Retidos sobre elegiveis", icon: LineChart },
          { label: "Reincidentes", value: String(recurrent.length), detail: "Tres ou mais contatos", icon: RefreshCw },
        ]
      : [
          { label: "Atendimentos", value: String(rows.length), detail: "Volume recebido no suporte", icon: MessageCircle },
          { label: "Resolvidos", value: String(resolved.length), detail: "Resolucao confirmada", icon: CheckCircle2 },
          { label: "Taxa de resolucao", value: percent((resolved.length / Math.max(rows.length, 1)) * 100), detail: "Resolvidos sobre analisados", icon: UserCheck },
          { label: "Primeira resposta", value: `${Math.round(average(rows.map((row) => row.firstResponse)))} min`, detail: "Media ate resposta humana", icon: Clock3 },
        ];
  const buckets = new Map<string, { date: string; volume: number; resultado: number; adherenceTotal: number }>();
  rows.forEach((row) => {
    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(row.start);
    const bucket = buckets.get(date) ?? { date, volume: 0, resultado: 0, adherenceTotal: 0 };
    bucket.volume += 1;
    bucket.resultado += sector === "Comercial" ? Number(row.classification === "Venda concluida") : sector === "Retencao" ? Number(row.classification === "Retido") : Number(row.resolution === "Resolvido");
    bucket.adherenceTotal += row.adherence;
    buckets.set(date, bucket);
  });
  const chartData = Array.from(buckets.values()).slice(0, 14).reverse().map((bucket) => ({ ...bucket, aderencia: Math.round(bucket.adherenceTotal / Math.max(bucket.volume, 1)) }));
  const peopleLabel = sector === "Comercial" ? "vendedores" : "atendentes";
  const outcomeLabel = sector === "Comercial" ? "vendas" : sector === "Retencao" ? "retencoes" : "resolucoes";
  return (
    <section className="stack">
      <div className="kpi-strip">
        {cards.map((metric) => {
          const Icon = metric.icon;
          return <article className="metric-card" key={metric.label}><span>{metric.label}</span><Icon size={17} /><strong>{metric.value}</strong><small>{metric.detail}</small></article>;
        })}
      </div>
      <section className="content-grid two-one">
        <article className="panel chart-panel">
          <PanelTitle icon={LineChart} title={sector === "Comercial" ? "Funil e conversoes por dia" : sector === "Atendimento" ? "Volume e resolucao por dia" : "Volume e retencoes por dia"} subtitle={`Grafico especifico da operacao de ${sector.toLowerCase()}.`} />
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#292929" vertical={false} />
              <XAxis dataKey="date" stroke="#8e8e8e" fontSize={11} />
              <YAxis stroke="#8e8e8e" fontSize={11} />
              <Tooltip contentStyle={{ background: "#151515", border: "1px solid #343434", borderRadius: 6 }} />
              <Bar dataKey="volume" fill="#ef2b2d" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="resultado" name={outcomeLabel} stroke="#ffffff" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </article>
        <article className="panel">
          <PanelTitle icon={Users} title={`Ranking de ${peopleLabel}`} subtitle={`Melhores resultados entre ${peopleLabel} no periodo.`} />
          <div className="ranking-list">
            {ranking.slice(0, 6).map((row, index) => <div key={row.name}><b>{index + 1}</b><span><strong>{row.name}</strong><small>{row.team} - {row.volume} conversas</small></span><strong>{row.score.toFixed(1)}</strong></div>)}
          </div>
        </article>
      </section>
    </section>
  );
}

function Classifications({ sector, onNotify }: { sector: Sector; onNotify: (title: string, body: string) => void }) {
  const [itemsBySector, setItemsBySector] = useState<Record<Sector, ManagedClassification[]>>({
    Atendimento: [
      { value: "agendamento_realizado", label: "Agendamento realizado", description: "Visita tecnica, mudanca de local ou segundo ponto agendados com data e responsavel confirmados.", active: true, nonScore: false, resolved: true },
      { value: "canal_errado", label: "Canal errado", description: "Solicitacao destinada a outro setor e corretamente encaminhada.", active: true, nonScore: true, resolved: false },
      { value: "customer_abandoned", label: "Cliente nao retornou", description: "Cliente deixou de responder antes da confirmacao de resolucao.", active: true, nonScore: true, resolved: false },
      { value: "cobranca_os_respondida", label: "Cobranca de O.S respondida", description: "Prazo ou situacao da ordem de servico foi consultado e informado adequadamente.", active: true, nonScore: false, resolved: true },
      { value: "escalated_other_sector", label: "Encaminhado para outro setor", description: "Assunto fora do escopo tecnico foi transferido com contexto suficiente.", active: true, nonScore: true, resolved: false },
      { value: "escalated_retention", label: "Encaminhado para retencao", description: "Sinal de cancelamento foi identificado e encaminhado conforme processo.", active: true, nonScore: false, resolved: true },
      { value: "technical_disconnection", label: "Falha tecnica do canal", description: "Atendimento interrompido por queda do WhatsApp, WebChat ou conexao do cliente.", active: true, nonScore: true, resolved: false },
      { value: "inatividade_sem_sinalizacao", label: "Inatividade sem sinalizacao", description: "Conversa ficou inativa sem orientacao clara sobre o proximo passo.", active: true, nonScore: false, resolved: false },
      { value: "unresolved", label: "Nao resolvido", description: "Diagnostico ou procedimento nao resolveu a solicitacao do cliente.", active: true, nonScore: false, resolved: false },
      { value: "os_aberta", label: "O.S aberta", description: "Ordem de servico registrada e proximos passos informados ao cliente.", active: true, nonScore: false, resolved: true },
      { value: "problema_massivo", label: "Problema massivo na rede", description: "Incidente geral afetando varios clientes, fora da responsabilidade individual.", active: true, nonScore: true, resolved: false },
      { value: "resolved", label: "Resolvido", description: "Problema resolvido na conversa e confirmado pelo cliente.", active: true, nonScore: false, resolved: true },
      { value: "bot_only", label: "Sem atendimento humano", description: "Conversa finalizada ainda na triagem automatica.", active: true, nonScore: true, resolved: false },
      { value: "senha_alterada", label: "Senha alterada", description: "Troca de senha concluida e reconexao orientada ao cliente.", active: true, nonScore: false, resolved: true },
    ],
    Comercial: [
      { value: "won", label: "Venda fechada", description: "Cliente concluiu a contratacao com sucesso.", active: true, nonScore: false, resolved: true },
      { value: "lead_active", label: "Lead potencial em andamento", description: "Negociacao ativa com proximo contato definido.", active: true, nonScore: false, resolved: false },
      { value: "price_objection", label: "Cliente achou caro", description: "Negociacao nao avancou por objecao de preco.", active: true, nonScore: false, resolved: false },
      { value: "no_coverage", label: "Sem cobertura na regiao", description: "Endereco ainda nao atendido pela Uai Telecom.", active: true, nonScore: true, resolved: false },
      { value: "competitor", label: "Foi para concorrente", description: "Cliente decidiu contratar outro provedor.", active: true, nonScore: false, resolved: false },
      { value: "ghost", label: "Cliente parou de responder", description: "Lead interrompeu a conversa sem desfecho.", active: true, nonScore: false, resolved: false },
      { value: "invalid_contact", label: "Contato invalido", description: "Numero ou contato nao permitiu continuidade.", active: true, nonScore: true, resolved: false },
      { value: "no_interest", label: "Sem interesse", description: "Cliente informou que nao deseja contratar no momento.", active: true, nonScore: false, resolved: false },
    ],
    Retencao: [
      { value: "retained", label: "Cliente retido", description: "Cliente permaneceu apos tratamento da causa e confirmacao.", active: true, nonScore: false, resolved: true },
      { value: "cancelled", label: "Cancelamento concluido", description: "Cancelamento confirmado apos todas as etapas aplicaveis.", active: true, nonScore: false, resolved: true },
      { value: "technical_return", label: "Retorno tecnico agendado", description: "Causa tecnica sera tratada antes de nova negociacao.", active: true, nonScore: false, resolved: true },
      { value: "price", label: "Motivo preco", description: "Valor foi o principal motivo de intencao de cancelamento.", active: true, nonScore: false, resolved: false },
      { value: "instability", label: "Instabilidade recorrente", description: "Problemas de conexao motivaram a solicitacao.", active: true, nonScore: false, resolved: false },
      { value: "change_no_coverage", label: "Mudanca sem cobertura", description: "Novo endereco nao possui disponibilidade de rede.", active: true, nonScore: true, resolved: false },
    ],
  });
  const items = itemsBySector[sector];
  const [draft, setDraft] = useState({ value: "", label: "", description: "" });

  const addClassification = () => {
    if (!draft.value.trim() || !draft.label.trim()) return onNotify("Classificacao incompleta", "Informe valor e nome antes de adicionar.");
    setItemsBySector((current) => ({ ...current, [sector]: [...current[sector], { ...draft, active: true, nonScore: false, resolved: false }] }));
    setDraft({ value: "", label: "", description: "" });
    onNotify("Classificacao criada", `A nova classificacao ja esta disponivel em ${sector}.`);
  };

  return (
    <section className="stack">
      <article className="classification-info"><div><strong>Como a IA usa as classificacoes de {sector}?</strong><p>A cada analise, a IA recebe somente as regras ativas deste contexto e escolhe exatamente uma. Desative sem excluir para preservar o historico.</p></div><span><b>Resolvido</b> soma na taxa de resolucao<br /><b>Non-Score</b> fica fora dos KPIs</span></article>
      <div className="kpi-strip classification-stats"><MiniStat label="Total" value={String(items.length)} /><MiniStat label="Ativas" value={String(items.filter((item) => item.active).length)} /><MiniStat label="Resolvidas" value={String(items.filter((item) => item.resolved).length)} /><MiniStat label="Non-Score" value={String(items.filter((item) => item.nonScore).length)} /></div>
      <article className="panel classification-create"><PanelTitle icon={Plus} title={`Nova classificacao de ${sector}`} subtitle="Cadastre uma regra para as proximas analises deste contexto." /><input placeholder="valor_chave" value={draft.value} onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))} /><input placeholder="Nome da classificacao" value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} /><input placeholder="Descricao para orientar a IA" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /><button onClick={addClassification}><Plus size={16} /> Adicionar</button></article>
      <article className="panel classification-table"><header><span>Value</span><span>Label</span><span>Descricao</span><span>Ativa</span></header>{items.map((item) => <div key={item.value}><code>{item.value}</code><span><strong>{item.label}</strong><span className="classification-badges">{item.resolved ? <small className="resolved-badge">Resolvido</small> : null}{item.nonScore ? <small>Non-Score</small> : null}</span></span><p>{item.description}</p><button className={`switch ${item.active ? "on" : ""}`} onClick={() => { setItemsBySector((current) => ({ ...current, [sector]: current[sector].map((entry) => entry.value === item.value ? { ...entry, active: !entry.active } : entry) })); onNotify(item.active ? "Classificacao desativada" : "Classificacao ativada", item.label); }} aria-label={`${item.active ? "Desativar" : "Ativar"} ${item.label}`}><span /></button></div>)}</article>
    </section>
  );
}

function OperatorPanel({ rows, onOpen }: { rows: Conversation[]; onOpen: (id: string) => void }) {
  const eligible = rows.filter((row) => row.eligible);
  const weakRows = eligible.filter((row) => row.score < 6.5).slice(0, 5);
  const goodRows = eligible.filter((row) => row.score >= 8).slice(0, 5);

  return (
    <section className="stack">
      <article className="panel">
        <PanelTitle icon={UserCheck} title="Resumo do operador" subtitle="Visao individual sem ranking nominal de colegas." />
        <div className="metric-grid compact">
          <MiniStat label="Meus atendimentos" value={rows.length.toString()} />
          <MiniStat label="Elegiveis para nota" value={eligible.length.toString()} />
          <MiniStat label="Minha nota media" value={average(eligible.map((row) => row.score)).toFixed(1)} />
          <MiniStat label="Minha aderencia" value={percent(average(eligible.map((row) => row.adherence)))} />
        </div>
      </article>

      <section className="content-grid two-one">
        <article className="panel">
          <PanelTitle icon={ClipboardCheck} title="O que fiz bem" subtitle="Evidencias positivas em atendimentos recentes." />
          <div className="cards-list">
            {goodRows.map((row) => (
              <button className="case-card" key={row.id} onClick={() => onOpen(row.id)}>
                <span><strong>{row.protocol}</strong><small>{row.classification}</small></span>
                <span>Boa conducao<small>{row.channel} - {formatDate(row.start)}</small></span>
                <ScoreBadge score={row.score} />
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelTitle icon={AlertTriangle} title="O que preciso corrigir" subtitle="Pontos objetivos para coaching individual." />
          <div className="cards-list">
            {weakRows.map((row) => (
              <button className="case-card" key={row.id} onClick={() => onOpen(row.id)}>
                <span><strong>{row.protocol}</strong><small>{row.alerts[0] ?? "Etapa com baixa aderencia"}</small></span>
                <span>{row.resolution}<small>{row.ineligibleReason}</small></span>
                <ScoreBadge score={row.score} />
              </button>
            ))}
          </div>
        </article>
      </section>

      <article className="panel">
        <PanelTitle icon={MessageCircle} title="Feedbacks pendentes" subtitle="Cada item aponta volume e evidencia, sem comparacao punitiva." />
        <div className="summary-grid">
          <div className="info-card">
            <h3>Confirmar resolucao</h3>
            <p>Em 4 de 11 atendimentos elegiveis, a conversa encerrou sem confirmar se o cliente ficou atendido.</p>
          </div>
          <div className="info-card">
            <h3>Registrar proximo passo</h3>
            <p>Quando abriu OS, informe prazo e canal de retorno. Evidencia em atendimentos com nota abaixo de 7.</p>
          </div>
          <div className="info-card">
            <h3>Evolucao</h3>
            <p>Houve melhora na saudacao e identificacao em relacao ao periodo anterior.</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function Adherence({ rows, onOpen }: { rows: Conversation[]; onOpen: (id: string) => void }) {
  const names = ["Saudacao", "Diagnostico", "Confirmacao", "Registro", "Escalonamento"];
  return (
    <section className="panel">
      <PanelTitle icon={ClipboardCheck} title="Heatmap de aderencia" subtitle="Agregado apenas com atendimentos elegiveis e aplicaveis." />
      <div className="heatmap">
        {attendantNames.slice(0, 10).map((name, rowIndex) => (
          <div className="heat-row" key={name}>
            <strong>{name}</strong>
            {names.map((step, cellIndex) => {
              const value = 45 + Math.round(pseudoRandom(rowIndex * 7 + cellIndex) * 52);
              return (
                <button
                  key={step}
                  style={{ background: `color-mix(in srgb, #ef2b2d ${value}%, #1d1d1d)` }}
                  onClick={() => onOpen(rows[rowIndex + cellIndex]?.id ?? rows[0]?.id)}
                  title={`${step}: ${value}%`}
                >
                  {value}%
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsCenter({
  alerts,
  focusAlertId,
  onOpen,
  onNotify,
}: {
  alerts: AlertItem[];
  focusAlertId: string | null;
  onOpen: (id: string) => void;
  onNotify: (title: string, body: string) => void;
}) {
  const [statusById, setStatusById] = useState<Record<string, AlertStatus>>({});
  const [alertTab, setAlertTab] = useState<"Ativos" | "Vistos" | "Descartados">("Ativos");
  const [severityFilter, setSeverityFilter] = useState("Todas severidades");
  const [ownerFilter, setOwnerFilter] = useState("Todos operadores");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(focusAlertId);
  const updateAlert = (alert: AlertItem, status: AlertStatus) => {
    setStatusById((items) => ({ ...items, [alert.id]: status }));
    fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: `alert_${status}`, targetType: "alert", targetId: alert.id, note: alert.evidence }),
    }).catch(() => undefined);
    onNotify("Alerta atualizado", `${alert.type} ficou como ${status}.`);
  };

  const visibleAlerts = alerts.filter((alert) => {
    const status = statusById[alert.id] ?? alert.status;
    const matchesTab = focusAlertId === alert.id || (alertTab === "Ativos" ? status === "Aberto" : alertTab === "Vistos" ? status === "Reconhecido" : status === "Resolvido");
    const matchesSeverity = severityFilter === "Todas severidades" || alert.severity === severityFilter;
    const matchesOwner = ownerFilter === "Todos operadores" || alert.owner === ownerFilter;
    return matchesTab && matchesSeverity && matchesOwner;
  }).sort((a, b) => Number(b.id === focusAlertId) - Number(a.id === focusAlertId));
  const activeCount = alerts.filter((alert) => (statusById[alert.id] ?? alert.status) === "Aberto").length;
  const criticalCount = alerts.filter((alert) => alert.severity === "Critico").length;
  const positiveCount = alerts.filter((alert) => alert.severity === "Baixo").length;
  const negativeCount = Math.max(0, alerts.length - positiveCount);

  return (
    <section className="stack alerts-workspace">
      <div className="alert-summary-grid">
        <MiniStat label="Ativos" value={String(activeCount)} />
        <MiniStat label="Criticos" value={String(criticalCount)} />
        <MiniStat label="Positivos" value={String(positiveCount)} />
        <MiniStat label="Negativos" value={String(negativeCount)} />
      </div>
      <div className="alerts-filterbar">
        <select aria-label="Origem do alerta"><option>Todas origens</option><option>Auditor IA</option><option>Reincidencia</option><option>Qualidade</option></select>
        <select aria-label="Polaridade"><option>Todas polaridades</option><option>Positiva</option><option>Negativa</option></select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} aria-label="Severidade"><option>Todas severidades</option><option>Critico</option><option>Alto</option><option>Medio</option><option>Baixo</option></select>
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="Operador"><option>Todos operadores</option><option>Gestor Suporte</option><option>Qualidade</option><option>Comercial</option></select>
      </div>
      <div className="alerts-tabs" role="tablist">
        {(["Ativos", "Vistos", "Descartados"] as const).map((tab) => <button key={tab} role="tab" aria-selected={alertTab === tab} className={alertTab === tab ? "active" : ""} onClick={() => setAlertTab(tab)}>{tab}</button>)}
      </div>
      <article className="panel">
        <PanelTitle icon={AlertTriangle} title="Central de alertas configuravel" subtitle="Atribuir, comentar, resolver e criar tarefas de coaching." />
        <div className="cards-list alerts-center-list">
        {visibleAlerts.map((alert) => (
          <div id={`alert-${alert.id}`} className={`case-card alert-case-card ${focusAlertId === alert.id ? "highlighted" : ""} ${expandedAlertId === alert.id ? "expanded" : ""}`} key={alert.id}>
            <button className="alert-case-trigger" onClick={() => setExpandedAlertId((current) => current === alert.id ? null : alert.id)} aria-expanded={expandedAlertId === alert.id}>
              <span className="alert-case-main"><strong>{alert.type}</strong><small>{alert.evidence}</small></span>
              <span className="alert-case-meta"><strong>{alert.severity}</strong><small>{alert.owner} - {alert.due}</small></span>
              <span className="alert-case-status">{statusById[alert.id] ?? alert.status}</span>
              <ChevronRight size={17} />
            </button>
            {expandedAlertId === alert.id ? (
              <div className="alert-detail-line">
                <div className="alert-timeline">
                  {["Detectado", "Atribuido", "Reconhecido", "Resolvido"].map((step, index) => {
                    const status = statusById[alert.id] ?? alert.status;
                    const reached = index === 0 || index === 1 || status === "Reconhecido" || status === "Resolvido";
                    return <span className={reached ? "reached" : ""} key={step}><i />{step}<small>{index === 0 ? "Auditor IA" : index === 1 ? alert.owner : index === 2 ? (status !== "Aberto" ? "Registrado" : "Pendente") : (status === "Resolvido" ? "Concluido" : "Pendente")}</small></span>;
                  })}
                </div>
                <p><strong>Evidencia:</strong> {alert.evidence}</p>
              </div>
            ) : null}
            <div className="alert-actions">
              <button onClick={() => updateAlert(alert, "Reconhecido")}>Reconhecer</button>
              <button onClick={() => updateAlert(alert, "Resolvido")}>Resolver</button>
              <button onClick={() => onNotify("Tarefa criada", `Coaching criado para ${alert.evidence}.`)}>Criar tarefa</button>
              <button onClick={() => onOpen(alert.conversationId)}>Abrir origem</button>
            </div>
          </div>
        ))}
        {visibleAlerts.length === 0 ? <div className="empty-alerts"><Bell size={22} /><strong>Nenhum insight encontrado</strong><p>Ajuste os filtros ou selecione outra aba.</p></div> : null}
        </div>
      </article>
    </section>
  );
}

function normalizeAgentQuestion(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildCommercialAgentAnswer(
  question: string,
  rows: Conversation[],
  ranking: AgentRankingRow[],
  alerts: AlertItem[],
  period: string,
): Omit<AgentMessage, "id" | "role"> {
  const normalized = normalizeAgentQuestion(question);
  const commercialRows = rows.filter((row) => row.sector === "Comercial");
  const eligibleLeads = commercialRows.filter((row) => row.eligible);
  const sales = commercialRows.filter((row) => row.classification === "Venda concluida");
  const conversion = (sales.length / Math.max(eligibleLeads.length, 1)) * 100;
  const averageScore = average(eligibleLeads.map((row) => row.score));
  const averageAdherence = average(eligibleLeads.map((row) => row.adherence));
  const criticalCases = commercialRows.filter((row) => row.alerts.length > 0 && row.score < 6);
  const lowAdherence = commercialRows.filter((row) => row.adherence < 70);
  const baseSources = [
    `${commercialRows.length} atendimentos comerciais no filtro ${period.toLowerCase()}`,
    "Classificacoes e auditorias da base Uai Telecom",
  ];

  const sellerStats = Array.from(new Set(commercialRows.map((row) => row.attendant)))
    .map((name) => {
      const sellerRows = commercialRows.filter((row) => row.attendant === name);
      const validRows = sellerRows.filter((row) => row.eligible);
      const sellerSales = sellerRows.filter((row) => row.classification === "Venda concluida").length;
      return {
        name,
        volume: sellerRows.length,
        sales: sellerSales,
        conversion: (sellerSales / Math.max(validRows.length, 1)) * 100,
        score: average(validRows.map((row) => row.score)),
        adherence: average(validRows.map((row) => row.adherence)),
      };
    })
    .filter((seller) => seller.volume > 0)
    .sort((a, b) => b.conversion - a.conversion || b.sales - a.sales || b.score - a.score);

  const bestSeller = sellerStats[0];
  const worstSeller = sellerStats[sellerStats.length - 1];
  const lossCounts = new Map<string, number>();
  commercialRows
    .filter((row) => !["Venda concluida", "Lead potencial em andamento"].includes(row.classification))
    .forEach((row) => lossCounts.set(row.classification, (lossCounts.get(row.classification) ?? 0) + 1));
  const topLosses = Array.from(lossCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const timestamps = commercialRows.map((row) => row.start.getTime());
  const spanDays = timestamps.length
    ? Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000) + 1)
    : 1;
  const projectedSales = Math.round((sales.length / spanDays) * 30);

  const answer = (content: string, facts: string[] = [], sources = baseSources) => ({ content, facts, sources });
  const protocol = question.toUpperCase().match(/UAI-\d+/)?.[0];
  if (protocol) {
    const conversation = rows.find((row) => row.protocol === protocol);
    if (!conversation) {
      return answer(
        `Nao encontrei o protocolo ${protocol} no periodo e nos filtros atuais. Posso procurar novamente quando o filtro for ampliado.`,
        [],
        [`Filtro atual: ${period}`],
      );
    }
    return answer(
      `Encontrei o atendimento ${protocol}. Ele foi conduzido por ${conversation.attendant}, recebeu nota ${conversation.score.toFixed(1)} e teve ${conversation.adherence}% de aderencia. O desfecho registrado foi "${conversation.classification}".`,
      [
        `Canal: ${conversation.channel}`,
        `Duracao: ${conversation.duration} minutos`,
        `Alertas: ${conversation.alerts.length ? conversation.alerts.join(", ") : "nenhum"}`,
      ],
      [`Atendimento ${protocol}`, `Processo ${conversation.processVersion}`],
    );
  }

  const namedSeller = sellerStats.find((seller) => normalized.includes(normalizeAgentQuestion(seller.name)));
  if (namedSeller) {
    return answer(
      `${namedSeller.name} realizou ${namedSeller.volume} atendimentos comerciais no periodo, com ${namedSeller.sales} vendas e conversao de ${namedSeller.conversion.toFixed(1)}% entre os leads elegiveis.`,
      [
        `Qualidade media: ${namedSeller.score.toFixed(1)}`,
        `Aderencia ao processo: ${Math.round(namedSeller.adherence)}%`,
        `Posicao por qualidade geral: ${Math.max(1, ranking.findIndex((row) => row.name === namedSeller.name) + 1)}`,
      ],
    );
  }

  if (/quem (e|voce)|o que voce|como pode ajudar|suas funcoes|o que faz/.test(normalized)) {
    return answer(
      "Sou o Agente de IA da Uai Telecom. Analiso os dados reais disponiveis da operacao para ajudar gestores, administradores e operadores a tomar decisoes com mais seguranca. Nao invento informacoes: quando a base nao sustenta uma resposta, eu aviso claramente.",
      [
        "Posso resumir vendas, conversao, qualidade e aderencia",
        "Posso ranquear, comparar e analisar vendedores",
        "Posso investigar perdas, alertas e conversas especificas",
        "Posso explicar os modulos e indicadores do sistema",
      ],
      ["Permissoes do usuario atual", "Dados sincronizados da operacao"],
    );
  }

  if (/melhor|ranking|ranque/.test(normalized) && bestSeller) {
    return answer(
      `${bestSeller.name} lidera o comercial no filtro atual. Foram ${bestSeller.sales} vendas em ${bestSeller.volume} atendimentos, com conversao de ${bestSeller.conversion.toFixed(1)}%.`,
      [
        `Qualidade media: ${bestSeller.score.toFixed(1)}`,
        `Aderencia ao processo: ${Math.round(bestSeller.adherence)}%`,
        `Criterio: conversao, depois volume de vendas e qualidade`,
      ],
    );
  }

  if (/pior|queda|baixo desempenho|precisa de ajuda/.test(normalized) && worstSeller) {
    return answer(
      `${worstSeller.name} aparece como o ponto de maior atencao no comercial neste recorte. A conversao esta em ${worstSeller.conversion.toFixed(1)}%, com ${worstSeller.sales} vendas em ${worstSeller.volume} atendimentos.`,
      [
        `Qualidade media: ${worstSeller.score.toFixed(1)}`,
        `Aderencia: ${Math.round(worstSeller.adherence)}%`,
        "Recomendacao: revisar conversas antes de definir qualquer acao de coaching",
      ],
    );
  }

  if (/compar/.test(normalized) && sellerStats.length >= 2) {
    const [first, second] = sellerStats;
    return answer(
      `${first.name} esta a frente de ${second.name} principalmente em conversao: ${first.conversion.toFixed(1)}% contra ${second.conversion.toFixed(1)}%.`,
      [
        `${first.name}: ${first.sales} vendas, nota ${first.score.toFixed(1)}, aderencia ${Math.round(first.adherence)}%`,
        `${second.name}: ${second.sales} vendas, nota ${second.score.toFixed(1)}, aderencia ${Math.round(second.adherence)}%`,
      ],
    );
  }

  if (/nao fech|perd|motivo|objec/.test(normalized)) {
    return answer(
      `Os motivos de perda mais frequentes no periodo sao ${topLosses.map(([name, count]) => `${name.toLowerCase()} (${count})`).join(", ") || "insuficientes para formar um ranking"}.`,
      [
        `${sales.length} vendas concluidas`,
        `${eligibleLeads.length} leads elegiveis considerados na conversao`,
        "A resposta usa o desfecho classificado, nao uma suposicao sobre a intencao do cliente",
      ],
    );
  }

  if (/roteiro|script|etapa|pulad|aderencia/.test(normalized)) {
    return answer(
      `${lowAdherence.length} atendimentos comerciais ficaram abaixo de 70% de aderencia. A base atual permite identificar esses casos, mas ainda nao possui o agregado por etapa necessario para afirmar qual etapa foi a mais pulada sem risco de inventar.`,
      [
        `Aderencia media do comercial: ${Math.round(averageAdherence)}%`,
        "A integracao das auditorias por etapa habilitara o ranking exato",
      ],
      [...baseSources, "Processo Comercial publicado"],
    );
  }

  if (/previs|projec|receita/.test(normalized)) {
    return answer(
      `Mantendo o ritmo observado, a projecao linear e de aproximadamente ${projectedSales} vendas em 30 dias. Nao consigo projetar receita porque o valor dos planos ainda nao esta presente na base.`,
      [
        `Ritmo observado: ${sales.length} vendas em ${spanDays} dias cobertos pelo filtro`,
        "Projecao simples, sem ajuste de sazonalidade",
      ],
    );
  }

  if (/alert|problema|fora do esperado/.test(normalized)) {
    return answer(
      `Ha ${criticalCases.length} atendimentos comerciais com alerta e nota abaixo de 6 no periodo. No sistema completo existem ${alerts.length} alertas gerados para os setores visiveis.`,
      [
        `${lowAdherence.length} casos comerciais abaixo de 70% de aderencia`,
        criticalCases[0] ? `Prioridade sugerida: revisar ${criticalCases[0].protocol}` : "Nenhum caso critico comercial no filtro atual",
      ],
      [...baseSources, "Central de Alertas"],
    );
  }

  if (/desconto|concorrente|o que (falam|disseram)|conversa real/.test(normalized)) {
    return answer(
      "Ainda nao consigo confirmar o que foi dito dentro das conversas porque as transcricoes da Blip e do PBX nao estao conectadas. Quando esses dados estiverem disponiveis, a busca sera feita no conteudo real, sem inferir pelo desfecho.",
      ["Nenhuma transcricao foi usada nesta resposta"],
      ["Status das integracoes Blip e PBX"],
    );
  }

  if (/qualifica|orcamento|decisao|necessidade|urgencia/.test(normalized)) {
    return answer(
      "A base atual nao possui os quatro campos de qualificacao separados. Por isso nao vou atribuir uma nota de orcamento, decisao, necessidade ou urgencia sem evidencia. Esse diagnostico sera habilitado quando as conversas reais forem processadas.",
      [],
      ["Campos disponiveis na base atual", "Processo Comercial"],
    );
  }

  return answer(
    `No filtro ${period.toLowerCase()}, encontrei ${commercialRows.length} atendimentos comerciais, ${sales.length} vendas e conversao de ${conversion.toFixed(1)}%. A qualidade media esta em ${averageScore.toFixed(1)} e a aderencia em ${Math.round(averageAdherence)}%.`,
    [
      bestSeller ? `Destaque atual: ${bestSeller.name}` : "Ainda nao ha vendedor com amostra suficiente",
      `${criticalCases.length} casos comerciais exigem atencao`,
      "Voce pode pedir ranking, motivos de perda, comparacao, previsao ou um protocolo especifico",
    ],
  );
}

function createAgentThreads(
  rows: Conversation[],
  ranking: AgentRankingRow[],
  alerts: AlertItem[],
  period: string,
): AgentThread[] {
  return [
    ["Qual meu melhor vendedor esta semana?", "ha 16 horas"],
    ["Tem algum alerta critico?", "ontem"],
    ["Por que os clientes nao fecham?", "ha 2 dias"],
  ].map(([question, updatedAt], index) => {
    const response = buildCommercialAgentAnswer(question, rows, ranking, alerts, period);
    return {
      id: `seed-${index}`,
      title: question,
      updatedAt,
      messages: [
        { id: `seed-${index}-user`, role: "user", content: question },
        { id: `seed-${index}-assistant`, role: "assistant", ...response },
      ],
    };
  });
}

function AiAgent({
  rows,
  ranking,
  alerts,
  period,
}: {
  rows: Conversation[];
  ranking: AgentRankingRow[];
  alerts: AlertItem[];
  period: string;
}) {
  const [threads, setThreads] = useState<AgentThread[]>(() => createAgentThreads(rows, ranking, alerts, period));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const suggestions = [
    "Como esta a operacao comercial este mes?",
    "Qual e o melhor vendedor?",
    "Por que os clientes nao fecham?",
    "Quais alertas exigem atencao?",
  ];

  const startNewChat = () => {
    setActiveThreadId(null);
    setDraft("");
    setIsThinking(false);
    setHistoryOpen(false);
  };

  const submitQuestion = (suggestedQuestion?: string) => {
    const question = (suggestedQuestion ?? draft).trim();
    if (!question || isThinking) return;
    const nextMessageIndex = (activeThread?.messages.length ?? 0) + 1;
    const threadId = activeThreadId ?? `chat-${threads.length + 1}`;
    const userMessage: AgentMessage = { id: `${threadId}-user-${nextMessageIndex}`, role: "user", content: question };
    setThreads((current) => {
      const exists = current.some((thread) => thread.id === threadId);
      if (!exists) {
        return [{ id: threadId, title: question.slice(0, 58), updatedAt: "agora", messages: [userMessage] }, ...current];
      }
      return current.map((thread) =>
        thread.id === threadId
          ? { ...thread, updatedAt: "agora", messages: [...thread.messages, userMessage] }
          : thread,
      );
    });
    setActiveThreadId(threadId);
    setDraft("");
    setIsThinking(true);
    setHistoryOpen(false);
    window.setTimeout(() => {
      const response = buildCommercialAgentAnswer(question, rows, ranking, alerts, period);
      const assistantMessage: AgentMessage = {
        id: `${threadId}-assistant-${nextMessageIndex + 1}`,
        role: "assistant",
        ...response,
      };
      setThreads((current) => current.map((thread) =>
        thread.id === threadId ? { ...thread, messages: [...thread.messages, assistantMessage] } : thread,
      ));
      setIsThinking(false);
    }, 650);
  };

  return (
    <section className="ai-chat-shell">
      <aside className={`ai-history ${historyOpen ? "mobile-open" : ""}`} aria-label="Historico do agente">
        <header>
          <div><strong>Conversas</strong><small>{threads.length} historicos</small></div>
          <button className="icon-button" onClick={startNewChat} title="Nova conversa"><Plus size={17} /></button>
        </header>
        <button className="ai-new-chat" onClick={startNewChat}><Plus size={16} />Nova conversa</button>
        <div className="ai-thread-list">
          {threads.map((thread) => (
            <button
              className={activeThreadId === thread.id ? "active" : ""}
              key={thread.id}
              onClick={() => { setActiveThreadId(thread.id); setHistoryOpen(false); }}
            >
              <span><strong>{thread.title}</strong><small>{thread.updatedAt}</small></span>
              <em>{thread.messages.length}</em>
            </button>
          ))}
        </div>
        <footer><ShieldCheck size={17} /><span><strong>Dados protegidos</strong><small>Respostas limitadas as fontes permitidas.</small></span></footer>
      </aside>

      <div className="ai-chat-main">
        <header className="ai-chat-toolbar">
          <button className="icon-button ai-history-toggle" onClick={() => setHistoryOpen((open) => !open)} title="Abrir conversas"><PanelLeftOpen size={18} /></button>
          <div><strong>Uai Sales AI</strong><small>Analise comercial baseada nos dados do filtro atual</small></div>
          <span className="ai-data-status"><span />Base demonstrativa</span>
          {activeThread ? <button onClick={startNewChat}><Plus size={15} />Novo chat</button> : null}
        </header>

        {activeThread ? (
          <div className="ai-messages" aria-live="polite">
            {activeThread.messages.map((message) => (
              <article className={`ai-message ${message.role}`} key={message.id}>
                {message.role === "assistant" ? <span className="ai-avatar"><Bot size={17} /></span> : null}
                <div className="ai-message-bubble">
                  <strong>{message.role === "assistant" ? "Uai Sales AI" : "Voce"}</strong>
                  {message.content.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {message.facts?.length ? <ul>{message.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
                  {message.sources?.length ? <div className="ai-sources"><small>Fontes consultadas</small>{message.sources.map((source) => <span key={source}>{source}</span>)}</div> : null}
                </div>
              </article>
            ))}
            {isThinking ? <article className="ai-message assistant"><span className="ai-avatar"><Bot size={17} /></span><div className="ai-thinking"><i /><i /><i /><span>Analisando dados disponiveis</span></div></article> : null}
          </div>
        ) : (
          <div className="ai-empty-state">
            <span><Bot size={30} /></span>
            <h3>Como posso ajudar?</h3>
            <p>Pergunte sobre vendas, conversao, vendedores, perdas, aderencia, previsoes, alertas ou qualquer indicador do sistema.</p>
            <div className="ai-suggestion-grid">
              {suggestions.map((suggestion) => <button key={suggestion} onClick={() => submitQuestion(suggestion)}>{suggestion}</button>)}
            </div>
          </div>
        )}

        <footer className="ai-composer">
          <div>
            <textarea
              aria-label="Digite sua pergunta"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
              placeholder="Digite sua pergunta..."
              rows={2}
            />
            <button className="icon-button" onClick={() => submitQuestion()} disabled={!draft.trim() || isThinking} title="Enviar pergunta"><Send size={18} /></button>
          </div>
          <small>Enter para enviar, Shift + Enter para quebra de linha. O agente nao inventa dados ausentes.</small>
        </footer>
      </div>
    </section>
  );
}

function Processes({
  processes,
  setProcesses,
  onNotify,
}: {
  processes: ManagedProcess[];
  setProcesses: Dispatch<SetStateAction<ManagedProcess[]>>;
  onNotify: (title: string, body: string) => void;
}) {
  const [draft, setDraft] = useState<ManagedProcess>({
    id: 0,
    name: "",
    sector: "Atendimento",
    status: "Rascunho",
    objective: "",
    steps: [{ name: "", weight: 1, criterion: "" }],
  });

  const updateStep = (index: number, key: "name" | "weight" | "criterion", value: string) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index
          ? { ...step, [key]: key === "weight" ? Number(value) || 1 : value }
          : step,
      ),
    }));
  };

  const saveProcess = () => {
    if (!draft.name.trim() || !draft.objective.trim()) {
      onNotify("Processo incompleto", "Informe nome e objetivo antes de salvar.");
      return;
    }
    const created = { ...draft, id: Date.now(), steps: draft.steps.filter((step) => step.name.trim()) };
    setProcesses((items) => [created, ...items]);
    fetch("/api/admin/processes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(created),
    }).catch(() => undefined);
    onNotify("Processo salvo", `${created.name} foi cadastrado como ${created.status}.`);
    setDraft({
      id: 0,
      name: "",
      sector: "Atendimento",
      status: "Rascunho",
      objective: "",
      steps: [{ name: "", weight: 1, criterion: "" }],
    });
  };

  return (
    <section className="stack">
      <article className="panel">
        <PanelTitle icon={FileText} title="Cadastrar novo processo" subtitle="Salva localmente na tela e envia para o banco D1 quando a migracao estiver aplicada." />
        <div className="process-editor">
          <label>Nome<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Atendimento - Suporte N1" /></label>
          <label>Setor<select value={draft.sector} onChange={(event) => setDraft((current) => ({ ...current, sector: event.target.value as Sector }))}><option>Comercial</option><option>Atendimento</option><option>Retencao</option></select></label>
          <label>Status<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ManagedProcess["status"] }))}><option>Rascunho</option><option>Em revisao</option><option>Publicado</option><option>Arquivado</option></select></label>
          <label>Objetivo<textarea value={draft.objective} onChange={(event) => setDraft((current) => ({ ...current, objective: event.target.value }))} placeholder="Descreva o objetivo da avaliacao e quando esse processo deve ser usado." /></label>
        </div>
      </article>
      <article className="panel">
        <PanelTitle icon={ClipboardCheck} title="Etapas do novo processo" subtitle="Inclua criterio e peso; etapas vazias sao ignoradas ao salvar." />
        <div className="step-list">
          {draft.steps.map((step, index) => (
            <div className="step-card editable-step" key={index}>
              <label>Etapa<input value={step.name} onChange={(event) => updateStep(index, "name", event.target.value)} placeholder="Ex.: Confirmacao de resolucao" /></label>
              <label>Peso<input value={step.weight} onChange={(event) => updateStep(index, "weight", event.target.value)} inputMode="numeric" /></label>
              <label>Criterio<input value={step.criterion} onChange={(event) => updateStep(index, "criterion", event.target.value)} placeholder="Evidencia esperada para cumprir a etapa" /></label>
            </div>
          ))}
          <div className="form-actions">
            <button onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, { name: "", weight: 1, criterion: "" }] }))}>Adicionar etapa</button>
            <button onClick={saveProcess}>Salvar processo</button>
          </div>
        </div>
      </article>
      <article className="panel">
        <PanelTitle icon={FileText} title="Processos cadastrados" subtitle="Clique para reutilizar como base de uma nova versao." />
        <div className="cards-list">
          {processes.map((process) => (
            <button className="case-card" key={process.id} onClick={() => setDraft({ ...process, id: 0, status: "Rascunho" })}>
              <span><strong>{process.name}</strong><small>{process.objective}</small></span>
              <span>{process.sector}<small>{process.steps.length} etapas</small></span>
              <span className="status cumpriu">{process.status}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function Reports({ rows }: { rows: Conversation[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={BarChart3} title="Relatorios" subtitle="Exportacoes incluem filtros e definicoes de metricas." />
      <div className="report-grid">
        {[
          "Executivo por periodo",
          "Qualidade por setor/equipe/atendente",
          "Aderencia por etapa",
          "Reincidencia e risco",
          "Precisao e calibracao da IA",
          "Precisao e volume de analises",
        ].map((report) => (
          <button className="report-card" key={report}>
            <FileText size={20} />
            <strong>{report}</strong>
            <small>{rows.length} registros no contexto atual</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Integrations({
  configs,
  setConfigs,
  onNotify,
}: {
  configs: IntegrationConfig[];
  setConfigs: Dispatch<SetStateAction<IntegrationConfig[]>>;
  onNotify: (title: string, body: string) => void;
}) {
  const updateConfig = (provider: IntegrationConfig["provider"], key: string, value: string) => {
    setConfigs((items) =>
      items.map((item) =>
        item.provider === provider
          ? { ...item, fields: { ...item.fields, [key]: value } }
          : item,
      ),
    );
  };

  const saveIntegration = (config: IntegrationConfig) => {
    setConfigs((items) =>
      items.map((item) =>
        item.provider === config.provider ? { ...item, status: "Configurado" } : item,
      ),
    );
    fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: config.provider, status: "Configurado", config: config.fields }),
    }).catch(() => undefined);
    onNotify("Integracao salva", `${config.provider} foi marcada como configurada.`);
  };

  return (
    <section className="stack">
      <article className="panel">
        <PanelTitle icon={Activity} title="Integracoes da supervisao" subtitle="Administrador configura Blip, OpenAI e PBX SSH. Segredos devem ir para variaveis seguras no deploy real." />
        <div className="content-grid">
          {configs.map((config) => (
            <article className="integration-card" key={config.provider}>
              <header>
                <strong>{config.provider}</strong>
                <span className={config.status === "Configurado" ? "status cumpriu" : "status incerto"}>{config.status}</span>
              </header>
              {Object.entries(config.fields).map(([key, value]) => (
                <label key={key}>
                  {key}
                  <input
                    value={value}
                    type={key.toLowerCase().includes("token") || key.toLowerCase().includes("key") ? "password" : "text"}
                    onChange={(event) => updateConfig(config.provider, key, event.target.value)}
                    placeholder={key === "host" ? "10.0.0.15" : key}
                  />
                </label>
              ))}
              <div className="form-actions">
                <button onClick={() => saveIntegration(config)}>Salvar</button>
                <button onClick={() => onNotify("Teste iniciado", `${config.provider}: teste de conectividade simulado executado.`)}>Testar</button>
              </div>
            </article>
          ))}
        </div>
      </article>
      <article className="panel">
        <PanelTitle icon={ShieldCheck} title="Como a ingestao vai funcionar" subtitle="Fluxo previsto para substituir os adaptadores simulados." />
        <div className="summary-grid">
          <div className="info-card">
            <h3>Blip</h3>
            <p>Importa mensagens, audios e metadados do atendimento. Audios entram na fila de transcricao antes da avaliacao.</p>
          </div>
          <div className="info-card">
            <h3>OpenAI</h3>
            <p>Executa transcricao, classificacao e avaliacao por schema. A chave fica no ambiente seguro, nao no front-end.</p>
          </div>
          <div className="info-card">
            <h3>PBX SSH</h3>
            <p>Autentica no servidor, lista gravacoes por periodo/ramal e relaciona arquivo ao atendimento antes da transcricao.</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function Admin({
  users,
  setUsers,
  configs,
  setConfigs,
  onNotify,
}: {
  users: ManagedUser[];
  setUsers: Dispatch<SetStateAction<ManagedUser[]>>;
  configs: IntegrationConfig[];
  setConfigs: Dispatch<SetStateAction<IntegrationConfig[]>>;
  onNotify: (title: string, body: string) => void;
}) {
  const [draftUser, setDraftUser] = useState({
    name: "",
    email: "",
    role: "Operador" as UserRole,
    team: "Suporte N1",
    password: "",
  });

  const saveUser = () => {
    if (!draftUser.name.trim() || !draftUser.email.trim() || draftUser.password.length < 6) {
      onNotify("Usuario incompleto", "Informe nome, email e senha com pelo menos 6 caracteres.");
      return;
    }
    const created: ManagedUser = {
      id: Date.now(),
      name: draftUser.name,
      email: draftUser.email,
      role: draftUser.role,
      team: draftUser.team,
      status: "Ativo",
    };
    setUsers((items) => [created, ...items]);
    fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftUser),
    }).catch(() => undefined);
    onNotify("Usuario criado", `${created.name} pode acessar como ${created.role}.`);
    setDraftUser({ name: "", email: "", role: "Operador", team: "Suporte N1", password: "" });
  };

  const markConfigured = (provider: IntegrationConfig["provider"]) => {
    setConfigs((items) =>
      items.map((item) => (item.provider === provider ? { ...item, status: "Configurado" } : item)),
    );
    onNotify("Supervisao atualizada", `${provider} ficou pronto para testes de integracao.`);
  };

  return (
    <section className="stack">
      <article className="panel">
        <PanelTitle icon={Settings} title="Administracao" subtitle="Criacao de usuarios, perfis e integracoes da Uai Telecom." />
        <div className="process-editor">
          <label>Nome<input value={draftUser.name} onChange={(event) => setDraftUser((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do usuario" /></label>
          <label>Email<input value={draftUser.email} onChange={(event) => setDraftUser((current) => ({ ...current, email: event.target.value }))} placeholder="email@uaitelecom.com.br" /></label>
          <label>Perfil<select value={draftUser.role} onChange={(event) => setDraftUser((current) => ({ ...current, role: event.target.value as UserRole }))}><option>Administrador</option><option>Gestor</option><option>Operador</option></select></label>
          <label>Equipe<input value={draftUser.team} onChange={(event) => setDraftUser((current) => ({ ...current, team: event.target.value }))} /></label>
          <label>Senha<input type="password" value={draftUser.password} onChange={(event) => setDraftUser((current) => ({ ...current, password: event.target.value }))} placeholder="Minimo 6 caracteres" /></label>
          <div className="form-actions">
            <button onClick={saveUser}>Criar usuario</button>
          </div>
        </div>
      </article>

      <section className="content-grid two-one">
        <article className="panel">
          <PanelTitle icon={Users} title="Usuarios cadastrados" subtitle="Persistencia preparada no D1; a lista responde imediatamente na interface." />
          <div className="cards-list">
            {users.map((user) => (
              <div className="case-card" key={user.id}>
                <span><strong>{user.name}</strong><small>{user.email}</small></span>
                <span>{user.role}<small>{user.team}</small></span>
                <span className="status cumpriu">{user.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelTitle icon={Activity} title="Supervisao do administrador" subtitle="Atalhos para marcar integracoes como prontas apos validar credenciais." />
          <div className="cards-list">
            {configs.map((config) => (
              <div className="case-card" key={config.provider}>
                <span><strong>{config.provider}</strong><small>{config.provider === "PBX SSH" ? "Busca gravacoes no servidor via SSH" : "Usado pelo pipeline de IA"}</small></span>
                <span className={config.status === "Configurado" ? "status cumpriu" : "status incerto"}>{config.status}</span>
                <button onClick={() => markConfigured(config.provider)}>Marcar pronto</button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="panel">
        <PanelTitle icon={ShieldCheck} title="Perfis e permissoes" subtitle="Gestor e operador veem superficies diferentes." />
        <div className="role-grid">
          {[
            ["Administrador", "Configura usuarios, Blip, OpenAI, PBX SSH, processos e politicas."],
            ["Gestor", "Acompanha alertas, reincidencias, revisoes e feedbacks da equipe."],
            ["Operador", "Ve somente o proprio resumo, atendimentos, feedbacks e contestacoes permitidas."],
          ].map(([role, body]) => (
            <div className="info-card" key={role}>
              <h3>{role}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <PanelTitle icon={AlertTriangle} title="Pendencias explicitas" subtitle="Configuracoes que dependem da operacao real." />
        <ul className="decision-list">
          {pendingDecisions.map((decision) => (
            <li key={decision}>{decision}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) {
  return (
    <header className="panel-title">
      <span><Icon size={18} /></span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return <span className={`score-badge ${score >= 8 ? "good" : score >= 6 ? "mid" : "bad"}`}>{score.toFixed(1)}</span>;
}

function ChannelPill({ channel }: { channel: Channel }) {
  const Icon = channel === "Ligacao" ? Phone : channel === "Audio" ? Headphones : MessageCircle;
  return (
    <span className="channel-pill">
      <Icon size={14} />
      {channel}
    </span>
  );
}
