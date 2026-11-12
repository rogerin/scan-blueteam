# Plano de handoff — refatoração do console web por fases

Documento para agentes (humanos ou Claude Code) continuarem o trabalho **sem acesso à sessão
original**. Leia inteiro antes de tocar em qualquer arquivo. Tudo o que está aqui foi verificado no
código em 12/11/2026, branch `erick.monteiro/frontend-melhorias`.

## 0. Estado atual (o que já está feito)

| Item | Estado |
| --- | --- |
| `web/index.html`, `web/app.js`, `web/style.css` reescritos como SPA em 5 fases | **Feito, não commitado** (`git status`: 3 modificados) |
| Backend (`pentest_pipeline/*`) | **Intocado** — e deve continuar assim |
| `python3 -m unittest discover -s tests` | 71 testes, OK |
| E2E controlado (`tools/e2e-web/`) | 93/93 asserções em 10 cenários, 0 erros de console; **arquivos novos, não rastreados** |
| README | Ainda descreve o console antigo em um parágrafo (seção "Executar") |

Nada precisa ser refeito. O trabalho restante é consolidar, documentar, revisar e validar ao vivo.

## 1. Invariantes — regras que nenhum agente pode quebrar

1. **Não alterar o backend** para acomodar a interface. O contrato é só `/api/status` (GET),
   `/api/campaign/start`, `/api/campaign/stop`, `/api/approval/decision` (POST JSON) e
   `/api/report.md|json`. Se precisar de algo que o snapshot não tem, documente a lacuna; não invente.
2. **Três arquivos vanilla, sem build, sem CDN.** `web_server.py` serve uma allowlist fixa
   (`/`, `/app.js`, `/style.css`, 4 fontes) com CSP `script-src 'self'; style-src 'self'`. Nada de
   script/style inline, nada de framework, nada de arquivo JS novo (não seria servido).
3. **Estados derivados, nunca inventados.** O backend não tem campo `state`. `deriveModel()` em
   `app.js` deriva de `running`, `stop_requested`, `approvals[].status`, `error` e `result.status`
   (`completed|inconclusive|stopped|failed`). Não adicionar timers, porcentagens ou "carregando" falsos.
4. **Explicabilidade só com registro real.** Hipótese/ação/resultado esperado/parada vêm de eventos
   `stage_plan` (ou da observação `agent_plan`); justificativa de achado vem do evento `triage`
   (`finding_id`, `severity`, `status`, `confidence`). Sem registro → texto "justificativa indisponível".
5. **Segurança visual ≠ segurança real.** Aprovação só via `/api/approval/decision` com `approval_id`
   real; parada só via `/api/campaign/stop`; navegar entre fases nunca dispara POST. Teste E2E cobre
   isso — mantenha os testes passando.
6. **Nenhum teste contra alvo externo.** Validação = unittest + E2E com servidor falso + fixtures.
7. Preservar a identidade visual (tokens `--keycore-*`, fontes Inter/Poppins, componentes existentes).

## 2. Mapa rápido de `web/app.js` (para se orientar em 5 minutos)

- Vocabulário fixo no topo: `stages` (8 etapas), `stageForPhase` (fase do evento → etapa; inclui
  `ai`, `archive`, `approval` que antes se perdiam), rótulos (`STATE_LABELS`, `STOP_REASONS`, etc.).
- `deriveModel(snapshot)` → objeto `model` com `state`, `stageStates[]` (active/complete/pending/
  skipped + eventos e planos por etapa), `pendingApproval`, `naturalPhase`, `available{}`,
  `loadedFromDisk`. **Única fonte de verdade da tela.**
- Navegação: `selectedPhase` (escolha do operador) vs `naturalPhase` (onde a campanha está). Quando a
  fase natural muda, a vista segue a campanha; clicar no stepper fixa até a próxima transição.
- Renderizadores: `renderConfigure`, `renderPlan`, `renderExecute`, `renderAnalyze`
  (`renderFindingsExplorer` + funções reaproveitadas do console antigo), `renderReport`, `renderAudit`.
