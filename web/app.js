"use strict";

const stages = [
  { id: "scope", number: "01", icon: "⌖", title: "Guardião do escopo", description: "Valida origem, método, orçamento e condição de parada antes de qualquer ação." },
  { id: "discovery", number: "02", icon: "◈", title: "Descoberta", description: "Identifica a aplicação e as rotas públicas incluídas na campanha." },
  { id: "checks", number: "03", icon: "◇", title: "Testes seguros", description: "Executa verificações de leitura com cadência e volume limitados." },
  { id: "triage", number: "04", icon: "▤", title: "Triagem", description: "Classifica evidência, severidade e confiança sem inferir exploração." },
  { id: "remediation", number: "05", icon: "✦", title: "Correção", description: "Relaciona os achados a dicas de código e testes de regressão." },
  { id: "monitor", number: "06", icon: "⌁", title: "Monitoramento", description: "Compara execuções e destaca achados novos ou resolvidos." },
];

const $ = (id) => document.getElementById(id);
const text = (node, value) => { node.textContent = value == null ? "" : String(value); };
const node = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) text(element, content);
  return element;
};

function formatTime(raw) {
  if (!raw) return "--:--:--";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function message(value, error = false) {
  const target = $("action-message");
  text(target, value);
  target.classList.toggle("error", error);
}

function renderStages(snapshot) {
  const grid = $("pipeline-grid");
  grid.replaceChildren();
  const events = snapshot.events?.length ? snapshot.events : (snapshot.result?.actions || []);
  const phases = events.map((event) => String(event.phase || "").toLowerCase());
  const reached = stages.map((stage) => phases.some((phase) => phase === stage.id || phase.startsWith(stage.id)
    || (stage.id === "checks" && phase === "surface_checks")));
  const activeIndex = snapshot.running ? Math.max(0, reached.lastIndexOf(true)) : -1;
  stages.forEach((stage, index) => {
    const state = snapshot.running && activeIndex === index ? "active" : (reached[index] ? "complete" : "pending");
    const card = node("article", `agent-card ${state}`);
    const top = node("div", "agent-card-top");
    top.append(node("span", "agent-num", stage.number), node("span", "agent-state", state === "active" ? "EM EXECUÇÃO" : state === "complete" ? "CONCLUÍDO" : "AGUARDANDO"));
    card.append(top, node("div", "agent-icon", stage.icon), node("h3", "", stage.title), node("p", "", stage.description));
    grid.append(card);
  });
  const diff = snapshot.delta?.summary;
  text($("monitor-delta"), diff
    ? `Comparação: ${diff.new} novo(s), ${diff.resolved} resolvido(s), ${diff.changed} alterado(s), ${diff.unchanged} estável(is).`
    : "A comparação de regressões aparece após duas campanhas completas no mesmo alvo.");
}

function renderBasics(observations) {
  const catalog = observations.find((item) => item.type === "beginner_challenges");
  text($("difficulty-one"), catalog?.difficulty_counts?.["1"] ?? "—");
  text($("difficulty-two"), catalog?.difficulty_counts?.["2"] ?? "—");
  const list = $("tutorial-list");
  list.replaceChildren();
  const names = Array.isArray(catalog?.tutorial_names) ? catalog.tutorial_names : [];
  if (!names.length) {
    list.append(node("li", "", "Os nomes aparecem após uma campanha concluída."));
  } else {
    names.forEach((name) => list.append(node("li", "", name)));
  }
}

function renderAIStatus(observations, scope) {
  const ai = observations.find((item) => item.type === "ai_advisor");
  const status = ai?.status === "completed" ? `IA ${ai.model || ""} · CONCLUÍDA`
    : ai?.status === "failed" ? `IA ${ai.model || ""} · FALHOU`
      : scope.ai_model ? `IA ${scope.ai_model} · ATIVA` : "IA DESLIGADA";
  text($("ai-status"), status);
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

function renderFindings(findings) {
  const list = $("findings-list");
  text($("findings-count"), `${findings.length} ${findings.length === 1 ? "ACHADO" : "ACHADOS"}`);
  list.replaceChildren();
  if (!findings.length) {
    const empty = node("div", "empty-state");
    empty.append(node("span", "", "◎"), node("strong", "", "Nenhum achado nesta execução"), node("p", "", "Consulte a trilha de auditoria para verificar quais testes foram concluídos."));
    list.append(empty);
    return;
  }
  findings.forEach((finding, index) => {
    const row = node("article", "finding");
    const head = node("div", "finding-head");
    const titleGroup = node("div", "finding-title-group");
    const info = node("div");
    info.append(node("h3", "", finding.title || finding.name || finding.id || `Achado ${index + 1}`));
    const meta = node("div", "finding-meta");
    const statusLabels = { confirmed: "confirmado", inconclusive: "inconclusivo", discarded: "descartado" };
    const confidenceLabels = { high: "confiança alta", medium: "confiança média", low: "confiança baixa" };
    [finding.id, statusLabels[finding.status] || finding.status || finding.state,
      confidenceLabels[finding.confidence] || finding.confidence].filter(Boolean)
      .forEach((item) => meta.append(node("span", "", item)));
    info.append(meta);
    titleGroup.append(node("span", "finding-number", String(index + 1).padStart(2, "0")), info);
    const severity = String(finding.severity || "informativa").toLowerCase();
    const severityLabels = { high: "ALTA", medium: "MÉDIA", low: "BAIXA", info: "INFO" };
    head.append(titleGroup, node("span", `severity ${severity}`, severityLabels[severity] || severity.toUpperCase()));
    row.append(head);
    const detail = node("div", "finding-detail");
    const description = finding.description || finding.summary || finding.impact;
    if (description) detail.append(node("p", "", description));
    const evidence = readable(finding.evidence);
    if (evidence) {
      const evidenceLine = node("p");
      evidenceLine.append(node("strong", "", "Evidência: "), node("code", "", evidence));
      detail.append(evidenceLine);
    }
    if (finding.limitations) detail.append(node("p", "", `Limite: ${readable(finding.limitations)}`));
    row.append(detail);
    list.append(row);
  });
}

function renderRecommendations(recommendations, findings) {
  const list = $("recommendations-list");
  const findingTitles = new Map(findings.map((finding) => [finding.id, finding.title]));
  list.replaceChildren();
  if (!recommendations.length) {
    const empty = node("div", "empty-state");
    empty.append(node("span", "", "✦"), node("strong", "", "Sem orientações nesta execução"), node("p", "", "As recomendações aparecem quando há evidência classificada."));
    list.append(empty);
    return;
  }
  recommendations.forEach((recommendation, index) => {
    const card = node("article", "recommendation-card");
    const top = node("div", "recommendation-top");
    top.append(node("span", "", `${recommendation.source === "ai" ? "SUGESTÃO IA" : "CORREÇÃO"} ${String(index + 1).padStart(2, "0")}`),
      node("span", "", recommendation.finding_id || recommendation.priority || ""));
    card.append(top, node("h3", "", recommendation.title || recommendation.name || findingTitles.get(recommendation.finding_id) || "Orientação de correção"));
    const advice = recommendation.advice || recommendation.description || recommendation.guidance || recommendation.fix;
    if (advice) card.append(node("p", "", readable(advice)));
    const regression = recommendation.regression_test || recommendation.test || recommendation.validation || recommendation.verification;
    if (regression) card.append(node("p", "", `Regressão: ${readable(regression)}`));
    const code = recommendation.code_example || recommendation.code || recommendation.snippet || recommendation.code_hint;
    if (code) card.append(node("pre", "", readable(code)));
    list.append(card);
  });
}

function renderAudit(events) {
  const list = $("audit-list");
  text($("audit-count"), `${events.length} EVENTOS`);
  if (!events.length) return;
  list.replaceChildren();
  events.forEach((event) => {
    const item = node("li");
    item.append(node("span", "audit-time", formatTime(event.timestamp)), node("span", "audit-phase", event.phase || event.type || "ação"), node("span", "", event.message || readable(event)));
    list.append(item);
  });
  list.scrollTop = list.scrollHeight;
}

function render(snapshot) {
  const result = snapshot.result || {};
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const observations = Array.isArray(result.observations) ? result.observations : [];
  const actions = Array.isArray(result.actions) ? result.actions : [];
  const events = snapshot.events || [];
  const scope = snapshot.scope || {};
  const target = scope.target || result.target || "Alvo definido em scope.json";
  text($("target-display"), target);
  text($("guardrail-target"), `Somente ${target}. Redirecionamentos externos são recusados.`);
  const maxRequests = scope.max_requests ?? "?";
  text($("guardrail-volume"), `GET/HEAD, até ${maxRequests} requisições e intervalo mínimo de ${scope.min_interval_seconds ?? "?"} s entre ações.`);
  text($("metric-request-limit"), `máximo ${maxRequests} por campanha`);
  text($("metric-actions"), String(Math.max(actions.length, events.length)).padStart(2, "0"));
  text($("metric-findings"), String(findings.length).padStart(2, "0"));
  const requestCount = result.summary?.requests ?? result.summary?.requests_made ?? result.summary?.request_count ?? actions.filter((item) => item.type === "request").length;
  text($("metric-requests"), String(requestCount).padStart(2, "0"));
  const status = snapshot.running ? (snapshot.stop_requested ? "Parando" : "Em execução") : snapshot.error ? "Erro" : result.status === "stopped" ? "Interrompida" : result.status === "inconclusive" ? "Inconclusiva" : result.status === "failed" ? "Falhou" : result.status === "completed" ? "Concluída" : "Aguardando";
  text($("hero-status"), status);
  text($("hero-substatus"), snapshot.running ? "Acompanhe cada etapa na trilha de auditoria" : snapshot.error || (result.ended_at ? `Última execução: ${formatTime(result.ended_at)}` : "Pronto para uma execução controlada"));
  text($("metric-control"), snapshot.stop_requested ? "PARANDO" : snapshot.running ? "EM CURSO" : "ATIVO");
  $("start-btn").disabled = snapshot.running;
  $("stop-btn").disabled = !snapshot.running || snapshot.stop_requested;
  $("download-btn").classList.toggle("disabled", !snapshot.report_available);
  $("download-btn").setAttribute("aria-disabled", String(!snapshot.report_available));
  renderStages(snapshot);
  renderBasics(observations);
  renderAIStatus(observations, scope);
  renderFindings(findings);
  renderRecommendations(recommendations, findings);
  renderAudit(events.length ? events : actions);
  if (snapshot.error) message(snapshot.error, true);
}

let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    message(`Não foi possível consultar o console: ${error.message}`, true);
  } finally {
    loading = false;
  }
}

async function action(path) {
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await response.json();
    message(payload.message || payload.error || `HTTP ${response.status}`, !response.ok);
    await refresh();
  } catch (error) {
    message(`Ação indisponível: ${error.message}`, true);
  }
}

$("start-btn").addEventListener("click", () => action("/api/campaign/start"));
$("stop-btn").addEventListener("click", () => action("/api/campaign/stop"));
$("download-btn").addEventListener("click", (event) => { if (event.currentTarget.classList.contains("disabled")) event.preventDefault(); });
document.querySelectorAll(".side-nav a").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".side-nav a").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
}));
text($("clock"), new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
refresh();
setInterval(refresh, 1500);
