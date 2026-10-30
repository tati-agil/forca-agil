# Padrão Visual Oficial do FORÇA ÁGIL

> **Toda funcionalidade nova ou modificada deve seguir o Padrão Visual Oficial do FORÇA ÁGIL.**

Versão 3 — 18/10/2026: hierarquia das ações, estados de links e botões e verificação **obrigatória** em teste (§3-A, §6). Versão 2 — 17/10/2026: foco por teclado e barra de rolagem (PR de campos, listas, rolagem e foco). Versão 1 — 17/10/2026: tipografia da Arquitetura Organizacional (PR #396). Decisão da responsável: a identidade visual
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
| Voltar | "← Voltar para <origem>" (`faNav`), classe `.avp-voltar-link` | um por posição (topo/rodapé); o Início se chama sempre "A Floresta" |

## 3-A. Hierarquia das ações e estados (obrigatório)

Cada ação tem a aparência da sua **importância no contexto**, não a de como a tela foi escrita:

| Papel | Classe | Aparência | Regra |
|---|---|---|---|
| Ação principal | `.btn.btn--primary` | amarelo (`--gold`) com brilho | **no máximo uma por cartão/seção**; alternativas equivalentes nunca são amarelas uma e azul a outra |
| Ação secundária | `.btn` (`.btn--sm` quando discreta) | contorno azul (`--line-strong`), fundo translúcido | escolhas alternativas têm o mesmo peso (todas `.btn`) |
| Navegação e retorno | `.avp-voltar-link` | contorno e texto ciano (`--cyan`) | **todo** "← Voltar…" e "Ver todos…" de navegação; nunca `.btn` |
| Acesso complementar | link textual (`a`), ou `.avp-mapa-link` | texto ciano claro (`--cyan-soft`), sublinhado no hover | nunca a cor padrão do navegador |

Exceção aprovada pela dona (30/10/2026): o link da nota do cabeçalho do ADMIN (`#adminNotaFloresta`, "A FLORESTA › Gestão da Floresta") usa a mesma fonte e o mesmo tamanho do texto, cinza-claro (`--ink`), amarelo (`--gold`) no hover e no foco por teclado (contorno amarelo), sem sublinhado fixo. Verificado por `teste-padrao-visual-floresta.js` (escopo `#adminNotaFloresta`).

Estados:

| Estado | Links | Botões (`.btn`, `.btn--primary`, `.avp-voltar-link`) |
|---|---|---|
| normal | `--cyan-soft` (regra de especificidade zero em `#page-avaliacoes`; classe própria vence) | como na tabela acima |
| **visitado** | **a mesma cor do normal** — nunca o lilás/roxo do navegador (o esquema escuro da área deixava `rgb(158,158,255)`, roxo depois de visitado) | igual ao normal |
| hover | sublinhado | borda/fundo um tom mais claro (regra do componente) |
| foco (teclado) | contorno de 2 px no acento (`:focus-visible`, §4) | idem |
| ativo | sem mudança de cor | sem deslocamento |
| desabilitado | — | opacidade reduzida e cursor "não permitido"; não recebe clique |

Tamanho: o botão tem o tamanho do texto (como os demais primários do site); largura total só no celular, quando é a
ação do próprio cartão. Contraste: texto ≥ 4,5:1 sobre o fundo realmente pintado (3:1 para texto grande); verde-escuro,
cinza-escuro e similares não servem no fundo espacial — sucesso no site é o ciano.

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

### Foco por teclado (versão 2, PR "campos, listas, rolagem e foco")

- **Todo controle interativo da Arquitetura mostra o foco por teclado** (`:focus-visible`): contorno de 2 px no acento
  do tema, afastado 2 px (dourado no site; na Taxonomia, o ciano dela, porque lá `--accent` já é `--tx-link`). Só para
  teclado — clique e toque não ganham contorno.
- O **Mapa da Floresta** mantém o contorno azul-escuro próprio (`#1f3b73`, 3 px), legível na folha clara.
- Não remover o contorno sem uma alternativa visível: a regra antiga `#adminContent input:focus { outline: none }` (do
  ADMIN do site) apagava o foco da Taxonomia e das caixas de seleção; dentro do domínio, a regra de foco a sobrepõe.

### Barra de rolagem da página

- A barra principal pertence ao `<html>`: enquanto uma tela da Arquitetura está aberta (Avaliação, ADMIN › Avaliações
  e Mapa, ADMIN › Taxonomia), a raiz usa `color-scheme: dark` e a barra sai escura. As demais páginas do site
  continuam como estavam (decisão de escopo: a troca global fica para quando todas as páginas forem validadas).
- Os contêineres do domínio já usavam `color-scheme: dark` (barras internas, seletores, calendário dos campos de
  data, caixa de busca).

### Auditoria de 17/10/2026 (Chromium e Edge no Windows, desktop e 375 px)

Telas: Início, listas P1–P16 e O1–O9 (com filtros), Nova avaliação preenchida, ficha P1–P16, O1–O9 escolher item, nova
responsabilidade, nova análise de área (campo de data), Jornada com busca, Mapa, Squad (nova, com busca), ADMIN ›
Avaliações e Mapa, editor de questionário com modal aberto, Usuários autorizados, Documentos, Estrutura Atual,
Taxonomia (catálogo e formulário do conceito).

| Achado | Situação |
|---|---|
| Campos, áreas de texto, seletores, data e busca com fundo claro | nenhum — todos escuros, `color-scheme: dark` |
| Rolagem interna desnecessária, aninhada ou lateral | nenhuma |
| Barra de rolagem da página clara no Windows (raiz sem `color-scheme`) | **corrigido** (só nas telas da Arquitetura) |
| Foco invisível: `.btn` (anel nativo de 1 px quase preto), caixa "Mostrar encerradas", busca e formulário da Taxonomia | **corrigido** |
| Foco no Mapa (contorno azul-escuro próprio) e nos modais | já conforme |

Limites: a barra de rolagem foi conferida no **Chromium e no Edge para Windows**; Firefox e Safari não foram testados
nesta auditoria. Barras customizadas (`::-webkit-scrollbar`) não foram criadas — o esquema escuro do navegador basta.

## 5. Inconsistências que não devem voltar

- Anton com peso acima de 400 (negrito sintético — letras empastadas).
- Space Mono em texto de leitura (etiquetas de estado, rótulos de campo, contadores, ajudas) a 11–12 px.
- Títulos com entrelinha 1,02 (linhas encostadas).
- Texto de leitura abaixo de 12,8 px.
- Controles (`button`, `input`) sem herdar a fonte — caíam na Arial padrão (ex.: lista da Taxonomia).
- Campos, listas ou cartões com fundo branco/cinza claro fora das exceções aprovadas.
- Sobrescritas geradas em massa por contêiner: corrigir a causa (token na regra do componente), não empilhar regras.
- Controle interativo sem foco visível por teclado, ou `outline: none` sem alternativa.
- Barra de rolagem clara sobre o fundo espacial (raiz sem `color-scheme: dark` numa tela da Arquitetura).
- Link na cor padrão do navegador (lilás/azul, e roxo depois de visitado).
- Duas ações amarelas no mesmo cartão, ou alternativas equivalentes com cores diferentes.
- "← Voltar" com aparência de ação (azul ou amarelo) em vez da navegação ciano.
- Botão esticado na largura do contêiner no computador (ex.: "Nova análise" com 1020 px).
- Texto de status escuro sobre o fundo escuro (ex.: o verde `#1d7a3a`, 3,4:1).

## 6. Como validar uma tela nova ou alterada

0. **Obrigatório em toda mudança visual:** `node .github/scripts/teste-padrao-visual-floresta.js` (com a raiz servida em
   `127.0.0.1:8811`). Ele usa `padrao-visual-verificacoes.js` — verificações reutilizáveis sobre os estilos calculados e o
   Tab real: link na cor do navegador, contraste, "← Voltar" sem estilo de navegação, dois amarelos no mesmo cartão,
   botão esticado, foco invisível e rolagem lateral a 375 px — e começa provando que cada regra reprova uma regressão
   injetada. Roda no CI (suíte hermética) e bloqueia o merge. Tela nova de A FLORESTA: acrescentar à lista `TELAS` dele;
   outra área do site pode reutilizar `verificarTela(page, { escopo })`.
1. Rodar `node .github/scripts/teste-padrao-visual.js` (servindo a raiz em `127.0.0.1:8811`): critérios explícitos
   sobre os estilos calculados — piso de 12,8 px, sem negrito sintético, Space Mono só em botões/sobretítulo/códigos,
   nada na Arial, Anton/Oswald nos títulos, fundo espacial presente, campos escuros, raiz com color-scheme escuro,
   foco visível em todo controle percorrido pelo Tab, sem rolagem lateral, e nada mudado fora do domínio. Tela nova do domínio: acrescentar à lista `TELAS` do teste.
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
e 375 px —, lista O1–O9 (desktop) e Jornada (375 px), já com a tipografia corrigida; barra de rolagem escura no
Edge para Windows (`barra-rolagem-escura-edge.jpg`) e foco por teclado num botão e num campo da Taxonomia
(`foco-botao.jpg`, `foco-campo-taxonomia.jpg`).
