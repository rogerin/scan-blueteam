"use strict";

// Recarregar o console deve sempre revelar o início da fase. Navegadores
// costumam restaurar a rolagem anterior e deixar o cabeçalho da vista sob a
// barra de controle fixa, o que parece um componente cortado.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo({ top: 0, left: 0, behavior: "auto" });

/* =====================================================================
   Vocabulário fixo. As oito etapas técnicas e seus rótulos são os
   mesmos do console anterior; só o mapeamento fase→etapa foi completado
   com as fases reais emitidas pelo pipeline (ai, archive, approval).
   ===================================================================== */
const stages = [
  { id: "scope", number: "01", icon: "target", title: "Guardião do escopo", description: "Valida origem, método, orçamento e condição de parada antes de qualquer ação." },
  { id: "discovery", number: "02", icon: "search", title: "Descoberta", description: "Identifica a aplicação e as rotas públicas incluídas na campanha." },
  { id: "planning", number: "03", icon: "clipboard", title: "Plano do agente", description: "Seleciona verificações declaradas e registra a origem da decisão." },
  { id: "checks", number: "04", icon: "shield-check", title: "Testes seguros", description: "Executa verificações de leitura com cadência e volume limitados." },
  { id: "triage", number: "05", icon: "filter", title: "Triagem", description: "Classifica evidência, severidade e confiança sem inferir exploração." },
  { id: "remediation", number: "06", icon: "wrench", title: "Correção", description: "Relaciona os achados a dicas de código e testes de regressão." },
  { id: "target_analysis", number: "07", icon: "network", title: "Análise multiagente", description: "Cruza inventário, evidências e hipóteses sobre a URL informada em agentes paralelos." },
  { id: "monitor", number: "08", icon: "activity", title: "Monitoramento", description: "Compara execuções e destaca achados novos ou resolvidos." },
];
const stageForPhase = {
  scope: "scope", discovery: "discovery", planning: "planning",
  surface_checks: "checks", checks: "checks", approval: "checks",
  triage: "triage", archive: "triage", remediation: "remediation",
  target_analysis: "target_analysis", ai: "target_analysis", monitor: "monitor",
};
const checkLabels = {
  headers: "cabeçalhos", cookies: "cookies", ftp_listing: "listagem /ftp",
  public_metrics: "métricas públicas", sql_error_exposure: "erros SQL expostos",
  beginner_challenges: "desafios iniciais", robots_txt: "robots.txt",
  security_txt: "security.txt", framework_inventory: "inventário do framework",
};
const stepLabels = {
  scope: "Escopo", discovery: "Descoberta", check_selection: "Seleção dos checks",
  ai_planning: "Prioridades da IA", asset_fetch: "Coleta de scripts",
  framework_inventory: "Inventário de framework", headers: "Cabeçalhos",
  cookies: "Cookies", triage: "Triagem", demo_archive: "Captura histórica da demo", remediation: "Correção", target_analysis: "Análise multiagente do alvo", ai_target_review: "Priorização por IA", ai_advisor: "Revisão por IA",
};
const PHASES = ["configure", "plan", "execute", "analyze", "report"];
const STATE_LABELS = {
  idle: ["Aguardando", "clock"], planning: ["Planejando", "activity"], running: ["Em execução", "activity"],
  awaiting_approval: ["Aguardando decisão", "alert"], stopping: ["Parando", "stop"],
  completed: ["Concluída", "check"], inconclusive: ["Inconclusiva", "alert"],
  stopped: ["Interrompida", "stop"], failed: ["Falhou", "x"],
};
const STAGE_LABELS = { active: "EM EXECUÇÃO", complete: "CONCLUÍDA", pending: "AGUARDANDO", skipped: "NÃO EXECUTADA" };
const STOP_REASONS = {
  planned_tests_complete: "testes planejados concluídos",
  incomplete_security_coverage: "cobertura de segurança incompleta: um teste declarado não executou ou a página inicial não respondeu 200",
  operator_requested: "interrompida pelo operador",
  request_budget_exhausted: "orçamento de requisições esgotado",
  ScopeError: "escopo recusado pelo guardião",
  NetworkFailure: "falha de rede ao alcançar o alvo",
};
const TYPE_LABELS = {
  decision: "decisão", test: "teste", request: "requisição", response: "resposta",
  observation: "observação", approval: "aprovação", denied: "negado", error: "erro",
  stop: "parada", agent_start: "agente", agent_result: "agente", evidence_link: "evidência",
  campaign: "campanha", control: "controle", triage: "triagem", recommendation: "correção", stage_plan: "plano",
};
const RELEVANT_TYPES = new Set(["decision", "test", "observation", "approval", "denied", "error", "stop", "agent_start", "agent_result", "evidence_link", "campaign", "control"]);
const AUDIT_FILTERS = {
  all: null,
  decisions: new Set(["decision", "stage_plan", "approval", "denied", "control", "stop", "campaign"]),
  tests: new Set(["test", "triage", "observation", "evidence_link", "agent_start", "agent_result", "recommendation"]),
  network: new Set(["request", "response"]),
  errors: new Set(["error", "stop", "denied"]),
};
const ACTION_LABELS = { quoted_search: "comparação de busca sintética" };
const SEVERITY_LABELS = { high: "alta", medium: "média", low: "baixa", info: "informativa" };
const FINDING_STATUS_LABELS = { confirmed: "confirmadas", inconclusive: "inconclusivos", discarded: "descartados" };
const CONFIDENCE_LABELS = { high: "alta", medium: "média", low: "baixa" };
const APPROVAL_LABELS = { pending: "Aguardando decisão", approved: "Aprovada", rejected: "Negada", cancelled: "Cancelada na interrupção", expired: "Expirada sem decisão" };
const CONDITIONED_REASONS = { approval_required_or_rejected: "aprovação não concedida, negada ou expirada" };

