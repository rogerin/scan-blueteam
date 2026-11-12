# Relatório de pentest controlado — Hackathon Hubbits - Desafio 3

## Resumo executivo

- Alvo: https://4.migbot.com.br//
- Execução: 20261112T142641Z-5f3c4aa3
- Estado: completed (planned_tests_complete)
- Requisições: 11
- Achados: 7
- Estados: 7 observações confirmadas, 0 inconclusivas, 0 descartadas

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

## Plano auditável por etapa

Cada linha abaixo foi registrada antes da respectiva etapa ou verificação. A previsão não é um resultado observado.

### scope

- Hipótese: O alvo e a política permitem uma campanha de leitura de baixo impacto.
- Ação: Validar origem exata, métodos GET/HEAD, cadência e limites declarados.
- Resultado esperado: Escopo aceito ou recusado antes de qualquer requisição.
- Condição de parada: Recusar imediatamente qualquer origem, método ou limite inválido.

### discovery

- Hipótese: A página informada revela apenas recursos públicos do próprio alvo.
- Ação: Fazer GET da página e identificar referências locais a JavaScript.
- Resultado esperado: Registrar status, metadados e até o limite de assets configurado.
- Condição de parada: Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### check_selection

- Hipótese: A campanha pode escolher somente checks declarados pela política.
- Ação: Aplicar a seleção do operador ou o perfil determinístico permitido.
- Resultado esperado: Lista de IDs permitidos registrada antes das verificações.
- Condição de parada: Recusar qualquer ID fora da lista de checks disponível.

### asset_fetch

- Hipótese: Scripts locais podem conter marcadores de versão para inventário passivo.
- Ação: Buscar somente os scripts locais descobertos, dentro do limite de assets.
- Resultado esperado: Metadados e corpos limitados em memória, sem persistir o JavaScript.
- Condição de parada: Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### framework_inventory

- Hipótese: Marcadores públicos permitem identificar família ou versão do framework.
- Ação: Inspecionar localmente HTML e scripts já obtidos, sem nova requisição.
- Resultado esperado: Inventário com grau de certeza; avisos sem aplicabilidade presumida.
- Condição de parada: Não confirmar CVE sem pacote, versão e condição aplicável verificados.

### ftp_listing

- Hipótese: Uma rota de arquivos pode exibir um índice público de nomes.
- Ação: Fazer GET da rota configurada e HEAD apenas de nomes listados permitidos.
- Resultado esperado: Confirmar índice por título e links diretos; HEAD prova só metadados.
- Condição de parada: Não baixar arquivos nem afirmar leitura de conteúdo; Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### public_metrics

- Hipótese: A rota de métricas pode responder anonimamente em formato Prometheus.
- Ação: Fazer GET da rota configurada e reconhecer apenas marcadores de formato.
- Resultado esperado: Status e formato confirmados, sem armazenar valores de métricas.
- Condição de parada: Não registrar corpo, valores ou possíveis segredos; Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### sql_error_exposure

- Hipótese: Uma entrada de busca pontual pode revelar erro interno ao cliente.
- Ação: Após aprovação humana explícita, comparar uma busca benigna com uma variante de aspas predefinida.
- Resultado esperado: Controle JSON válido e erro SQL explícito ou resultado inconclusivo.
- Condição de parada: Não executar sem aprovação; não fazer extração, bypass ou novas variantes; Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### beginner_challenges

- Hipótese: O catálogo público pode informar desafios de dificuldade inicial.
- Ação: Fazer GET da rota configurada e contar apenas itens iniciais.
- Resultado esperado: Contagem e nomes de tutoriais, sem tentar resolver desafios.
- Condição de parada: Parar se o operador interromper, o orçamento acabar, a requisição sair do escopo ou ocorrer falha de rede.

### headers

- Hipótese: Cabeçalhos da resposta inicial podem revelar lacunas de configuração.
- Ação: Comparar os nomes e valores de cabeçalhos já recebidos com regras fixas.
- Resultado esperado: Presença ou ausência nesta resposta, sem inferir exploração.
- Condição de parada: Não extrapolar o resultado para outras rotas ou respostas.

### cookies

- Hipótese: Atributos de cookies recebidos podem ser avaliados sem expor valores.
- Ação: Analisar somente atributos dos Set-Cookie da resposta já obtida.
- Resultado esperado: Atributos presentes ou ausentes, com valor do cookie omitido.
- Condição de parada: Não afirmar risco de sessão sem verificar a finalidade do cookie.

