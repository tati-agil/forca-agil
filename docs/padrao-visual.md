# Padrão Visual Oficial do FORÇA ÁGIL

> **Toda funcionalidade nova ou modificada deve seguir o Padrão Visual Oficial do FORÇA ÁGIL.**

Versão 1 — 17/10/2026 (PR de tipografia da Arquitetura Organizacional). Decisão da responsável: a identidade visual
atual está aprovada e deve ser preservada; mudanças visuais só corrigem problemas comprovados de leitura ou uso. Este
documento é a referência verificável — e acompanha a futura extração do Núcleo de Arquitetura Organizacional (a área
herda esta identidade; não ganha um design próprio).

A fonte de verdade dos valores é o CSS (`forca-agil/styles.css` e `forca-agil/pages.css`): aqui estão o que cada
token e componente significa, o que não pode mudar e como validar. Um estilo **não** é oficial só porque existe no
CSS — os oficiais estão listados abaixo; o que destoa deles é inconsistência a corrigir.

## 1. O que preservar (identidade)

| Elemento | Onde está | Regra |
|---|---|---|
| Fundo espacial | `#sky` (nebulosa `assets/nebula.jpg` + três brilhos radiais, `position: fixed`) e `#stars` (canvas de estrelas, `stars.js`) em `styles.css` | Não mudar, não cobrir com fundo opaco de página, não trocar por cor lisa. |
| Paleta | tokens em `:root` de `styles.css`: `--space-0…2`, `--panel`, `--panel-2`, `--line`, `--line-strong`, azuis Previ (`--blue`, `--navy`), dourado `--gold`, ciano `--cyan`/`--teal`, texto `--ink`, `--ink-2`, `--ink-3`, acentos `--accent`/`--accent-2` | Usar sempre os tokens; não introduzir cinzas ou brancos novos. Temas `resistencia` e `holocron` redefinem os mesmos tokens. |
| Títulos de página | `.page-hero h1` / `.admin-hero h1` em **Anton** (`--font-display`), peso 400, com sobretítulo `.eyebrow` em Space Mono dourada | Anton sempre no peso 400 (é o único que ela tem). |
| Títulos de seção e de cartão | `h2–h4` em **Oswald** (`--font-head`) | Manter a Oswald; entrelinha ≥ 1,25 e tamanho ≥ 1 rem. |
| Botões | `.btn` (Space Mono, caixa-alta, borda `--line-strong`, fundo translúcido), `.btn--primary` (dourado com brilho), `.btn--ghost`, `.btn--sm` | A cara do botão é identidade: não trocar por botão chapado genérico. |
| Cartões e painéis | fundo `--panel`/`--panel-2` (ou gradiente entre eles), borda `--line-strong`, raio 10–14 px; ex.: `.avp-form-card`, `.avp-admin-aval`, `.avp-admin-card` | Não usar fundo branco nem cinza claro; um nível de borda por cartão. |
| Cabeçalho e menu | `.nav`, `.nav-links` (Space Mono caixa-alta), marca `FORÇA ÁGIL` com "ÁGIL" dourado | Não mudar sem decisão específica. |
| Exceções aprovadas | **Mapa da Floresta** (`.mfm-painel`: "folha" clara própria, para leitura do diagrama) e **Taxonomia** (`.tax-ui`: tokens `--tx-*`, escuros) | São partes do padrão; não espalhar o tema claro do Mapa para outras telas. |

## 2. Tipografia (hierarquia oficial)

Famílias, por papel — não trocar todas por uma só:

| Papel | Família | Observação |
|---|---|---|
| Título de página | Anton 400 | identidade |
| Títulos de seção/cartão | Oswald 600 | identidade; entrelinha ≥ 1,25 |
| Texto corrido, descrições, rótulos, etiquetas, metadados | fonte de texto do site (`system-ui` hoje, imposta no `<body>`; a Barlow é a declarada nos tokens — a troca global é decisão separada) | nunca Space Mono para texto de leitura |
| Botões, sobretítulo (`.eyebrow`), códigos (P1–P16, IDs, versões) | Space Mono | identidade |

Tamanhos (tokens em `pages.css`, bloco "ARQUITETURA ORGANIZACIONAL: TIPOGRAFIA"):

| Token | Valor | Uso |
|---|---|---|
| `--arq-fs-texto` | 0,92 rem | descrições, ajudas, explicações |
| `--arq-fs-aux` | 0,86 rem | rótulos, textos auxiliares, avisos curtos |
| `--arq-fs-meta` | 0,80 rem (12,8 px) | metadados, etiquetas, cabeçalhos de tabela — **piso**: nada de leitura abaixo disso |

Botões no domínio: 0,82 rem, espaçamento 0,08 em (Space Mono, caixa-alta).

**Como aplicar em componente novo:** use os tokens na própria regra do componente (`font-size: var(--arq-fs-aux)`),
herde as famílias pelos tokens `--font-head`/`--font-mono`/corpo, e não crie sobrescritas por contêiner. Classes
compartilhadas com o resto do site (`.btn`, `.admin-table`) só ganham ajuste escopado ao domínio quando necessário.

## 3. Componentes oficiais