/* ===================== Utilidades de DOM ===================== */
const $ = (id) => document.getElementById(id);
const text = (node, value) => { node.textContent = value == null ? "" : String(value); };
const node = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) text(element, content);
  return element;
};
const ICON_PATHS = {
  activity: '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>',
  external: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.7 7.2-4.4 8.6m7-8.6 4.4 8.6M7.5 18h9"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z"/>',
  "shield-check": '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0-5-5L12 4 9 7 6.5 4.5a4 4 0 0 0 5 5L4 17l3 3 7.5-7.5a4 4 0 0 0 5-5L17 10l-3-3Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
function iconNode(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("ui-icon");
  if (className) svg.classList.add(...className.split(" "));
  svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.alert;
  return svg;
}
const pad2 = (value) => String(value).padStart(2, "0");
const safeScreenshotPath = (value) => typeof value === "string"
  && value.length <= 200
  && /^\/evidence\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(value)
  && !value.includes("..") ? value : "";

function formatTime(raw) {
  if (!raw) return "--:--:--";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDateTime(raw) {
  if (!raw) return "não registrado";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "não registrado" : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDuration(start, end) {
  const a = new Date(start).getTime(); const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return "não determinada";
  const seconds = Math.round((b - a) / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
}
function readable(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const parts = [];
    for (const [key, item] of Object.entries(value)) {
      if (item != null && typeof item !== "object") parts.push(`${key}: ${item}`);
    }
    return parts.join(" · ");
  }
  return String(value);
}
function message(value, error = false) {
  const target = $("action-message");
  text(target, value);
  target.classList.toggle("error", error);
}
function fact(label, value, fallback = "Não informado") {
  const row = node("div", "stage-plan-fact");
  row.append(node("strong", "", label), node("span", "", readable(value).trim() || fallback));
  return row;
}
function listItem(content, className) { return node("li", className || "", content); }
function button(label, className, onClick) {
  const element = node("button", className, label);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}
function emptyState(icon, title, body) {
  const empty = node("div", "empty-state");
  empty.append(iconNode(icon, "empty-state-icon"), node("strong", "", title), node("p", "", body));
  return empty;
}

/* <details data-key> lembra se o operador abriu ou fechou cada bloco,
   para que a atualização periódica não recolha o que está sendo lido. */
const openState = new Map();
document.addEventListener("toggle", (event) => {
  const key = event.target?.dataset?.key;
  if (key) openState.set(key, event.target.open);
}, true);
function details(key, summaryContent, defaultOpen = false, className = "") {
  const element = node("details", className);
  element.dataset.key = key;
  if (defaultOpen) element.dataset.defaultOpen = "1";
  const summary = node("summary");
  if (typeof summaryContent === "string") text(summary, summaryContent); else summary.append(...summaryContent);
  element.append(summary);
  return element;
}
function applyOpenState(root) {
  root.querySelectorAll("details[data-key]").forEach((element) => {
    const key = element.dataset.key;
    element.open = openState.has(key) ? openState.get(key) : element.dataset.defaultOpen === "1";
  });
}

/* =====================================================================
   Modelo derivado. Toda a navegação parte dos campos reais do snapshot:
   running, stop_requested, approvals, error e result.status. Nenhum
   estado é inventado nem simulado por temporizador.
   ===================================================================== */
function deriveModel(snapshot) {
  const result = snapshot.result && typeof snapshot.result === "object" ? snapshot.result : null;
  const liveEvents = Array.isArray(snapshot.events) ? snapshot.events : [];
  const events = liveEvents.length ? liveEvents : (Array.isArray(result?.actions) ? result.actions : []);
  const observations = Array.isArray(result?.observations) ? result.observations : [];
  const findings = Array.isArray(result?.findings) ? result.findings : [];
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const approvals = (Array.isArray(snapshot.approvals) ? snapshot.approvals : [])
    .filter((item) => item && /^[0-9a-f]{32}$/.test(item.id || ""));
  const scope = snapshot.scope && typeof snapshot.scope === "object" ? snapshot.scope : {};
  const target = scope.target || result?.target || "";
  const running = Boolean(snapshot.running);

  const stageEvents = stages.map(() => []);
  events.forEach((event) => {
    const id = stageForPhase[String(event.phase || "").toLowerCase()];
    const index = stages.findIndex((stage) => stage.id === id);
    if (index >= 0) stageEvents[index].push(event);
  });
  const reached = stageEvents.map((list) => list.length > 0);
  const activeIndex = running ? Math.max(0, reached.lastIndexOf(true)) : -1;

  const savedPlan = observations.find((item) => item.type === "agent_plan");
  const planSteps = Array.isArray(savedPlan?.steps) && savedPlan.steps.length
    ? savedPlan.steps : events.filter((item) => item.type === "stage_plan");
  const stageStates = stages.map((stage, index) => {
    let state;
    if (running && index === activeIndex) state = "active";
    else if (reached[index]) state = "complete";
    else if (!running && (result || snapshot.error)) state = "skipped";
    else state = "pending";
    return {
      ...stage, index, state,
      hasError: stageEvents[index].some((event) => event.type === "error"),
      events: stageEvents[index],
      steps: planSteps.filter((step) => stageForPhase[String(step.phase || "").toLowerCase()] === stage.id),
    };
  });

  const pendingApproval = approvals.find((item) => item.status === "pending") || null;
  let state;
  if (running) {
    state = snapshot.stop_requested ? "stopping" : pendingApproval ? "awaiting_approval" : activeIndex <= 2 ? "planning" : "running";
  } else if (snapshot.error) {
    state = "failed";
  } else if (["completed", "inconclusive", "stopped", "failed"].includes(result?.status)) {
    state = result.status;
  } else {
    state = "idle";
  }
  const terminal = !running && state !== "idle";
  const hasData = events.length > 0 || Boolean(result);
  const naturalPhase = state === "idle" ? "configure"
    : state === "planning" ? "plan"
      : running ? "execute"
        : hasData ? "analyze" : "configure";
  const requestCount = Number.isFinite(result?.summary?.requests)
    ? result.summary.requests : events.filter((event) => event.type === "request").length;
  return {
    snapshot, result, events, observations, findings, recommendations, approvals, scope, target,
    running, state, terminal, hasData, stageStates, activeIndex, planSteps, pendingApproval, requestCount,
    maxRequests: Number.isFinite(scope.max_requests) ? scope.max_requests : null,
    completedCount: stageStates.filter((stage) => stage.state === "complete").length,
    naturalPhase,
    available: {
      configure: true,
      plan: events.length > 0 || planSteps.length > 0,
      execute: events.length > 0,
      analyze: terminal && hasData,
      report: Boolean(result),
    },
    loadedFromDisk: !running && Boolean(result) && liveEvents.length === 0,
  };
}

/* ===================== Navegação por fase ===================== */
let selectedPhase = null;
let lastNatural = null;
let lastRaw = null;
let lastSnapshot = null;
let lastModel = null;
let renderedPhase = null;
let busy = false;
let connected = true;
let analyzeTab = "findings";
let selectedFindingId = null;
let auditOpen = false;
let auditFilter = "all";
let starting = false;
let requestSeq = 0;
let acceptAfterSeq = 0;
let pendingRefresh = false;

/* Rascunho: o operador está na Configuração, sem campanha em execução, depois de uma
   campanha registrada. A tela passa a descrever a PRÓXIMA campanha; a anterior fica
   acessível só por Análise e Relatório, rotuladas como "campanha anterior". */
function isDraft(model, phase) {
  return Boolean(model) && !model.running && phase === "configure" && model.hasData;
}
function draftOrigin() {
  try {
    const parsed = new URL($("target-url").value.trim());
    return parsed.protocol === "https:" ? parsed.origin + "/" : "";
  } catch { return ""; }
}
/* Ao iniciar outra campanha, nada da interface da campanha anterior pode sobreviver:
   blocos abertos, achado selecionado e aba ativa pertencem àquela execução. */
function resetCampaignUI() {
  openState.clear();
  selectedFindingId = null;
  analyzeTab = "findings";
  selectedPhase = null;
  lastNatural = null;
  renderedPhase = null;
}

function resolvePhase(model) {
  if (model.naturalPhase !== lastNatural) {
    lastNatural = model.naturalPhase;
    selectedPhase = null;
  }
  const wanted = selectedPhase || model.naturalPhase;
  return model.available[wanted] ? wanted : model.naturalPhase;
}
function goTo(phase) {
  if (!lastModel || !lastModel.available[phase]) return;
  selectedPhase = phase;
  render(lastSnapshot, true);
  window.scrollTo({ top: 0, behavior: "auto" });
  $("main").focus({ preventScroll: true });
}
function lockedHint(phase, model) {
  if (phase === "plan" || phase === "execute") return "Disponível após iniciar uma campanha.";
  return model.running ? "Disponível quando a execução terminar." : "Disponível após uma campanha registrada.";
}

function renderStepper(model, phase) {
  const draft = isDraft(model, phase);
  const naturalIndex = PHASES.indexOf(model.naturalPhase);
  $("phase-stepper").querySelectorAll(".phase-step").forEach((step) => {
    const id = step.dataset.phase;
    const index = PHASES.indexOf(id);
    const previous = draft && (id === "analyze" || id === "report") && model.available[id];
    const locked = draft ? !previous && id !== "configure" : !model.available[id];
    const current = id === phase;
    const done = !draft && !locked && index < naturalIndex;
    step.classList.toggle("is-current", current);
    step.classList.toggle("is-done", done);
    step.classList.toggle("is-locked", locked);
    step.classList.toggle("is-live", id === model.naturalPhase && model.running);
    step.setAttribute("aria-disabled", String(locked));
    if (current) step.setAttribute("aria-current", "step"); else step.removeAttribute("aria-current");
    text(step.querySelector(".phase-index"), done ? "✓" : String(index + 1));
    text(step.querySelector(".phase-state"), current ? (draft ? "nova campanha" : "fase atual")
      : previous ? "campanha anterior" : locked ? "bloqueada" : done ? "concluída" : (id === model.naturalPhase ? "em andamento" : ""));
    step.classList.toggle("is-previous", previous);
    step.title = locked ? (draft ? "Disponível após iniciar a nova campanha." : lockedHint(id, model)) : previous ? "Resultados da campanha anterior" : "";
  });
}

function renderControlBar(model) {
  const draft = isDraft(model, renderedPhase);
  const targetNode = $("bar-target");
  const target = draft ? draftOrigin() : model.target;
  text(targetNode, target || (draft ? "Informe a URL do alvo" : "Nenhum alvo definido"));
  targetNode.title = target || "";
  const [label, stateIcon] = starting ? ["Iniciando…", "activity"]
    : draft ? ["Nova campanha", STATE_LABELS.idle[1]] : STATE_LABELS[model.state];
  const pill = $("bar-status");
  pill.dataset.state = starting ? "planning" : draft ? "idle" : model.state;
  pill.replaceChildren(iconNode(stateIcon), document.createTextNode(label));
  const active = model.stageStates[model.activeIndex];
  text($("bar-progress"), starting ? "Validando escopo e provedor de IA"
    : draft ? `Última campanha: ${STATE_LABELS[model.state][0].toLowerCase()}`
      : model.running && active ? `Etapa ${model.activeIndex + 1}/8 · ${active.title}`
        : model.terminal ? `${model.completedCount}/8 etapas executadas` : "Sem campanha ativa");
  const scope = model.scope;
  const methods = Array.isArray(scope.allowed_methods) ? scope.allowed_methods.join("/") : "GET/HEAD";
  $("bar-policy").replaceChildren(iconNode("clock"), document.createTextNode(`${methods} · até ${scope.max_requests ?? "?"} req · ${scope.min_interval_seconds ?? "?"} s`));
  $("bar-policy").title = `Política ativa: ${methods} na origem exata, até ${scope.max_requests ?? "?"} requisições, intervalo mínimo ${scope.min_interval_seconds ?? "?"} s, ${scope.max_response_bytes ?? "?"} bytes por resposta, sem redirecionamentos.`;
  const stop = $("stop-btn");
  stop.disabled = !connected || !model.running || Boolean(model.snapshot.stop_requested) || busy;
  stop.replaceChildren(iconNode("stop"), document.createTextNode(model.snapshot.stop_requested ? "Parando…" : "Parar"));
  text($("audit-badge"), model.events.length);
}

function approvalTitle(item) {
  return ACTION_LABELS[item.action_id] || `ação condicionada ${item.action_id || ""}`;
}
function renderBanners(model, phase) {
  $("connection-banner").hidden = connected;
  const banner = $("approval-banner");
  const show = Boolean(model.pendingApproval) && phase !== "execute";
  banner.hidden = !show;
  if (show) {
    text($("approval-banner-text"), `Decisão humana necessária: ${approvalTitle(model.pendingApproval)} aguarda aprovação até ${formatTime(model.pendingApproval.expires_at)}. A campanha permanece bloqueada nesta ação.`);
  }
}

/* ===================== FASE 1 · Configuração ===================== */
let targetDirty = false;
let aiProviderInitialized = false;
function renderPolicy(scope) {
  const allowed = Array.isArray(scope.allowed_methods) ? scope.allowed_methods.join("/") : "GET/HEAD";
  text($("policy-allowed"), `${allowed} na origem HTTPS autorizada; até ${scope.max_requests ?? "?"} requisições, intervalo mínimo de ${scope.min_interval_seconds ?? "?"} s e ${scope.max_response_bytes ?? "?"} bytes por resposta.`);
  const conditional = Array.isArray(scope.conditional_actions) && scope.conditional_actions.includes("quoted_search");
  text($("policy-conditioned"), conditional
    ? "Comparação de busca sintética com aspas: só executa após aprovação explícita nesta campanha e expira em cinco minutos."
    : "Nenhuma ação condicionada foi declarada para este alvo.");
  text($("policy-denied"), "POST/PUT/DELETE, força bruta, extração de arquivos, exploração encadeada e destinos fora da origem autorizada. Nenhuma aprovação do console libera estas ações.");
}
function renderConfigure(model) {
  const { scope, result } = model;
  if (!aiProviderInitialized && ["openai", "bedrock"].includes(scope.ai_provider)) {
    $("ai-provider").value = scope.ai_provider;
    aiProviderInitialized = true;
  }
  if (!targetDirty && !model.running && model.target) {
    $("target-url").value = model.target;
    updateTargetPreview();
  }
  const methods = Array.isArray(scope.allowed_methods) ? scope.allowed_methods.join("/") : "GET/HEAD";
  const summary = $("start-summary");
  summary.replaceChildren(
    listItem("Oito etapas técnicas: escopo, descoberta, plano, testes, triagem, correção, análise multiagente e monitoramento."),
    listItem(`No máximo ${scope.max_requests ?? "?"} requisições ${methods}, intervalo mínimo de ${scope.min_interval_seconds ?? "?"} s e ${scope.max_response_bytes ?? "?"} bytes por resposta, sem seguir redirecionamentos.`),
    listItem("Ações condicionadas declaradas no escopo só executam após a sua aprovação explícita; sem decisão em cinco minutos, o teste é pulado e fica inconclusivo."),
    listItem("Você pode interromper a qualquer momento; eventos e evidências já capturados são preservados."),
    listItem("O resultado é gravado em reports/<run_id>/ (result.json e report.md) e fica disponível para exportação."),
  );
  const hosts = Array.isArray(scope.allowed_hosts) && scope.allowed_hosts.length ? scope.allowed_hosts.join(", ") : "origem informada";
  const conditional = Array.isArray(scope.conditional_actions) && scope.conditional_actions.length
    ? `${scope.conditional_actions.length} ação condicionada declarada (${scope.conditional_actions.map((id) => ACTION_LABELS[id] || id).join(", ")})`
    : "nenhuma ação condicionada declarada";
  text($("config-scope-note"), `Host ${hosts} · ${conditional}`);
  text($("guardrail-target"), `Somente ${model.target || "a origem HTTPS informada"}. Redirecionamentos externos são recusados.`);
  text($("guardrail-volume"), `${methods}, até ${scope.max_requests ?? "?"} requisições e intervalo mínimo de ${scope.min_interval_seconds ?? "?"} s entre ações.`);
  renderPolicy(scope);
  const prior = $("prior-campaign");
  prior.hidden = !result;
  if (result) {
    const [label] = STATE_LABELS[["completed", "inconclusive", "stopped", "failed"].includes(result.status) ? result.status : "idle"];
    text($("prior-campaign-text"), `Campanha registrada${model.loadedFromDisk ? " (carregada de reports/)" : ""}: ${result.target || "alvo não registrado"} · ${label} · ${formatDateTime(result.ended_at)}. Iniciar outra campanha substitui os dados desta sessão; o relatório anterior permanece em reports/${result.run_id || ""}.`);
  }
  $("start-btn").disabled = model.running || busy || !connected;
  $("target-url").disabled = model.running;
  $("authorization-confirmed").disabled = model.running;
  updateAIProviderFields(model.running);
}

/* ===================== FASE 2 · Planejamento ===================== */
function stepCard(step) {
  const card = node("article", "stage-plan-step");
  const id = step.step_id || step.check_id || "";
  card.append(node("h4", "", stepLabels[id] || checkLabels[id] || id || "Etapa"));
  card.append(fact("Hipótese", step.hypothesis), fact("Ação", step.action),
    fact("Resultado esperado", step.expected_result), fact("Condição de parada", step.stop_condition));
  return card;
}
function stageStateLabel(stage) {
  return `${STAGE_LABELS[stage.state] || stage.state}${stage.hasError ? " · COM ERRO" : ""}`;
}
function renderPlan(model) {
  const { events, scope } = model;
  text($("plan-state-tag"), STATE_LABELS[model.state][0].toUpperCase());

  const scopeBox = $("plan-scope");
  scopeBox.replaceChildren();
  const validated = events.find((event) => event.type === "decision" && event.phase === "scope");
  const refused = events.find((event) => event.type === "error" && ["control", "scope"].includes(event.phase));
  if (validated) {
    scopeBox.append(node("p", "status-line ok", "✓ Escopo validado pelo guardião antes de qualquer requisição."));
    scopeBox.append(fact("Alvo", validated.target || model.target), fact("Hosts permitidos", validated.allowed_hosts),
      fact("Métodos", validated.methods), fact("Orçamento", Number.isFinite(validated.max_requests) ? `${validated.max_requests} requisições, intervalo ${validated.min_interval_seconds ?? scope.min_interval_seconds ?? "?"} s` : ""));
  } else if (refused) {
    scopeBox.append(node("p", "status-line error", `Escopo recusado: ${refused.detail || refused.error || refused.message}`));
  } else {
    scopeBox.append(node("p", "status-line", model.running ? "◐ Aguardando validação do guardião do escopo…" : "Nenhuma validação de escopo registrada."));
  }

  const selection = $("plan-selection");
  selection.replaceChildren();
  const planEvent = [...events].reverse().find((event) => event.phase === "planning" && Array.isArray(event.check_ids));
  if (planEvent) {
    const source = planEvent.source === "ai" ? `✓ Plano selecionado pela IA${scope.ai_model ? ` (${scope.ai_model})` : ""} entre as verificações permitidas.`
      : planEvent.source === "operator" ? "✓ Verificações selecionadas pelo operador."
        : planEvent.fallback ? "◍ IA indisponível: perfil seguro determinístico aplicado. A campanha continua com as regras locais."
          : "✓ Perfil seguro determinístico selecionado.";
    selection.append(node("p", `status-line ${planEvent.fallback ? "warn" : "ok"}`, source));
    const chips = node("div", "chip-row");
    planEvent.check_ids.forEach((check) => chips.append(node("span", "chip", checkLabels[check] || check)));
    selection.append(chips);
    if (planEvent.error_type) selection.append(node("p", "panel-note", `Motivo registrado: ${planEvent.error_type}.`));
    selection.append(node("p", "panel-note", "Cabeçalhos, cookies e inventário do framework sempre executam; a IA só escolhe entre os checks opcionais permitidos."));
  } else {
    selection.append(node("p", "status-line", model.running ? "◐ Aguardando seleção das verificações…" : "Nenhuma seleção de verificações registrada."));
  }

  const holder = $("plan-agents");
  holder.replaceChildren();
  model.stageStates.forEach((stage) => {
    const summary = [node("span", "agent-num", stage.number), node("strong", "", stage.title),
      node("span", `agent-state ${stage.state}`, stageStateLabel(stage)),
      node("small", "", stage.steps.length ? `${stage.steps.length} ${stage.steps.length === 1 ? "plano registrado" : "planos registrados"}` : "sem plano registrado")];
    const block = details(`plan-${stage.id}`, summary, stage.state === "active", `plan-stage ${stage.state}`);
    const body = node("div", "plan-stage-body");
    body.append(node("p", "panel-note", stage.description));
    if (stage.steps.length) {
      const list = node("div", "stage-plan-list");
      stage.steps.forEach((step) => list.append(stepCard(step)));
      body.append(list);
    } else {
      body.append(node("p", "stage-plan-empty", stage.id === "monitor"
        ? "O monitoramento compara execuções completas e não registra plano próprio."
        : stage.state === "pending" ? "O plano desta etapa é registrado imediatamente antes de sua execução."
          : "Justificativa indisponível: nenhum plano foi registrado para esta etapa."));
    }
    if (stage.events.length) {
      const last = stage.events[stage.events.length - 1];
      body.append(fact("Último registro", `${formatTime(last.timestamp)} · ${last.message || readable(last)}`));
    }
    block.append(body);
    holder.append(block);
  });
  applyOpenState(holder);

  const cta = $("plan-cta");
  cta.replaceChildren();
  if (model.running && model.state !== "planning") cta.append(button("Acompanhar a execução →", "button button-primary", () => goTo("execute")));
  else if (model.terminal) cta.append(button("Ver análise dos resultados →", "button button-primary", () => goTo("analyze")));
}

/* ===================== FASE 3 · Execução ===================== */
function eventRow(event) {
  const row = node("li", "event-row");
  const metadata = [event.method, event.url,
    Number.isInteger(event.status) ? `HTTP ${event.status}` : "",
    event.check ? checkLabels[event.check] || event.check : "",
    event.outcome ? `resultado ${event.outcome}` : "",
    event.agent ? `agente ${event.agent}` : "",
    event.action_id, event.approval_id ? `decisão ${event.status || ""}` : "",
    event.finding_id, event.error_type || event.error || "",
    typeof event.body_sha256 === "string" && /^[0-9a-f]{64}$/.test(event.body_sha256) ? `SHA-256 ${event.body_sha256.slice(0, 12)}…` : ""]
    .filter(Boolean).join(" · ");
  row.append(node("span", "audit-time", formatTime(event.timestamp)),
    node("span", "audit-phase", event.phase || event.type || "ação"),
    node("span", `audit-type type-${event.type || "other"}`, TYPE_LABELS[event.type] || event.type || ""),
    node("span", "audit-msg", `${event.message || readable(event)}${metadata ? ` · ${metadata}` : ""}`));
  return row;
}
function xaiBlock(stage, key, defaultOpen) {
  const block = details(key, [node("span", "", "Por que esta ação?"), node("small", "", "hipótese, ação, resultado esperado e condição de parada registrados pelo agente")], defaultOpen, "xai");
  const body = node("div", "xai-body");
  if (stage.steps.length) {
    const latest = stage.steps[stage.steps.length - 1];
    body.append(stepCard(latest));
    if (stage.steps.length > 1) {
      const more = details(`${key}-more`, `Ver os ${stage.steps.length - 1} planos anteriores desta etapa`, false, "xai-more");
      const list = node("div", "stage-plan-list");
      stage.steps.slice(0, -1).forEach((step) => list.append(stepCard(step)));
      more.append(list);
      body.append(more);
    }
  } else {
    body.append(node("p", "stage-plan-empty", "Justificativa indisponível: nenhum plano foi registrado para esta etapa até agora."));
  }
  const observed = stage.events.filter((event) => ["test", "decision", "observation", "agent_result", "evidence_link"].includes(event.type)).slice(-4);
  if (observed.length) {
    body.append(node("h4", "xai-heading", "Resultado observado"));
    const list = node("ol", "event-list");
    observed.forEach((event) => list.append(eventRow(event)));
    body.append(list);
  }
  block.append(body);
  return block;
}
function approvalCard(item, model) {
  const card = node("article", `approval-item approval-${item.status}`);
  const head = node("div", "approval-item-head");
  head.append(node("strong", "", item.action_id === "quoted_search" ? "Comparação de busca sintética" : `Ação condicionada: ${item.action_id || "não informada"}`),
    node("span", `pill status-${item.status}`, APPROVAL_LABELS[item.status] || "Estado desconhecido"));
  card.append(head, node("p", "", item.reason || "Motivo não informado"), node("small", "", `Alvo da ação: ${item.target || "origem não informada"}`));
  if (item.status !== "pending") {
    if (item.decided_at) card.append(node("small", "approval-expiry", `Decidida em ${formatTime(item.decided_at)}`));
    return card;
  }
  const step = model.planSteps.find((entry) => (entry.check_id || entry.step_id) === "sql_error_exposure");
  const why = details(`why-${item.id}`, "Por que esta ação foi proposta?", true, "xai");
  const whyBody = node("div", "xai-body");
  if (step) whyBody.append(stepCard(step));
  else whyBody.append(node("p", "stage-plan-empty", "Justificativa do plano indisponível para esta ação; apenas o motivo acima foi registrado."));
  why.append(whyBody);
  card.append(why);
  const remaining = model.maxRequests != null ? Math.max(0, model.maxRequests - model.requestCount) : null;
  const limits = node("ul", "fact-list");
  limits.append(listItem(`Executa no máximo duas requisições GET com os valores sintéticos q=apple e q=apple%27 na origem autorizada${remaining != null ? ` (orçamento restante: ${remaining} de ${model.maxRequests})` : ""}.`),
    listItem("Continua sujeita ao gateway: host exato, GET/HEAD, cadência e teto de bytes. Observa a diferença de resposta; não extrai dados nem altera estado."),
    listItem(`Sem decisão até ${formatTime(item.expires_at)}, a ação expira, o teste é pulado e a cobertura fica inconclusiva.`));
  card.append(node("h4", "xai-heading", "Limites e impacto"), limits);
  const minutes = Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / 60000));
  card.append(node("small", "approval-expiry", `Prazo: ${formatTime(item.expires_at)} · ${Number.isFinite(minutes) ? `${minutes} min restantes` : "prazo não determinado"}`));
  const actions = node("div", "approval-actions");
  const approve = button("Aprovar esta ação", "button button-primary", () => action("/api/approval/decision", { approval_id: item.id, approve: true }));
  const reject = button("Negar", "button button-ghost", () => action("/api/approval/decision", { approval_id: item.id, approve: false }));
  approve.disabled = reject.disabled = busy || !connected;
  actions.append(approve, reject);
  card.append(actions, node("small", "approval-note", "A decisão vale apenas para a ação declarada. Navegar entre telas não aprova nem nega nada, e o backend continua validando escopo e orçamento."));
  return card;
}
function renderExecute(model) {
  const { events, scope, result } = model;
  text($("exec-state-tag"), STATE_LABELS[model.state][0].toUpperCase());
  const active = model.stageStates[model.activeIndex];
  text($("exec-progress"), model.running && active
    ? `Etapa ${model.activeIndex + 1} de 8 · ${active.title}. O executor mantém o controle da rede; a interface reflete apenas eventos reais.`
    : model.terminal ? `Execução encerrada: ${STATE_LABELS[model.state][0].toLowerCase()}${result?.stop_reason ? ` · ${STOP_REASONS[result.stop_reason] || result.stop_reason}` : ""}.`
      : "O executor mantém o controle da rede; a interface reflete apenas eventos reais do backend.");

  const focus = $("active-agent");
  focus.replaceChildren();
  if (model.running && active) {
    const top = node("div", "agent-card-top");
    top.append(node("span", "agent-num", `${active.number} · ETAPA ${model.activeIndex + 1} DE 8`),
      node("span", "agent-state active", model.pendingApproval ? "AGUARDANDO DECISÃO" : model.snapshot.stop_requested ? "ENCERRANDO AÇÃO ATUAL" : "EM EXECUÇÃO"));
    const agentIcon = node("div", "agent-icon");
    agentIcon.append(iconNode(active.icon));
    focus.append(top, agentIcon, node("h3", "", active.title), node("p", "", active.description));
    if (model.pendingApproval) {
      const section = node("section", "approval-context");
      section.append(node("h4", "xai-heading", "Decisão humana necessária para continuar"), approvalCard(model.pendingApproval, model));
      focus.append(section);
    }
    focus.append(xaiBlock(active, `xai-${active.id}`, true));
    const recent = active.events.filter((event) => RELEVANT_TYPES.has(event.type)).slice(-5);
    const activity = node("div", "agent-activity");
    activity.append(node("h4", "xai-heading", "Atividade recente desta etapa"));
    if (recent.length) {
      const list = node("ol", "event-list");
      recent.forEach((event) => list.append(eventRow(event)));
      activity.append(list);
    } else {
      activity.append(node("p", "stage-plan-empty", "Nenhum evento relevante registrado ainda nesta etapa."));
    }
    focus.append(activity);
  } else if (model.terminal) {
    const top = node("div", "agent-card-top");
    top.append(node("span", "agent-num", "EXECUÇÃO ENCERRADA"), node("span", `agent-state ${model.state}`, STATE_LABELS[model.state][0].toUpperCase()));
    focus.append(top, node("h3", "", `Campanha ${STATE_LABELS[model.state][0].toLowerCase()}`),
      node("p", "", result?.stop_reason ? `Motivo registrado: ${STOP_REASONS[result.stop_reason] || result.stop_reason}.` : model.snapshot.error || "Sem motivo registrado."));
    const skipped = model.stageStates.filter((stage) => stage.state === "skipped");
    if (skipped.length) focus.append(node("p", "panel-note", `Etapas não executadas: ${skipped.map((stage) => stage.title).join(", ")}. Uma etapa concluída não implica campanha concluída.`));
    if (model.available.analyze) focus.append(button("Ver análise dos resultados →", "button button-primary", () => goTo("analyze")));
  } else {
    focus.append(emptyState("activity", "Nenhuma campanha em execução", "Inicie uma campanha na fase de configuração."));
  }
  applyOpenState(focus);

  const chips = $("completed-agents");
  chips.replaceChildren();
  const completed = model.stageStates.filter((stage) => stage.state === "complete");
  if (!completed.length) chips.append(node("p", "stage-plan-empty", "Nenhuma etapa concluída ainda."));
  completed.forEach((stage) => {
    const summary = [node("span", "chip-check", stage.hasError ? "!" : "✓"), node("span", "agent-num", stage.number), node("strong", "", stage.title),
      node("small", "", `${stage.events.length} ${stage.events.length === 1 ? "evento" : "eventos"}${stage.hasError ? " · erro registrado" : ""}`)];
    const chip = details(`chip-${stage.id}`, summary, false, `agent-chip ${stage.hasError ? "has-error" : ""}`);
    chip.append(xaiBlock(stage, `xai-chip-${stage.id}`, true));
    chips.append(chip);
  });
  applyOpenState(chips);

  const upcoming = $("upcoming-agents");
  upcoming.replaceChildren();
  const pending = model.stageStates.filter((stage) => stage.state === "pending" || stage.state === "skipped");
  if (!pending.length) upcoming.append(listItem("Todas as etapas foram alcançadas.", "upcoming-item"));
  pending.forEach((stage) => {
    const row = node("li", `upcoming-item ${stage.state}`);
    row.append(node("span", "chip-check", stage.state === "skipped" ? "—" : "○"), node("span", "agent-num", stage.number), node("span", "", stage.title),
      node("small", "", stage.state === "skipped" ? "não executada" : "pendente"));
    upcoming.append(row);
  });

  text($("exec-metric-requests"), pad2(model.requestCount));
  text($("exec-metric-requests-limit"), model.maxRequests != null ? `de ${model.maxRequests} no orçamento` : "orçamento não informado");
  $("exec-metric-requests-bar").style.width = model.maxRequests ? `${Math.min(100, Math.round((model.requestCount / model.maxRequests) * 100))}%` : "0%";
  text($("exec-metric-stages"), `${model.completedCount}/8`);
  text($("exec-metric-tests"), pad2(events.filter((event) => event.type === "test").length));
  text($("exec-metric-decisions"), pad2(events.filter((event) => event.type === "decision").length));

  const limits = $("exec-limits");
  limits.replaceChildren(
    listItem(`Host exato: ${Array.isArray(scope.allowed_hosts) && scope.allowed_hosts.length ? scope.allowed_hosts.join(", ") : model.target || "não informado"}`),
    listItem(`Métodos: ${Array.isArray(scope.allowed_methods) ? scope.allowed_methods.join("/") : "GET/HEAD"} · sem redirecionamentos`),
    listItem(`Cadência: intervalo mínimo ${scope.min_interval_seconds ?? "?"} s · timeout ${scope.timeout_seconds ?? "?"} s`),
    listItem(`Resposta: até ${scope.max_response_bytes ?? "?"} bytes, corpo descartado após análise`),
    listItem(`Parada: ${model.snapshot.stop_requested ? "solicitada; a ação atual termina dentro do timeout" : "disponível a qualquer momento"}`),
  );

  const evidence = $("exec-evidence");
  evidence.replaceChildren();
  const tests = events.filter((event) => event.type === "test");
  const observed = events.filter((event) => event.type === "observation" && (event.family || event.difficulty_counts));
  const links = events.filter((event) => event.type === "evidence_link");
  if (!tests.length && !observed.length && !links.length) evidence.append(listItem("Nenhum resultado de teste registrado ainda."));
  tests.slice(-8).forEach((event) => evidence.append(listItem(`${formatTime(event.timestamp)} · ${event.check ? checkLabels[event.check] || event.check : "verificação"}: ${event.message}${event.outcome ? ` → ${event.outcome}` : ""}${Number.isInteger(event.status) ? ` (HTTP ${event.status})` : ""}`)));
  observed.forEach((event) => evidence.append(listItem(`${formatTime(event.timestamp)} · ${event.family ? `framework ${event.family}${event.version ? ` ${event.version}` : ""} (${event.certainty || "certeza não informada"})` : `desafios nível 1: ${event.difficulty_counts?.["1"] ?? "?"}, nível 2: ${event.difficulty_counts?.["2"] ?? "?"}`}`)));
  links.forEach((event) => evidence.append(listItem(`${formatTime(event.timestamp)} · captura histórica vinculada ao achado ${event.finding_id || ""}`)));
  if (result) evidence.append(listItem(`Triagem concluída: ${model.findings.length} ${model.findings.length === 1 ? "achado classificado" : "achados classificados"}. Consulte a análise.`, "evidence-final"));

  const approvalsBox = $("exec-approvals");
  approvalsBox.replaceChildren();
  const decided = model.approvals.filter((item) => item.status !== "pending");
  if (!model.approvals.length) approvalsBox.append(node("p", "approval-empty", "Nenhuma ação condicionada proposta nesta execução."));
  if (model.pendingApproval) approvalsBox.append(node("p", "approval-empty", "A decisão pendente aparece no cartão do agente ativo."));
  decided.forEach((item) => approvalsBox.append(approvalCard(item, model)));

  const relevant = $("exec-events");
  relevant.replaceChildren();
  const rows = events.filter((event) => RELEVANT_TYPES.has(event.type)).slice(-8);
  if (!rows.length) relevant.append(listItem("Aguardando eventos da campanha.", "event-row"));
  rows.forEach((event) => relevant.append(eventRow(event)));
}

/* ===================== FASE 4 · Análise ===================== */
function collectLimitations(model) {
  const items = [];
  const { result, observations, findings } = model;
  if (!result) {
    items.push(model.snapshot.error || "Nenhum resultado registrado para esta campanha.");
    return items;
  }
  if (result.status === "inconclusive") items.push(`Campanha inconclusiva: ${STOP_REASONS[result.stop_reason] || result.stop_reason || "motivo não registrado"}.`);
  if (result.status === "stopped") {
    const skipped = model.stageStates.filter((stage) => stage.state === "skipped").map((stage) => stage.title);
    items.push(`Campanha interrompida (${STOP_REASONS[result.stop_reason] || result.stop_reason || "motivo não registrado"}). Etapas não executadas: ${skipped.join(", ") || "nenhuma"}.`);
  }
  if (result.status === "failed") items.push(`Campanha falhou: ${STOP_REASONS[result.stop_reason] || result.stop_reason || "motivo não registrado"}.`);
  observations.filter((item) => item.type === "conditioned_check" && item.status === "not_executed").forEach((item) => {
    items.push(`Teste "${checkLabels[item.check] || item.check}" não executado (${CONDITIONED_REASONS[item.reason] || item.reason || "sem motivo registrado"}); a cobertura declarada ficou incompleta.`);
  });
  const aiPlan = observations.find((item) => item.type === "ai_plan");
  if (aiPlan?.status === "failed") items.push(`Planejador por IA indisponível (${aiPlan.error_type || "erro"}); o perfil seguro determinístico foi aplicado.`);
  const advisor = observations.find((item) => item.type === "ai_advisor");
  if (advisor?.status === "failed") items.push(`Orientação por IA indisponível (${advisor.error_type || "erro"}); as recomendações determinísticas foram mantidas.`);
  const review = observations.find((item) => item.type === "target_ai_review");
  if (review?.status === "failed") items.push(`Priorização por IA indisponível (${review.error_type || "erro"}); as hipóteses locais seguem sem ordenação.`);
  const inventory = observations.find((item) => item.type === "framework_inventory");
  if (inventory && !(typeof inventory.version === "string" && inventory.version.trim())) items.push("Versão do framework não confirmada; os avisos correlacionados são referência de triagem, não prova de vulnerabilidade.");
  const inconclusive = findings.filter((item) => item.status === "inconclusive").length;
  if (inconclusive) items.push(`${inconclusive} ${inconclusive === 1 ? "resultado inconclusivo exige" : "resultados inconclusivos exigem"} contexto adicional antes de qualquer conclusão.`);
  if (!items.length) items.push("Nenhuma limitação adicional registrada além dos limites de escopo e volume da campanha.");
  return items;
}
function aiSummary(model) {
  const { observations, events, scope } = model;
  const plan = observations.find((item) => item.type === "ai_plan");
  const advisor = observations.find((item) => item.type === "ai_advisor");
  const review = observations.find((item) => item.type === "target_ai_review");
  const planEvent = [...events].reverse().find((event) => event.phase === "planning" && Array.isArray(event.check_ids));
  const describe = (item) => item ? (item.status === "completed" ? `concluído${item.model ? ` · ${item.model}` : ""}` : `falhou (${item.error_type || "erro"})`) : "não utilizado";
  return {
    model: plan?.model || advisor?.model || review?.model || scope.ai_model || "",
    planner: plan ? describe(plan) : planEvent ? (planEvent.source === "ai" ? "concluído" : planEvent.fallback ? "falhou · perfil seguro" : "não utilizado") : "não registrado",
    advisor: describe(advisor), reviewer: describe(review),
  };
}
function metricTile(label, value, note, accent) {
  const tile = node("article", `metric ${accent || ""}`);
  tile.append(node("span", "", label), node("strong", "", value), node("small", "", note));
  return tile;
}
function renderAnalyze(model) {
  const { result, findings, observations } = model;
  text($("analyze-state-tag"), STATE_LABELS[model.state][0].toUpperCase());
  const summary = $("analyze-summary");
  summary.replaceChildren();
  const bySeverity = result?.summary?.by_severity || {};
  const severityNote = Object.keys(bySeverity).length
    ? Object.entries(bySeverity).map(([key, count]) => `${count} ${SEVERITY_LABELS[key] || key}`).join(" · ") : "sem achados";
  const confidence = { high: 0, medium: 0, low: 0 };
  findings.forEach((item) => { if (item.confidence in confidence) confidence[item.confidence] += 1; });
  const withEvidence = findings.filter((item) => readable(item.proof).trim() || readable(item.excerpt).trim() || safeScreenshotPath(item.screenshot)).length;
  const analysis = observations.find((item) => item.type === "target_multiagent_analysis");
  const hypotheses = Array.isArray(analysis?.hypotheses) ? analysis.hypotheses.length : 0;
  summary.append(
    metricTile("STATUS FINAL", STATE_LABELS[model.state][0], result?.stop_reason ? STOP_REASONS[result.stop_reason] || result.stop_reason : model.snapshot.error || "sem motivo registrado", `state-${model.state}`),
    metricTile("ACHADOS", pad2(findings.length), severityNote),
    metricTile("ALTA CONFIANÇA", pad2(confidence.high), `${confidence.medium} média · ${confidence.low} baixa`),
    metricTile("COM EVIDÊNCIA", pad2(withEvidence), "trecho, prova ou captura"),
    metricTile("INCONCLUSIVOS", pad2(findings.filter((item) => item.status === "inconclusive").length), "resultados que exigem contexto"),
    metricTile("HIPÓTESES", pad2(hypotheses), "não confirmadas · a validar"),
  );
  const limitations = $("analyze-limitations");
  limitations.replaceChildren(...collectLimitations(model).map((item) => listItem(item)));

  renderFindingsExplorer(model);
  renderTargetAnalysis(observations, model.target || "alvo não informado");
  renderFrameworkInventory(observations);
  renderBasics(observations, model.running ? "running" : result?.status);
  setTab(analyzeTab);

  const cta = $("analyze-cta");
  cta.replaceChildren();
  if (model.available.report) cta.append(button("Ir para o relatório e encerramento →", "button button-primary", () => goTo("report")));
}
function findingCategory(finding) {
  return finding.status === "confirmed" ? "confirmed" : finding.status === "discarded" ? "discarded" : "inconclusive";
}
function renderFindingsExplorer(model) {
  const { findings, events, recommendations, result } = model;
  const list = $("finding-list");
  const detail = $("finding-detail");
  text($("findings-count"), findings.length);
  list.replaceChildren();
  detail.replaceChildren();
  if (!findings.length) {
    const checks = Array.isArray(result?.summary?.selected_checks) ? result.summary.selected_checks.map((check) => checkLabels[check] || check).join(", ") : "não registradas";
    list.append(emptyState("search", result ? "Nenhum achado nesta execução" : "Sem dados de achados",
      result ? `Verificações executadas: ${checks}. A ausência de achados não prova ausência de falhas.` : model.snapshot.error || "A campanha não produziu um resultado."));
    return;
  }
  if (!findings.some((item) => item.id === selectedFindingId)) selectedFindingId = findings[0].id;
  const categories = [["confirmed", "Observações confirmadas"], ["inconclusive", "Inconclusivos"], ["discarded", "Descartados registrados"]];
  const severityLabels = { high: "ALTA", medium: "MÉDIA", low: "BAIXA", info: "INFO" };
  categories.forEach(([status, label]) => {
    const group = findings.filter((item) => findingCategory(item) === status);
    const section = node("section", `finding-group finding-group-${status}`);
    section.append(node("h3", "finding-group-heading", `${label} · ${group.length}`));
    if (!group.length) section.append(node("p", "finding-group-empty", status === "discarded" ? "Nenhum candidato descartado registrado." : "Nenhum registro nesta categoria."));
    group.forEach((finding) => {
      const index = findings.indexOf(finding);
      const row = button("", "finding-row", () => { selectedFindingId = finding.id; renderFindingsExplorer(model); detail.focus({ preventScroll: true }); });
      row.setAttribute("aria-pressed", String(finding.id === selectedFindingId));
      const severity = String(finding.severity || "info").toLowerCase();
      row.append(node("span", "finding-number", pad2(index + 1)),
        node("span", "finding-row-title", finding.title || finding.name || finding.id || `Achado ${index + 1}`),
        node("span", `severity ${severity}`, severityLabels[severity] || severity.toUpperCase()));
      section.append(row);
    });
    list.append(section);
  });
  const finding = findings.find((item) => item.id === selectedFindingId);
  detail.append(findingDetail(finding, findings.indexOf(finding), events, recommendations));
  applyOpenState(detail);
}
function findingDetail(finding, index, events, recommendations) {
  const panel = node("article", "finding");
  panel.setAttribute("aria-label", `Detalhe do achado ${index + 1}`);
  const head = node("div", "finding-head");
  const titleGroup = node("div", "finding-title-group");
  const info = node("div");
  info.append(node("h3", "", finding.title || finding.name || finding.id || `Achado ${index + 1}`));
  const meta = node("div", "finding-meta");
  const statusLabels = { confirmed: "observação confirmada", inconclusive: "inconclusivo", discarded: "descartado" };
  const confidenceLabels = { high: "confiança alta", medium: "confiança média", low: "confiança baixa" };
  [finding.id, statusLabels[finding.status] || finding.status, confidenceLabels[finding.confidence] || finding.confidence,
    finding.check ? `check ${checkLabels[finding.check] || finding.check}` : ""].filter(Boolean).forEach((item) => meta.append(node("span", "", item)));
  info.append(meta);
  titleGroup.append(node("span", "finding-number", pad2(index + 1)), info);
  const severity = String(finding.severity || "info").toLowerCase();
  const severityLabels = { high: "ALTA", medium: "MÉDIA", low: "BAIXA", info: "INFO" };
  head.append(titleGroup, node("span", `severity ${severity}`, severityLabels[severity] || severity.toUpperCase()));
  panel.append(head);
  const body = node("div", "finding-detail");
  const description = finding.description || finding.summary || finding.impact;
  if (description) body.append(node("p", "finding-impact", description));
  if (finding.url) body.append(fact("URL observada", finding.url));

  body.append(node("h4", "finding-evidence-label", "Evidência observada"));
  const grid = node("div", "finding-evidence-grid");
  [{ label: "Trecho observado", value: finding.excerpt, fallback: "Trecho não registrado nesta execução.", code: true },
    { label: "Prova do teste", value: finding.proof, fallback: "Prova detalhada não registrada nesta execução." },
    { label: "Evidência", value: finding.evidence, fallback: "Evidência detalhada não registrada nesta execução." }]
    .forEach(({ label, value, fallback, code }) => {
      const card = node("div", "finding-evidence-card");
      card.append(node("h4", "finding-evidence-label", label));
      card.append(node(code ? "pre" : "p", code ? "finding-excerpt" : "finding-evidence-text", readable(value).trim() || fallback));
      grid.append(card);
    });
  body.append(grid);

  const screenshotPath = safeScreenshotPath(finding.screenshot);
  if (screenshotPath) {
    const caption = typeof finding.screenshot_caption === "string" && finding.screenshot_caption.trim()
      ? finding.screenshot_caption.trim()
      : "Origem visual não informada; este registro não comprova, por si só, uma captura direta do alvo.";
    const visual = node("figure", "finding-screenshot");
    const preview = node("a", "finding-screenshot-preview");
    preview.href = screenshotPath; preview.target = "_blank"; preview.rel = "noopener noreferrer";
    preview.setAttribute("aria-label", "Abrir imagem de evidência em nova aba");
    const image = node("img");
    image.src = screenshotPath; image.alt = "Prévia do registro visual de evidência"; image.loading = "lazy"; image.decoding = "async";
    preview.append(image);
    const annotation = node("div", "finding-screenshot-annotation");
    const open = node("a", "finding-screenshot-open");
    open.append(document.createTextNode("Abrir imagem"), iconNode("external"));
    open.href = screenshotPath; open.target = "_blank"; open.rel = "noopener noreferrer";
    annotation.append(node("h4", "finding-evidence-label", "Registro visual"), node("figcaption", "", caption), open);
    if (/^[0-9a-f]{64}$/.test(finding.screenshot_sha256 || "")) annotation.append(node("small", "finding-image-hash", `SHA-256: ${finding.screenshot_sha256}`));
    visual.append(preview, annotation);
    body.append(visual);
  }
  if (finding.reproduction) {
    const reproduction = node("div", "finding-reproduction");
    reproduction.append(node("strong", "", "Reprodução controlada"), node("p", "", finding.reproduction));
    body.append(reproduction);
  }

  const triage = events.find((event) => event.type === "triage" && event.finding_id === finding.id);
  const why = details(`why-finding-${finding.id}`, "Justificativa da classificação", true, "xai");
  const whyBody = node("div", "xai-body");
  const semantics = { confirmed: "Confirmado significa observação reproduzida pelo check; não comprova exploração, impacto em contas nem CVE aplicável.",
    inconclusive: "Inconclusivo é um sinal que precisa de contexto adicional antes de qualquer conclusão.",
    discarded: "Descartado é uma hipótese examinada e refutada pela própria campanha." };
  if (triage) {
    whyBody.append(node("p", "", `Classificação registrada pela triagem em ${formatTime(triage.timestamp)}: severidade ${triage.severity || "não informada"}, estado ${triage.status || "não informado"}, confiança ${triage.confidence || "não informada"}${finding.check ? `, pela regra da verificação "${checkLabels[finding.check] || finding.check}"` : ""}.`));
  } else {
    whyBody.append(node("p", "stage-plan-empty", "Registro de triagem indisponível para este achado; a classificação exibida vem do resultado consolidado."));
  }
  whyBody.append(node("p", "panel-note", semantics[finding.status] || "Estado não documentado."));
  why.append(whyBody);
  body.append(why);

  const limitation = node("div", "finding-limitation");
  limitation.append(node("strong", "", "Limite da conclusão"),
    node("p", "", readable(finding.limitations).trim() || "Limites específicos não registrados nesta execução; reexecute a campanha para revisar este achado."));
  body.append(limitation);

  const fixes = details(`fix-${finding.id}`, "Orientações para correção", false, "xai");
  const fixBody = node("div", "xai-body");
  const related = recommendations.filter((item) => item.finding_id === finding.id);
  if (finding.recommendation) fixBody.append(node("p", "", readable(finding.recommendation)));
  if (finding.code_hint) fixBody.append(node("pre", "", readable(finding.code_hint)));
  related.forEach((item) => {
    const card = node("div", "fix-card");
    card.append(node("span", "recommendation-top", item.source === "ai" ? `SUGESTÃO IA${item.model ? ` · ${item.model}` : ""} · revisar antes de aplicar` : "CORREÇÃO DETERMINÍSTICA"));
    const advice = item.guidance || item.advice || item.description || item.fix;
    if (advice) card.append(node("p", "", readable(advice)));
    const verification = item.verification || item.regression_test || item.validation;
    if (verification) card.append(node("p", "", `Verificação: ${readable(verification)}`));
    const code = item.code_hint || item.code_example || item.code || item.snippet;
    if (code) card.append(node("pre", "", readable(code)));
    fixBody.append(card);
  });
  if (!finding.recommendation && !finding.code_hint && !related.length) fixBody.append(node("p", "stage-plan-empty", "Nenhuma orientação de correção registrada para este achado."));
  fixes.append(fixBody);
  body.append(fixes);
  panel.append(body);
  return panel;
}
function setTab(id) {
  analyzeTab = id;
  ["findings", "hypotheses", "inventory"].forEach((key) => {
    const tab = $(`tab-${key}`);
    const selected = key === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(`panel-${key}`).hidden = !selected;
  });
}

/* ===== Blocos reaproveitados do console anterior (hipóteses, inventário, básicos) ===== */
function renderBasics(observations, campaignStatus) {
  const catalog = observations.find((item) => item.type === "beginner_challenges");
  $("basics").hidden = !catalog && Boolean(campaignStatus) && campaignStatus !== "running";
  text($("difficulty-one"), catalog?.difficulty_counts?.["1"] ?? "—");
  text($("difficulty-two"), catalog?.difficulty_counts?.["2"] ?? "—");
  const list = $("tutorial-list");
  list.replaceChildren();
  const names = Array.isArray(catalog?.tutorial_names) ? catalog.tutorial_names : [];
  if (!names.length) list.append(node("li", "", "Os nomes aparecem após uma campanha concluída."));
  else names.forEach((name) => list.append(node("li", "", name)));
}
function renderFrameworkInventory(observations) {
  const inventory = observations.find((item) => item.type === "framework_inventory");
  const family = typeof inventory?.family === "string" && inventory.family.trim() ? inventory.family.trim() : "Não identificada";
  const version = (typeof inventory?.version === "string" || typeof inventory?.version === "number")
    && String(inventory.version).trim() ? String(inventory.version).trim() : "Não confirmada";
  const certaintyLabels = {
    exact: "Versão exata observada", conflicting_versions: "Versões conflitantes", family_only: "Apenas família identificada",
    not_detected: "Não detectado", confirmed: "Confirmada", high: "Alta", medium: "Média", low: "Baixa", inferred: "Inferida", unknown: "Desconhecida",
  };
  const certainty = typeof inventory?.certainty === "string" ? inventory.certainty.trim() : "";
  const advisories = Array.isArray(inventory?.advisories) ? inventory.advisories : [];
  text($("framework-count"), inventory ? `${advisories.length}` : "—");
  text($("framework-family"), inventory ? family : "Aguardando");
  text($("framework-version"), version);
  text($("framework-certainty"), certaintyLabels[certainty.toLowerCase()] || certainty || "—");
  text($("framework-caveat"), !inventory
    ? "Nenhuma versão ou instalação afetada foi confirmada nesta execução."
    : version === "Não confirmada"
      ? "A versão instalada não foi confirmada. Estes avisos são referências para triagem e não comprovam vulnerabilidade no alvo."
      : "A versão observada e a aplicabilidade dos avisos exigem validação no inventário e no build do alvo. Estes avisos não comprovam vulnerabilidade.");
  const evidence = inventory?.evidence;
  const evidenceItems = Array.isArray(evidence) ? evidence : evidence == null ? [] : [evidence];
  const evidenceContainer = $("framework-evidence");
  evidenceContainer.replaceChildren();
  if (evidenceItems.length) {
    const evidenceList = node("ul", "framework-evidence-list");
    evidenceItems.forEach((item) => evidenceList.append(node("li", "", readable(item) || JSON.stringify(item))));
    evidenceContainer.append(evidenceList);
  } else {
    evidenceContainer.append(node("p", "", "Nenhuma evidência de framework registrada nesta execução."));
  }
  const list = $("framework-advisories");
  list.replaceChildren();
  if (!advisories.length) {
    list.append(node("p", "framework-empty", inventory
      ? "Nenhum aviso correlacionado com a evidência disponível. Isso não confirma ausência de falhas."
      : "Nenhum aviso correlacionado até agora."));
    return;
  }
  const statusLabels = {
    version_unconfirmed: "Versão não confirmada", reference_only: "Referência sem confirmação", candidate: "Aplicabilidade a verificar",
    potential: "Aplicabilidade a verificar", possible: "Possível; validar versão", not_confirmed: "Não confirmado",
    affected: "Faixa afetada descrita no aviso", not_applicable: "Não aplicável à versão observada", unknown: "Indeterminada",
  };
  advisories.forEach((advisory) => {
    if (!advisory || typeof advisory !== "object") return;
    const item = node("article", "framework-advisory");
    const title = [advisory.id, advisory.cve].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ");
    item.append(node("strong", "", title || "Aviso de segurança"));
    if (advisory.status) item.append(node("span", "framework-advisory-status", `Correlação: ${statusLabels[advisory.status] || String(advisory.status).replaceAll("_", " ")}`));
    if (advisory.reason) item.append(node("p", "", advisory.reason));
    list.append(item);
  });
}
function analysisFact(label, value) {
  const row = node("p", "analysis-fact");
  row.append(node("strong", "", label), node("span", "", readable(value) || "Não determinado."));
  return row;
}
function renderTargetAnalysis(observations, target) {
  const analysis = observations.find((item) => item.type === "target_multiagent_analysis");
  const aiReview = observations.find((item) => item.type === "target_ai_review");
  const hypotheses = Array.isArray(analysis?.hypotheses) ? analysis.hypotheses : [];
  text($("target-analysis-count"), analysis ? `${hypotheses.length}` : "0");
  text($("target-analysis-caveat"), analysis
    ? "Estas hipóteses foram geradas a partir de dados coletados nesta URL. São passos para validação; só entram em Achados após uma prova específica e autorizada."
    : "Execute uma campanha para analisar esta URL. Hipóteses só aparecem após nova coleta.");
  const meta = $("target-analysis-meta");
  meta.replaceChildren();
  if (analysis) meta.append(node("span", "", `Alvo desta análise: ${target}`), node("span", "", "Fonte: respostas, scripts e achados desta campanha"));
  const runs = $("target-agent-runs");
  runs.replaceChildren();
  const agentNames = {
    technology_inventory: ["Inventário técnico", "Organiza os marcadores de tecnologia coletados."],
    evidence_review: ["Revisão da evidência", "Relaciona provas e limites dos testes concluídos."],
    followup_hypotheses: ["Hipóteses futuras", "Propõe verificações condicionais a partir dos sinais."],
    inventory: ["Inventário técnico", "Organiza os marcadores de tecnologia coletados."],
    evidence: ["Revisão da evidência", "Relaciona provas e limites dos testes concluídos."],
    hypotheses: ["Hipóteses futuras", "Propõe verificações condicionais a partir dos sinais."],
  };
  const agentRuns = Array.isArray(analysis?.agent_runs) ? analysis.agent_runs : [];
  if (!agentRuns.length) runs.append(node("p", "analysis-empty", analysis ? "Nenhuma execução de agente foi registrada." : "Aguardando dados da campanha."));
  agentRuns.forEach((run) => {
    if (!run || typeof run !== "object") return;
    const [name, description] = agentNames[run.name] || [run.name || "Agente", "Análise local."];
    const card = node("article", "analysis-agent-card");
    const status = run.status === "completed" ? "CONCLUÍDO" : run.status === "failed" ? "FALHOU" : "NÃO EXECUTADO";
    card.append(node("span", `analysis-agent-status ${run.status === "completed" ? "complete" : ""}`, status), node("h4", "", name), node("p", "", run.detail || description));
    if (Number.isFinite(run.duration_ms) && run.duration_ms >= 0) card.append(node("small", "", `${Math.round(run.duration_ms)} ms · análise local`));
    runs.append(card);
  });
  const technology = $("target-technology");
  technology.replaceChildren();
  const tech = analysis?.technology;
  if (tech && typeof tech === "object") {
    const card = node("article", "analysis-technology-card");
    const certainty = { exact: "Versão observada", family_only: "Somente família", not_detected: "Não detectada", conflicting_versions: "Marcadores conflitantes" }[tech.certainty] || tech.certainty || "Não determinada";
    card.append(analysisFact("Família", tech.family || "Não identificada"), analysisFact("Versão", tech.version || "Não determinada"), analysisFact("Certeza", certainty),
      analysisFact("Página inicial", Number.isInteger(tech.home_status) ? `HTTP ${tech.home_status}` : "Não determinada"),
      analysisFact("Formato", tech.html_response ? "HTML observado" : "HTML não confirmado"),
      analysisFact("Scripts analisados", Number.isInteger(tech.asset_count) ? String(tech.asset_count) : "Não determinado"),
      analysisFact("Limite", tech.limitations || "O inventário passivo não identifica toda a pilha do servidor."));
    technology.append(card);
  } else {
    technology.append(node("p", "analysis-empty", "Nenhum marcador técnico foi registrado nesta análise."));
  }
  const signals = $("target-signals");
  signals.replaceChildren();
  const signalItems = Array.isArray(analysis?.signals) ? analysis.signals : [];
  if (!signalItems.length) signals.append(node("p", "analysis-empty", "Nenhum sinal foi associado a hipóteses nesta campanha."));
  signalItems.forEach((signal) => {
    if (!signal || typeof signal !== "object") return;
    const item = node("article", "analysis-signal");
    item.append(node("strong", "", checkLabels[signal.check] || signal.check || "Sinal da campanha"), node("span", "", signal.status === "confirmed" ? "OBSERVAÇÃO CONFIRMADA" : "SINAL INCONCLUSIVO"));
    if (signal.finding_id) item.append(analysisFact("Achado relacionado", signal.finding_id));
    if (signal.proof) item.append(analysisFact("Prova já coletada", signal.proof));
    item.append(analysisFact("Limite", signal.limitations || "O sinal não comprova uma hipótese adicional."));
    signals.append(item);
  });
  const list = $("target-hypotheses");
  list.replaceChildren();
  if (!hypotheses.length) list.append(node("p", "analysis-empty", analysis ? "Nenhuma hipótese adicional foi formulada com a evidência disponível." : "Execute uma nova campanha para gerar hipóteses sobre a URL informada."));
  hypotheses.forEach((hypothesis, index) => {
    if (!hypothesis || typeof hypothesis !== "object") return;
    const block = details(`hyp-${hypothesis.id || index}`, [], false, "analysis-hypothesis");
    const summary = block.querySelector("summary");
    summary.className = "analysis-hypothesis-summary";
    const title = node("span", "analysis-hypothesis-title");
    title.append(node("small", "", pad2(index + 1)), node("strong", "", hypothesis.title || hypothesis.id || "Hipótese"));
    summary.append(title, node("span", "analysis-hypothesis-badge", "A VALIDAR"));
    const body = node("div", "analysis-hypothesis-body");
    body.append(analysisFact("Estado", "Hipótese não confirmada por esta campanha."), analysisFact("Base observada", hypothesis.basis),
      analysisFact("Resultado a verificar", hypothesis.expected_result), analysisFact("Próxima verificação", hypothesis.verification), analysisFact("Limite", hypothesis.limitations));
    const related = Array.isArray(hypothesis.related_finding_ids) ? hypothesis.related_finding_ids : [];
    if (related.length) body.append(analysisFact("Achados relacionados", related.join(" · ")));
    block.append(body);
    list.append(block);
  });
  applyOpenState(list);
  text($("target-ai-status"), aiReview?.status === "completed" ? `IA ${aiReview.model || ""} · CONCLUÍDA` : aiReview?.status === "failed" ? "IA INDISPONÍVEL" : "SEM PRIORIZAÇÃO POR IA");
  const priorities = $("target-ai-priorities");
  priorities.replaceChildren();
  const suggestions = Array.isArray(aiReview?.priorities) ? aiReview.priorities : [];
  if (!suggestions.length) priorities.append(node("p", "analysis-empty", aiReview?.status === "failed" ? "A priorização por IA falhou; a análise local permanece disponível." : "Nenhuma prioridade por IA nesta campanha."));
  const knownIds = new Set(hypotheses.map((item) => item.id));
  suggestions.forEach((suggestion) => {
    if (!suggestion || typeof suggestion !== "object" || !knownIds.has(suggestion.id)) return;
    const card = node("article", "analysis-priority");
    const title = hypotheses.find((item) => item.id === suggestion.id)?.title || suggestion.id;
    card.append(node("span", "analysis-priority-rank", { high: "ALTA", medium: "MÉDIA", low: "BAIXA" }[suggestion.priority] || "PRIORIDADE"), node("h4", "", title),
      analysisFact("Por que revisar", suggestion.rationale), analysisFact("Próximo passo", suggestion.next_step), analysisFact("Limite", suggestion.limitation));
    priorities.append(card);
  });
}

/* ===================== FASE 5 · Relatório ===================== */
function renderRecommendations(recommendations, findings) {
  const list = $("recommendations-list");
  const findingTitles = new Map(findings.map((finding) => [finding.id, finding.title]));
  list.replaceChildren();
  if (!recommendations.length) {
    list.append(emptyState("wrench", "Sem orientações nesta execução", "As recomendações aparecem quando há evidência classificada."));
    return;
  }
  recommendations.forEach((recommendation, index) => {
    const card = node("article", "recommendation-card");
    const top = node("div", "recommendation-top");
    top.append(node("span", "", `${recommendation.source === "ai" ? "SUGESTÃO IA" : "CORREÇÃO"} ${pad2(index + 1)}`), node("span", "", recommendation.finding_id || recommendation.priority || ""));
    card.append(top, node("h3", "", recommendation.title || recommendation.name || findingTitles.get(recommendation.finding_id) || "Orientação de correção"));
    const advice = recommendation.advice || recommendation.description || recommendation.guidance || recommendation.fix;
    if (advice) card.append(node("p", "", readable(advice)));
    const regression = recommendation.regression_test || recommendation.test || recommendation.validation || recommendation.verification;
    if (regression) card.append(node("p", "", `Verificação: ${readable(regression)}`));
    const code = recommendation.code_example || recommendation.code || recommendation.snippet || recommendation.code_hint;
    if (code) card.append(node("pre", "", readable(code)));
    list.append(card);
  });
}
function renderAIStatus(observations, scope, events) {
  const ai = observations.find((item) => item.type === "ai_advisor");
  const plan = [...events].reverse().find((event) => event.phase === "planning" && Array.isArray(event.check_ids));
  text($("ai-status"), ai?.status === "completed" ? `IA ${ai.model || ""} · CONCLUÍDA`
    : ai?.status === "failed" ? `IA ${ai.model || ""} · FALHOU`
      : plan?.fallback ? "IA INDISPONÍVEL · PLANO SEGURO"
        : plan?.source === "ai" ? `IA ${scope.ai_model || ""} · PLANO DEFINIDO`
          : scope.ai_model ? `IA ${scope.ai_model} · CONFIGURADA` : "IA DESLIGADA");
}
function dlRow(label, value) {
  return [node("dt", "", label), node("dd", "", readable(value).trim() || "não registrado")];
}
function renderReport(model) {
  const { result, findings, recommendations, events, observations, scope } = model;
  text($("report-state-tag"), STATE_LABELS[model.state][0].toUpperCase());
  const exec = $("report-exec");
  exec.replaceChildren();
  if (result) {
    const ai = aiSummary(model);
    const bySeverity = result.summary?.by_severity || {};
    const byStatus = result.summary?.by_status || {};
    exec.append(...dlRow("Alvo", result.target), ...dlRow("Campanha", result.campaign_name), ...dlRow("Execução", result.run_id),
      ...dlRow("Início", formatDateTime(result.started_at)), ...dlRow("Fim", formatDateTime(result.ended_at)),
      ...dlRow("Duração", formatDuration(result.started_at, result.ended_at)),
      ...dlRow("Estado", `${STATE_LABELS[model.state][0]} · ${STOP_REASONS[result.stop_reason] || result.stop_reason || "motivo não registrado"}`),
      ...dlRow("Requisições", `${model.requestCount} de ${scope.max_requests ?? "?"}`),
      ...dlRow("Achados", findings.length ? Object.entries(bySeverity).map(([key, count]) => `${count} ${SEVERITY_LABELS[key] || key}`).join(" · ") : "nenhum"),
      ...dlRow("Estados", Object.entries(byStatus).map(([key, count]) => `${count} ${FINDING_STATUS_LABELS[key] || key}`).join(" · ") || "nenhum"),
      ...dlRow("IA", `planejador ${ai.planner} · orientador ${ai.advisor} · priorizador ${ai.reviewer}`));
  } else {
    exec.append(...dlRow("Estado", model.snapshot.error || "Sem resultado registrado."));
  }
  const technical = $("report-technical");
  technical.replaceChildren();
  const selected = Array.isArray(result?.summary?.selected_checks) ? result.summary.selected_checks : [];
  const conditioned = observations.filter((item) => item.type === "conditioned_check");
  if (!selected.length) technical.append(listItem("Nenhuma verificação registrada."));
  selected.forEach((check) => {
    const tests = events.filter((event) => event.type === "test" && event.check === check);
    const related = findings.filter((item) => item.check === check);
    const skipped = conditioned.find((item) => item.check === check && item.status === "not_executed");
    const state = skipped ? `não executado (${CONDITIONED_REASONS[skipped.reason] || skipped.reason})`
      : tests.length ? `${tests.length} ${tests.length === 1 ? "teste" : "testes"}${tests.some((event) => event.outcome) ? ` · ${[...new Set(tests.map((event) => event.outcome).filter(Boolean))].join(", ")}` : ""}`
        : ["headers", "cookies", "framework_inventory"].includes(check) ? "executado nas verificações obrigatórias" : "sem evento de teste registrado";
    technical.append(listItem(`${checkLabels[check] || check}: ${state}${related.length ? ` · ${related.length} ${related.length === 1 ? "achado" : "achados"}` : ""}`));
  });
  const available = Array.isArray(result?.summary?.available_checks) ? result.summary.available_checks.filter((check) => !selected.includes(check)) : [];
  if (available.length) technical.append(listItem(`Não selecionados nesta campanha: ${available.map((check) => checkLabels[check] || check).join(", ")}.`));

  const reportFindings = $("report-findings");
  reportFindings.replaceChildren();
  if (!findings.length) reportFindings.append(node("p", "stage-plan-empty", result ? "Nenhum achado nos testes executados; isso não prova ausência de falhas." : "Sem dados."));
  const severityLabels = { high: "ALTA", medium: "MÉDIA", low: "BAIXA", info: "INFO" };
  findings.forEach((finding, index) => {
    const severity = String(finding.severity || "info").toLowerCase();
    const row = button("", "finding-row compact", () => { selectedFindingId = finding.id; analyzeTab = "findings"; goTo("analyze"); });
    row.append(node("span", "finding-number", pad2(index + 1)), node("span", "finding-row-title", finding.title || finding.id),
      node("span", "finding-row-meta", `${{ confirmed: "confirmado", inconclusive: "inconclusivo", discarded: "descartado" }[finding.status] || finding.status} · confiança ${CONFIDENCE_LABELS[finding.confidence] || finding.confidence || "?"} · ${readable(finding.proof).trim() || readable(finding.excerpt).trim() || safeScreenshotPath(finding.screenshot) ? "com evidência" : "sem evidência detalhada"}`),
      node("span", `severity ${severity}`, severityLabels[severity] || severity.toUpperCase()));
    reportFindings.append(row);
  });
  renderRecommendations(recommendations, findings);
  renderAIStatus(observations, scope, events);
  $("report-limitations").replaceChildren(...collectLimitations(model).map((item) => listItem(item)));
  const diff = model.snapshot.delta?.summary;
  text($("monitor-delta"), diff
    ? `Comparação com a execução anterior: ${diff.new} novo(s), ${diff.resolved} resolvido(s), ${diff.changed} alterado(s), ${diff.unchanged} estável(is).`
    : "A comparação de regressões aparece após duas campanhas completas no mesmo alvo.");
  text($("report-audit-count"), events.length);
  ["download-btn", "download-json-btn"].forEach((id) => {
    $(id).classList.toggle("disabled", !model.snapshot.report_available);
    $(id).setAttribute("aria-disabled", String(!model.snapshot.report_available));
  });
  $("new-campaign-btn").disabled = model.running;
}

/* ===================== Auditoria (gaveta) ===================== */
function renderAudit(events) {
  const list = $("audit-list");
  const allowed = AUDIT_FILTERS[auditFilter];
  const rows = allowed ? events.filter((event) => allowed.has(event.type)) : events;
  text($("audit-count"), `${rows.length} DE ${events.length} EVENTOS`);
  list.replaceChildren();
  if (!rows.length) {
    list.append(node("li", "audit-placeholder", events.length ? "Nenhum evento neste filtro." : "Aguardando o início da campanha..."));
    return;
  }
  rows.forEach((event) => list.append(eventRow(event)));
  list.scrollTop = list.scrollHeight;
}
function toggleAudit(open) {
  auditOpen = open;
  $("audit-drawer").hidden = !open;
  $("audit-toggle").setAttribute("aria-expanded", String(open));
  if (open) {
    if (lastModel) renderAudit(lastModel.events);
    $("audit-close").focus();
  } else {
    $("audit-toggle").focus();
  }
}

/* ===================== Orquestração ===================== */
function showView(phase) {
  document.querySelectorAll(".phase-view").forEach((view) => {
    const visible = view.dataset.phase === phase;
    if (visible && view.hidden) view.classList.add("entering");
    view.hidden = !visible;
  });
}
function render(snapshot, force = false) {
  lastSnapshot = snapshot;
  const model = deriveModel(snapshot);
  lastModel = model;
  const phase = resolvePhase(model);
  if (phase !== renderedPhase) { showView(phase); renderedPhase = phase; }
  renderControlBar(model);
  renderStepper(model, phase);
  renderBanners(model, phase);
  if (phase === "configure") renderConfigure(model);
  else if (phase === "plan") renderPlan(model);
  else if (phase === "execute") renderExecute(model);
  else if (phase === "analyze") renderAnalyze(model);
  else if (phase === "report") renderReport(model);
  if (auditOpen) renderAudit(model.events);
  if (snapshot.error && !force) message(snapshot.error, true);
}

let loading = false;
async function refresh() {
  if (loading) { pendingRefresh = true; return; }
  loading = true;
  const seq = ++requestSeq;
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    if (seq <= acceptAfterSeq) return; /* pedida antes da última ação: estado possivelmente antigo */
    const wasOffline = !connected;
    connected = true;
    if (wasOffline) { message("Conexão com o console restabelecida."); lastRaw = null; }
    const unchanged = raw === lastRaw && lastModel && !lastModel.pendingApproval;
    if (unchanged) return;
    lastRaw = raw;
    render(JSON.parse(raw));
  } catch (error) {
    connected = false;
    $("start-btn").disabled = true;
    $("stop-btn").disabled = true;
    if (lastModel) { renderControlBar(lastModel); renderBanners(lastModel, renderedPhase); }
    else $("connection-banner").hidden = false;
    message(`Não foi possível consultar o console: ${error.message}`, true);
  } finally {
    loading = false;
    if (pendingRefresh) { pendingRefresh = false; refresh(); }
  }
}
async function action(path, data = {}) {
  if (busy) return false;
  busy = true;
  if (lastModel) renderControlBar(lastModel);
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const payload = await response.json();
    message(payload.message || payload.error || `HTTP ${response.status}`, !response.ok);
    busy = false;
    acceptAfterSeq = requestSeq;
    if (response.ok && path === "/api/campaign/start") resetCampaignUI();
    starting = false;
    lastRaw = null;
    await refresh();
    return response.ok;
  } catch (error) {
    message(`Ação indisponível: ${error.message}`, true);
    return false;
  } finally {
    busy = false;
    if (starting) { starting = false; if (lastModel) renderControlBar(lastModel); }
  }
}

