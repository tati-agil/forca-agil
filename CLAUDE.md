# CLAUDE.md

Guia curto para o Claude Code neste repositório. **Detalhes sob demanda** (não leia tudo de uma vez — busque o trecho):
- `docs/arquitetura-detalhada.md` — decisões e invariantes de cada módulo, rota, nó e prova automatizada (o corpo
  antigo deste arquivo, preservado sem alteração);
- `docs/referencia-tecnica.md` — dicionário do banco (todos os nós), tabela de módulos, ordem de carga, deploy/CI
  (conferida por `teste-consistencia-docs.js`);
- `docs/paridade-firebase-postgresql.md`, `backend/README.md`, `AGENTS.md` (instruções para qualquer assistente),
  `docs/checklist-pos-deploy.md`, `docs/backlog-testes.md`, `docs/*-contratos.md`.

## O que é

"Força Ágil": site em JavaScript puro (SPA, temática Star Wars) da Previ — onboarding gamificado e o Núcleo de
Avaliação, Taxonomia e Mapa da Floresta (P1–P16, O1–O9, S1–S8). **Sem build, sem bundler, sem package manager no
site**: o repositório é publicado no Firebase Hosting como está. Há testes (suíte hermética + regras no emulador +
Smoke) e dois projetos com `package.json` próprio, fora do site: `functions/` (fronteira confiável, Cloud Functions) e
`backend/` (NestJS + PostgreSQL, só desenvolvimento).

## Comandos

- Pré-visualizar: servir a raiz por HTTP (`npx firebase-tools@13 serve` ou qualquer servidor estático); `file://` quebra
  Auth/CSP.
- Suíte hermética (Firebase falso, sem rede nem segredo — `.github/scripts/suite-hermetica.json`): servir a raiz em
  `http://127.0.0.1:8811` (`python3 -m http.server 8811`) e `node .github/scripts/rodar-suite.js` (paralela; `--processos 1`
  sequencial; um teste só: `node .github/scripts/teste-<nome>.js`, com `FA_BASE_URL` se a porta for outra). Todo
  `teste-*.js` precisa estar na suíte ou em `foraDaSuite` com o motivo.
- Regras do banco: `teste-rules*.js` contra o emulador (`teste-rules.yml`). Depois de editar `database.rules.json`:
  `node .github/scripts/regras-compactas.js --gravar database.rules.min.json` (o deploy usa o compacto). Trechos gerados
  por `montar-regras-*.js --gravar` não se editam à mão.
- Antes do push: `node --check` em cada `.js` alterado (skill `pre-publicacao`).
- CI: a suíte em 4 grupos (`testes-automaticos.yml`), regras no emulador, fronteira, Smoke não bloqueante com o Firebase
  real (`.github/scripts/smoke-site-real.js`, honesto offline por `teste-smoke-seletores.js`). Deploy pelo CI com
  `npx firebase-tools@13`.

## Arquitetura (resumo)

- **`index.html` único** com todas as rotas como `.page-section` e a biblioteca SVG. Carrega `forca-agil/head-init.js`,
  os SDKs **compat** do Firebase, `firebase.js` e os scripts de `forca-agil/` como `<script>` globais, **em ordem que
  importa** (cada um pendura funções em `window.fa*`). A ordem completa e o motivo de cada dependência estão em
  `docs/referencia-tecnica.md` e `docs/arquitetura-detalhada.md`; ao criar módulo, coloque-o depois do que ele usa e
  registre-o na tabela de módulos.