- `details(key, …)` + `openState` + `applyOpenState()`: blocos `<details data-key>` lembram se o
  operador abriu/fechou, porque o polling re-renderiza a cada 1,5 s.
- `refresh()`: polling existente; pula o render se o JSON não mudou (exceto com aprovação pendente,
  para o prazo atualizar); `lastRaw = null` ao reconectar e após qualquer `action()`.
- `action()`: guarda `busy` contra duplo clique; limpa `lastRaw` para forçar render.

Eventos reais que a UI consome: `stage_plan`, `decision` (com `check_ids/source/fallback` na fase
`planning`), `test` (`check/outcome/status`), `observation`, `approval` (`approval_id/status`),
`triage`, `agent_start/agent_result`, `evidence_link`, `error`, `stop`. Observações: `agent_plan`,
`ai_plan`, `ai_advisor`, `target_ai_review`, `conditioned_check`, `framework_inventory`,
`target_multiagent_analysis`, `beginner_challenges`.

## 3. Tarefas para agentes

Cada tarefa é independente salvo onde indicado. Antes de começar qualquer uma: `git status` limpo
exceto os 3 arquivos de `web/` (e os novos em `tools/e2e-web/`), `python3 -m unittest discover -s tests`
verde, E2E verde (comandos em `tools/e2e-web/README.md`).

### Tarefa A — Consolidar o harness E2E no repositório
**Objetivo:** `tools/e2e-web/` reproduzível por qualquer pessoa sem `reports/` (que é gitignored).
**Passos:**
1. Rodar `build_scenarios.py` com `docs/resultado-evidencia-detalhada.json` (fixture rastreado, 69
   ações, sem evento de aprovação pendente → o script sintetiza e marca `synthetic: true`).
2. Rodar o E2E completo com esse fixture. Esperado: o cenário `awaiting_approval` passa com o item
   sintético; `loaded` tem 7 achados (não 6) — ajustar a asserção `"6 finding rows"` em `run_e2e.mjs`
   para ler a contagem do fixture em vez de um número fixo; idem `78` eventos de auditoria.
3. Decidir com o dono do projeto se `tools/e2e-web/` entra no commit. Se sim, garantir que **não**
   é descoberto pelo `unittest` (nomes sem prefixo `test_`) e que falha com mensagem clara sem Chrome.
**Aceite:** E2E verde com o fixture rastreado; `unittest` continua com 71 testes.

### Tarefa B — Documentação
**Objetivo:** README e docs refletirem a jornada guiada.
**Passos:** no `README.md`, seção "Executar", trocar o parágrafo da interface web por 5–8 linhas:
as 5 fases, o que cada uma mostra, a barra persistente (alvo, estado, política, Parar, auditoria),
onde a aprovação aparece, e que a interface só reflete eventos reais. Linkar `tools/e2e-web/README.md`.
Adicionar em `docs/PLANO_FUNCIONALIDADES.md` uma linha por item da tabela indicando onde cada
funcionalidade vive agora (fase). Não reescrever o resto.
**Aceite:** nenhuma afirmação no README que o código não cumpra (conferir lendo `app.js`).

### Tarefa C — Revisão de código do diff
**Objetivo:** pegar regressões que os testes não cobrem.
**Passos:** `git diff -- web/` com foco em: (1) caminhos do formulário (chave limpa, `targetDirty`,
provedor Bedrock mostra região); (2) `approvalCard` com `expires_at` ausente/inválido; (3)
`renderExecute` quando `activeIndex === -1` ou `events` vazio durante `running`; (4) `renderReport`
com `result.summary` parcial (os testes do backend usam `summary: {requests, findings}` apenas —
a UI precisa tolerar isso); (5) XSS: tudo passa por `textContent`/`node()`; procurar qualquer
`innerHTML` (não deve existir). Rodar também `/code-review` se disponível.
**Aceite:** lista de achados com arquivo:linha; corrigir os confirmados; E2E e unittest verdes.