### triage

- Hipótese: Os sinais obtidos podem ser classificados sem presumir exploração.
- Ação: Deduplicar achados e atribuir severidade, estado e confiança.
- Resultado esperado: Achados confirmados, inconclusivos ou descartados separados por regra.
- Condição de parada: Não elevar observações sem evidência ao estado confirmado.

### remediation

- Hipótese: Achados classificados permitem sugestões condicionais de correção.
- Ação: Associar orientações e trechos de código locais aos achados.
- Resultado esperado: Dicas revisáveis e ligadas ao ID do achado.
- Condição de parada: Não executar código ou alterar o alvo.

### ai_advisor

- Hipótese: Evidências redigidas permitem à IA sugerir correções para revisão.
- Ação: Enviar no máximo cinco achados sanitizados ao modelo sem ferramentas.
- Resultado esperado: Sugestões associadas apenas a IDs existentes ou dicas locais preservadas.
- Condição de parada: Descartar IDs inventados e nunca alterar a classificação dos achados.

## Revisão editorial após a coleta

Os ajustes abaixo esclarecem o alcance de evidências já coletadas. Nenhuma nova requisição foi feita por esta revisão.

- Data: 2026-11-12T14:30:19.006837+00:00
- CSP e Referrer-Policy foram nomeados como ausência de cabeçalho na resposta observada; políticas via HTML não foram avaliadas.
- O roteiro da comparação sintética de busca passou a mencionar aprovação explícita; não houve nova requisição por esta revisão.
- O resumo do escopo foi anexado a partir da configuração e do alvo registrados para exibição coerente no console.

## Achados técnicos

### Recurso anunciado em /ftp/: incident-support.kdbx

- ID: `ftp_file_head_incident-support.kdbx-8cc84ca64260`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/ftp/incident-support.kdbx
- Evidência: HEAD /ftp/incident-support.kdbx respondeu 200, tipo application/octet-stream, tamanho 3246 bytes; nenhum corpo de arquivo foi lido
- Trecho sanitizado: Content-Type: application/octet-stream; Content-Length: 3246
- Prova do teste: O nome constava no índice; HEAD /ftp/incident-support.kdbx: HTTP 200; Content-Type: application/octet-stream; 3246 bytes anunciados.
- Limites da conclusão: HEAD 200 confirma metadados; não comprova GET, conteúdo, senha ou credenciais.
- Reprodução controlada: Confirme o nome no índice /ftp/ e faça somente HEAD na URL do achado; compare status, Content-Type e Content-Length. Não faça GET.
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
- Trecho sanitizado: listing directory /ftp/
- Prova do teste: GET /ftp/: HTTP 200; Content-Type: text/html; título e link filho válidos; SHA-256 capturado: 1a3c507a1d60…
- Limites da conclusão: A listagem confirma nomes; não comprova leitura dos arquivos anunciados.
- Reprodução controlada: Faça um GET em /ftp/; confira HTTP 200, tipo HTML, título de índice e ao menos um link filho da mesma origem. Não abra arquivos.
- Impacto possível: Visitantes anônimos podem descobrir nomes de arquivos disponíveis nesse diretório.
- Orientação: Desative o índice de diretório em /ftp/ e limite o acesso aos arquivos necessários por rota autenticada.
- Registro visual: Captura direta separada do índice /ftp/ em 12/11/2026. Mostra nomes públicos naquele momento; não é o corpo da resposta desta execução nem comprova leitura dos arquivos.
- Arquivo: docs/evidence/ftp-listagem.png
- SHA-256 da imagem: `bc24f75789d8ec2cf314e89dcffb135ba3d9457bd9e8c68cef94ecf354354bba`

```text
# Express: remova serve-index de /ftp/; no Nginx: autoindex off;
```

### Métricas Prometheus públicas

- ID: `public_metrics-57c88ab0fb9b`
- Severidade: medium; estado: confirmed; confiança: high
- URL: https://4.migbot.com.br/metrics
- Evidência: GET /metrics respondeu 200 com formato Prometheus; valores não registrados
- Trecho sanitizado: # HELP juiceshop_llm_input_tokens_total
- Prova do teste: GET /metrics: HTTP 200; Content-Type: text/plain; linha de métrica reconhecida; SHA-256 capturado: 3aa6aa9f31ff…
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

