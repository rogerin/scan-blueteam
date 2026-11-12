"use strict";

const stages = [
  { id: "scope", number: "01", icon: "⌖", title: "Guardião do escopo", description: "Valida origem, método, orçamento e condição de parada antes de qualquer ação." },
  { id: "discovery", number: "02", icon: "◈", title: "Descoberta", description: "Identifica a aplicação e as rotas públicas incluídas na campanha." },
  { id: "planning", number: "03", icon: "✧", title: "Plano do agente", description: "Seleciona verificações declaradas e registra a origem da decisão." },
  { id: "checks", number: "04", icon: "◇", title: "Testes seguros", description: "Executa verificações de leitura com cadência e volume limitados." },
  { id: "triage", number: "05", icon: "▤", title: "Triagem", description: "Classifica evidência, severidade e confiança sem inferir exploração." },
  { id: "remediation", number: "06", icon: "✦", title: "Correção", description: "Relaciona os achados a dicas de código e testes de regressão." },
  { id: "target_analysis", number: "07", icon: "⌘", title: "Análise multiagente", description: "Cruza inventário, evidências e hipóteses sobre a URL informada em agentes paralelos." },
  { id: "monitor", number: "08", icon: "⌁", title: "Monitoramento", description: "Compara execuções e destaca achados novos ou resolvidos." },
];

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

const $ = (id) => document.getElementById(id);
const text = (node, value) => { node.textContent = value == null ? "" : String(value); };
const node = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) text(element, content);
  return element;
};
const safeScreenshotPath = (value) => typeof value === "string"
  && value.length <= 200
  && /^\/evidence\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(value)
  && !value.includes("..") ? value : "";

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
  const planEvent = [...events].reverse().find((event) => event.phase === "planning" && event.type !== "request" && event.type !== "response");
  const selectedChecks = Array.isArray(planEvent?.check_ids) ? planEvent.check_ids : [];
  const planSource = planEvent?.source === "ai" ? "Plano por IA" : "Plano determinístico";
  const fallback = planEvent?.fallback ? " após fallback da IA" : "";
  text($("plan-status"), selectedChecks.length
    ? `${planSource}${fallback}: ${selectedChecks.map((check) => checkLabels[check] || check).join(" · ")}.`
    : planEvent?.message || "O plano de testes aparece quando a campanha começar.");
  const diff = snapshot.delta?.summary;
  text($("monitor-delta"), diff
    ? `Comparação: ${diff.new} novo(s), ${diff.resolved} resolvido(s), ${diff.changed} alterado(s), ${diff.unchanged} estável(is).`
    : "A comparação de regressões aparece após duas campanhas completas no mesmo alvo.");
}

