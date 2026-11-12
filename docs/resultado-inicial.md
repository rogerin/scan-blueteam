# Relatório de pentest controlado — Hackathon Hubbits - Desafio 3

## Resumo executivo

- Alvo: https://4.migbot.com.br/
- Execução: 20261112T125521Z-d02cc79b
- Estado: completed (planned_tests_complete)
- Requisições: 6
- Achados: 6

Os achados desta campanha decorrem de verificações HTTP não destrutivas. Ausência de cabeçalho é uma observação de configuração; não demonstra exploração.

## Dificuldades básicas do desafio

- Desafios de dificuldade 1: 13
- Desafios de dificuldade 2: 19
- Tutoriais iniciais: Score Board, DOM XSS, Bonus Payload, Privacy Policy, Reflected XSS, Exposed Credentials, Login Admin, Admin Section, Password Strength, View Basket, Forged Feedback, Login Jim

## Achados técnicos

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

- ID: `missing_csp-86cbe373453a`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/
- Evidência: HTTP 200: cabeçalho Content-Security-Policy ausente
- Impacto possível: A página não restringe por política as fontes de script, imagem, conexão e outros recursos.
- Orientação: Mapeie as origens usadas pela SPA, teste em Report-Only e depois aplique CSP.

```text
Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'
```

### HSTS ausente

- ID: `missing_hsts-711328775d47`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/
- Evidência: HTTP 200: cabeçalho Strict-Transport-Security ausente
- Impacto possível: Sem HSTS, o navegador não recebe uma política explícita para voltar somente por HTTPS.
- Orientação: Envie HSTS apenas após confirmar que o domínio funciona integralmente em HTTPS.

```text
Strict-Transport-Security: max-age=31536000
```

### Política de Referer não declarada

- ID: `missing_referrer_policy-0714c97acd0c`
- Severidade: low; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/
- Evidência: HTTP 200: cabeçalho Referrer-Policy ausente
- Impacto possível: URLs completas podem ser enviadas como Referer a outros destinos dependendo do navegador.
- Orientação: Defina uma política explícita de Referer compatível com os fluxos da aplicação.

```text
Referrer-Policy: strict-origin-when-cross-origin
```

## Orientação por IA

- Modelo: gpt-6-luna
- Estado: completed
- Uso: sugestões para revisão humana; não alteram a classificação dos achados.

### ftp_listing-65e2d54cd901

Desative a listagem de diretórios em /ftp/ e disponibilize somente os arquivos necessários por rotas com controle de acesso adequado.

```text
Na configuração do servidor ou framework que atende /ftp/, desabilite directory listing/autoindex; restrinja os arquivos por autenticação ou autorização quando necessário.
```

Validação sugerida: Confirme pela configuração que o índice está desabilitado e que usuários não autorizados não conseguem acessar os arquivos restritos.

### public_metrics-57c88ab0fb9b

Restrinja /metrics à rede interna ou exija autenticação na borda, conforme o ambiente de implantação.

```text
Configure a política de acesso do proxy, gateway ou servidor para bloquear solicitações anônimas a /metrics.
```

Validação sugerida: Valide, em revisão controlada da configuração, que acesso anônimo recebe 403/404 e que o acesso autorizado continua disponível.

### sql_error_exposure-70d5e72808c2

No handler Express indicado, valide q, use parâmetros preparados na consulta SQLite e retorne uma mensagem genérica ao cliente; mantenha detalhes técnicos apenas em logs internos protegidos.

```text
Use placeholders na consulta SQLite e vincule q como parâmetro; trate erros sem incluir mensagens do banco na resposta HTTP.
```

Validação sugerida: Revise o código e os testes existentes para confirmar o uso de parâmetros e respostas genéricas em caso de erro, sem expor detalhes SQLite.

### missing_csp-86cbe373453a

Identifique as origens necessárias pela aplicação, implemente uma política CSP inicialmente em Report-Only e, após ajustar a política, aplique-a em modo de bloqueio.

```text
Configure Content-Security-Policy-Report-Only no servidor ou middleware; migre para Content-Security-Policy quando a política estiver validada.
```

Validação sugerida: Confira os cabeçalhos de resposta e revise os relatórios de violação antes de habilitar o bloqueio.

### missing_hsts-711328775d47

Adicione HSTS somente depois de confirmar que o domínio funciona integralmente por HTTPS; avalie subdomínios e preload antes de incluir essas diretivas.

```text
Configure Strict-Transport-Security no servidor ou proxy TLS com um max-age apropriado; inclua includeSubDomains ou preload apenas se aplicável.
```

Validação sugerida: Confirme que o domínio atende por HTTPS e que as respostas HTTPS incluem o cabeçalho HSTS esperado.

## Trilha de auditoria

Corpos de resposta e valores de cookies não são gravados. O arquivo `evidence.json` contém os eventos, hashes e metadados limitados.

- 2026-11-12T12:55:21.078272+00:00 · scope · decision: Campaign scope validated
- 2026-11-12T12:55:21.228416+00:00 · discovery · request: Bounded request started
- 2026-11-12T12:55:22.214485+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T12:55:22.214508+00:00 · discovery · decision: Asset discovery skipped
- 2026-11-12T12:55:22.231241+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T12:55:22.824195+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T12:55:22.824268+00:00 · surface_checks · test: Checked public FTP index
- 2026-11-12T12:55:23.236358+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T12:55:23.905556+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T12:55:23.905594+00:00 · surface_checks · test: Checked public metrics endpoint
- 2026-11-12T12:55:24.241544+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T12:55:24.931321+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T12:55:25.244281+00:00 · surface_checks · request: Bounded request started
- 2026-11-12T12:55:26.040484+00:00 · surface_checks · response: Response recorded without body content
- 2026-11-12T12:55:26.040507+00:00 · surface_checks · test: Compared benign and quoted search inputs
- 2026-11-12T12:55:26.249497+00:00 · discovery · request: Bounded request started
- 2026-11-12T12:55:27.346760+00:00 · discovery · response: Response recorded without body content
- 2026-11-12T12:55:27.347792+00:00 · discovery · observation: Beginner challenges counted
- 2026-11-12T12:55:27.347826+00:00 · checks · test: Checked Strict-Transport-Security
- 2026-11-12T12:55:27.347852+00:00 · checks · test: Checked X-Content-Type-Options
- 2026-11-12T12:55:27.347858+00:00 · checks · test: Checked Referrer-Policy
- 2026-11-12T12:55:27.347872+00:00 · checks · test: Checked Content-Security-Policy
- 2026-11-12T12:55:27.347888+00:00 · checks · test: Checked frame protection
- 2026-11-12T12:55:27.347916+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347920+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347923+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347927+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347930+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347933+00:00 · triage · triage: Finding classified
- 2026-11-12T12:55:27.347943+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347949+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347953+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347956+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347960+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347963+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T12:55:27.347974+00:00 · ai · decision: Sending redacted findings to optional AI advisor
- 2026-11-12T12:55:37.187970+00:00 · ai · recommendation: AI advice received for human review
- 2026-11-12T12:55:37.188010+00:00 · control · stop: Planned non-destructive campaign ended

## Limites

A campanha não testa autenticação, IDOR, injeção, XSS ou APIs que exijam interação, credenciais ou alteração de estado. Esses testes exigem escopo e contas de teste específicos.