### ftp_file_head_incident-support.kdbx-8cc84ca64260

Revise se o arquivo precisa ser publicado. Se for privado, exija autorização e aplique o mesmo controle a requisições HEAD e GET.

```text
Na configuração do servidor ou middleware que entrega /ftp/, desative acesso anônimo ao arquivo; não dependa apenas de ocultar o link.
```

Validação sugerida: Revise as regras de acesso para confirmar que HEAD e GET usam a mesma autorização e que usuários anônimos não podem obter o arquivo privado.

### ftp_listing-65e2d54cd901

Desative a listagem de diretório em /ftp/ e permita somente o acesso necessário aos arquivos, por rotas autorizadas.

```text
Se o servidor ou framework oferecer índice automático de diretório, desative-o para /ftp/; restrinja arquivos individuais conforme a necessidade.
```

Validação sugerida: Confirme na configuração que o índice está desativado e que o acesso aos arquivos é limitado conforme a política definida.

### public_metrics-57c88ab0fb9b

Restrinja /metrics à rede interna ou proteja a rota com autenticação, conforme a arquitetura disponível.

```text
Aplique o controle na borda, no proxy ou na aplicação, conforme a tecnologia utilizada, e evite exposição pública das métricas.
```

Validação sugerida: Revise a configuração de rede e autorização para confirmar que clientes anônimos não têm acesso a /metrics.

### sql_error_exposure-70d5e72808c2

Valide a entrada q, use parâmetros preparados na consulta SQLite e retorne uma mensagem genérica ao cliente; mantenha detalhes técnicos apenas em logs internos protegidos.

```text
No handler Express da busca, vincule q como parâmetro da consulta em vez de concatená-lo ao SQL e trate erros sem expor detalhes do banco.
```

Validação sugerida: Revise o handler e o tratamento de erros para confirmar o uso de parâmetros e a ausência de detalhes internos nas respostas ao cliente.

### missing_csp-8ff0abadd3a0

Defina uma CSP compatível com as origens e recursos realmente usados pela SPA. Considere começar em modo Report-Only antes de aplicar a política.

```text
Configure Content-Security-Policy na aplicação ou no servidor de borda; ajuste as diretivas após mapear os recursos legítimos.
```

Validação sugerida: Revise a política implantada e confirme que o cabeçalho é emitido nas respostas aplicáveis sem bloquear os recursos necessários.

## Trilha de auditoria

Corpos de resposta e valores de cookies não são gravados. O arquivo `evidence.json` contém os eventos, hashes e metadados limitados.

