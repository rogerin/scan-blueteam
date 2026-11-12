# Relatório de pentest controlado — Hackathon Hubbits - Desafio 3

## Resumo executivo

- Alvo: https://4.migbot.com.br//
- Execução: 20261112T141427Z-04a62dbb
- Estado: completed (planned_tests_complete)
- Requisições: 8
- Achados: 5
- Estados: 5 observações confirmadas, 0 inconclusivas, 0 descartadas

Os achados desta campanha decorrem de verificações HTTP não destrutivas. Ausência de cabeçalho é uma observação de configuração; não demonstra exploração.

## Plano dos testes

- Agente: IA (gpt-6-luna)
- Estado: completed
- Checks selecionados: headers, cookies, framework_inventory, public_metrics, sql_error_exposure, beginner_challenges
- Fallback determinístico: não
- A IA escolhe apenas IDs predefinidos; o executor valida cada requisição e decide os resultados.

## Inventário Angular e avisos de segurança

- Família: Angular
- Versão: 22.2.2
- Confiança da identificação: exact
- CVEs confirmadas: nenhuma pela análise passiva.
- O catálogo de advisories é limitado; versões sobrepostas exigem confirmação do pacote e das condições no código.

- Marcador runtime_ng_version: 22.2.2 em chunk-Cv2YgWUq.js

### GHSA-ffj9-42qx-f38h — avaliação condicional

- Pacote: @angular/upgrade
- Estado: not_confirmed
- Motivo: Package @angular/upgrade not confirmed; Hybrid AngularJS app, downgradeComponent, co-located directive and user-controlled data must be verified.
- Fonte do mantenedor: https://github.com/angular/angular/security/advisories/GHSA-ffj9-42qx-f38h

## Dificuldades básicas do desafio

- Desafios de dificuldade 1: 13
- Desafios de dificuldade 2: 19
- Tutoriais iniciais: Score Board, DOM XSS, Bonus Payload, Privacy Policy, Reflected XSS, Exposed Credentials, Login Admin, Admin Section, Password Strength, View Basket, Forged Feedback, Login Jim

## Revisão editorial após a coleta

Os ajustes abaixo esclarecem o alcance de evidências já coletadas. Nenhuma nova requisição foi feita por esta revisão.

- Data: 2026-11-12T14:30:19.005148+00:00
- CSP e Referrer-Policy foram nomeados como ausência de cabeçalho na resposta observada; políticas via HTML não foram avaliadas.
- O roteiro da comparação sintética de busca passou a mencionar aprovação explícita; não houve nova requisição por esta revisão.
- O resumo do escopo foi anexado a partir da configuração e do alvo registrados para exibição coerente no console.

## Achados técnicos

### Métricas Prometheus públicas

- ID: `public_metrics-57c88ab0fb9b`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/metrics
- Evidência: GET /metrics respondeu 200 com formato Prometheus; valores não registrados
- Trecho sanitizado: # HELP juiceshop_llm_input_tokens_total
- Prova do teste: GET /metrics: HTTP 200; Content-Type: text/plain; linha de métrica reconhecida; SHA-256 capturado: 325fd436ab01…
- Limites da conclusão: O marcador prova formato de métricas; valores e possíveis segredos não foram retidos.
- Reprodução controlada: Faça um GET em /metrics; confira HTTP 200, tipo Prometheus e uma linha # HELP ou # TYPE. Não publique valores de métricas.
- Impacto possível: Visitantes anônimos podem consultar metadados operacionais e indicadores do serviço.
- Orientação: Proteja /metrics na borda por rede interna ou autenticação e valide que anônimos recebem 403/404.

```text
# Express: app.get('/metrics', internalOnly, metricsHandler)
```

### Erro SQLite exposto por entrada de busca

- ID: `sql_error_exposure-70d5e72808c2`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/rest/products/search
- Evidência: GET com q=apple respondeu 200; q=apple%27 respondeu 500 com marcador SQLITE_ERROR. Nenhuma extração ou bypass foi tentado.
- Trecho sanitizado: SQLITE_ERROR
- Prova do teste: q=apple: HTTP 200 (application/json); q=apple%27: HTTP 500 (text/html); SQLITE_ERROR; SHA-256 capturado: 7364680cd6b5…
- Limites da conclusão: Confirma erro SQL exposto; não comprova extração, bypass ou injeção explorável.
- Reprodução controlada: Após aprovação humana (ou --approve-quoted-search no CLI), compare q=apple com q=apple%27, uma requisição de cada; confira JSON 200 e erro 5xx com SQLITE_ERROR. Não tente extração.
- Impacto possível: A entrada pode causar falha na consulta e revelar detalhes internos. Isso não comprova, isoladamente, exploração de SQL injection.
- Orientação: No handler Express da busca, valide q, use parâmetros preparados na consulta SQLite e retorne erro genérico ao cliente; mantenha o detalhe só no log interno.

