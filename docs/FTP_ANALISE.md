# Análise aprofundada de `/ftp`

- **Alvo:** `https://4.migbot.com.br/ftp` e caminhos filhos apresentados pelo próprio índice
- **Data:** 12/11/2026 (America/Recife)

**Método:** oito requisições de leitura com timeout; quatro foram `HEAD`. Foram lidos apenas HTML dos índices de diretório e cabeçalhos de arquivos selecionados. Nenhum corpo de arquivo listado foi obtido.

## Evidência reproduzida

| Requisição anônima | Resposta | Conclusão sustentada |
| --- | --- | --- |
| `GET /ftp` | 200, `text/html` | O caminho sem barra final apresenta índice. |
| `GET /ftp/` | 200, `text/html`; 11 entradas únicas | Há listagem pública de nomes. |
| `HEAD /ftp/acquisitions.md` | 200, `text/markdown`, `Content-Length: 909` | O servidor anuncia esse recurso a visitantes anônimos. Conteúdo não verificado. |
| `HEAD /ftp/incident-support.kdbx` | 200, `application/octet-stream`, `Content-Length: 3246` | O servidor anuncia um arquivo `.kdbx` a visitantes anônimos. Não foi aberto; não há evidência de credenciais expostas. |
| `HEAD /ftp/package.json.bak` | 403 | O backup listado foi bloqueado neste teste. |
| `HEAD /ftp/package-lock.json.bak` | 403 | O outro backup listado também foi bloqueado. |
| `GET /ftp/quarantine` | 200, índice com quatro nomes terminados em `.url` | O subdiretório também lista metadados; atalhos não foram abertos ou executados. |

O índice principal apresentou `quarantine`, `acquisitions.md`, `announcement_encrypted.md`, `coupons_2013.md.bak`, `eastere.gg`, `encrypt.pyc`, `incident-support.kdbx`, `legal.md`, `package-lock.json.bak`, `package.json.bak` e `suspicious_errors.yml`. Essa é uma observação de **nomes**, sem inferência sobre o conteúdo ou finalidade real de cada arquivo.

## Triagem sem falso positivo

1. **Confirmado — listagem pública:** as duas variantes de `/ftp` retornaram índice. Isso expõe nomes e estrutura, mesmo que alguns objetos individuais sejam bloqueados.
2. **Confirmado — resposta `HEAD` para `.kdbx`:** status 200 e tamanho não zero. É um sinal de exposição a revisar com prioridade, mas `HEAD` não prova que `GET` entrega o conteúdo nem que o arquivo contém credenciais. A classificação de vazamento de segredos permanece **inconclusiva**.
3. **Descartado neste teste — leitura anônima de backups `.bak`:** ambos retornaram 403 em `HEAD`. A mera presença no índice não justifica afirmar que seus conteúdos são públicos.
4. **Confirmado — índice de `quarantine`:** somente os nomes dos atalhos `.url` foram vistos. Nenhum arquivo ou programa foi executado; não há base para alegar infecção.

A [OWASP WSTG](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information/) recomenda verificar listagem e acesso direto separadamente, e manter backups e dados operacionais fora da raiz pública. O aplicativo é o OWASP Juice Shop, um laboratório deliberadamente vulnerável; isso não reduz a necessidade de distinguir evidência de hipótese no relatório.

## Correção e regressão

- Desativar o índice em `/ftp` e `/ftp/quarantine` e expor apenas arquivos necessários por rotas controladas.
- Mover backups, cofres, código compilado e arquivos de suporte para armazenamento fora da raiz pública. Uma regra por extensão isolada deixa outros formatos acessíveis.
- Validar com o mantenedor se `incident-support.kdbx` deve existir no servidor público. Se não, removê-lo da publicação e revisar o processo de build/deploy.
- Testar `GET /ftp/` e `GET /ftp/quarantine` para confirmar que não listam nomes; testar `HEAD` dos caminhos conhecidos para esperar 403/404 quando não forem públicos. Preservar testes específicos para os `.bak`, que já retornaram 403.

Os testes automáticos da pipeline devem registrar **qual observação foi feita** (`índice`, `HEAD 200`, `HEAD 403`) e não converter extensão ou sugestão da IA em vazamento confirmado. Uma resposta 200 de uma SPA sem marcador de índice deve ficar inconclusiva até revisão.