function renderBasics(observations, campaignStatus) {
  const catalog = observations.find((item) => item.type === "beginner_challenges");
  $("basics").hidden = !catalog && Boolean(campaignStatus) && campaignStatus !== "running";
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

function renderStagePlan(observations, events) {
  const holder = $("stage-plan-list");
  holder.replaceChildren();
  const saved = observations.find((item) => item.type === "agent_plan");
  const steps = Array.isArray(saved?.steps) && saved.steps.length
    ? saved.steps : events.filter((item) => item.type === "stage_plan");
  if (!steps.length) {
    holder.append(node("p", "stage-plan-empty", "Hipótese, ação, resultado esperado e condição de parada aparecem aqui."));
    return;
  }
  steps.forEach((step) => {
    const card = node("article", "stage-plan-step");
    const id = step.step_id || step.check_id || "";
    card.append(node("h4", "", stepLabels[id] || checkLabels[id] || id || "Etapa"));
    const facts = [
      ["Hipótese", step.hypothesis], ["Ação", step.action],
      ["Resultado esperado", step.expected_result], ["Condição de parada", step.stop_condition],
    ];
    facts.forEach(([label, value]) => {
      const item = node("div", "stage-plan-fact");
      item.append(node("strong", "", label), node("span", "", value || "Não informado"));
      card.append(item);
    });
    holder.append(card);
  });
}

function renderAIStatus(observations, scope, events) {
  const ai = observations.find((item) => item.type === "ai_advisor");
  const plan = [...events].reverse().find((event) => event.phase === "planning" && Array.isArray(event.check_ids));
  const status = ai?.status === "completed" ? `IA ${ai.model || ""} · CONCLUÍDA`
    : ai?.status === "failed" ? `IA ${ai.model || ""} · FALHOU`
      : plan?.fallback ? "IA INDISPONÍVEL · PLANO SEGURO"
        : plan?.source === "ai" ? `IA ${scope.ai_model || ""} · PLANO DEFINIDO`
          : scope.ai_model ? `IA ${scope.ai_model} · CONFIGURADA` : "IA DESLIGADA";
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

function renderFrameworkInventory(observations) {
  const inventory = observations.find((item) => item.type === "framework_inventory");
  const family = typeof inventory?.family === "string" && inventory.family.trim()
    ? inventory.family.trim() : "Não identificada";
  const version = (typeof inventory?.version === "string" || typeof inventory?.version === "number")
    && String(inventory.version).trim() ? String(inventory.version).trim() : "Não confirmada";
  const certaintyLabels = {
    exact: "Versão exata observada", conflicting_versions: "Versões conflitantes",
    family_only: "Apenas família identificada", not_detected: "Não detectado",
    confirmed: "Confirmada", high: "Alta", medium: "Média", low: "Baixa",
    inferred: "Inferida", unknown: "Desconhecida",
  };
  const certainty = typeof inventory?.certainty === "string" ? inventory.certainty.trim() : "";
  const advisories = Array.isArray(inventory?.advisories) ? inventory.advisories : [];
  text($("framework-count"), inventory ? `${advisories.length} ${advisories.length === 1 ? "AVISO" : "AVISOS"}` : "AGUARDANDO");
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
    version_unconfirmed: "Versão não confirmada",
    reference_only: "Referência sem confirmação",
    candidate: "Aplicabilidade a verificar",
    potential: "Aplicabilidade a verificar",
    possible: "Possível; validar versão",
    not_confirmed: "Não confirmado",
    affected: "Faixa afetada descrita no aviso",
    not_applicable: "Não aplicável à versão observada",
    unknown: "Indeterminada",
  };
  advisories.forEach((advisory) => {
    if (!advisory || typeof advisory !== "object") return;
    const item = node("article", "framework-advisory");
    const title = [advisory.id, advisory.cve].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ");
    item.append(node("strong", "", title || "Aviso de segurança"));
    if (advisory.status) item.append(node("span", "framework-advisory-status",
      `Correlação: ${statusLabels[advisory.status] || String(advisory.status).replaceAll("_", " ")}`));
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
  text($("target-analysis-count"), analysis
    ? `${hypotheses.length} ${hypotheses.length === 1 ? "HIPÓTESE" : "HIPÓTESES"}` : "AGUARDANDO");
  text($("target-analysis-caveat"), analysis
    ? "Estas hipóteses foram geradas a partir de dados coletados nesta URL. São passos para validação; só entram em Achados verificados após uma prova específica e autorizada."
    : "Execute uma campanha para analisar esta URL. Campanhas anteriores continuam visíveis em Achados verificados; hipóteses só aparecem após nova coleta.");

  const meta = $("target-analysis-meta");
  meta.replaceChildren();
  if (analysis) meta.append(node("span", "", `Alvo desta análise: ${target}`),
    node("span", "", "Fonte: respostas, scripts e achados desta campanha"));

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
  if (!agentRuns.length) runs.append(node("p", "analysis-empty", analysis
    ? "Nenhuma execução de agente foi registrada."
    : "Aguardando dados da campanha."));
  agentRuns.forEach((run) => {
    if (!run || typeof run !== "object") return;
    const [name, description] = agentNames[run.name] || [run.name || "Agente", "Análise local."];
    const card = node("article", "analysis-agent-card");
    const status = run.status === "completed" ? "CONCLUÍDO" : run.status === "failed" ? "FALHOU" : "NÃO EXECUTADO";
    card.append(node("span", `analysis-agent-status ${run.status === "completed" ? "complete" : ""}`, status),
      node("h4", "", name), node("p", "", run.detail || description));
    if (Number.isFinite(run.duration_ms) && run.duration_ms >= 0) {
      card.append(node("small", "", `${Math.round(run.duration_ms)} ms · análise local`));
    }
    runs.append(card);
  });

  const technology = $("target-technology");
  technology.replaceChildren();
  const tech = analysis?.technology;
  if (tech && typeof tech === "object") {
    const card = node("article", "analysis-technology-card");
    const certainty = { exact: "Versão observada", family_only: "Somente família", not_detected: "Não detectada",
      conflicting_versions: "Marcadores conflitantes" }[tech.certainty] || tech.certainty || "Não determinada";
    card.append(analysisFact("Família", tech.family || "Não identificada"),
      analysisFact("Versão", tech.version || "Não determinada"),
      analysisFact("Certeza", certainty),
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
    const label = signal.status === "confirmed" ? "OBSERVAÇÃO CONFIRMADA" : "SINAL INCONCLUSIVO";
    item.append(node("strong", "", checkLabels[signal.check] || signal.check || "Sinal da campanha"),
      node("span", "", label));
    if (signal.finding_id) item.append(analysisFact("Achado relacionado", signal.finding_id));
    if (signal.proof) item.append(analysisFact("Prova já coletada", signal.proof));
    item.append(analysisFact("Limite", signal.limitations || "O sinal não comprova uma hipótese adicional."));
    signals.append(item);
  });

  const list = $("target-hypotheses");
  list.replaceChildren();
  if (!hypotheses.length) list.append(node("p", "analysis-empty", analysis
    ? "Nenhuma hipótese adicional foi formulada com a evidência disponível."
    : "Execute uma nova campanha para gerar hipóteses sobre a URL informada."));
  hypotheses.forEach((hypothesis, index) => {
    if (!hypothesis || typeof hypothesis !== "object") return;
    const details = node("details", "analysis-hypothesis");
    const summary = node("summary", "analysis-hypothesis-summary");
    const title = node("span", "analysis-hypothesis-title");
    title.append(node("small", "", String(index + 1).padStart(2, "0")),
      node("strong", "", hypothesis.title || hypothesis.id || "Hipótese"));
    summary.append(title, node("span", "analysis-hypothesis-badge", "A VALIDAR"));
    details.append(summary);
    const body = node("div", "analysis-hypothesis-body");
    body.append(analysisFact("Estado", "Hipótese não confirmada por esta campanha."),
      analysisFact("Base observada", hypothesis.basis),
      analysisFact("Resultado a verificar", hypothesis.expected_result),
      analysisFact("Próxima verificação", hypothesis.verification),
      analysisFact("Limite", hypothesis.limitations));
    const related = Array.isArray(hypothesis.related_finding_ids) ? hypothesis.related_finding_ids : [];
    if (related.length) body.append(analysisFact("Achados relacionados", related.join(" · ")));
    details.append(body);
    list.append(details);
  });

  text($("target-ai-status"), aiReview?.status === "completed" ? `IA ${aiReview.model || ""} · CONCLUÍDA`
    : aiReview?.status === "failed" ? "IA INDISPONÍVEL" : "SEM PRIORIZAÇÃO POR IA");
  const priorities = $("target-ai-priorities");
  priorities.replaceChildren();
  const suggestions = Array.isArray(aiReview?.priorities) ? aiReview.priorities : [];
  if (!suggestions.length) priorities.append(node("p", "analysis-empty", aiReview?.status === "failed"
    ? "A priorização por IA falhou; a análise local permanece disponível."
    : "Nenhuma prioridade por IA nesta campanha."));
  const knownIds = new Set(hypotheses.map((item) => item.id));
  suggestions.forEach((suggestion) => {
    if (!suggestion || typeof suggestion !== "object" || !knownIds.has(suggestion.id)) return;
    const card = node("article", "analysis-priority");
    const title = hypotheses.find((item) => item.id === suggestion.id)?.title || suggestion.id;
    const rank = { high: "ALTA", medium: "MÉDIA", low: "BAIXA" }[suggestion.priority] || "PRIORIDADE";
    card.append(node("span", "analysis-priority-rank", rank), node("h4", "", title),
      analysisFact("Por que revisar", suggestion.rationale),
      analysisFact("Próximo passo", suggestion.next_step),
      analysisFact("Limite", suggestion.limitation));
    priorities.append(card);
  });
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
  const categories = [
    ["confirmed", "Observações confirmadas"],
    ["inconclusive", "Inconclusivos"],
    ["discarded", "Descartados registrados"],
  ];
  const buckets = new Map();
  categories.forEach(([status, label]) => {
    const section = node("section", `finding-group finding-group-${status}`);
    const count = findings.filter((item) => (item.status === "confirmed" ? "confirmed"
      : item.status === "discarded" ? "discarded" : "inconclusive") === status).length;
    section.append(node("h3", "finding-group-heading", `${label} · ${count}`));
    const body = node("div", "finding-group-list");
    body.setAttribute("data-empty", status === "discarded"
      ? "Nenhum candidato descartado foi registrado nesta execução."
      : "Nenhum registro nesta categoria.");
    section.append(body);
    list.append(section);
    buckets.set(status, body);
  });
  findings.forEach((finding, index) => {
    const row = node("article", "finding");
    const head = node("div", "finding-head");
    const titleGroup = node("div", "finding-title-group");
    const info = node("div");
    info.append(node("h3", "", finding.title || finding.name || finding.id || `Achado ${index + 1}`));
    const meta = node("div", "finding-meta");
    const statusLabels = { confirmed: "observação confirmada", inconclusive: "inconclusivo", discarded: "descartado" };
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
    if (description) detail.append(node("p", "finding-impact", description));

    const evidenceGrid = node("div", "finding-evidence-grid");
    const fields = [
      { label: "Trecho observado", value: finding.excerpt, fallback: "Trecho não registrado nesta execução.", code: true },
      { label: "Prova do teste", value: finding.proof, fallback: "Prova detalhada não registrada nesta execução." },
      { label: "Evidência", value: finding.evidence, fallback: "Evidência detalhada não registrada nesta execução." },
    ];
    fields.forEach(({ label, value, fallback, code }) => {
      const card = node("div", "finding-evidence-card");
      card.append(node("h4", "finding-evidence-label", label));
      const content = readable(value).trim() || fallback;
      card.append(node(code ? "pre" : "p", code ? "finding-excerpt" : "finding-evidence-text", content));
      evidenceGrid.append(card);
    });
    detail.append(evidenceGrid);

    const screenshotPath = safeScreenshotPath(finding.screenshot);
    if (screenshotPath) {
      const caption = typeof finding.screenshot_caption === "string" && finding.screenshot_caption.trim()
        ? finding.screenshot_caption.trim()
        : "Origem visual não informada; este registro não comprova, por si só, uma captura direta do alvo.";
      const visual = node("figure", "finding-screenshot");
      const preview = node("a", "finding-screenshot-preview");
      preview.href = screenshotPath;
      preview.target = "_blank";
      preview.rel = "noopener noreferrer";
      preview.setAttribute("aria-label", "Abrir imagem de evidência em nova aba");
      const image = node("img");
      image.src = screenshotPath;
      image.alt = "Prévia do registro visual de evidência";
      image.loading = "lazy";
      image.decoding = "async";
      preview.append(image);
      const annotation = node("div", "finding-screenshot-annotation");
      const open = node("a", "finding-screenshot-open", "Abrir imagem ↗");
      open.href = screenshotPath;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      annotation.append(node("h4", "finding-evidence-label", "Registro visual"),
        node("figcaption", "", caption), open);
      if (/^[0-9a-f]{64}$/.test(finding.screenshot_sha256 || "")) {
        annotation.append(node("small", "finding-image-hash", `SHA-256: ${finding.screenshot_sha256}`));
      }
      visual.append(preview, annotation);
      detail.append(visual);
    }

    if (finding.reproduction) {
      const reproduction = node("div", "finding-reproduction");
      reproduction.append(node("strong", "", "Reprodução controlada"), node("p", "", finding.reproduction));
      detail.append(reproduction);
    }

    const limitation = node("div", "finding-limitation");
    limitation.append(node("strong", "", "Limite da conclusão"),
      node("p", "", readable(finding.limitations).trim()
        || "Limites específicos não registrados nesta execução; reexecute a campanha para revisar este achado."));
    detail.append(limitation);
    row.append(detail);
    const category = finding.status === "confirmed" ? "confirmed"
      : finding.status === "discarded" ? "discarded" : "inconclusive";
    buckets.get(category).append(row);
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
    const metadata = [event.method, event.url, Number.isInteger(event.status) ? `HTTP ${event.status}` : "",
      event.action_id, event.approval_id ? `decisão ${event.status || ""}` : "",
      typeof event.body_sha256 === "string" && /^[0-9a-f]{64}$/.test(event.body_sha256)
        ? `SHA-256 ${event.body_sha256.slice(0, 12)}…` : ""].filter(Boolean).join(" · ");
    item.append(node("span", "audit-time", formatTime(event.timestamp)),
      node("span", "audit-phase", event.phase || event.type || "ação"),
      node("span", "", `${event.message || readable(event)}${metadata ? ` · ${metadata}` : ""}`));
    list.append(item);
  });
  list.scrollTop = list.scrollHeight;
}

function renderApprovals(approvals, scope) {
  const list = $("approval-list");
  list.replaceChildren();
  const allowed = Array.isArray(scope.allowed_methods) ? scope.allowed_methods.join("/") : "GET/HEAD";
  text($("policy-allowed"), `${allowed} na origem HTTPS autorizada; até ${scope.max_requests ?? "?"} requisições, intervalo mínimo de ${scope.min_interval_seconds ?? "?"} s e ${scope.max_response_bytes ?? "?"} bytes por resposta.`);
  const conditional = Array.isArray(scope.conditional_actions) && scope.conditional_actions.includes("quoted_search");
  text($("policy-conditioned"), conditional
    ? "Comparação de busca sintética com aspas: só executa após aprovação explícita nesta campanha."
    : "Nenhuma ação condicionada foi declarada para este alvo.");
  text($("policy-denied"), "POST/PUT/DELETE, força bruta, extração de arquivos, exploração encadeada e destinos fora da origem autorizada.");
  if (!Array.isArray(approvals) || !approvals.length) {
    list.append(node("p", "approval-empty", "Nenhuma ação aguardando decisão nesta execução."));
    return;
  }
  const labels = { pending: "Aguardando decisão", approved: "Aprovada", rejected: "Rejeitada", cancelled: "Cancelada", expired: "Expirada" };
  approvals.forEach((item) => {
    if (!item || !/^[0-9a-f]{32}$/.test(item.id || "")) return;
    const card = node("article", "approval-item");
    const title = node("div", "approval-item-head");
    title.append(node("strong", "", item.action_id === "quoted_search" ? "Comparação de busca sintética" : "Ação condicionada"),
      node("span", "", labels[item.status] || "Estado desconhecido"));
    card.append(title, node("p", "", item.reason || "Motivo não informado"),
      node("small", "", item.target || "Origem não informada"));
    if (item.expires_at) card.append(node("small", "approval-expiry", `Prazo: ${formatTime(item.expires_at)}`));
    if (item.status === "pending") {
      const buttons = node("div", "approval-actions");
      const approve = node("button", "button button-primary", "Aprovar esta ação");
      const reject = node("button", "button button-ghost", "Rejeitar");
      [approve, reject].forEach((button) => { button.type = "button"; });
      approve.addEventListener("click", () => action("/api/approval/decision", { approval_id: item.id, approve: true }));
      reject.addEventListener("click", () => action("/api/approval/decision", { approval_id: item.id, approve: false }));
      buttons.append(approve, reject);
      card.append(buttons);
    }
    list.append(card);
  });
}

function render(snapshot) {
  const result = snapshot.result || {};
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const observations = Array.isArray(result.observations) ? result.observations : [];
  const actions = Array.isArray(result.actions) ? result.actions : [];
  const events = snapshot.events || [];
  const scope = snapshot.scope || {};
  if (!aiProviderInitialized && ["openai", "bedrock"].includes(scope.ai_provider)) {
    $("ai-provider").value = scope.ai_provider;
    aiProviderInitialized = true;
  }
  const target = scope.target || result.target || "Alvo ainda não informado";
  if (!targetDirty && !snapshot.running && target && target !== "Alvo ainda não informado") {
    $("target-url").value = target;
    updateTargetPreview();
  }
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
  $("target-url").disabled = snapshot.running;
  updateAIProviderFields(snapshot.running);
  $("authorization-confirmed").disabled = snapshot.running;
  ["download-btn", "download-json-btn"].forEach((id) => {
    $(id).classList.toggle("disabled", !snapshot.report_available);
    $(id).setAttribute("aria-disabled", String(!snapshot.report_available));
  });
  renderStages(snapshot);
  renderStagePlan(observations, events.length ? events : actions);
  renderBasics(observations, snapshot.running ? "running" : result.status);
  renderFrameworkInventory(observations);
  renderTargetAnalysis(observations, target);
  renderAIStatus(observations, scope, events.length ? events : actions);
  renderFindings(findings);
  renderRecommendations(recommendations, findings);
  renderAudit(events.length ? events : actions);
  renderApprovals(snapshot.approvals, scope);
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

async function action(path, data = {}) {
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const payload = await response.json();
    message(payload.message || payload.error || `HTTP ${response.status}`, !response.ok);
    await refresh();
    return response.ok;
  } catch (error) {
    message(`Ação indisponível: ${error.message}`, true);
    return false;
  }
}

let targetDirty = false;
let aiProviderInitialized = false;
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

$("target-url").addEventListener("input", () => {
  targetDirty = true;
  $("authorization-confirmed").checked = false;
  updateTargetPreview();
});
function updateAIProviderFields(running = false) {
  const bedrock = $("ai-provider").value === "bedrock";
  $("ai-provider").disabled = running;
  $("ai-model").disabled = running;
  $("aws-region").disabled = running || !bedrock;
  $("api-key").disabled = running;
  $("aws-region-field").hidden = !bedrock;
  $("api-key-field").hidden = false;
  text($("api-key-label"), bedrock ? "Amazon Bedrock API key" : "Chave OpenAI");
  $("api-key").placeholder = bedrock
    ? "Cole a chave Bedrock desta campanha"
    : "Cole a chave OpenAI desta campanha";
  text($("api-key-help"), bedrock
    ? "Opcional se o servidor já tiver credenciais AWS. O console usa a chave só em memória."
    : "Opcional se OPENAI_API_KEY estiver no servidor. O console usa a chave só em memória.");
  $("ai-model").placeholder = bedrock ? "amazon.nova-micro-v1:0" : "gpt-6-luna";
  text($("ai-model-help"), bedrock
    ? "Aceita model ID, inference profile ID ou ARN compatível com Converse."
    : "Informe um modelo OpenAI ou deixe em branco.");
}
$("ai-provider").addEventListener("change", () => {
  aiProviderInitialized = true;
  $("api-key").value = "";
  updateAIProviderFields(false);
});
$("api-key").value = "";
window.addEventListener("pageshow", () => {
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
document.querySelectorAll(".side-nav a").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".side-nav a").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
}));
text($("clock"), new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
updateAIProviderFields(false);
refresh();
setInterval(refresh, 1500);