/* ===================== Formulário (preservado) ===================== */
function updateTargetPreview() {
  const input = $("target-url");
  const preview = $("target-preview");
  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity("Informe a URL do alvo.");
    text(preview, "Informe uma URL HTTPS autorizada.");
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search) {
      input.setCustomValidity("Use HTTPS e remova usuário, senha e parâmetros da URL.");
      text(preview, "Use HTTPS e remova usuário, senha e parâmetros da URL.");
    } else {
      input.setCustomValidity("");
      text(preview, `Origem exata: ${parsed.origin}`);
    }
  } catch {
    input.setCustomValidity("Informe uma URL HTTPS válida.");
    text(preview, "Informe uma URL HTTPS válida.");
  }
}
function updateAIProviderFields(running = false) {
  const bedrock = $("ai-provider").value === "bedrock";
  $("ai-provider").disabled = running;
  $("ai-model").disabled = running;
  $("aws-region").disabled = running || !bedrock;
  $("api-key").disabled = running;
  $("aws-region-field").hidden = !bedrock;
  text($("api-key-label"), bedrock ? "Amazon Bedrock API key" : "Chave OpenAI");
  $("api-key").placeholder = bedrock ? "Cole a chave Bedrock desta campanha" : "Cole a chave OpenAI desta campanha";
  text($("api-key-help"), bedrock
    ? "Opcional se o servidor já tiver credenciais AWS. O console usa a chave só em memória."
    : "Opcional se OPENAI_API_KEY estiver no servidor. O console usa a chave só em memória.");
  $("ai-model").placeholder = bedrock ? "amazon.nova-micro-v1:0" : "gpt-6-luna";
  text($("ai-model-help"), bedrock ? "Aceita model ID, inference profile ID ou ARN compatível com Converse." : "Informe um modelo OpenAI ou deixe em branco.");
}