### Tarefa D — Acessibilidade e responsividade (sem código novo, se possível)
**Objetivo:** checar o que o E2E não checa.
**Passos:** percorrer com teclado todas as 5 fases (Tab/Shift+Tab, Enter em stepper/abas/aprovar,
Esc na gaveta); verificar contraste dos pills de estado (`.status-pill[data-state=…]`) e dos
`.severity` com uma ferramenta de contraste; testar 360 px, 420 px, 920 px, 1180 px (breakpoints em
`style.css`); leitor de tela: `aria-live` da barra de estado não deve ficar verboso (hoje anuncia só
mudanças de estado porque o render é pulado quando o JSON não muda — manter isso).
**Aceite:** relatório curto com problemas + correções mínimas em CSS/atributos.

### Tarefa E — Validação ao vivo (requer operador com autorização)
**Objetivo:** a única coisa impossível de simular: eventos chegando em tempo real na fase 3.
**Passos:** `python3 -m pentest_pipeline.web_server`, abrir `http://127.0.0.1:8765/`, iniciar uma
campanha **apenas no alvo autorizado do `scope.json`**, e observar: transição configurar→planejamento
→execução sem clique; cartão do agente ativo muda a cada etapa; chips de concluídos acumulam;
aprovação aparece no cartão (e como faixa ao navegar para outra fase); Negar e Aprovar; Parar no meio
de uma etapa → "Parando" → "Interrompida" com etapas "não executadas" na análise; recarregar a página
durante a execução **não** inicia outra campanha; ao terminar, vista vai para Análise sozinha.
**Aceite:** checklist preenchido; divergências entre o que a UI mostra e `reports/<run_id>/result.json`
anotadas como issues (prioridade: dados reais > interface).

### Tarefa F — Decisões pendentes para o dono do projeto (não executar sem resposta)
1. Favicon: o console gera um 404 em `/favicon.ico`. Corrigir exige adicionar o arquivo à allowlist em
   `web_server.py` (mudança de backend, pequena). Fazer ou aceitar o 404?
2. Mensagens de evento em inglês ("Campaign scope validated"): são registros do backend, exibidos
   como estão. Traduzir na UI criaria divergência com `report.md`. Manter.
3. `tools/e2e-web/` no repositório ou fora?

### Ordem e dependências
A, B, C, D podem rodar **em paralelo** (arquivos diferentes; C e D só tocam `web/` com correções
pequenas — coordenar para não editar a mesma função). E depende de um operador. Commit/PR só depois
de A–D verdes e das respostas de F. Mensagem de commit sugerida: `feat(web): guided five-phase
campaign console with real-state navigation`.

## 4. Como validar qualquer mudança (checklist de 2 minutos)
```bash
node --check web/app.js
python3 -m unittest discover -s tests 2>&1 | grep -E '^(Ran |OK|FAILED)'
# E2E: ver tools/e2e-web/README.md
python3 -m pentest_pipeline.web_server --port 8799 &  # depois: curl -s localhost:8799/api/status | head -c 300 ; kill %1
```
Checagem barata de consistência: todo `$("id")` em `app.js` deve existir em `index.html`
(`grep -o '\$("[^"]*")' web/app.js | sort -u` vs `grep -o 'id="[^"]*"' web/index.html`).

## 5. Armadilhas conhecidas
- `toggle` de `<details>` não borbulha: o listener global usa captura (`addEventListener(…, true)`).
- `[hidden]{display:none!important}` em `style.css` é necessário porque várias classes definem `display`.
- Durante `running`, `snapshot.result` é `null`; ao recarregar o servidor, `events` vem vazio e a
  UI usa `result.actions` (caminho `loadedFromDisk`). Os dois caminhos estão cobertos no E2E.
- O cenário `awaiting_approval` re-renderiza a cada tick (para o prazo); é o cenário que exercita a
  memória de `<details>`. Use-o para testar qualquer mudança em listas reconstruídas.
- Chrome headless pede `/favicon.ico`; o harness filtra esse 404 por URL — não "corrija" o filtro.
