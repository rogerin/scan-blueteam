"""Gera cenários de /api/status a partir de um result.json real (sem rede).

Uso: python3 -I tools/e2e-web/build_scenarios.py <saida.json> [result.json]
Sem origem, usa o reports/*/result.json mais recente. Se a origem não tiver evento de
aprovação 'pending' (ex.: docs/resultado-evidencia-detalhada.json), um evento sintético,
marcado com "synthetic": true, é inserido após o primeiro teste de superfície.
Ver docs/PLANO_HANDOFF_FRONTEND.md, tarefa A.
"""
import copy, datetime, glob, json, os, sys

out = sys.argv[1]
if len(sys.argv) > 2:
    src = sys.argv[2]
else:
    found = sorted(glob.glob("reports/*/result.json"), key=os.path.getmtime)
    if not found:
        sys.exit("Nenhum reports/*/result.json; informe a origem, ex.: docs/resultado-evidencia-detalhada.json")
    src = found[-1]
real = json.load(open(src, encoding="utf-8"))
acts = real["actions"]
if not any(a.get("type") == "approval" and a.get("status") == "pending" for a in acts):
    at = next((i for i, a in enumerate(acts) if a.get("phase") == "surface_checks"), len(acts) // 2)
    target = real["target"].rstrip("/") + "/rest/products/search"
    acts.insert(at, {"timestamp": acts[at - 1]["timestamp"], "type": "approval", "phase": "approval",
                     "message": "Ação condicionada aguardando aprovação humana.",
                     "approval_id": "0" * 31 + "1", "action_id": "quoted_search", "status": "pending",
                     "target": target, "synthetic": True})
scope = {**real["summary"]["scope"], "ai_model": "gpt-6-luna", "ai_provider": "openai"}
idx = lambda p: next(i for i, a in enumerate(acts) if p(a))
i_plan = idx(lambda a: a.get("phase") == "planning" and a.get("type") == "decision") + 1
i_pending = idx(lambda a: a.get("type") == "approval" and a.get("status") == "pending") + 1
i_triage = idx(lambda a: a.get("phase") == "triage")
base = dict(running=False, stop_requested=False, events=[], result=None, delta=None, error=None,
            scope=scope, report_available=False, approvals=[])
now = datetime.datetime.now(datetime.timezone.utc)
pend = next(a for a in acts if a.get("type") == "approval" and a.get("status") == "pending")
approval = {"id": pend["approval_id"], "action_id": "quoted_search", "target": pend["target"],
            "reason": "Comparar duas buscas sintéticas para verificar exposição de erro SQL.",
            "status": "pending", "created_at": now.isoformat(),
            "expires_at": (now + datetime.timedelta(minutes=4)).isoformat(), "decided_at": None}
stopped = copy.deepcopy(real)
stopped.update(status="stopped", stop_reason="operator_requested", actions=acts[:i_triage],
               findings=real["findings"][:2], recommendations=[])
stopped["observations"] = [o for o in stopped["observations"] if o["type"] in ("ai_plan", "framework_inventory", "agent_plan")]
stopped["summary"] = {**real["summary"], "findings": 2, "by_severity": {"medium": 2}, "by_status": {"confirmed": 2}}
empty = copy.deepcopy(real)
empty.update(status="completed", stop_reason="planned_tests_complete", findings=[], recommendations=[])
empty["summary"] = {**real["summary"], "findings": 0, "by_severity": {}, "by_status": {}}
empty["observations"] = [o for o in empty["observations"] if o["type"] != "conditioned_check"]
S = {
    "idle": base | {},
    "loaded": base | {"result": real, "report_available": True},
    "planning": base | {"running": True, "events": acts[:i_plan]},
    "running": base | {"running": True, "events": acts[:i_triage]},
    "awaiting_approval": base | {"running": True, "events": acts[:i_pending], "approvals": [approval]},
    "stopping": base | {"running": True, "stop_requested": True, "events": acts[:i_triage]},
    "stopped": base | {"result": stopped, "events": acts[:i_triage], "report_available": True},
    "completed_empty": base | {"result": empty, "report_available": True},
    "failed_error": base | {"error": "Erro interno na campanha (RuntimeError).",
                            "events": acts[:5] + [{"timestamp": now.isoformat(), "type": "error",
                                                   "phase": "campaign", "message": "A campanha terminou com erro."}]},
    "offline": base | {},
}
S["rerun"] = copy.deepcopy(S["loaded"])  # rodar, preencher de novo e iniciar outra campanha
json.dump(S, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("origem:", src)
print("cenários:", ", ".join(f"{k}(ev={len(v['events'])})" for k, v in S.items()))
