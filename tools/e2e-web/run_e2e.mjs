import { spawn } from "node:child_process";
import fs from "node:fs";
const [,, ROOT, E2E, ONLY] = process.argv;
const WEB = `${ROOT}/web`, OUT = `${E2E}/shots`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitHttp(url, tries = 60) { for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.status) return; } catch {} await sleep(100); } throw new Error(`not reachable: ${url}`); }
async function launchChrome(dir) {
  const p = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "--window-size=1440,900", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  const ws = await new Promise((res, rej) => { let buf = ""; p.stderr.on("data", (d) => { buf += String(d); const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); }); p.on("exit", () => rej(new Error("chrome exited: " + buf.slice(-400)))); setTimeout(() => rej(new Error("chrome timeout: " + buf.slice(-400))), 20000); });
  return { proc: p, devPort: new URL(ws).port };
}
async function connect(devPort) {
  const list = await (await fetch(`http://127.0.0.1:${devPort}/json`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method) events.push(msg); };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ws, send, events };
}
const PROBE = `({phase:[...document.querySelectorAll('.phase-view')].find(v=>!v.hidden)?.dataset.phase, status:document.getElementById('bar-status').textContent.trim(), progress:document.getElementById('bar-progress').textContent.trim(), locked:[...document.querySelectorAll('.phase-step')].filter(b=>b.getAttribute('aria-disabled')==='true').map(b=>b.dataset.phase), msg:document.getElementById('action-message').textContent.trim(), conn:!document.getElementById('connection-banner').hidden, approvalBanner:!document.getElementById('approval-banner').hidden, stopDisabled:document.getElementById('stop-btn').disabled, startDisabled:document.getElementById('start-btn').disabled})`;
const scenarios = {
  async idle({ evaluate, click, shot, probe, posts, check, waitFor }) {
    let p = await probe(); check("configure view", p.phase === "configure", p); check("status Aguardando", /Aguardando/.test(p.status), p.status);
    check("plan/execute/analyze/report locked", ["plan", "execute", "analyze", "report"].every((x) => p.locked.includes(x)), p.locked);
    check("start enabled", !p.startDisabled); check("stop disabled", p.stopDisabled);
    check("start-summary filled", (await evaluate(`document.querySelectorAll('#start-summary li').length`)) >= 4);
    check("prior banner hidden", await evaluate(`document.getElementById('prior-campaign').hidden`));
    await shot("configure"); await shot("configure-mobile", true);
    await click("#start-btn"); await sleep(400);
    check("no POST without authorization", posts().length === 0, posts());
    await evaluate(`document.getElementById('authorization-confirmed').checked=true; document.getElementById('api-key').value='sk-test'; true`);
    await click("#start-btn"); await waitFor(`${PROBE}.phase==='plan'`, 4000);
    const sent = posts(); check("start POST sent once with authorization", sent.length === 1 && sent[0].path === "/api/campaign/start" && sent[0].body.authorization_confirmed === true, sent);
    check("api-key field cleared", (await evaluate(`document.getElementById('api-key').value`)) === "");
    p = await probe(); check("auto-advanced to plan after start", p.phase === "plan", p);
  },
  async planning({ evaluate, probe, check, shot }) {
    const p = await probe(); check("plan view", p.phase === "plan", p); check("status Planejando", /Planejando/.test(p.status), p.status);
    check("scope validated text", /Escopo validado/.test(await evaluate(`document.getElementById('plan-scope').textContent`)));
    check("check chips rendered", (await evaluate(`document.querySelectorAll('#plan-selection .chip').length`)) > 0);
    check("active stage details open", await evaluate(`!!document.querySelector('#plan-agents details.active[open]')`));
    await shot("plan");
  },
  async running({ evaluate, click, probe, check, shot, posts, waitFor }) {
    let p = await probe(); check("execute view", p.phase === "execute", p); check("status Em execução", /Em execução/.test(p.status), p.status);
    check("active agent is Testes seguros", /Testes seguros/.test(await evaluate(`document.querySelector('#active-agent h3')?.textContent||''`)));
    check("xai block open with plan", await evaluate(`!!document.querySelector('#active-agent details.xai[open] .stage-plan-step')`));
    check(">=3 completed chips", (await evaluate(`document.querySelectorAll('#completed-agents .agent-chip').length`)) >= 3);
    check("upcoming listed", (await evaluate(`document.querySelectorAll('#upcoming-agents .upcoming-item').length`)) >= 3);
    check("requests metric nonzero", (await evaluate(`document.getElementById('exec-metric-requests').textContent`)) !== "00");
    check("evidence list populated", (await evaluate(`document.querySelectorAll('#exec-evidence li').length`)) > 0);
    check("analyze/report locked while running", p.locked.includes("analyze") && p.locked.includes("report"), p.locked);
    await shot("execute");
    await click('.phase-step[data-phase="plan"]'); p = await probe(); check("can view plan without reset", p.phase === "plan" && /Em execução/.test(p.status), p);
    await click('.phase-step[data-phase="execute"]'); check("stop enabled", !(await probe()).stopDisabled);
    await click("#stop-btn"); await waitFor(`${PROBE}.status.includes('Parando')`, 4000);
    p = await probe(); check("stop POST sent", posts().some((x) => x.path === "/api/campaign/stop"), posts()); check("status Parando + stop disabled", /Parando/.test(p.status) && p.stopDisabled, p);
  },
  async awaiting_approval({ evaluate, click, probe, check, shot, posts, waitFor }) {
    let p = await probe(); check("execute view", p.phase === "execute", p); check("status Aguardando decisão", /Aguardando decisão/.test(p.status), p.status);
    check("approve button in active card", await evaluate(`!!document.querySelector('#active-agent .approval-actions button')`));
    check("why-proposed uses real plan", /Hipótese/.test(await evaluate(`document.querySelector('#active-agent .approval-item')?.textContent||''`)));
    check("countdown shown", /min restantes/.test(await evaluate(`document.querySelector('#active-agent .approval-expiry')?.textContent||''`)));
    check("no banner on execute", !p.approvalBanner);
    await evaluate(`document.querySelector('#active-agent details.xai[data-key="xai-checks"]').open=false; true`); await sleep(2300);
    check("closed XAI stays closed across re-render", await evaluate(`document.querySelector('#active-agent details.xai[data-key="xai-checks"]').open===false`));
    await shot("approval"); await shot("approval-mobile", true);
    await click('.phase-step[data-phase="configure"]'); p = await probe(); check("banner visible off-execute", p.phase === "configure" && p.approvalBanner, p);
    check("no POST from navigation", posts().length === 0);
    await click("#approval-banner-btn"); check("banner returns to execute", (await probe()).phase === "execute");
    await click("#active-agent .approval-actions button"); await waitFor(`!document.querySelector('#active-agent .approval-actions')`, 5000);
    const sent = posts(); check("approve POST once", sent.length === 1 && sent[0].path === "/api/approval/decision" && sent[0].body.approve === true, sent);
    p = await probe(); check("status back to Em execução", /Em execução/.test(p.status), p.status);
    check("decided approval listed", /Aprovada/.test(await evaluate(`document.getElementById('exec-approvals').textContent`)));
  },
  async stopping({ probe, check }) { const p = await probe(); check("status Parando", /Parando/.test(p.status), p.status); check("stop disabled", p.stopDisabled); check("execute view", p.phase === "execute", p); },
  async stopped({ evaluate, probe, check, click, shot }) {
    let p = await probe(); check("analyze view", p.phase === "analyze", p); check("status Interrompida", /Interrompida/.test(p.status), p.status);
    check("limitations mention skipped stages", /Etapas não executadas/.test(await evaluate(`document.getElementById('analyze-limitations').textContent`)));
    check("2 findings listed", (await evaluate(`document.querySelectorAll('#finding-list .finding-row').length`)) === 2);
    await click('.phase-step[data-phase="execute"]'); check("execute shows skipped stages", (await evaluate(`document.querySelectorAll('#upcoming-agents .upcoming-item.skipped').length`)) > 0);
    await shot("stopped-execute");
  },
  async completed_empty({ evaluate, probe, check }) {
    const p = await probe(); check("analyze view", p.phase === "analyze", p); check("status Concluída", /Concluída/.test(p.status), p.status);
    check("honest empty state", /Nenhum achado nesta execução/.test(await evaluate(`document.getElementById('finding-list').textContent`)));
    check("report available", !p.locked.includes("report"));
  },
  async failed_error({ probe, check, evaluate }) {
    const p = await probe(); check("status Falhou", /Falhou/.test(p.status), p.status); check("error message shown", /Erro interno/.test(p.msg), p.msg);
    check("analyze shows error limitation", /Erro interno/.test(await evaluate(`document.getElementById('analyze-limitations').textContent`)));
  },
  async loaded({ evaluate, click, probe, check, shot, key }) {
    let p = await probe(); check("analyze view on reopen", p.phase === "analyze", p); check("status Inconclusiva", /Inconclusiva/.test(p.status), p.status);
    check("6 finding rows", (await evaluate(`document.querySelectorAll('#finding-list .finding-row').length`)) === 6);
    check("detail has triage justification", /Classificação registrada pela triagem/.test(await evaluate(`document.getElementById('finding-detail').textContent`)));
    check("limitations mention conditioned check", /não executado/.test(await evaluate(`document.getElementById('analyze-limitations').textContent`)));
    await shot("analyze");
    await click('#finding-list .finding-row:nth-of-type(3)'); check("selection changes detail", await evaluate(`document.querySelectorAll('#finding-list .finding-row[aria-pressed="true"]').length===1`));
    await evaluate(`const t=document.getElementById('tab-findings'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); true`);
    check("arrow key moves tab", await evaluate(`document.getElementById('tab-hypotheses').getAttribute('aria-selected')==='true'`));
    await click("#tab-findings"); await click("#tab-hypotheses"); check("hypotheses tab visible", await evaluate(`!document.getElementById('panel-hypotheses').hidden && document.querySelectorAll('#target-hypotheses details').length>0`));
    await click("#tab-inventory"); check("inventory tab shows Angular", /Angular/.test(await evaluate(`document.getElementById('framework-family').textContent`)));
    await click('.phase-step[data-phase="report"]'); p = await probe(); check("report view", p.phase === "report", p);
    check("exec summary rows", (await evaluate(`document.querySelectorAll('#report-exec dd').length`)) >= 8);
    check("download enabled", await evaluate(`document.getElementById('download-btn').getAttribute('aria-disabled')==='false'`));
    check("recommendations rendered", (await evaluate(`document.querySelectorAll('#recommendations-list .recommendation-card').length`)) > 0);
    await shot("report");
    await click("#audit-toggle"); check("audit drawer open with all events", await evaluate(`!document.getElementById('audit-drawer').hidden && document.querySelectorAll('#audit-list li').length===78`));
    await evaluate(`const s=document.getElementById('audit-filter'); s.value='network'; s.dispatchEvent(new Event('change')); true`);
    check("audit filter narrows", (await evaluate(`document.querySelectorAll('#audit-list li').length`)) < 78);
    await key("Escape"); check("Esc closes drawer", await evaluate(`document.getElementById('audit-drawer').hidden`));
    await click("#new-campaign-btn"); p = await probe(); check("new campaign goes to configure with prior banner", p.phase === "configure" && !(await evaluate(`document.getElementById('prior-campaign').hidden`)), p);
    check("form prefilled with last target", /4\.migbot/.test(await evaluate(`document.getElementById('target-url').value`)));
    await shot("configure-prior"); await shot("analyze-mobile", true);
  },
  async rerun({ evaluate, click, probe, check, shot, send }) {
    const dump = () => evaluate(`(()=>{const q=(s)=>document.querySelector(s); const st={}; document.querySelectorAll('.phase-step').forEach(b=>st[b.dataset.phase]={locked:b.getAttribute('aria-disabled')==='true', state:b.querySelector('.phase-state').textContent, idx:b.querySelector('.phase-index').textContent}); return {phase:[...document.querySelectorAll('.phase-view')].find(x=>!x.hidden)?.dataset.phase, status:q('#bar-status').textContent.trim(), progress:q('#bar-progress').textContent.trim(), target:q('#bar-target').textContent.trim(), steps:st, open:[...document.querySelectorAll('.phase-view')].find(x=>!x.hidden).querySelectorAll('details[open]').length, openKeys:[...[...document.querySelectorAll('.phase-view')].find(x=>!x.hidden).querySelectorAll('details[open]')].map(x=>x.dataset.key||x.id)}})()`);
    const OVER = `[...document.querySelectorAll('.phase-step')].flatMap(b=>{const sb=document.querySelector('.sidebar').getBoundingClientRect(); const els=[...b.querySelectorAll('.phase-index,.phase-copy strong,.phase-copy small,.phase-state')].filter(e=>e.offsetParent&&e.getClientRects().length); const rs=els.map(e=>e.getBoundingClientRect()); const o=[]; const br=b.getBoundingClientRect(); if(br.right>sb.right+0.5) o.push(b.dataset.phase+': botão sai da sidebar'); rs.forEach((r,i)=>{ if(r.right>sb.right+0.5) o.push(b.dataset.phase+': '+els[i].className+' sai da sidebar'); for(let j=i+1;j<rs.length;j++){const c=rs[j]; if(r.left<c.right-0.5&&c.left<r.right-0.5&&r.top<c.bottom-0.5&&c.top<r.bottom-0.5) o.push(b.dataset.phase+': '+(els[i].className||els[i].tagName)+' x '+(els[j].className||els[j].tagName));}}); return o;})`;
    for (const w of [1600, 1440, 1280, 1200, 1100, 1000, 800, 420, 360]) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 600 }); await sleep(300);
      const o = await evaluate(OVER); check(`stepper sem sobreposição em ${w}px`, o.length === 0, o);
      if ([1440, 1280, 420].includes(w)) { const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: Math.min(w, 420), height: 480, scale: 1 } }); fs.writeFileSync(`${OUT}/rerun-stepper-${w}.png`, Buffer.from(r.result.data, "base64")); }
    }
    await send("Emulation.clearDeviceMetricsOverride"); await sleep(300);
    await click('#tab-hypotheses'); await click('#target-hypotheses details summary');
    const before = await dump(); check("antes: análise da anterior", before.phase === "analyze" && /Inconclusiva/.test(before.status), before);
    await click("#new-campaign-btn"); let d = await dump();
    check("rascunho: barra diz Nova campanha", /Nova campanha/.test(d.status), d.status);
    check("rascunho: progresso cita a última", /Última campanha: inconclusiva/.test(d.progress), d.progress);
    check("rascunho: sem ✓ herdado", Object.values(d.steps).every((x) => x.idx !== "✓"), d.steps);
    check("rascunho: plano/execução bloqueados", d.steps.plan.locked && d.steps.execute.locked, d.steps);
    check("rascunho: análise/relatório = campanha anterior", !d.steps.analyze.locked && /anterior/.test(d.steps.analyze.state) && /anterior/.test(d.steps.report.state), d.steps);
    await evaluate(`const i=document.getElementById('target-url'); i.value='https://example.org/'; i.dispatchEvent(new Event('input')); true`);
    d = await dump(); check("barra acompanha o alvo digitado", d.target === "https://example.org/", d.target);
    await shot("configure-again");
    await click('.phase-step[data-phase="analyze"]'); d = await dump();
    check("consultar anterior ainda funciona", d.phase === "analyze" && /Inconclusiva/.test(d.status), d);
    await click('.phase-step[data-phase="configure"]');
    await evaluate(`document.getElementById('authorization-confirmed').checked=true; document.getElementById('api-key').value='k'; true`);
    await click("#start-btn"); await sleep(1800); d = await dump();
    check("após iniciar: planejamento da nova", d.phase === "plan" && /Planejando/.test(d.status) && d.target === "https://example.org/", d);
    check("após iniciar: análise/relatório bloqueados", d.steps.analyze.locked && d.steps.report.locked, d.steps);
    check("após iniciar: nada aberto herdado além do ativo", d.open <= 1, d.open);
    const old = await evaluate(`document.getElementById('view-plan').innerText`);
    check("após iniciar: nenhum plano antigo exibido", !/plano registrado/.test(old.replace(/sem plano registrado/g, "")), old.slice(0, 300));
    await shot("after-start");
  },
  async offline({ probe, check }) { const p = await probe(); check("connection banner visible", p.conn, p); check("stop disabled", p.stopDisabled); check("start disabled", p.startDisabled); check("error message", /Não foi possível consultar/.test(p.msg), p.msg); },
};
const summary = []; let port = 8810;
for (const [name, steps] of Object.entries(scenarios)) {
  if (ONLY && ONLY !== name) continue;
  port += 1; const log = `${E2E}/posts-${name}.log`; fs.rmSync(log, { force: true }); fs.rmSync(`${E2E}/profile-${name}`, { recursive: true, force: true });
  const server = spawn("python3", ["-I", `${E2E}/fake_console.py`, "--scenario", name, "--port", String(port), "--web", WEB, "--fixtures", `${E2E}/scenarios.json`, "--log", log], { stdio: ["ignore", "ignore", "pipe"] });
  const results = []; let chrome;
  const check = (label, ok, detail) => results.push({ label, ok: Boolean(ok), detail: ok ? undefined : (typeof detail === "string" ? detail : JSON.stringify(detail ?? "")) });
  try {
    await waitHttp(`http://127.0.0.1:${port}/`);
    chrome = await launchChrome(`${E2E}/profile-${name}`);
    const { send, events } = await connect(chrome.devPort);
    await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
    const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error("eval: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result?.result?.value; };
    const waitFor = async (expr, timeout = 3000) => { const t = Date.now(); while (Date.now() - t < timeout) { if (await evaluate(expr)) return true; await sleep(150); } return false; };
    const click = async (sel) => { const ok = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.click(); return true;})()`); if (!ok) throw new Error("no element " + sel); await sleep(250); };
    const key = async (k) => { await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true})); true`); await sleep(150); };
    const shot = async (label, mobile = false) => { if (mobile) await send("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 1, mobile: true }); else await send("Emulation.clearDeviceMetricsOverride"); await sleep(400); const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/${name}-${label}.png`, Buffer.from(r.result.data, "base64")); };
    const probe = () => evaluate(PROBE);
    const posts = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    await waitFor(`document.getElementById('bar-target').textContent!=='—'`, 6000); await sleep(1800);
    await steps({ evaluate, click, shot, probe, posts, check, waitFor, key, send });
    const errors = events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") || (e.method === "Log.entryAdded" && e.params.entry.level === "error" && !/favicon\.ico$/.test(e.params.entry.url || "") && !(name === "offline" && /503/.test(e.params.entry.text))))
      .map((e) => e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || (e.params.entry ? `${e.params.entry.text} [${e.params.entry.url || ""}]` : undefined) || JSON.stringify(e.params.args?.map((a) => a.value)));
    check("no console/runtime errors", errors.length === 0, errors.slice(0, 3));
  } catch (error) { check("scenario ran", false, String(error.stack || error)); }
  finally { try { chrome?.proc.kill("SIGKILL"); } catch {} server.kill("SIGKILL"); }
  const failed = results.filter((r) => !r.ok);
  summary.push({ name, passed: results.length - failed.length, total: results.length, failed });
}
let bad = 0;
for (const s of summary) { console.log(`${s.failed.length ? "FAIL" : "ok  "} ${s.name.padEnd(18)} ${s.passed}/${s.total}`); for (const f of s.failed) { bad++; console.log(`     ✗ ${f.label}${f.detail ? " — " + f.detail.slice(0, 300) : ""}`); } }
console.log(`\nscreenshots: ${fs.readdirSync(OUT).length} in ${OUT}`);
process.exit(bad ? 1 : 0);