- **Rotas** (`router.js`, hash): fixed page list (`home`, `turmas`, `conteudos`, `treinamento`, `repositorio`, `avaliacao`, `avaliacoes`, `minha-area`, `ajuda`, `admin`, `facilitador`, `checkin`).
  **A FLORESTA** (nome visível; tecnicamente o Núcleo de Arquitetura Organizacional) tem o endereço oficial `#arquitetura`
  — a página interna continua `avaliacoes` (`#page-avaliacoes`, permissões). O antigo `#avaliacoes…` (com os parâmetros)
  é reescrito para `#arquitetura…` por `head-init.js`, antes de qualquer outro script ler o endereço; gere sempre
  `#arquitetura…` (`teste-rota-arquitetura.js`). O Início da Floresta segue a ordem Continuar → Começar (Produto/Serviço,
  responsabilidade, área, Adequação à Squad — independentes) → Mapa; **Trabalhos** (`#arquitetura?tr=1`, desenhado por
  `mapa-floresta.js`) é uma tela só: "Continuar de onde parou" e as listas completas (blocos de `avaliacao-produto.js`,
  `window.faTrabalhosFloresta`) com os registros da antiga Jornada de Avaliação e Posicionamento; o registro de um item é
  `?tr=1&item=<id>`, e o antigo `?mf=catalogo[&item=]` é reescrito para `?tr=1[&item=]` (`teste-floresta-trabalhos.js`).
  A **Gestão da Floresta** (`#arquitetura?arq=<área>`) reúne o que eram ADMIN › Avaliações e Mapa e ADMIN › Taxonomia
  (`?arq=taxonomia`), com os mesmos módulos e ids (os painéis `#adminPanelArquitetura`/`#adminPanelTaxonomia` estão em
  `#page-avaliacoes`; `avaliacao-produto.js` abre a Gestão e sobe a instância `admin`); o antigo `#admin?arq=<área>` é
  reescrito por `head-init.js`, e o ADMIN não tem mais essas abas (`teste-floresta-gestao.js`).
  O controle de acesso vale na navegação e no acesso direto pelo hash; informação de acesso que chega tarde reaplica a
  decisão sem rolar a página para o topo. Subendereços: `#arquitetura?arq=<área>`, `?po=…`, `?sq=…`, `?an=…`, `?tr=1`,
  `?mf=mapa`.
- **Acesso** (`auth.js`, `window.faAuth`): quatro dimensões independentes — autenticação, participação (`member`/`enrolled`),
  perfis funcionais (`fa-avaliacao-autorizados`: `avaliacao` avalia; `avaliacao-arquitetura` também cura, decide e entra
  na Gestão da Floresta — sem Taxonomia nem Usuários autorizados, que são do admin geral; não vê o ADMIN) e admin geral (lista fixa + `fa-admins`). "Ainda não sei" ≠ "não tem acesso".
  **Tudo é imposto por `database.rules.json`**, não só pela tela.
- **Dados**: Firebase Realtime Database (projeto `kyber-agil`) é a única fonte oficial; o cliente lê e grava direto,
  com horário do servidor, autoria do token, revisão + 1 e auditoria só de acréscimo onde o domínio exige. Único código
  de servidor: a fronteira confiável em `functions/` (identidade `fronteira-confiavel`; só pelo
  `faServicosPosicionamento.executar`; nunca implantada pela `main`).
- **Núcleos puros** (`*-nucleo.js`, motores): regras de negócio sem Firebase/DOM/relógio, fonte única das suas regras —
  nunca copiar nem reescrever (o backend e a fronteira carregam os mesmos arquivos). Motores O1–O9/P1–P16/S1–S8 não se
  alteram sem pedido explícito.
- **Domínios principais** (detalhes em `docs/arquitetura-detalhada.md`): Avaliação de Produto/Serviço (P1–P16) e
  Adequação à Squad (S1–S8), com instâncias operacional e ADMIN; Posicionamento Organizacional (O1–O9) com governança
  do motor; Taxonomia (fonte única de nomes e definições); Porta 2 — responsabilidades organizacionais e Análise
  Organizacional (marcador próprio; registro direto `contrato: 'registro-direto'`, registros anteriores com a regra
  antiga); Estrutura Organizacional Atual (`estrutura-atual-*`, marcador próprio, separada das Estruturas do Mapa);
  Estruturas Organizacionais Concretas e Catálogo do Mapa da Floresta; manual do ADMIN (`manual.js`).

## Backend local e deploy

- `backend/` (NestJS 11 + PostgreSQL 17 em Docker, só desenvolvimento): usa os mesmos `forca-agil/*-nucleo.js`; fontes
  oficiais sem adaptador (rotas de negócio respondem 503); o site não depende dele. Guia: `backend/README.md`.
- Deploy só pelo GitHub Actions (`firebase-tools@13`, conta de serviço em secret): push na `main` → `hosting,database`
  (regras pelo `database.rules.min.json`); `v2`/`v3-quiz` → canais de prévia; Cloud Functions só pelo workflow manual
  `deploy-functions.yml`. `firebase.json` serve a raiz (exceto `scraps/`, `screenshots/`, `uploads/`, `*.md`, `*.txt`,
  dotfiles, `backend/**`, `functions/**`) e reescreve tudo para `/index.html`.