$("target-url").addEventListener("input", () => {
  targetDirty = true;
  $("authorization-confirmed").checked = false;
  updateTargetPreview();
  if (lastModel) renderControlBar(lastModel);
});
$("ai-provider").addEventListener("change", () => {
  aiProviderInitialized = true;
  $("api-key").value = "";
  updateAIProviderFields(false);
});
$("api-key").value = "";
window.addEventListener("pageshow", () => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  $("api-key").value = "";
  updateAIProviderFields(false);
});
$("campaign-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  updateTargetPreview();
  if (!$("campaign-form").reportValidity()) return;
  const targetUrl = $("target-url").value.trim();
  const keyInput = $("api-key");
  const apiKey = keyInput.value.trim();
  keyInput.value = "";
  starting = true;
  if (lastModel) renderControlBar(lastModel);
  const accepted = await action("/api/campaign/start", {
    target_url: targetUrl,
    api_key: apiKey,
    ai_provider: $("ai-provider").value,
    ai_model: $("ai-model").value.trim(),
    aws_region: $("aws-region").value.trim(),
    authorization_confirmed: $("authorization-confirmed").checked,
  });
  if (accepted) {
    targetDirty = false;
    $("authorization-confirmed").checked = false;
  }
});
$("stop-btn").addEventListener("click", () => action("/api/campaign/stop"));
["download-btn", "download-json-btn"].forEach((id) => $(id).addEventListener("click", (event) => {
  if (event.currentTarget.classList.contains("disabled")) event.preventDefault();
}));