| Componente | Classe/padrão | Notas |
|---|---|---|
| Campos (input, textarea, select, data) | regra `:where(#adminContent, #page-avaliacoes) :where(input, select, textarea)` em `pages.css` (fundo escuro, borda `--line-strong`, foco `--accent`) | Campos nunca com fundo branco. Taxonomia e Mapa têm os seus (excluídos da regra). |
| Seções recolhíveis | `<details class="avp-admin-secao">` com título + descrição curta visíveis | lembram a escolha da pessoa ao voltar |
| Histórico | "Histórico — N alterações", recolhido por padrão (`renderHistoricoRecolhido`) | um formato só em todo o domínio |
| Tabelas | `.admin-table` / `.avp-table`; cabeçalho `--arq-fs-meta`, corpo `--arq-fs-aux`, algarismos tabulares | no celular a lista vira cartões ou rola dentro do próprio contêiner |
| Mensagens | `.avp-error-msg`, `.avp-flash-success`, `.loading-msg`, `.admin-empty` | "carregando" e "falhou" sempre distintos de "vazio" |
| Modais | `.modal-overlay` + `.modal-box` (fundo `#060e1f`, borda `--accent`, barra de rolagem fina dourada) | |
| Voltar | "← Voltar para <origem>" (`faNav`) | um por posição (topo/rodapé) |

## 4. Listas, seletores e rolagem

- **Preferir a rolagem normal da página.** Rolagem interna só com necessidade funcional; hoje no domínio:
  resultados de busca da Squad (`.sq-busca-resultados`, 220 px) e valores longos do histórico
  (`.avp-historico-valores pre`, 320 px); fora dele, `.modal-box` e `.cs-list`.
- Nada de duas barras de rolagem no mesmo bloco; nenhuma rolagem lateral da página (testado em 375 px); tabela larga
  rola só dentro do próprio contêiner.
- Seletores nativos (`<select>`) ficam nativos (acessibilidade), com `color-scheme: dark` nos campos para a lista
  abrir escura.
- Barras de rolagem: seguir o tema escuro via `color-scheme: dark`; barras customizadas (`::-webkit-scrollbar`) só em
  contêineres próprios (modal, listas suspensas), nunca em controles nativos.

### Achados da auditoria de 17/10/2026 (pendentes — PR específica "campos, listas e rolagem")

1. **A página não declara `color-scheme: dark`** (`html` = `normal`): no Chrome/Edge para Windows, a barra de rolagem
   da página e as das áreas internas saem claras, destoando do fundo espacial. Correção prevista: `color-scheme: dark`
   no `:root` (afeta o site todo — exige validação visual em todas as páginas).
2. **`.btn` não tem indicação de foco por teclado** (`:focus-visible`), exceto nas Estruturas do Mapa
   (`.est-painel .btn:focus-visible`). Ex.: lista P1–P16 a 375 px. Correção prevista: um `:focus-visible` com o
   `--accent`, igual ao das Estruturas.
3. Campos do domínio auditados (Nova avaliação, filtros das listas, O1–O9, responsabilidade, análise, Jornada,
   Usuários autorizados): **todos escuros** — nenhum fundo branco encontrado.
4. Nenhuma rolagem interna aninhada nem rolagem lateral nas telas auditadas (desktop e 375 px).

## 5. Inconsistências que não devem voltar

- Anton com peso acima de 400 (negrito sintético — letras empastadas).
- Space Mono em texto de leitura (etiquetas de estado, rótulos de campo, contadores, ajudas) a 11–12 px.
- Títulos com entrelinha 1,02 (linhas encostadas).
- Texto de leitura abaixo de 12,8 px.
- Controles (`button`, `input`) sem herdar a fonte — caíam na Arial padrão (ex.: lista da Taxonomia).
- Campos, listas ou cartões com fundo branco/cinza claro fora das exceções aprovadas.
- Sobrescritas geradas em massa por contêiner: corrigir a causa (token na regra do componente), não empilhar regras.

## 6. Como validar uma tela nova ou alterada

1. Rodar `node .github/scripts/teste-padrao-visual.js` (servindo a raiz em `127.0.0.1:8811`): critérios explícitos
   sobre os estilos calculados — piso de 12,8 px, sem negrito sintético, Space Mono só em botões/sobretítulo/códigos,
   nada na Arial, Anton/Oswald nos títulos, fundo espacial presente, campos escuros, sem rolagem lateral, e nada
   mudado fora do domínio. Tela nova do domínio: acrescentar à lista `TELAS` do teste.
2. Comparar com as capturas de referência em `screenshots/padrao-visual/` (desktop 1280 e 375 px, escala 1×, fontes
   reais): a tela deve parecer o mesmo FORÇA ÁGIL. Capturas sempre na mesma escala e enquadramento — imagem reduzida
   funde traços finos e dá falsa impressão de borrado.
3. Celular e computador são a mesma entrega (375 px é a referência).

## 7. Como propor uma mudança visual

Abrir a proposta com: o problema comprovado (medição ou captura), o componente/token afetado, antes × depois na mesma
escala (desktop e 375 px), o efeito fora da área tocada e o ajuste do teste `teste-padrao-visual.js`. Mudança de
identidade (fundo, paleta, fontes de título, cara dos botões, cartões, menu) só com decisão explícita da responsável,
registrada aqui com nova versão deste documento.

## 8. Capturas de referência

`screenshots/padrao-visual/` (fora do deploy): Início da Avaliação, lista P1–P16, ADMIN › Avaliações e Mapa — desktop
e 375 px —, lista O1–O9 (desktop) e Jornada (375 px), já com a tipografia corrigida.
