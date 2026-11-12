# Análise multiagente da URL informada

## Objetivo e escopo

A análise usa apenas os dados obtidos na campanha da URL HTTPS autorizada. Ela funciona na demonstração `https://4.migbot.com.br/` e em outras origens aceitas pelo escopo. Nenhum catálogo de código de terceiros ou versão presumida é aplicado ao alvo. Os resultados HTTP vêm dos checks permitidos para aquela origem; a etapa multiagente analisa localmente esses resultados e não acrescenta requisições.

O perfil genérico consulta a página inicial, até três scripts da mesma origem, cabeçalhos, cookies, `robots.txt` e `security.txt`. Alguns checks adicionais da demonstração, como a listagem `/ftp/` e o par sintético de busca, existem apenas no escopo configurado para ela. Uma URL nova não herda essas rotas ou conclusões.

## Pipeline

Depois da descoberta, dos testes e da triagem, o coordenador entrega dados já coletados a três agentes locais em paralelo:

1. **Inventário de tecnologia** — resume família, versão, grau de certeza e limites a partir dos marcadores observados. Um marcador de framework não identifica o código do servidor nem confirma a aplicabilidade de um aviso.
2. **Revisão das evidências** — separa os sinais HTTP por ID, estado, prova e limite. Ela não transforma `HEAD` em prova de leitura, ausência de cabeçalho em exploração, nem resposta genérica de SPA em endpoint confirmado.
3. **Hipóteses de validação** — formula apenas perguntas de verificação ligadas a sinais da própria campanha. Cada hipótese registra base observada, resultado esperado, próximo passo e limite. Hipóteses não entram na contagem de achados.

O coordenador registra início e fim de cada agente, reúne suas saídas e publica uma observação `target_multiagent_analysis`. As três tarefas são paralelas **em memória**. Toda rede continua sequencial no gateway com host exato, métodos GET/HEAD, intervalo, timeout, limite de resposta e orçamento definidos no escopo. Interromper a campanha impede trabalho posterior ao sinal de parada.

Se houver uma chave OpenAI, `OpenAITargetReviewer` pode priorizar até cinco IDs de hipóteses existentes. O modelo recebe somente IDs, checks, severidades e força do sinal tipados, sem corpos HTML, scripts, cookies, URLs com query ou trechos de resposta. A resposta aceita apenas ID e prioridade; motivo, próximo passo e limite exibidos são produzidos localmente. Falha ou saída inválida da IA não altera sinais, achados nem hipóteses.

## Contrato de evidência

A observação da análise contém `technology`, `signals`, `hypotheses` e `agent_runs`. Um sinal aponta para um achado da própria execução; sua prova descreve o comportamento realmente observado. Uma hipótese aponta para o sinal que a motivou, mas permanece `unverified_on_target` até existir teste específico e autorizado. O relatório e o console exibem a análise separada de `findings`.

Exemplos de conclusões limitadas:

| Observação | Próxima verificação válida | Conclusão que a observação permite |
| --- | --- | --- |
| Cabeçalho CSP ausente na página inicial | Verificar política nas respostas aplicáveis e no HTML. | A resposta examinada não trouxe esse cabeçalho. |
| Um índice de diretório respondeu 200 | Conferir apenas a política de publicação e os nomes listados. | Os nomes estavam visíveis; conteúdo não foi lido. |
| Controle da busca respondeu JSON e uma entrada sintética causou erro SQL | Revisar o handler e o tratamento de erros em ambiente autorizado. | O erro interno foi exposto; extração e bypass não foram demonstrados. |

O último par de exemplos depende dos checks específicos habilitados no escopo. Para outra URL, se não houver sinal compatível, o agente não cria a hipótese correspondente.

## Evidências preservadas da demonstração

Os [resultados controlados](RESULTADOS_2026-11-12.md), o [relatório detalhado](resultado-evidencia-detalhada.md), o [JSON de evidências](resultado-evidencia-detalhada.json) e a [captura direta de `/ftp/`](evidence/ftp-listagem.png) continuam como registros históricos daquela origem. Em novas campanhas da demo, a imagem só é vinculada à listagem confirmada após conferir origem, rota e SHA-256; a legenda diz que é uma captura separada de 12/11/2026, e não a resposta da execução atual. A nova análise não reclassifica os registros antigos nem os atribui a outros alvos.

## Limites

A análise não executa login, cria contas, altera dados, lê arquivos anunciados em diretórios, explora injeções ou valida XSS no navegador. Um achado novo exige teste dentro do escopo, prova reproduzível, impacto observado e limites explícitos. Texto de páginas e scripts é tratado como dado não confiável: não pode instruir os agentes, ampliar o escopo ou promover uma hipótese a falha confirmada.