/* ===================== Navegação e atalhos ===================== */
$("phase-stepper").addEventListener("click", (event) => {
  const step = event.target.closest(".phase-step");
  if (!step || step.getAttribute("aria-disabled") === "true") return;
  goTo(step.dataset.phase);
});
$("brand-link").addEventListener("click", (event) => {
  event.preventDefault();
  selectedPhase = null;
  if (lastSnapshot) render(lastSnapshot, true);
});
$("prior-campaign-btn").addEventListener("click", () => goTo("analyze"));
$("approval-banner-btn").addEventListener("click", () => goTo("execute"));
$("new-campaign-btn").addEventListener("click", () => goTo("configure"));
$("report-findings-btn").addEventListener("click", () => { analyzeTab = "findings"; goTo("analyze"); });
["audit-toggle", "exec-audit-btn", "report-audit-btn"].forEach((id) => $(id).addEventListener("click", () => toggleAudit(!auditOpen || id !== "audit-toggle")));
$("audit-close").addEventListener("click", () => toggleAudit(false));
$("audit-filter").addEventListener("change", (event) => { auditFilter = event.target.value; if (lastModel) renderAudit(lastModel.events); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && auditOpen) toggleAudit(false); });
const tabIds = ["findings", "hypotheses", "inventory"];
tabIds.forEach((key, index) => {
  const tab = $(`tab-${key}`);
  tab.addEventListener("click", () => setTab(key));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % tabIds.length : event.key === "ArrowLeft" ? (index + tabIds.length - 1) % tabIds.length : event.key === "Home" ? 0 : tabIds.length - 1;
    setTab(tabIds[next]);
    $(`tab-${tabIds[next]}`).focus();
  });
});
document.querySelectorAll(".phase-view").forEach((view) => view.addEventListener("animationend", () => view.classList.remove("entering")));
document.querySelectorAll("[data-icon]").forEach((slot) => slot.replaceChildren(iconNode(slot.dataset.icon)));

text($("clock"), new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
updateAIProviderFields(false);
refresh();
setInterval(refresh, 1500);
