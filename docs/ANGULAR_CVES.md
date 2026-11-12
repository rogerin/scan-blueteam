# Inventário Angular e análise de CVEs

- **Alvo:** `https://4.migbot.com.br//#/tokensale-ico-ea`
- **Execução:** 12/11/2026, campanha de leitura com 11 requisições ao host autorizado
- **Resultado:** Angular **22.2.2** identificado; **nenhuma CVE confirmada** para esta instalação com a evidência disponível

A execução integral está em [`resultado-tokensale.json`](resultado-tokensale.json) e [`resultado-tokensale.md`](resultado-tokensale.md). Esses arquivos contêm metadados e hashes, sem os corpos dos bundles ou a chave da API.

## Evidência da versão

O HTML da origem carregou três arquivos `modulepreload` dentro do orçamento. O terceiro, `/chunk-Cv2YgWUq.js`, respondeu `200`, `application/javascript`, 367621 bytes, sem truncamento. Seu SHA-256 foi `fbc703799bc777df67e696f42cd8889e0fdf977d0bdc19071c931f7d1501cdd1`. Nele, o analisador local encontrou o marcador de runtime `ng-version` com valor `22.2.2`. O JavaScript foi lido como texto, sem execução, e o corpo não foi gravado no relatório nem enviado à IA.

O fragmento `#/tokensale-ico-ea` é uma rota do navegador. A requisição inicial da campanha usou o caminho HTTP `//`, com o fragmento removido. O reconhecimento do framework não demonstra que todos os pacotes Angular da aplicação compartilham a mesma versão.

## Cruzamento com avisos oficiais

| Aviso do mantenedor | Faixa relevante | Conclusão neste alvo |
| --- | --- | --- |
| [GHSA-ffj9-42qx-f38h](https://github.com/angular/angular/security/advisories/GHSA-ffj9-42qx-f38h), `@angular/upgrade`, sem CVE conhecida | 22.0.0 a anterior a 22.2.4 | A versão de runtime cai na faixa, mas não foi comprovada a instalação de `@angular/upgrade` nem uso híbrido com AngularJS e `downgradeComponent()`. **Não confirmado.** |
| [CVE-2026-88057](https://github.com/angular/angular/security/advisories/GHSA-hh8m-fm6v-7cvg), `@angular/core`/`compiler` | 22.0.0 a anterior a 22.1.0 | 22.2.2 está fora da faixa. |
| [CVE-2025-66035](https://github.com/angular/angular/security/advisories/GHSA-58c5-g7wp-6w37), `@angular/common` | Linhas 18 a 21 anteriores às correções listadas | Nenhuma faixa 22.x afetada no aviso. |
| [CVE-2026-111753](https://github.com/angular/angular/security/advisories/GHSA-jfgx-762w-99vr), `@angular/common` | Linhas 20 e 21 anteriores às correções listadas | O aviso declara que 22.x já não era afetado. |

O catálogo embutido na pipeline contém esses quatro avisos verificados em 12/11/2026; **não é uma consulta exaustiva nem atualização em tempo real do banco de CVEs**. A interface mostra coincidências condicionais e suas fontes, mas não transforma versão isolada em vulnerabilidade confirmada. Para decidir sobre `@angular/upgrade`, o mantenedor deve verificar um manifesto de dependências confiável e o uso das APIs híbridas no código, sem publicar credenciais ou artefatos privados.

## Regras contra falsos positivos e prompt injection

- A versão exige marcador específico em HTML ou JavaScript público com status, tipo MIME e origem válidos; conflitos entre marcadores anulam a versão exata.
- Conteúdo do alvo não é executado nem interpretado como instrução. Textos que mencionem Angular, CVE ou pedidos aos agentes sem o marcador esperado não geram versão ou achado.
- Apenas nome sanitizado do asset, versão, hash e metadados entram na evidência. A IA recebe metadados sanitizados e não decide a correspondência de CVEs.
- Uma faixa de versão coincidente informa **possibilidade para revisão**; comprovar pacote, configuração, fluxo vulnerável e impacto requer análise do código do alvo.