```text
const rows = db.prepare('SELECT ... FROM Products WHERE name LIKE ?').all(`%${q}%`); // SQLite
// Express: catch (err) { logger.error(err); res.status(500).json({ error: 'internal_error' }); }
```

### Cabeçalho Content-Security-Policy ausente

- ID: `missing_csp-8ff0abadd3a0`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Content-Security-Policy ausente
- Trecho sanitizado: Content-Security-Policy: <ausente>
- Prova do teste: GET da página HTML: HTTP 200; Content-Type: text/html; CSP não veio na resposta.
- Limites da conclusão: Confirma ausência do cabeçalho nesta resposta; meta CSP não foi avaliada e XSS não foi testado.
- Reprodução controlada: Faça um GET na página indicada e confira nos cabeçalhos da resposta a ausência da política citada. Não infira exploração.
- Impacto possível: Sem esse cabeçalho, a resposta não declara uma política CSP HTTP; políticas via HTML não foram avaliadas.
- Orientação: Mapeie as origens usadas pela SPA, teste em Report-Only e depois aplique CSP.

```text
Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'
```

### HSTS ausente

- ID: `missing_hsts-06d4aa3e8a88`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Strict-Transport-Security ausente
- Trecho sanitizado: Strict-Transport-Security: <ausente>
- Prova do teste: GET da página: HTTP 200; Content-Type: text/html; Strict-Transport-Security não veio na resposta.
- Limites da conclusão: Confirma ausência nesta resposta; não demonstra exploração.
- Reprodução controlada: Faça um GET na página indicada e confira nos cabeçalhos da resposta a ausência da política citada. Não infira exploração.
- Impacto possível: Sem HSTS, o navegador não recebe uma política explícita para voltar somente por HTTPS.
- Orientação: Envie HSTS apenas após confirmar que o domínio funciona integralmente em HTTPS.

```text
Strict-Transport-Security: max-age=31536000
```

### Cabeçalho Referrer-Policy ausente

- ID: `missing_referrer_policy-253b1b85b972`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Referrer-Policy ausente
- Trecho sanitizado: Referrer-Policy: <ausente>
- Prova do teste: GET da página: HTTP 200; Content-Type: text/html; Referrer-Policy não veio na resposta.
- Limites da conclusão: Confirma ausência do cabeçalho nesta resposta; políticas em HTML ou outras rotas não foram avaliadas.
- Reprodução controlada: Faça um GET na página indicada e confira nos cabeçalhos da resposta a ausência da política citada. Não infira exploração.
- Impacto possível: Sem esse cabeçalho, a política de Referer depende do navegador ou de outra declaração não avaliada.
- Orientação: Defina uma política explícita de Referer compatível com os fluxos da aplicação.

```text
Referrer-Policy: strict-origin-when-cross-origin
```

## Orientação por IA

- Modelo: gpt-6-luna
- Estado: completed
- Uso: sugestões para revisão humana; não alteram a classificação dos achados.

### public_metrics-57c88ab0fb9b

Restrinja /metrics na borda à rede interna ou exija autenticação, sem expor detalhes operacionais a usuários anônimos.

```text
Configure a regra no proxy, gateway ou mecanismo de controle de acesso disponível; permita somente origens administrativas autorizadas.
```

Validação sugerida: Revise a configuração implantada e os registros de acesso para confirmar que a rota está limitada às origens autorizadas.

### sql_error_exposure-70d5e72808c2

Valide a entrada q, use parâmetros preparados na consulta SQLite e retorne uma mensagem genérica ao cliente; mantenha detalhes do erro apenas em logs internos.

```text
No handler Express, use placeholders e vincule q como parâmetro, em vez de concatená-lo à consulta.
```

Validação sugerida: Revise o handler e o tratamento de erros para confirmar o uso de parâmetros e a ausência de detalhes SQLite nas respostas.

### missing_csp-8ff0abadd3a0

Defina uma CSP compatível com as origens necessárias pela aplicação; comece em Report-Only e aplique a política após avaliar os relatórios.

```text
Configure o cabeçalho no servidor, proxy ou middleware disponível; evite diretivas permissivas sem necessidade.
```

Validação sugerida: Revise a política implantada e os relatórios existentes para identificar incompatibilidades antes de aplicá-la.

### missing_hsts-06d4aa3e8a88

Configure HSTS somente após confirmar que o domínio funciona integralmente em HTTPS.

```text
Defina Strict-Transport-Security na camada que entrega as respostas HTTPS; inclua subdomínios apenas se todos estiverem preparados para HTTPS.
```

