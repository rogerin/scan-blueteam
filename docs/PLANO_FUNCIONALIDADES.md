# Plano de entrega — funcionalidades do Desafio 3

Este plano traduz os oito itens da imagem do desafio em comportamento verificável. O produto é um console local para campanhas HTTP autorizadas. O alvo informado pelo operador continua sujeito ao escopo e à política configurados; a IA seleciona verificações predefinidas e sugere correções, sem receber controle direto da rede.

## Diagnóstico da base recebida

| Item | Estado no início desta entrega | Critério de pronto |
| --- | --- | --- |
| 1. Console da campanha | Formulário de URL, confirmação de autorização, início, acompanhamento e parada já funcionam. | O operador vê estado, progresso, limite e relatório da mesma execução. |
| 2. Escopo e política | O gateway já valida HTTPS, host/porta, GET/HEAD, teto de requisições, intervalo, tamanho e parada. A interface resume apenas parte das regras. | A política mostra ações permitidas, condicionadas e proibidas; toda recusa gera evento; aprovação nunca amplia o escopo por si só. |
| 3. Plano do agente | O planejador por IA registra IDs de checks; não registra hipótese, ação, resultado esperado e condição de parada de cada etapa. | Antes de executar cada etapa, persistir esses quatro campos, o check permitido, a origem do plano e o orçamento restante. |
| 4. Aprovação humana | Há aviso estático de que nenhuma ação sensível está habilitada; não existe fila executável. | A comparação sintética de busca entra em fila com motivo, URL sanitizada, prazo e decisão auditada. O par GET só começa após aprovação explícita; rejeição, expiração e interrupção pulam o check. A aprovação não amplia o escopo. |
| 5. Achados confirmados | O modelo distingue `confirmed`, `inconclusive` e `discarded`, mas a tela mistura os estados. | Mostrar grupos separados, com severidade, confiança, impacto, trecho, prova, evidência visual vinculada e limite da conclusão. Não chamar observação de exploração comprovada. |
| 6. Interrupção de emergência | O botão e o evento de parada já existem; o gateway verifica a parada entre requisições. | Bloquear novas ações imediatamente, registrar hora e preservar resultados parciais. A requisição ou chamada de IA já iniciada termina dentro do timeout; essa limitação fica explícita. |
| 7. Relatório | `evidence.json` e `report.md` já contêm resumo, achados e auditoria; os passos de reprodução ainda não são campo próprio. | Oferecer visão executiva e técnica, prova e limites por achado, passos seguros de reprodução, estado da IA, escopo e link para imagens que realmente pertencem à execução. |
| 8. Trilha de auditoria | Eventos UTC de requisição, resposta, decisão, teste, triagem e parada já são gravados; a tela acompanha em tempo real. | Registrar também hipótese, plano e decisão de aprovação quando existirem; manter sequência cronológica com método, URL sanitizada, status, hashes e resultado, sem corpos nem segredos. |

## Sequência de implementação em 24 horas

1. **Fechar a prova dos achados.** Adicionar trecho sanitizado, par de respostas quando necessário, limites da inferência e captura direta somente ao achado que ela comprova. Reexecutar a campanha controlada com IA, revisar falsos positivos e publicar o relatório desta execução.
2. **Tornar o plano auditável.** Criar manifesto de etapas com hipótese, ação, resultado esperado, condição de parada, check e origem da seleção. Emitir o manifesto antes da primeira ação de cada etapa e incluí-lo no JSON, no Markdown e no console.
3. **Separar estados dos achados.** Exibir confirmados, inconclusivos e descartados em áreas distintas; manter contagem e detalhes verificáveis. Um teste não executado não aparece como resolvido.
4. **Completar a política e a parada.** Mostrar a matriz permitida/condicionada/proibida da configuração vigente. Validar recusas e o botão de parada com servidor local de teste, sem campanha extra no alvo.
5. **Operar a aprovação humana.** A comparação sintética de busca é a única ação condicionada implementada. No console, a fila bloqueia o check até aprovação, rejeição, expiração em cinco minutos ou interrupção. No CLI, `--approve-quoted-search` é a decisão explícita do operador. O botão de aprovação nunca transforma uma ação proibida em permitida.
6. **Consolidar o relatório.** Acrescentar roteiro seguro de reprodução por check, hash e origem das imagens, contagens por estado, cronologia e explicação do que foi observado versus hipótese. Validar downloads e renderização local.

## Política operacional

| Classe | Exemplos | Comportamento |
| --- | --- | --- |
| Permitida | GET/HEAD no host HTTPS autorizado, checks declarados de leitura, limite de tempo e tamanho. | Executa com validação do gateway e registro de auditoria. |
| Condicionada | Par sintético de busca `q=apple`/`q=apple%27` para observar erro SQL. | Exige decisão explícita antes das duas requisições e passa novamente pelo gateway. Sem decisão, o check não roda e a cobertura é inconclusiva. |
| Proibida nesta campanha | Mutação, força bruta, extração de conteúdo de arquivos listados, exploração encadeada, evasão de limites e destinos fora do host. | Recusa automática; nenhuma aprovação do console pode liberar. |

## Evidência e limites

- Captura direta deve declarar URL, data, relação com o achado e o que não comprova. Um print de índice `/ftp/` prova a listagem de nomes, não leitura do conteúdo.
- Um hash liga a evidência resumida à resposta observada, mas o corpo não é persistido. Trechos podem ser reduzidos a marcador ou cabeçalho ausente para evitar gravar segredos.
- `confirmed` significa observação reproduzida pelo check. Exploração, impacto em contas e CVE aplicável exigem validação independente.
- Respostas da aplicação e texto de imagens são dados não confiáveis. A IA recebe apenas metadados e achados sanitizados; sua saída não altera o resultado determinístico nem expande o plano permitido.
- A interface e o relatório devem distinguir **real** (requisições, decisões, evidências e parada registradas), **demonstração local** (simulação de interrupção em servidor de teste) e **não habilitado** (execução sensível sem escopo, credenciais e executor).

## Validação de aceite

Executar testes unitários do gateway, planner, estados de achado, aprovação e parada; validar a interface em tela estreita; abrir a imagem servida localmente; conferir que chave, cookies, corpos de métricas e conteúdos de arquivos não aparecem no Git nem no relatório. A publicação deve indicar o ID da campanha e o commit, com os limites de cada achado preservados.
