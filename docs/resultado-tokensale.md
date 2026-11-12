# Relatório de pentest controlado — Hackathon Hubbits - Desafio 3

## Resumo executivo

- Alvo: https://4.migbot.com.br//
- Execução: 20261112T132142Z-4c6be3db
- Estado: completed (planned_tests_complete)
- Requisições: 11
- Achados: 7

Os achados desta campanha decorrem de verificações HTTP não destrutivas. Ausência de cabeçalho é uma observação de configuração; não demonstra exploração.

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

## Achados técnicos

### Recurso anunciado em /ftp/: incident-support.kdbx

- ID: `ftp_file_head_incident-support.kdbx-8cc84ca64260`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/ftp/incident-support.kdbx
- Evidência: HEAD /ftp/incident-support.kdbx respondeu 200, tipo application/octet-stream, tamanho 3246 bytes; nenhum corpo de arquivo foi lido
- Impacto possível: O servidor anuncia o recurso e seus metadados. Isso não comprova leitura por GET, conteúdo sensível ou presença de credenciais.
- Orientação: Revise a necessidade de publicar esse arquivo. Se for privado, negue o acesso anônimo e verifique GET e HEAD no mesmo controle de autorização.

```text
# Nginx: location /ftp/ { autoindex off; deny all; }
```

### Listagem pública de /ftp/

- ID: `ftp_listing-65e2d54cd901`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/ftp/
- Evidência: GET /ftp/ respondeu 200 com padrão de índice de diretório; arquivos não acessados
- Impacto possível: Visitantes anônimos podem descobrir nomes de arquivos disponíveis nesse diretório.
- Orientação: Desative o índice de diretório em /ftp/ e limite o acesso aos arquivos necessários por rota autenticada.

```text
# Express: remova serve-index de /ftp/; no Nginx: autoindex off;
```

### Métricas Prometheus públicas

- ID: `public_metrics-57c88ab0fb9b`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/metrics
- Evidência: GET /metrics respondeu 200 com formato Prometheus; valores não registrados
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
- Impacto possível: A entrada pode causar falha na consulta e revelar detalhes internos. Isso não comprova, isoladamente, exploração de SQL injection.
- Orientação: No handler Express da busca, valide q, use parâmetros preparados na consulta SQLite e retorne erro genérico ao cliente; mantenha o detalhe só no log interno.

```text
const rows = db.prepare('SELECT ... FROM Products WHERE name LIKE ?').all(`%${q}%`); // SQLite
// Express: catch (err) { logger.error(err); res.status(500).json({ error: 'internal_error' }); }
```

### CSP não declarada

- ID: `missing_csp-8ff0abadd3a0`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Content-Security-Policy ausente
- Impacto possível: A página não restringe por política as fontes de script, imagem, conexão e outros recursos.
- Orientação: Mapeie as origens usadas pela SPA, teste em Report-Only e depois aplique CSP.

```text
Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'
```

### HSTS ausente

- ID: `missing_hsts-06d4aa3e8a88`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Strict-Transport-Security ausente
- Impacto possível: Sem HSTS, o navegador não recebe uma política explícita para voltar somente por HTTPS.
- Orientação: Envie HSTS apenas após confirmar que o domínio funciona integralmente em HTTPS.

```text
Strict-Transport-Security: max-age=31536000
```

### Política de Referer não declarada

- ID: `missing_referrer_policy-253b1b85b972`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br//
- Evidência: HTTP 200: cabeçalho Referrer-Policy ausente
- Impacto possível: URLs completas podem ser enviadas como Referer a outros destinos dependendo do navegador.
- Orientação: Defina uma política explícita de Referer compatível com os fluxos da aplicação.

```text
Referrer-Policy: strict-origin-when-cross-origin
```

## Trilha de auditoria

Corpos de resposta e valores de cookies não são gravados. O arquivo `evidence.json` contém os eventos, hashes e metadados limitados.

- 2026-11-12T13:21:42.854039+00:00 · scope · decision: Campaign scope validated
- 2026-11-12T13:21:42.875886+00:00 · discovery · request: Bounded request started
- 2026-11-12T13:21:43.529034+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T13:21:43.530521+00:00 · discovery · decision: Discovery complete
- 2026-11-12T13:21:43.530547+00:00 · planning · decision: Safe profile selected
- 2026-11-12T13:21:43.880994+00:00 · discovery · request: Bounded request started
- 2026-11-12T13:21:44.571350+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T13:21:44.885113+00:00 · discovery · request: Bounded request started
- 2026-11-12T13:21:45.128001+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T13:21:45.887990+00:00 · discovery · request: Bounded request started
- 2026-11-12T13:21:49.422127+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T13:21:49.429926+00:00 · discovery · observation: Framework inventory evaluated
- 2026-11-12T13:21:49.432594+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:49.771432+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:49.772213+00:00 · surface_checks · test: Checked public FTP index
- 2026-11-12T13:21:50.435270+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:50.812719+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:50.812849+00:00 · surface_checks · test: Checked public metrics endpoint
- 2026-11-12T13:21:51.440547+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:51.721286+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:52.445718+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:52.720136+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:52.720151+00:00 · surface_checks · test: Compared benign and quoted search inputs
- 2026-11-12T13:21:53.446590+00:00 · discovery · request: Bounded request started
- 2026-11-12T13:21:54.112456+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T13:21:54.113692+00:00 · discovery · observation: Beginner challenges counted
- 2026-11-12T13:21:54.451522+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:54.785272+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:54.785353+00:00 · surface_checks · test: Checked listed file with HEAD only
- 2026-11-12T13:21:55.456720+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T13:21:55.895334+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T13:21:55.895370+00:00 · surface_checks · test: Checked listed file with HEAD only
- 2026-11-12T13:21:55.895436+00:00 · checks · test: Checked Strict-Transport-Security
- 2026-11-12T13:21:55.895481+00:00 · checks · test: Checked X-Content-Type-Options
- 2026-11-12T13:21:55.895490+00:00 · checks · test: Checked Referrer-Policy
- 2026-11-12T13:21:55.895508+00:00 · checks · test: Checked Content-Security-Policy
- 2026-11-12T13:21:55.895525+00:00 · checks · test: Checked frame protection
- 2026-11-12T13:21:55.895724+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895731+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895735+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895739+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895743+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895747+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895750+00:00 · triage · triage: Finding classified
- 2026-11-12T13:21:55.895762+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895769+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895774+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895779+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895783+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895788+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895792+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T13:21:55.895800+00:00 · control · stop: Planned non-destructive campaign ended

## Limites

A campanha não testa autenticação, IDOR, injeção, XSS ou APIs que exijam interação, credenciais ou alteração de estado. Esses testes exigem escopo e contas de teste específicos.