- 2026-11-12T14:26:41.107842+00:00 · scope · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:41.107929+00:00 · scope · decision: Campaign scope validated
- 2026-11-12T14:26:41.107935+00:00 · discovery · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:41.240328+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br//
- 2026-11-12T14:26:41.705817+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br// · HTTP 200 · SHA-256 2827d932e805…
- 2026-11-12T14:26:41.706843+00:00 · discovery · decision: Discovery complete
- 2026-11-12T14:26:41.706878+00:00 · planning · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:41.706905+00:00 · planning · decision: Operator selected allowed checks
- 2026-11-12T14:26:41.706920+00:00 · discovery · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:42.241461+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/rolldown-runtime-BoHGiXSq.js
- 2026-11-12T14:26:42.893906+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/rolldown-runtime-BoHGiXSq.js · HTTP 200 · SHA-256 68e9792c539b…
- 2026-11-12T14:26:43.246568+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/chunk-DBPdFzgj.js
- 2026-11-12T14:26:43.563821+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/chunk-DBPdFzgj.js · HTTP 200 · SHA-256 97f1c6984085…
- 2026-11-12T14:26:44.251681+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/chunk-Cv2YgWUq.js
- 2026-11-12T14:26:44.688721+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/chunk-Cv2YgWUq.js · HTTP 200 · SHA-256 fbc703799bc7…
- 2026-11-12T14:26:44.688786+00:00 · discovery · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:44.703047+00:00 · discovery · observation: Framework inventory evaluated
- 2026-11-12T14:26:44.703089+00:00 · surface_checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:44.703093+00:00 · surface_checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:44.703096+00:00 · surface_checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:44.703099+00:00 · surface_checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:45.256718+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/ftp/
- 2026-11-12T14:26:45.566408+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/ftp/ · HTTP 200 · SHA-256 1a3c507a1d60…
- 2026-11-12T14:26:45.570317+00:00 · surface_checks · test: Checked public FTP index · HTTP 200
- 2026-11-12T14:26:46.261753+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/metrics
- 2026-11-12T14:26:46.601709+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/metrics · HTTP 200 · SHA-256 3aa6aa9f31ff…
- 2026-11-12T14:26:46.602063+00:00 · surface_checks · test: Checked public metrics endpoint · HTTP 200
- 2026-11-12T14:26:46.602167+00:00 · approval · decision: Conditional search check explicitly approved by CLI operator · ação quoted_search
- 2026-11-12T14:26:47.266869+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/rest/products/search
- 2026-11-12T14:26:47.573922+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/rest/products/search · HTTP 200 · SHA-256 084d85f6fb39…
- 2026-11-12T14:26:48.271961+00:00 · surface_checks · request: Bounded request started · GET · https://4.migbot.com.br/rest/products/search
- 2026-11-12T14:26:49.022770+00:00 · surface_checks · response: Response recorded without body content · GET · https://4.migbot.com.br/rest/products/search · HTTP 500 · SHA-256 7364680cd6b5…
- 2026-11-12T14:26:49.023178+00:00 · surface_checks · test: Compared benign and quoted search inputs
- 2026-11-12T14:26:49.272202+00:00 · discovery · request: Bounded request started · GET · https://4.migbot.com.br/api/Challenges
- 2026-11-12T14:26:49.704325+00:00 · discovery · response: Response recorded without body content · GET · https://4.migbot.com.br/api/Challenges · HTTP 200 · SHA-256 6157b3195a6b…
- 2026-11-12T14:26:49.706528+00:00 · discovery · observation: Beginner challenges counted
- 2026-11-12T14:26:50.277251+00:00 · surface_checks · request: Bounded request started · HEAD · https://4.migbot.com.br/ftp/incident-support.kdbx
- 2026-11-12T14:26:50.548852+00:00 · surface_checks · response: Response recorded without body content · HEAD · https://4.migbot.com.br/ftp/incident-support.kdbx · HTTP 200 · SHA-256 e3b0c44298fc…
- 2026-11-12T14:26:50.548909+00:00 · surface_checks · test: Checked listed file with HEAD only · HTTP 200
- 2026-11-12T14:26:51.282209+00:00 · surface_checks · request: Bounded request started · HEAD · https://4.migbot.com.br/ftp/package.json.bak
- 2026-11-12T14:26:51.588411+00:00 · surface_checks · response: Response recorded without body content · HEAD · https://4.migbot.com.br/ftp/package.json.bak · HTTP 403 · SHA-256 e3b0c44298fc…
- 2026-11-12T14:26:51.588424+00:00 · surface_checks · test: Checked listed file with HEAD only · HTTP 403
- 2026-11-12T14:26:51.588438+00:00 · checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:51.588442+00:00 · checks · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:51.588453+00:00 · checks · test: Checked Strict-Transport-Security
- 2026-11-12T14:26:51.588469+00:00 · checks · test: Checked X-Content-Type-Options
- 2026-11-12T14:26:51.588472+00:00 · checks · test: Checked Referrer-Policy
- 2026-11-12T14:26:51.588484+00:00 · checks · test: Checked Content-Security-Policy
- 2026-11-12T14:26:51.588494+00:00 · checks · test: Checked frame protection
- 2026-11-12T14:26:51.588636+00:00 · triage · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:51.588646+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588648+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588649+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588651+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588652+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588654+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588655+00:00 · triage · triage: Finding classified
- 2026-11-12T14:26:51.588657+00:00 · remediation · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:51.588662+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588665+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588667+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588668+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588670+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588672+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588673+00:00 · remediation · recommendation: Code guidance attached
- 2026-11-12T14:26:51.588676+00:00 · ai · stage_plan: Plano da etapa registrado antes da execução
- 2026-11-12T14:26:51.588679+00:00 · ai · decision: Sending redacted findings to optional AI advisor
- 2026-11-12T14:26:59.136100+00:00 · ai · recommendation: AI advice received for human review
- 2026-11-12T14:26:59.136140+00:00 · control · stop: Planned non-destructive campaign ended

## Limites

A campanha não testa autenticação, IDOR, exploração de injeção, XSS ou APIs que exijam interação, credenciais ou alteração de estado. Esses testes exigem escopo e contas de teste específicos.