Validação sugerida: Confirme, por revisão da configuração e do estado de HTTPS do domínio, que a política corresponde à cobertura pretendida.

### missing_referrer_policy-253b1b85b972

Defina uma política explícita de Referrer compatível com os fluxos da aplicação e que minimize a divulgação de URLs a outros domínios.

```text
Configure o cabeçalho Referrer-Policy no servidor, proxy ou middleware disponível; considere strict-origin-when-cross-origin se adequado aos fluxos.
```

Validação sugerida: Revise a configuração implantada e confirme que a política escolhida atende aos requisitos de navegação e privacidade.

## Trilha de auditoria

Corpos de resposta e valores de cookies não são gravados. O arquivo `evidence.json` contém os eventos, hashes e metadados limitados.

- 2026-11-12T14:14:27.022771+00:00 · scope · decision: Campaign scope validated
- 2026-11-12T14:14:27.067175+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br//
- 2026-11-12T14:14:27.397728+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br// · HTTP 200 · SHA-256 2827d932e805…
- 2026-11-12T14:14:27.398576+00:00 · discovery · decision: Discovery complete
- 2026-11-12T14:14:33.867763+00:00 · planning · decision: Plan selected from allowed checks
- 2026-11-12T14:14:33.870640+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/rolldown-runtime-BoHGiXSq.js
- 2026-11-12T14:14:34.447905+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/rolldown-runtime-BoHGiXSq.js · HTTP 200 · SHA-256 68e9792c539b…
- 2026-11-12T14:14:34.873618+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/chunk-DBPdFzgj.js
- 2026-11-12T14:14:35.190521+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/chunk-DBPdFzgj.js · HTTP 200 · SHA-256 97f1c6984085…
- 2026-11-12T14:14:35.878704+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/chunk-Cv2YgWUq.js
- 2026-11-12T14:14:36.308665+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/chunk-Cv2YgWUq.js · HTTP 200 · SHA-256 fbc703799bc7…
- 2026-11-12T14:14:36.322914+00:00 · discovery · observation: Framework inventory evaluated
- 2026-11-12T14:14:36.882760+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/metrics
- 2026-11-12T14:14:37.193355+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/metrics · HTTP 200 · SHA-256 325fd436ab01…
- 2026-11-12T14:14:37.193678+00:00 · surface_checks · test: Checked public metrics endpoint · HTTP 200
- 2026-11-12T14:14:37.883038+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/rest/products/search
- 2026-11-12T14:14:38.510749+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/rest/products/search · HTTP 200 · SHA-256 084d85f6fb39…
- 2026-11-12T14:14:38.887203+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/rest/products/search
- 2026-11-12T14:14:39.224507+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/rest/products/search · HTTP 500 · SHA-256 7364680cd6b5…
- 2026-11-12T14:14:39.224620+00:00 · surface_checks · test: Compared benign and quoted search inputs
- 2026-11-12T14:14:39.889642+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/api/Challenges
- 2026-11-12T14:14:40.207376+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/api/Challenges · HTTP 200 · SHA-256 6157b3195a6b…
- 2026-11-12T14:14:40.207781+00:00 · discovery · observation: Beginner challenges counted
- 2026-11-12T14:14:40.207798+00:00 · checks · test: Checked Strict-Transport-Security
- 2026-11-12T14:14:40.207810+00:00 · checks · test: Checked X-Content-Type-Options
- 2026-11-12T14:14:40.207813+00:00 · checks · test: Checked Referrer-Policy
- 2026-11-12T14:14:40.207820+00:00 · checks · test: Checked Content-Security-Policy
- 2026-11-12T14:14:40.207826+00:00 · checks · test: Checked frame protection
- 2026-11-12T14:14:40.207940+00:00 · triage · triage: Finding classified
- 2026-11-12T14:14:40.207942+00:00 · triage · triage: Finding classified
- 2026-11-12T14:14:40.207943+00:00 · triage · triage: Finding classified
- 2026-11-12T14:14:40.207945+00:00 · triage · triage: Finding classified
- 2026-11-12T14:14:40.207946+00:00 · triage · triage: Finding classified
- 2026-11-12T14:14:40.207951+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:14:40.207953+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:14:40.207955+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:14:40.207956+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:14:40.207958+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:14:40.207961+00:00 · ai · decision: Sending redacted findings to optional AI advisor
- 2026-11-12T14:14:48.218295+00:00 · ai · recommendation: AI advice received for human review
- 2026-11-12T14:14:48.218340+00:00 · control · stop: Planned non-destructive campaign ended

## Limites

A campanha não testa autenticação, IDOR, exploração de injeção, XSS ou APIs que exijam interação, credenciais ou alteração de estado. Esses testes exigem escopo e contas de teste específicos.