- Redação publicada de motor é imutável pelas regras: nunca reintroduza `.write` num ancestral de `versoes/<n>`; para
  suspender, use `publicacaoSuspensa` (só admin geral).

## Working agreements

**Abrir PR não precisa de permissão.** A dona do repositório autorizou de forma
permanente: ao terminar uma mudança, faça commit, dê push no branch de trabalho
e **abra o PR direto**, sem perguntar antes. Não fique esperando um "sim" a cada
vez. O merge continua sendo dela — abrir o PR é o fim do seu trabalho, não um
pedido de autorização.

Se o PR anterior desse branch já foi mergeado, os commits novos precisam de um
PR novo — mergeado é mergeado, não dá para reaproveitar. Abra o novo PR do
mesmo jeito, sem perguntar.

**Paridade Firebase × PostgreSQL é requisito da migração futura** (decisão D1, 2026-10-13 — a decisão original, de
2026-10-11, exigia a paridade também para começar a gravar no site) — requisitos e critérios de aceite em
`docs/paridade-firebase-postgresql.md`. O FORÇA ÁGIL opera de verdade no Firebase atual, a fonte oficial única; a
paridade é comprovada antes da troca de fonte, com reconciliação dos dados reais já gravados. Hoje não existe teste real
de equivalência entre os dois bancos: não diga que existe. Uma fonte oficial de gravação por vez (o Firebase), horário
do servidor, nenhuma gravação dupla; `compõe` no site só de Squad para uma especialização de Linha (decisão C2).

**Celular e computador são a mesma entrega.** Nenhuma funcionalidade deste site
está pronta se só funciona num dos dois. Isso não é um capricho de qualidade: as
participantes usam o site **no celular, na sala da oficina, na rede da Previ** —
esse é o uso real, e o computador é a exceção. Quem desenvolve olhando só a tela
larga inverte a prioridade sem perceber.

