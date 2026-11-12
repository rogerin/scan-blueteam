# E2E do console web (opcional, sem alvo externo)

Valida `web/index.html`, `web/app.js` e `web/style.css` em um Chrome headless,
contra um servidor falso que serve os mesmos arquivos e responde `/api/status`
com cenários fatiados de um `result.json` real. Nenhuma requisição sai da máquina.

Requisitos: `google-chrome` no PATH e Node 22+ (usa `WebSocket`/`fetch` nativos).

```bash
mkdir -p /tmp/e2e-web/shots
python3 -I tools/e2e-web/build_scenarios.py /tmp/e2e-web/scenarios.json            # usa reports/*/result.json mais recente
python3 -I tools/e2e-web/build_scenarios.py /tmp/e2e-web/scenarios.json docs/resultado-evidencia-detalhada.json  # fixture rastreado
cp tools/e2e-web/fake_console.py tools/e2e-web/run_e2e.mjs /tmp/e2e-web/
node /tmp/e2e-web/run_e2e.mjs "$PWD" /tmp/e2e-web            # todos os cenários
node /tmp/e2e-web/run_e2e.mjs "$PWD" /tmp/e2e-web loaded     # um cenário
```

Saída: tabela ok/FAIL por cenário, asserções que falharam e screenshots em `shots/`.
O 404 de `/favicon.ico` é filtrado (o servidor real também não o serve).
