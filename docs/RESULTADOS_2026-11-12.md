# Resultados controlados — 12/11/2026

Alvo autorizado: `https://4.migbot.com.br//#/tokensale-ico-ea` (a rota após `#` não integra a requisição HTTP). Cada campanha respeitou origem HTTPS exata, GET/HEAD, até 11 requisições, pausa mínima de 1 segundo e resposta limitada a 512 KiB. Nenhum corpo de arquivo do índice `/ftp/` foi baixado.

## Duas passagens com papéis distintos

| Execução | Objetivo | Resultado |
| --- | --- | --- |
| `20261112T141427Z-04a62dbb` | Planejamento pela OpenAI e dicas de correção. | Plano IA e orientador concluídos; 8 requisições, 5 observações. A IA não escolheu o check de `/ftp/`; esta execução não sustenta o print. [Relatório](resultado-plano-ia.md) · [JSON](resultado-plano-ia.json) |
| `20261112T142641Z-5f3c4aa3` | Cobertura completa dos checks declarados, plano por etapa e revisão de correções pela OpenAI. | 11 requisições, 7 observações, 14 eventos de plano e orientador IA concluído. A comparação sintética de busca teve sinal explícito de aprovação no CLI. [Relatório detalhado](resultado-evidencia-detalhada.md) · [JSON](resultado-evidencia-detalhada.json) |

A primeira passagem ocorreu antes da implementação da fila; o check de busca seguiu a política de leitura então vigente. A fila passou a controlar novas campanhas no console, e a passagem completa posterior usou o sinal explícito do CLI.

## Prova e limite dos achados da passagem completa

| Observação | Prova retida | Limite |
| --- | --- | --- |
| Índice `/ftp/` público | GET 200, tipo HTML, título de diretório, link filho da mesma origem, hash da resposta e [captura direta separada](evidence/ftp-listagem.png). | A captura mostra nomes; não demonstra leitura de arquivos. |
| Metadados de `incident-support.kdbx` | Nome visto no índice; HEAD 200, tipo binário e tamanho anunciado. | HEAD não demonstra GET, conteúdo, senha nem credenciais. |
| `/metrics` público | GET 200, tipo Prometheus e linha `# HELP` sanitizada. | Valores e possíveis segredos não foram retidos. |
| Erro SQLite na busca | Controle `q=apple` retornou JSON 200; variante única com aspas retornou 500 com marcador `SQLITE_ERROR`. | Não houve extração, bypass ou comprovação de SQL injection explorável. |
| Cabeçalhos CSP, HSTS e Referrer-Policy ausentes | Resposta HTML inicial 200 sem os cabeçalhos citados. | Refere-se somente a essa resposta; políticas em HTML ou outras rotas não foram avaliadas. |

A imagem de `/ftp/` foi capturada diretamente no navegador em 12/11/2026, separada da campanha completa. SHA-256: `bc24f75789d8ec2cf314e89dcffb135ba3d9457bd9e8c68cef94ecf354354bba`. Ela está vinculada apenas ao achado de listagem. Nenhuma CVE foi confirmada pelo inventário passivo de Angular.

## Estado das funcionalidades do desafio

O [plano das oito funcionalidades](PLANO_FUNCIONALIDADES.md) mapeia critérios de aceite e política. Console, escopo, plano por etapa, achados separados, relatório e auditoria operam no código. A aprovação da busca condicionada usa fila no console; rejeição, expiração e parada impedem as requisições. O fluxo de fila e a interrupção foram validados com testes locais controlados; não houve uma campanha extra no alvo pela interface para demonstrar esses botões. O grupo “Descartados registrados” está vazio porque nenhum candidato descartado foi emitido, e isso não equivale a uma prova de ausência de falhas.

Os textos dos cabeçalhos e do roteiro de reprodução receberam revisão editorial após a coleta. A revisão está registrada em cada JSON e não fez novas requisições.
