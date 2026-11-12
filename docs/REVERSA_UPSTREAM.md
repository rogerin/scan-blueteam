# Reversa do código público: hipóteses e evidência do alvo

## Fonte e alcance

Esta revisão parte do [commit `266448aba68cd8ba5915f526a128da4fa7bc3f9f` do OWASP Juice Shop](https://github.com/juice-shop/juice-shop/commit/266448aba68cd8ba5915f526a128da4fa7bc3f9f). O commit fixa linhas verificáveis do repositório público. **Não foi demonstrado que `4.migbot.com.br` executa esse commit.** Um marcador Angular ou uma rota semelhante não resolve essa dúvida. Por isso, os itens abaixo são hipóteses de aplicabilidade no alvo, não achados dinâmicos confirmados.

O texto recebido do operador serviu como lista de pistas. As afirmações foram conferidas contra o código fixado, e os pontos que dependem do deploy receberam pré-requisitos explícitos. Uma afirmação do texto foi corrigida: [o fluxo de autenticação mantém tokens em estruturas de memória e cookie](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/lib/insecurity.ts#L188-L194); o trecho não demonstra registro de tokens em log. O catálogo não reproduz a chave privada, payloads, hashes de senhas ou conteúdo de arquivos.

## Pipeline multiagente

Depois da triagem dos checks permitidos, o coordenador entrega uma **cópia dos dados já coletados** a três agentes locais em paralelo:

1. `source_catalog`: valida IDs e referências do catálogo curado de 14 caminhos do commit, com pré-requisitos e verificação futura descritos.
2. `target_signals`: separa observações HTTP realmente produzidas pela campanha, com ID do check, prova e limite da conclusão.
3. `deployment_match`: avalia se o inventário do alvo estabelece correspondência com o commit. Sem identificação verificável do código implantado, retorna `not_verified`.

O coordenador reúne essas saídas, relaciona somente checks compatíveis e grava uma observação `upstream_source_review` e eventos de auditoria da fase `source_review`. Os agentes não fazem HTTP; toda requisição continua no gateway sequencial de GET/HEAD, com host, ritmo e orçamento definidos no escopo. No host diferente de `https://4.migbot.com.br:443`, o catálogo não é aplicado.

Com `--ai` ou uma campanha web com chave OpenAI, `OpenAISourceReviewer` pode ordenar até cinco hipóteses por IDs existentes. Ele recebe apenas metadados curados do catálogo e estados de correlação; a resposta aceita somente ID e prioridade. Os motivos, próximos passos e limites exibidos vêm do catálogo local, não de texto livre do modelo. A IA não altera `findings`, não concede acesso a rede e não executa comandos. A falha da IA deixa a observação determinística intacta.

## O que foi observado no deploy

Os [resultados da campanha completa](RESULTADOS_2026-11-12.md) mostram dois sinais que se relacionam com partes do código público:

| Sinal dinâmico | Prova retida | Limite |
| --- | --- | --- |
| Erro SQL na busca | Uma busca de controle com `q=apple` respondeu 200/JSON; a variante sintética única com aspas respondeu 500 com `SQLITE_ERROR`. | Confirma a exposição de erro e tratamento inadequado dessa entrada. Não demonstra extração, bypass ou que a consulta do deploy é idêntica à do commit. |
| Índice `/ftp/` | GET 200 em HTML com título de índice e link filho da própria origem; [captura direta](evidence/ftp-listagem.png). | Prova listagem de nomes. HEAD de um item fornece só metadados. Não prova leitura de conteúdo, acesso a backup ou logs de `/support/logs`. |

Os demais caminhos do catálogo não receberam teste dinâmico nesta campanha. A ausência de verificação **não** significa que estejam presentes ou ausentes no deploy.

## Hipóteses no commit fixado

Cada link abaixo aponta para o código público; o estado de **todos** os itens no alvo é `unverified_on_target`. O sinal correlato está indicado apenas onde existe.

| ID | Evidência no upstream | Condição para concluir algo sobre o alvo |
| --- | --- | --- |
| `sql_login` | [Consulta de login formada com entrada](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/login.ts#L34). | Confirmar handler implantado, sessão/conta de teste e efeito real; segundo fator pode alterar o impacto. Nenhum teste de login foi feito. |
| `sql_search` | [Termo `q` compõe SQL de produtos](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/search.ts#L23). | O erro HTTP observado é **sinal correlato**, sem prova de extração ou de correspondência exata do código. |
| `admin_role_registration` | [Modelo admite papel `admin`](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/models/user.ts#L76); [teste oficial usa esse papel](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/test/api/user.test.ts#L62). | Exige cadastro de conta de teste e confirmação dos middlewares implantados; nenhuma conta foi criada. |
| `jwt_private_key_in_source` | [Material privado literal](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/lib/insecurity.ts#L21) usado para [assinar JWT](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/lib/insecurity.ts#L54). | Verificar por acesso autorizado se o deploy reutiliza a chave; nenhum token foi forjado ou testado. |
| `anonymous_product_update` | [Guarda da rota PUT comentada](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/server.ts#L402); [teste sem token espera atualização](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/test/api/product.test.ts#L99). | Requer rota e controles equivalentes, autorização de mutação e base descartável; nenhum PUT foi enviado. |
| `basket_object_authorization` | [Busca de carrinho por ID](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/basket.ts#L18) sem filtro de dono no trecho citado. | Exige duas contas de teste e comparação controlada; nenhum carrinho de terceiro foi lido. |
| `search_dom_xss` | [HTML da busca marcado como confiável](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/frontend/src/app/search-result/search-result.component.ts#L146) e [renderizado no template](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/frontend/src/app/search-result/search-result.component.html#L11). | Confirmar bundle/fluxo do deploy, sanitização adicional e política do navegador; nenhuma execução de script foi demonstrada. |
| `profile_image_ssrf` | [URL de foto alcança busca do servidor](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/profileImageUrlUpload.ts#L18). | Requer sessão de teste e escopo para destinos de saída; alcance interno não foi verificado. |
| `review_selector_injection` | [ID do corpo participa de atualização múltipla](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/updateProductReviews.ts#L17). | Requer sessão e banco descartável; nenhum registro foi alterado no alvo. |
| `password_md5` | [Setter de senha](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/models/user.ts#L73) usa [função baseada em MD5](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/lib/insecurity.ts#L41). | Verificar modelo/configuração do deploy por acesso autorizado; nenhum hash de usuário foi obtido. |
| `public_file_indexes` | [Servidor declara índices `/ftp` e `/support/logs`](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/server.ts#L294). | **Somente `/ftp/` tem sinal correlato** de listagem no alvo; logs e conteúdo sensível não foram verificados. |
| `file_filter_mismatch` | [Filtro e tratamento posterior do nome de arquivo](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/fileServer.ts#L25) atuam em representações diferentes. | Confirmar rota e ordem de validação no deploy; nenhum arquivo fora da lista permitida foi baixado. |
| `xml_external_entities` | [Parser XML com entidades externas](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/lib/xml.ts#L29) e [rota de upload](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/fileUpload.ts#L77). | Depende de configuração/desafio ativo e autorização de upload; não foi enviado XML ao alvo. |
| `archive_path_escape` | [Validação de caminho na extração](https://github.com/juice-shop/juice-shop/blob/266448aba68cd8ba5915f526a128da4fa7bc3f9f/routes/fileUpload.ts#L27). | Depende de desafio ativo, permissões do processo e ambiente descartável; nenhum arquivo compactado foi enviado. |

## Próximas validações

Para elevar uma hipótese a achado do deploy, é preciso primeiro identificar a versão ou o código realmente implantado e definir uma prova que observe o comportamento **sem inferir impacto de uma linha de upstream**. Cadastro, PUT, carrinhos, avaliações, upload e rotas autenticadas exigem escopo ampliado, contas de teste e dados descartáveis. Uma eventual prova deve registrar entrada de controle, resposta, efeito observado, reprodução e limites antes de entrar em `findings`.