Vale para tudo, não só para layout: **rede lenta é uma condição de mobile, não um
caso raro.** Corridas que duram milissegundos no wi-fi duram segundos no 4G, e é
exatamente nesses segundos que a pessoa clica. Os dois desastres da oficina de
08-09/09/2026 foram disso: gente inscrita sendo expulsa do Treinamento porque
"ainda não sei" foi tratado como "não tem acesso" (PR #111), e a tela preta que
era só o site esperando calado (PR #116). Nenhum dos dois aparecia no
computador do escritório.

Na prática, antes de considerar qualquer mudança pronta:
- se ela toca a interface, verifique nos **dois** formatos de tela (375px é a
  referência de celular usada nos testes deste repo);
- se ela depende de leitura do Firebase, pense no caminho lento e no caminho que
  nunca responde, não só no caminho feliz;
- prefira provar rodando a página num navegador a raciocinar sobre o código —
  `.github/scripts/teste-tela-preta.js` é o exemplo de como fazer isso sem
  depender de rede nem de segredo, e roda desktop e celular lado a lado.

**Toda funcionalidade nova ou modificada deve seguir o Padrão Visual Oficial do FORÇA ÁGIL**
(`docs/padrao-visual.md`). A identidade atual está aprovada pela dona: fundo espacial, paleta azul-escuro, dourado e
ciano, Anton nos títulos de página, Oswald nos títulos de seção, botões em Space Mono, cartões escuros. Mudança
visual só para corrigir problema comprovado de leitura ou uso — nunca um tema novo, nunca componente branco ou
cinza fora das exceções do documento (Mapa da Floresta). Tamanhos de letra pelos tokens `--arq-fs-*` na própria
regra do componente, não por sobrescritas em massa; validar com `.github/scripts/teste-padrao-visual.js` e
comparar com `screenshots/padrao-visual/` na mesma escala.

**Editar sem conseguir salvar não é uma funcionalidade menor — é quebrada.**
Nas palavras dela: "se admin pode mexer, pode gravar. ou não deixa mexer ou
deixa e salva." Toda tela é uma destas duas coisas, nunca uma terceira: só
consulta (não mostra edição pra quem não pode gravar), ou edição de verdade
(quem abre o formulário também consegue salvar). Isso já aconteceu de
verdade: `roteiros-evento` e `eventos` deixavam qualquer admin editar no
painel, mas as regras do banco (`database.rules.json`) só permitiam a
gravação a dois e-mails fixos — silêncio total até a PR #135 fazer o erro
aparecer, e o descompasso de permissão em si só saiu na PR #136. Ver a skill
`editar-e-salvar` antes de adicionar um formulário de edição, um botão
"Salvar" ligado a uma escrita no Firebase, ou mexer em `database.rules.json`.

**Merge e deploy só com autorização explícita da dona**, a cada vez. Nada de dados fictícios (GECON etc.) no banco
oficial: homologação no Firebase falso ou no emulador.

## Execução eficiente (política permanente)

Menos contexto repetido, menos comandos desnecessários, menos retrabalho — sem enfraquecer arquitetura, testes,
permissões, auditoria nem experiência do usuário.

- **Investigação**: antes de editar, identifique os arquivos e contratos envolvidos; reutilize o que já está
  documentado (os docs acima); faça buscas direcionadas (Grep/trechos) em vez de reler arquivos inteiros; não despeje
  logs ou trechos grandes quando bastam as linhas relevantes.
- **Implementação**: reutilize componentes, funções e testes existentes; planeje as alterações relacionadas e faça-as em
  blocos coerentes, sem dezenas de edições fragmentadas; para edição exata use a ferramenta de edição (scripts
  temporários e `sed` com escapes complexos quebram); prefira a menor solução completa e segura, sem antecipar o que não
  foi pedido; não rediscuta decisões já aprovadas.
- **Testes**: direcionados durante o desenvolvimento; não repita a suíte de um módulo que a mudança não afeta; regras do
  Firebase alteradas → emulador; validação completa (CI) no commit final da PR, repetida só se novas alterações exigirem;
  nunca economize eliminando testes de segurança, regressão, concorrência ou compatibilidade.
- **Git e PR**: commits incrementais coerentes; não recrie branches, PRs ou ambientes sem necessidade; sem merge nem
  deploy sem autorização.
- **Comunicação**: checkpoints curtos ao fim de cada etapa relevante (concluído, testes, commit, pendências, próximo
  passo); não repita explicações longas; peça decisão só diante de impedimento real ou mudança relevante de escopo; se
  uma abordagem falhar duas vezes, pare, diagnostique a causa e avalie a alternativa mais simples.

### Critério de encerramento — evitar ciclos intermináveis

Uma PR é concluída quando o escopo aprovado está implementado, os critérios de aceite estão atendidos e os testes
exigidos passam. Revisão não é ciclo interminável de refinamento.

1. **Só impede o merge** problema comprovado e relevante: falha de segurança, autorização ou integridade dos dados;
   risco real de perda ou corrupção de dados, histórico ou auditoria; defeito funcional reproduzido que comprometa os
   critérios de aceite; violação de contrato arquitetural ou de regra de governança aprovada; falha nos testes
   obrigatórios do commit candidato. Todo bloqueador precisa de evidência objetiva, impacto identificado e correção
   proporcional; suspeita não confirmada é investigada antes de virar bloqueador.
2. **Não impede o merge**: melhorias estéticas ou editoriais não essenciais, funcionalidades fora do escopo,
   otimizações especulativas, preferências de implementação sem defeito comprovado, problemas antigos não introduzidos
   pela PR que não comprometam a entrega, a segurança ou a integridade. Esses itens vão para o backlog, sem gerar
   implementação automática.
3. **Em cada rodada de revisão**: corrigir só bloqueadores reais e o necessário para os critérios de aceite; não ampliar
   escopo sem autorização; não reabrir decisões aprovadas sem fato novo relevante; não pedir revisões completas depois
   de cada pequeno ajuste; testes direcionados durante as correções e CI completo no commit final; encerrar a rodada
   quando os critérios estiverem satisfeitos. Se a correção exigir mudança arquitetural maior ou decisão de governança
   ainda não aprovada, interromper essa mudança e apresentar objetivamente a decisão necessária — não seguir por
   iniciativa própria.
4. **Pronta (Definition of Done)**: escopo aprovado implementado; critérios de aceite demonstrados; nenhum bloqueador
   real conhecido; permissões, contratos, históricos e auditoria preservados; testes obrigatórios do commit final
   aprovados; melhorias opcionais separadas das pendências impeditivas. Nesse momento, parar de desenvolver e
   apresentar a PR como pronta para a decisão da dona do repositório. Abrir PR não requer autorização; merge e deploy
   dependem de aprovação explícita.
