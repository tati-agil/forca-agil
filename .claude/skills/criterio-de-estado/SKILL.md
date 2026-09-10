---
name: criterio-de-estado
description: Antes de mudar uma regra que decide um ESTADO de pessoa ou turma neste projeto (forca-agil) — quem está inscrita, quem é admin/facilitadora, se a turma está aberta/finalizada/encerrada —, percorre TODAS as portas de escrita e TODOS os leitores daquele estado, para que nenhum fique com critério diferente. Use sempre que a mudança acrescentar ou remover uma exigência de um critério, e sempre que criar um caminho novo que grave um desses estados.
---

# Critério de estado: leitores e portas de escrita andam juntos

Este repositório não tem tipos, schema nem validação no servidor — o estado de
uma pessoa é um punhado de campos soltos no Realtime Database, e cada arquivo
decide por conta própria o que significa "inscrita". Isso torna possível uma
classe de bug que **não faz barulho nenhum**: uma regra de leitura passa a
exigir um campo que uma das portas de escrita não sabe gravar, ninguém vê erro,
e o sistema começa a produzir gente num estado impossível.

## O caso que originou esta skill

Aconteceu de verdade, e vale ler antes de mexer em qualquer critério.

| data | o que aconteceu |
|---|---|
| 17/06/2026 | O "＋ Participante" do painel nasce gravando só `status: 'inscrito'`. Funcionava — o acesso também olhava só o status. |
| 12/07/2026 | Nasce o botão Confirmar e o campo `confirmedByAdmin`. Passam a existir dois campos, mas nada exige o segundo. |
| **14/08/2026** | `auth.js` passa a exigir os dois (`16e8f20`), para impedir que só manifestar interesse desse acesso. **Correto — e quebrou o "＋ Participante"**, que gravava `addedByAdmin`, outro nome. |
| 08-09/09/2026 | Oficina. Pessoas inscritas no painel, sem acesso a nada, vendo a própria Minha Área como não confirmada. |
| 10/09/2026 | Corrigido: painel passa a exigir os dois campos (#112), as três portas de escrita passam a gravá-los (#113), e o painel inteiro passa a responder por um critério único. |

Nada quebrou no deploy de 14/08. Nenhum erro no console. O painel continuou
dizendo "Inscrito". A janela ficou aberta **27 dias** e só apareceu com 20
pessoas numa sala.

**A lição:** quando uma regra de LEITURA ganha uma exigência nova, é preciso
percorrer TODAS as portas de ESCRITA que produzem aquele estado — e vice-versa.
Um critério novo não é uma linha alterada; é um inventário.

## O que fazer, sempre

1. **Nomeie o estado** que está mudando ("estar inscrita numa turma", "ser
   admin", "turma encerrada").
2. **Liste as portas de escrita** — todo lugar que produz aquele estado.
   `grep` pelo campo e pelo valor literal, nos dois sentidos:
   ```
   grep -rn "status: *'inscrito'\|/status'\] *=" forca-agil/*.js
   grep -rn "confirmedByAdmin" forca-agil/*.js
   ```
3. **Liste os leitores** — todo lugar que pergunta por aquele estado:
   ```
   cd forca-agil && for f in *.js; do
     case "$f" in manual.js|testes.js|mapa.js|qrcode.min.js) continue;; esac
     grep -n "status *[!=]== *['\"]inscrito['\"]" "$f" | sed "s|^|$f:|"
   done
   ```
   (`manual.js` e `testes.js` usam `'inscrito'` como chave de persona, não como
   status — por isso saem da varredura.)
4. **Monte a tabela** porta × leitor e confira se todos usam o MESMO critério.
   Cada divergência é ou um bug hoje, ou um bug esperando o dado certo.
5. **Prefira um critério único** a repetir a condição. Em `admin.js` isso é
   `inscricaoValida(r)`; em `auth.js`, `isInscrito(val)`. Ao acrescentar uma
   exigência, mude a função — não N cópias da condição.
6. **Prove numericamente** antes de publicar. Não raciocine: monte o registro
   de cada porta e rode os predicados de todos os leitores em cima dele. Um
   script de 30 linhas em Node resolve, e é o que revelou tanto o bug quanto o
   conserto. Registro que sai `SIM` em alguns leitores e `NAO` em outros é
   exatamente o estado impossível.
7. **Documente** conforme a skill `docs-internas`, e inclua um teste em
   `testes.js` que percorra todas as portas exigindo o mesmo resultado final
   (existe um assim: "os três caminhos para Inscrita gravam o mesmo registro").

## Inventário atual: "estar inscrita numa turma"

O estado vive em `turmas-interesse/<turma>/<emailKey>` e o critério completo é
**`!removed` + `status === 'inscrito'` + `confirmedByAdmin` preenchido**.

**Portas de escrita** (as três gravam o critério completo desde o PR #113):

| porta | onde |
|---|---|
| botão Confirmar | `admin.js` `confirmarInscrito` |
| ＋ Participante como "Inscrita" | `admin.js` `openAddParticipantModal` |
| Mover para turma (lista de espera) | `admin.js` `moverParaTurma` |

As três recusam sem sessão de admin ativa, em vez de gravar o registro pela
metade — `confirmedByAdmin: null` no Realtime Database **apaga o campo**, é a
mesma escrita que o Desconfirmar faz.

**Leitores com o critério completo:**

| leitor | onde |
|---|---|
| acesso a Conteúdos/Treinamento/Avaliação | `auth.js` `isInscrito` |
| Minha Área da pessoa | `aluno.js` |
| contagem de participantes | `dashboard.js` |
| turmas com avaliação liberada | `avaliacao.js` |
| painel: cabeçalho, filtro "Confirmados", sorteio, linha da tabela, "Já participou" | `admin.js` `inscricaoValida` |

**Leitores que ainda olham só o `status`** — decisão consciente, não
esquecimento: mudá-los altera o que a PESSOA consegue fazer (não o que a admin
vê), e endurecer o check-in no dia da oficina é pior que o problema que
resolve. Depois do #113 nenhum registro novo nasce quebrado, então esses
caminhos só são alcançáveis por registros antigos:

| leitor | onde | efeito de estar divergente |
|---|---|---|
| registrar presença por QR | `checkin.js` | registro antigo consegue check-in sem ter acesso ao conteúdo |
| lista de presença para impressão | `admin.js` `imprimirListaPresenca` | pode listar quem o painel mostra como pendente |
| CSV da turma / histórico | `admin.js` `getStatus` | rótulo do CSV diverge do rótulo da tela |
| certificados: elegíveis | `admin.js` `loadInscritos` | pode oferecer certificado a registro incompleto |
| eventos do quiz | `game.js` | pode liberar o quiz a registro incompleto |
| botão "Tenho interesse" travado | `app.js` | card mostra "✓ Inscrita" a quem não tem acesso |
| sobreposição em outra turma | `admin.js` `checkOutrasTurmas` | **deixar assim é o certo** — detectar demais é o lado seguro |

Ao mexer em qualquer um deles, reveja esta tabela inteira antes.

## Outros critérios de estado deste projeto

Mesma disciplina se aplica, e cada um tem seu próprio inventário a levantar:

- **admin** — allowlist de e-mails no código + nó `fa-admins` (`auth.js`).
- **facilitadora** — nó `fa-facilitadores`, que só libera a rota `#facilitador`;
  participar da equipe de uma turma é outra coisa, mora em `turmas-equipe`
  (ver `CLAUDE.md` e `roteiro.js`).
- **estado da turma** — `turmas-config/<turma>`: `finalizada` (interesse
  encerrado), `encerrada` + `dataConclusao` (turma realizada), `diaAtivo`
  (check-in aberto). Aqui há um segundo perigo, já corrigido no PR #109: datas
  comparadas em UTC dão o dia errado no Brasil (UTC-3) — para "hoje" use
  `getFullYear`/`getMonth`/`getDate`, nunca `toISOString().slice(0,10)`.
- **prontidão de leitura** (`_adminsResolvidos`, `_facilitadoresResolvidos`,
  `_inscricaoResolvida` em `auth.js`) — "não sei ainda" é diferente de "não
  tem acesso"; ver PR #111. Um critério novo que dependa de leitura do banco
  precisa da sua flag de prontidão e do seu evento `fa-*-ready`, ou vira tela
  preta e expulsão de rota no celular em rede lenta.
