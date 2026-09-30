> **Anexo B3 — inventário bruto (material de apoio).** Levantamento feito lendo o código na íntegra, no commit `c38cfe0` (merge da PR #244). Os números de linha valem para esse commit; se o arquivo mudar, localize pelo nome da função/trecho citado. Escopo: `aposta.js` (Construção da Aposta) e `roteiro.js`. **Escrito em inglês** (levantamento técnico original); a versão normativa das regras de `apostas`, em português, é o [anexo A](A-apostas-regras.md).
> Os documentos 01-12 já consolidam o que importa daqui; use este anexo para conferir detalhes, achar a linha exata de uma chamada ao Firebase ou checar se nada ficou de fora ao adaptar/testar uma tela.

---

# Inventory: Firebase RTDB usage in `aposta.js` and `roteiro.js` (for the MongoDB + NestJS migration)

Sources read in full: `forca-agil/aposta.js` (6,999 lines), `forca-agil/roteiro.js` (3,810 lines), the `apostas` section of `database.rules.json` (lines 191–316) plus the rules for the nodes those two files touch (lines 37–133), and `.github/scripts/teste-rules.js` (851 lines). I also checked the callers `facilitador.js`, `admin.js` (equipe/roteiro modals, turma deletion, `apostaHabilitada`) and `auth.js` (`isAdmin`/`isFacilitador`).
Line numbers are `file:line`. "RTDB" means Firebase Realtime Database.

Neither file uses `onDisconnect`, `ServerValue` or `serverTimestamp`. **Every timestamp is a client-side `new Date().toISOString()`**, and lock expiry compares the client clock (`Date.now()`) with a timestamp another client wrote. `push()` is used only to generate IDs client-side (`.push().key`), plus `push()`+`set()` for new children in roteiro.js.

---

## 1. aposta.js — data model of `apostas/<turmaKey>`

The header comment describes the model at aposta.js:47–90 and the cycle model at aposta.js:2489–2574. What follows is what the code actually **writes**. All values are strings unless marked otherwise.

```
apostas/<turmaKey>/
  atual: string (execId)                         — pointer to the active execution; written ONLY inside the
                                                   atomic creation update (aposta.js:2452)
  criacaoExecucaoEmAndamento: {                  — execution-creation lock (aposta.js:2344–2347)
      em: ISO string, por: email, token: pushKey }  released to null by a token-checked transaction (2372–2375)
  contadorExecucoes: number                      — monotonic counter, transaction +1 (2404–2405); gaps are allowed
  execucoes/<execId>/                            — execId = client push key (2413)
      numero: number                             — from contadorExecucoes (2434)
      status: 'ativa' | 'encerrada'              — (2435, 2427). Legacy executions have no status.
      criadaEm: ISO, criadaPor: email, criadaPorNome: string   (2436–2438)
      turmaKey, turmaLabel, eventoKey: string    (2439–2441)
      missao: '' (creation) | object | legacy string   (2442; set 6556; remove 6567)
          object = { verbo, oQue, contexto, prazo (digits), prazoUnidade (enum UNIDADES), texto? (legacy) }
      revelado: boolean                          (2443; set 5578, 6611)
      encerrada: boolean                         (2444, 2428) — legacy mirror; `status` decides the real state
      encerradaEm: ISO, encerradaPor: email, encerradaPorNome: string   (2429–2431)
      grupos-resumo/<grupoId>/                   — Phase 5 discovery view for participants
          nome: string, qtdMembros: integer      (created 6600 with 0; incremented at 2937)
      grupos/<grupoId>/                          — grupoId = push key (6597)
          nome: string, criadoEm: ISO, etapa: 'missao'   (created 6599)
          membros/<emailKey>/ { name, email, entrouEm: ISO }   (2934–2936)
          etapa: etapaId                         — legacy "implicit Cycle 1" navigation progress (5189)
          dados/<etapaId>: object                — legacy "implicit Cycle 1" content (5346 via caminhoDadosAtual)
          atualizadoEm: ISO, atualizadoPorNome: string   (5347–5348, on every save)
          ciclos/                                — exists only once a group needs Cycle 2 (2505–2521)
              atual: cicloId                     (2785)
              criacaoCicloEmAndamento: { em, por, token }   (lock, 2674–2676; released at 2688–2690)
              porId/<cicloId>/                   — cicloId = push key (2716, 2749)
                  numero: number                 (1 for the materialized Cycle 1; previous + 1 otherwise, 2727)
                  status: 'EM_CONSTRUCAO' | 'FINALIZADO'   (2752, 2763, 2770, 5218)
                  criadoEm: ISO|null, criadoPorNome: string|null, finalizadoEm: ISO|null
                  cicloAnteriorId: cicloId|null
                  pontoDeReinicio: etapaId|null  (rewritten by the cascade at 5341)
                  decisaoOrigem: decision text | 'edicao-manual' | null   (2776, 5494)
                  herdadas: [etapaId]            — array → RTDB object with numeric keys (2777, 5340)
                  etapa: etapaId                 (2779, 5189)
                  dados/<etapaId>: object        (2779, 5330, 5346)
```

### 1.1 Content of `dados/<etapaId>`

The etapa list is at aposta.js:209–499. These are the fields the collectors actually persist (`coletar()`, aposta.js:4041–4110):

| etapaId | Fields persisted |
|---|---|
| `missao` | `verbo`, `oQue`, `contexto`, `prazo` (digits), `prazoUnidade` (enum `segundos…anos`, 698), `texto` (legacy, hidden input) |
| `sintoma` | `texto` **or** `{ pulada: true }` / `{ pulada: false }` (4919, 4941) |
| `problema` | `quem`, `situacaoIndesejada` |
| `mudancas` | `itens: [ { id ('r'+base36, 1192), direcao ('Aumentar'/'Reduzir'/'Manter'/'Atingir' or free text), indicador, atual, meta, tipoLimite ('Pelo menos'/'No máximo'/'Entre'), limiteMinimo, limiteMaximo, formaMedicao (enum, 886), unidade, periodo, prazo, prazoUnidade } ]`. All numbers are stored as strings. Blank blocks are skipped (4053–4056). |
| `hipotese` | `causa`, `indicio` (can be seeded from `decisao.proxHip*` when a cycle restarts at `hipotese`, 2659–2663) |
| `ideia` | `acao`, `mudanca`, `texto` (legacy) **or** `{ pulada }` |
| `experimento` | `duracao`, `duracaoUnidade`, `quantidade`, `comQuem`, `oQue`, `responsavel`, `custo` ('R$ x,yy'), `resultadoIds: [mudanca.id]` |
| `evidencia` | `itens: [ { resultadoId, fontePrevista, comoSeraMedido } ]` while planning; `{ resultadoId, observado, fonte, fonteDetalhe, naoMedido: 'sim'\|'', motivo, aprendizado }` while recording. Also `classificacao` ('Sustentada'/'Parcialmente sustentada'/'Não sustentada') and `registrando: 'sim'` (5072). |
| `decisao` | `decisao` (8-value enum, 420), `proximaAcao`, `responsavel`, `prazo`, `prazoUnidade`, `reavaliacao` ('dd/mm/aaaa'), `proxHipCausa`, `proxHipIndicio`, `proximaHipotese` (legacy), `pontoDeReinicioEscolhido` (etapaId), `dataDecisao` (ISO, set once at 5139 and preserved at 4106) |

Observation from reading, not verified at runtime: in recording mode the "planned source" inputs are rendered without a `data-e` attribute (3947–3950). The next `coletar()` therefore drops `fontePrevista`, `comoSeraMedido` and `registrando` from `evidencia.itens`. `statusEvidencia()` re-infers "recording" from the content (3761), so the flow keeps working, but the "O QUE FOI PLANEJADO" recap loses its data. This is worth confirming before designing the Mongo schema.

Semantics to preserve:
- **Implicit Cycle 1.** `grupos/<g>/dados` and `grupos/<g>/etapa` are read and written until `ciclos/` exists (`cicloAtualDe`, 2584–2590; `caminhoDadosAtual`, 2596–2603). After that the legacy path is frozen by the rules.
- **Save granularity.** Each save replaces the whole etapa object (`updates[path/etapaId] = dados`, 5346). Between members of the same group, the last writer wins per etapa.
- **Autosave.** A 600 ms debounce (5274–5279), flushed on close (1888). Navigation (Back, Continue, trail click) waits for the write to be confirmed before moving on (4885–4896).

---

## 2. aposta.js — every DB operation

| # | Line(s) | Path | Operation | Purpose / who |
|---|---|---|---|---|
| 1 | 162 | `turmas-equipe` | `once('value')` | Fallback read of the whole team node when `window.faRoteiro` is missing. Result is cached; errors give an empty cache, so the check fails closed. |
| 1b | 160 → roteiro.js:629 | `turmas-equipe` | `once('value')` | Same read through `faRoteiro.carregarEquipeGlobal`; used by `souFacilitadoraDaTurma`. |
| 2 | 1726 | `turmas` | `once('value')` | Eligibility: which turmas have `apostaHabilitada`, plus labels and `eventoKey`. |
| 3 | 1777 | `turmas-interesse` (**whole node**) | `once('value')` | Eligibility for non-admins and non-facilitators: `status==='inscrito' && confirmedByAdmin && !removed`. This downloads every turma's enrollments. |
| 4 | 1908 | `apostas/<t>/atual` | `once('value')` | Finds the current execution when the dynamic opens. |
| 5 | 1937–1939 | `apostas/<t>/execucoes/<exec>` | `on('value')` | Conductor listener for the whole execution (see §2.2). |
| 6 | 1994–1995 | `…/<exec>/missao` | `on('value')` | Participant listener. |
| 7 | 2004–2005 | `…/<exec>/revelado` | `on('value')` | Participant listener. |
| 8 | 2015–2016 | `…/<exec>/grupos-resumo` | `on('value')` | Participant listener. |
| 9 | 2035–2048 | `…/<exec>/grupos/<g>` | `on('value')` | Participant listener on their own group. |
| 10 | 1898–1903, 2034, 2943 | the refs above | `off()` | Tear-down on close, on execution change and on a failed join. |
| 11 | 2342, 2343–2347 | `apostas/<t>/criacaoExecucaoEmAndamento` | `push().key` (token) + **transaction** | Acquires the execution-creation lock (§2.1 T1). |
| 12 | 2372 | same | **transaction** | Token-checked lock release (T2). |
| 13 | 2386 | `apostas/<t>/atual` | `once('value')` | Re-reads `atual` while holding the lock. |
| 14 | 2403–2405 | `apostas/<t>/contadorExecucoes` | **transaction** | Execution number (T3). |
| 15 | 2413 | `apostas/<t>/execucoes` | `push().key` | New execution ID; nothing is written here. |
| 16 | 2469 | root, multi-path | `update()` | **Atomic** step: ends the old execution (`status`, `encerrada`, `encerradaEm`, `encerradaPor`, `encerradaPorNome`), creates the new one and moves `atual`. |
| 17 | 2672–2676 | `…/grupos/<g>/ciclos/criacaoCicloEmAndamento` | `push().key` + **transaction** | Acquires the cycle-creation lock (T4). |
| 18 | 2688 | same | **transaction** | Token-checked cycle-lock release (T5). |
| 19 | 2695 | `…/grupos/<g>/ciclos/atual` | `once('value')` | Re-reads the current cycle while holding the lock. |
| 20 | 2716, 2749 | `…/ciclos/porId` | `push().key` | New cycle ID, and an ID for the materialized Cycle 1. |
| 21 | 2725 | `…/ciclos/porId/<prev>`, or `…/grupos/<g>` for implicit Cycle 1 | `once('value')` | Fresh copy of the cycle being closed: its data and number. |
| 22 | 2787 | root, multi-path | `update()` | **Atomic** step: materializes Cycle 1 (first time only), finalizes the previous cycle, creates the new cycle with inherited data and sets `ciclos/atual`. |
| 23 | 2851 | `…/grupos/<g>/membros/<myKey>` (one read per group) | `once('value')` | Participant discovers their own group without reading member lists. |
| 24 | 2938 | root, multi-path | `update()` | Joins a group: `grupos/<g>/membros/<me>` plus `grupos-resumo/<g>/qtdMembros = guess+1`. Retries once, then shows an error (2930–2946). |
| 25 | 5189 | `…/etapa`, or `…/ciclos/porId/<c>/etapa` | `set()` | Persists trail progress on advance. The facilitator panel uses it; a failure shows a toast. |
| 26 | 5218 | `…/ciclos/porId/<c>` | `update({status:'FINALIZADO', finalizadoEm})` | Closes an explicit cycle for decisions that do not open a new one. |
| 27 | 5349 | root, multi-path | `update()` | `salvarEtapa`: `dados/<etapa>`, `atualizadoEm`, `atualizadoPorNome`. If an **inherited** etapa is edited it also clears later etapas (`{}`) and rewrites `herdadas` and `pontoDeReinicio` (5324–5344). |
| 28 | 5578 | `…/<exec>/revelado` | `set(true)` | "Revelar conexões" button on the Map (conductor). **No callback or error handling.** |
| 29 | 6556 | `…/<exec>/missao` | `set(obj)` | Saves the base mission (panel). |
| 30 | 6567 | `…/<exec>/missao` | `remove()` | Removes the base mission (panel). |
| 31 | 6597, 6601 | `…/<exec>` | `push().key` + `update({grupos/<k>, grupos-resumo/<k>})` | Creates a group and its summary atomically (panel). |
| 32 | 6611 | `…/<exec>/revelado` | `set(!revelado)` | Toggles the reveal (panel). |
| 33 | 6878 | `apostas/<t>/execucoes` (**whole history**) | `once('value')` | Read-only history modal and CSV export of past executions (conductor only). |

No DB writes occur in the CSV export (6904), the text/PDF export or the "Analisar com IA" prompts (6094–6246). They generate text locally only.

### 2.1 Transactions

All five use RTDB `transaction(updateFn, onComplete)`. Returning `undefined` from `updateFn` aborts the transaction, which reaches `onComplete` with `committed=false`.

- **T1 — acquire the execution lock** (2344–2360). Protects creation of the next execution against concurrent clicks, including two tabs of the same person.
  - `updateFn`: if a lock exists and `Date.now() - lock.em < LOCK_EXPIRA_MS (20000, 2336)`, it aborts. Otherwise it writes `{em: nowISO, por: email, token}`.
  - On error: toast "Não consegui abrir…", nothing written.
  - On abort: persistent toast "Outra execução está sendo iniciada…", nothing written.
  - On commit: `confirmarAtualAindaValido`, which re-reads `atual`. If `atual` changed, it releases the lock, warns and re-listens. Then it moves to T3, then the atomic update #16. The lock is released afterwards with T2, never inside #16.
  - Invariants claimed in the comments (2258–2261): at most one `status:'ativa'` per turma, and `atual` always points at an existing active execution. **Only the client enforces these; the rules do not.**
- **T2 — release the execution lock** (2371–2376). `updateFn`: returns `null` (delete) only if `lock.token === meuToken`, otherwise `undefined`. The outcome is ignored. It is called on every error path and after success.
- **T3 — counter** (2403–2416). `updateFn`: `(atual||0)+1`. If the transaction errors or does not commit, the lock is released and an error is shown. A failure later on can leave a gap in the numbering, which is accepted.
- **T4 — acquire the cycle lock** (2668–2682). Same logic as T1, on the group's `ciclos/criacaoCicloEmAndamento`. It protects against two members of the same group clicking Continue on the Decision at the same time.
  - On abort or error: `cb('lock-ocupado' | err)`. The caller (5248–5262) shows "decisão salva, mas não consegui abrir o próximo ciclo" and shows the Map.
  - On commit: re-read `ciclos/atual` (#19) and the previous cycle (#21), then the atomic update #22.
  - Numbering comes from `previous.numero + 1` and is gap-free, so no counter is needed.
- **T5 — release the cycle lock** (2687–2692). Token-checked, like T2. It is called after #22 whether #22 succeeded or failed (2788).

NestJS equivalents: T1 and T2 become a compare-and-set on the turma document (`findOneAndUpdate({_id, atual: expected}, …)` inside a Mongo transaction). T3 becomes `$inc`. T4/T5 plus #22 become a single transactional compare-and-set on `ciclos.atual`. The locks and client clocks then disappear.

### 2.2 Realtime listeners (`.on('value')`)

| Line | Path | Who listens | What re-renders |
|---|---|---|---|
| 1939 | `execucoes/<exec>` (whole: all groups, all data, all cycles) | **Conductor**: admin, or facilitator with a team link to this turma (`_souConduzoDestaTurma`) | Updates `_exec` and `_grupo`/`_dados`. Calls `render()` **except** while editing an etapa (`_grupoId && !_vendoMapa`), unless `revelado` just changed (1978–1980). So it live-refreshes group selection (group names, member counts), the **Mapa da Aposta while "Projetar"-ing a group** (the facilitator sees a group advance live) and the reveal. The facilitator panel modal does **not** redraw on echoes; it reads `_exec.grupos` only on open or after an action. If `v` is null it shows "sem execução". |
| 1995 | `<exec>/missao` | **Participant** | Sets `_exec.missao` only. No render; the value is used at the next navigation to etapa 1 (1996–1999). |
| 2005 | `<exec>/revelado` | Participant | Renders if not editing, or if the reveal just happened (2007–2011). This drives the "reveal" moment, which appears on every group's Map at once. |
| 2016 | `<exec>/grupos-resumo` | Participant | Renders only while the participant has not chosen a group (2021). Groups appear live as the facilitator creates them, and `qtdMembros` updates live. |
| 2048 | `<exec>/grupos/<myGroup>` | Participant (after the group is known) | The first snapshot is the entry: sets `_etapaAtual` and renders. Later snapshots are suppressed while editing and render only on the Map (2061–2065). |

The participant's `atual` pointer is read with `once` (1908), not `on`. A participant waiting on "A dinâmica ainda não começou" is told "Assim que a facilitadora abrir a dinâmica, ela aparece aqui" (2243), but in fact has to close and reopen. The same applies after "Iniciar nova execução": participants keep listening to the old execution's `missao`/`revelado`/`grupos-resumo`, and their own writes to it start failing because the execution is now `encerrada`.

---

## 3. Authorization matrix for `apostas/<turma>` (from database.rules.json:191–316)

### 3.1 Role predicates

`K` is the rules' key derivation, `auth.token.email.toLowerCase().replace('@','_').replace('.','_')`. In RTDB rules, `replace()` replaces **all** occurrences.

| Name | Exact condition |
|---|---|
| PREVI | `auth != null && auth.token.email.matches(/.*@previ\.com\.br/)`. Every apostas rule starts with this. The regex has no `$`, and `email_verified` is not checked. Use an anchored check in the guard. |
| SUPER | email is `tatianefdirene@previ.com.br` or `danielfrazao@previ.com.br` (hardcoded; also `ADMIN` in auth.js:8) |
| ADMIN | `SUPER || fa-admins/<K> exists` |
| FAC_TURMA | `fa-facilitadores/<K> exists && turmas-equipe/<turma>/<K> exists`. Both are required. Any `papel` (`responsavel` or `facilitador`) counts. `fa-facilitadores.ativo` is ignored. |
| CONDUTOR | `ADMIN || FAC_TURMA` |
| CONFIRMADA | `turmas-interesse/<turma>/<K>/status === 'inscrito' && …/confirmedByAdmin exists && …/removed !== true` |
| ATUAL(exec) | `$execKey === apostas/<turma>/atual` |
| ABERTA(exec) | `apostas/<turma>/execucoes/<exec>/status !== 'encerrada'`, evaluated on the **pre-write** state. Legacy executions with no `status` count as open. |
| MEMBRO(g) | `…/execucoes/<exec>/grupos/<g>/membros/<K>` exists in the **pre-write** state |
| SEM_CICLOS(g) | `…/grupos/<g>/ciclos/atual` does not exist (pre-write) |
| CICLO_ATUAL(c) | `$cicloId === …/grupos/<g>/ciclos/atual` (pre-write) |
| CICLO_ABERTO(c) | `…/ciclos/porId/<c>/status !== 'FINALIZADO'` (pre-write) |

"Participante confirmado" in the task maps to CONFIRMADA. "Membro do grupo" maps to MEMBRO. RTDB permissions cascade and cannot be revoked lower down, so a read granted on `execucoes` gives CONDUTOR read on everything underneath it. There are **no `.validate` rules** anywhere in `apostas`, so no types, enums or required fields are enforced.

### 3.2 Matrix (the root `apostas` and `apostas/<turma>` nodes deny read and write)

| Path under `apostas/<turma>/` | Read | Write | Extra constraints (rules line) |
|---|---|---|---|
| `atual` | CONDUTOR or CONFIRMADA | CONDUTOR | No validation that the target exists or is active (197–200). |
| `criacaoExecucaoEmAndamento` | CONDUTOR | CONDUTOR | Free content (201–204). |
| `contadorExecucoes` | CONDUTOR | CONDUTOR | Free content (205–208). |
| `execucoes` (collection) | CONDUTOR (cascades to everything below) | denied | (209–211) |
| `execucoes/<exec>` (whole node) | CONDUTOR | CONDUTOR, **create only** (`!data.exists()`) | Whatever is in the creation payload is accepted, including `grupos`. `numero`, `criadaEm`, `criadaPor*`, `turmaKey`, `turmaLabel` and `eventoKey` are immutable afterwards because they have no child rule (212–214). |
| `<exec>/status`, `encerrada`, `encerradaEm`, `encerradaPor`, `encerradaPorNome` | (CONDUTOR via cascade) | CONDUTOR and ABERTA | So these can be written only while not yet `'encerrada'`; once `status='encerrada'`, **nobody, not even SUPER, can reopen or rewrite them**. The values themselves are not validated (215–229). |
| `<exec>/missao` | CONDUTOR, or CONFIRMADA and ATUAL | CONDUTOR and ABERTA | (230–233) |
| `<exec>/revelado` | CONDUTOR, or CONFIRMADA and ATUAL | CONDUTOR and ABERTA | (234–237) |
| `<exec>/grupos-resumo` | CONDUTOR, or CONFIRMADA and ATUAL | denied at this level | (238–240) |
| `grupos-resumo/<g>` | (as above) | CONDUTOR and ABERTA and **create only**, and `newData.nome === post-write grupos/<g>/nome`. Plus either (a) the group does not exist pre-write (it is created in the same update) and `qtdMembros === 0`, or (b) the group already existed pre-write (backfill of a legacy group) and `qtdMembros >= 0`. | (241–242). A summary can never be overwritten once it exists. |
| `grupos-resumo/<g>/qtdMembros` | (as above) | PREVI and ABERTA and **CONFIRMADA** (CONDUTOR does not appear here). If already MEMBRO pre-write, the value must be unchanged. Otherwise it must be `data + 1` **and** the post-write `grupos/<g>/membros/<K>` must exist. | (243–244). The invariant is "+1 exactly, in the same write that adds **your own** member key". It does not recount children. Admins and facilitators cannot correct the count. |
| `<exec>/grupos` (collection) | CONDUTOR only (cascade) | denied | (248–249) |
| `grupos/<g>` (whole subtree) | CONDUTOR, or **MEMBRO(g) in any execution, current or past** (CONFIRMADA not required) | CONDUTOR and ABERTA and **create only** | (250–252). Historical reads of your own group are intended (test S5, teste-rules.js:412–419). |
| `grupos/<g>/membros` (collection) | (CONDUTOR or MEMBRO via cascade) | denied | (253–254) |
| `grupos/<g>/membros/<m>` | also CONFIRMADA and ATUAL and `m === K` (your own key only, for discovery) | ABERTA and (CONDUTOR with any key and content, **or** `m === K` and `newData.email === auth.token.email`) | (255–257). **CONFIRMADA is not required for self-join**, see §3.3. |
| `grupos/<g>/etapa` | (cascade) | ABERTA and SEM_CICLOS and (CONDUTOR or MEMBRO) | Legacy path frozen once cycles exist (260–262). |
| `grupos/<g>/dados/<etapaId>` | (cascade) | ABERTA and SEM_CICLOS and (CONDUTOR or MEMBRO) | (263–267) |
| `grupos/<g>/atualizadoEm`, `atualizadoPorNome` | (cascade) | ABERTA and (CONDUTOR or MEMBRO) | (269–274) |
| `grupos/<g>/ciclos` (collection) | (cascade) | denied | (275–276) |
| `ciclos/atual` | (cascade) | ABERTA and (CONDUTOR or MEMBRO) | **No validation of the target** (277–279). |
| `ciclos/criacaoCicloEmAndamento` | (cascade) | ABERTA and (CONDUTOR or MEMBRO) | (280–282) |
| `ciclos/porId` | (cascade) | denied | (283–284) |
| `ciclos/porId/<c>` (whole node) | (cascade) | ABERTA and (CONDUTOR or MEMBRO) and **create only** | (285–286) |
| `porId/<c>/status`, `finalizadoEm` | (cascade) | ABERTA and (CONDUTOR or MEMBRO) and CICLO_ABERTO(c) | Applies to **any** non-finalized cycle, not only the current one. A FINALIZADO cycle can never go back (287–292). |
| `porId/<c>/etapa`, `herdadas`, `pontoDeReinicio`, `dados/<etapaId>` | (cascade) | ABERTA and (CONDUTOR or MEMBRO) and CICLO_ATUAL(c) and CICLO_ABERTO(c) | (293–305). Only the current, open cycle is editable. |

What each role can do, in plain language:
- **SUPER and ADMIN** are equivalent here. They can read and write everything above in every turma, and they are still blocked by the execution-closed and cycle-finalized immutability.
- **Turma facilitator** has the same rights as ADMIN, but only in turmas where both flags hold. A global flag alone, or a team link alone, is denied (teste-rules.js:224–234).
- **Confirmed participant** can:
  - read `atual`;
  - read `missao`, `revelado` and `grupos-resumo` of the **current** execution;
  - probe their own member key in any group of the current execution;
  - join a group (member key plus `qtdMembros` +1);
  - never read the execution or the group collection wholesale.
- **Group member** can:
  - read the whole group, including in past executions;
  - write group data, progress and cycles while the execution is open;
  - create cycles and finalize non-finalized cycles.
- An **@previ email with no link** gets nothing (teste-rules.js:273–276).

Multi-path `update()` is all-or-nothing, and each path is checked against pre-write `root`/`data` and post-write `newData` (tested at teste-rules.js:805–841). The three atomic updates (#16, #22, #24) are accepted as written by the client (teste-rules.js:330–340, 350–363, 545–559, 686–699).

### 3.3 Gaps and nuances to decide on when re-implementing the guards

1. **The role inputs can be forged under the current rules.**
   - `turmas-interesse/<turma>/<user>` is writable by **any @previ user** (rules 125–133), so anyone can make themselves CONFIRMADA in any turma.
   - `turmas-equipe/<turma>` is writable by any @previ user (61–66), so anyone already in `fa-facilitadores` can make themselves FAC_TURMA in any turma.
   - `turmas/<turma>` is writable by any @previ user (104–109), including `apostaHabilitada` and `responsavelFacilitadorKey`.
   - The apostas rules are only as strong as these nodes. In NestJS these writes must themselves be admin-only.
2. **`apostaHabilitada` is enforced only in the client** (aposta.js:1728, 1776). The rules ignore it, so a confirmed participant can use the dynamic even when the turma is not released.
3. **Self-join does not require CONFIRMADA.** `membros/<ownKey>` is writable by any @previ user in any open execution, including a non-current or legacy one without `status`, as long as it is written **without** `qtdMembros`. Only the `qtdMembros` path requires CONFIRMADA. After joining, that person is MEMBRO and can read and write the group. The identity test writes the member key alone (teste-rules.js:151) and there is no negative test for a non-confirmed user.
4. **Removed or unconfirmed participants stay members.** MEMBRO rights never re-check CONFIRMADA, so a participant later marked `removed` keeps writing their group.
5. **Legacy executions without `status` count as open forever** unless they are closed through the new flow, and their groups stay writable by members.
6. **No server-side enforcement** of "only one `ativa` execution", "`atual` points to an existing, active execution", "`ciclos/atual` points to an existing, open cycle", "one group per participant" (a user could self-add to several groups), or of value shapes and enums (`status`, `decisao`, …).
7. **Key derivation mismatch.** The client `emailKey()` also strips `[^a-z0-9_]` and truncates to 64 characters (aposta.js:95–97, roteiro.js:102–104). The rules only lowercase and replace `@` and `.`. Emails containing `-`, `+` and similar characters get different keys, so FAC_TURMA, MEMBRO and self-join fail for them. `roteiros-evento`/`eventos` look up `fa-admins` **without** `toLowerCase` (rules 71, 90). Pick one key function for the new user IDs.
8. **Deleting a turma** (admin.js:3236–3250) removes `turmas-equipe` and `turmas-roteiro` but **not `apostas/<turma>`**, which is left orphaned.
9. **Admins and facilitators cannot fix `qtdMembros`.** No rule lets them rewrite it after creation, and there is no "leave group" operation anywhere.

---

## 4. roteiro.js

### 4.1 Data model

The header documents the model at roteiro.js:13–59; writes are confirmed below.

```
roteiros-evento/<eventoKey>/
  dias/<diaKey>        = { ordem: number (steps of 10), titulo: string, createdAt: ISO }              (441–449)
  atividades/<atvKey>  = {                                                                            (460–471)
      diaKey, ordem: number, paiKey?: atvKey (makes it a sub-step; one level only),
      titulo (required), tipo (free label; 'Intervalo' is the only type with meaning in calculations),
      sessao (free text, e.g. 'Manhã'), horaInicio 'HH:MM', horaFim 'HH:MM', duracaoMinutos: number,
      objetivo, resultadoEsperado, passoAPasso, dicasFacilitador, promptIA, conexaoAgilidade,
      preparacaoPrevia, observacoes      — sanitized rich HTML strings (sanitizarHtmlRico, 117–160)
      materiais: [HTML string]           — array → RTDB object with numeric keys
      createdAt, updatedAt: ISO
      legacy orphan fields: descricao, perguntasDebrief (26–27); may also hold Markdown text from migrations
  }
  _migracoesBackup     — historical only; no longer written (2694–2699) but may exist in data

turmas-roteiro/<turmaKey>/
  customizacoes/<baseAtvKey> = { <only the fields that differ from the base>, removida?: true, updatedAt }   (562–582)
  exclusivas/<atvKey>        = same shape as a base activity + diaKey (+ paiKey for turma-only sub-steps); normally no `ordem` (584–592)
  facilitacao/<atvKey>       = { principal: facKey | '', apoio: [facKey] }    (key may be a base or an exclusive activity) (603–606)

turmas-equipe/<turmaKey>/<facKey> = { email, name, papel: 'responsavel' | 'facilitador', addedAt: ISO }
      (632–646; the header also mentions `addedBy`, but nothing writes it)
turmas/<turmaKey>/responsavelFacilitadorKey = facKey    (written with the team in 634 and 650)
roteiro-tipos-atividade/<key> = { nome, createdAt }     (read here at 744; written in admin.js:6264–6371)
```

Turma fields used when merging and printing: `turma.eventoKey`, `turma.dias` (array of 'YYYY-MM-DD'), `turma.label`, `turma.resultadoEsperado`.

### 4.2 Every DB operation

| Line(s) | Path | Operation | Purpose |
|---|---|---|---|
| 410 | `roteiros-evento/<ev>` | `once` | Loads the base script (editor reload and effective merge). |
| 442–443 | `…/dias` | `push()` + `set` | New day. |
| 448 | `…/dias/<d>/titulo` | `set` | Rename a day. |
| 454 | root, multi-path | `update` (nulls) | Delete a day and all its activities, then clean orphans (527). |
| 461–466 | `…/atividades` | `push()` + `set` | New activity or sub-step (`paiKey`). Callers: 3312, 3404. |
| 470 | `…/atividades/<k>` | `update` (merge) | Edit an activity. Also called in loops by the schedule recalculation (3129), the parent `horaFim` update (3390), the import at 2031 and the migration at 2703; **each is a separate, non-atomic write**. |
| 480 | root, multi-path | `update` (nulls) | Delete an activity and its children, then clean orphans. |
| 493 | root, multi-path | `update` | Swap `ordem` of two siblings (up/down). |
| 500–516 | `…/atividades` | `push()` + `set`, then one `push()` + `set` per child | Duplicate. Non-atomic; child-copy errors are ignored. |
| 529 | `turmas-roteiro` (**all turmas**) | `once` | Orphan cleanup scan. |
| 540 | root, multi-path | `update` (nulls) | Drops `customizacoes/<k>` and `facilitacao/<k>` in every turma. Errors are ignored. Exclusive activities whose `paiKey` pointed at the deleted base activity are **not** cleaned. |
| 549 | `turmas-roteiro/<t>` | `once` | Loads the turma customization. |
| 571 / 574 | `…/customizacoes/<k>` | `remove` when the diff is empty / `set(diff)` | "Editar apenas nesta turma". |
| 577 | `…/customizacoes/<k>` | `remove` | Restore base. |
| 580 | `…/customizacoes/<k>` | `update({removida:true, updatedAt})` | Remove from this turma. |
| 585–587 | `…/exclusivas` | `push()` + `set` | Turma-only activity or sub-step. |
| 590 | `…/exclusivas/<k>` | `update` | Edit an exclusive activity. |
| 601 | root, multi-path | `update` (nulls) | Delete an exclusive activity, its children and their `facilitacao`. |
| 604 | `…/facilitacao/<k>` | `set` | Main and support facilitators for an activity. |
| 613 | `turmas-equipe/<t>` | `once` | Team list, sorted with the responsável first. |
| 629 | `turmas-equipe` (all) | `once` | Used by aposta.js and admin. |
| 641 | root, multi-path | `update` | Set the responsável: `turmas/<t>/responsavelFacilitadorKey` plus the new team entry, and demote the previous responsável to `facilitador`. |
| 644 | `turmas-equipe/<t>/<fac>` | `set` | Add a support facilitator. |
| 651 | root, multi-path | `update` (nulls) | Remove a team member, and clear `responsavelFacilitadorKey` if they were the responsável. |
| 744 | `roteiro-tipos-atividade` | **`on('value')`, never turned off** | Keeps the in-memory `TIPOS` list live; started on the first roteiro load (741–751). |
| 3264 | `…/atividades/<k>/ordem` | `set` × N | "Ordenar por horário"; separate writes. |

Every write in the UI goes through `ok(cb)` (397–402), which shows an alert on error. The exceptions are the orphan cleanup, duplicate-children writes and the migration writes, and the admin equipe callers ignore errors too (admin.js:3662–3688).

### 4.3 Merge algorithm: base plus customization gives the effective script

The merge is `carregarRoteiroEfetivoTurma`, roteiro.js:666–707.

1. Read `roteiros-evento/<turma.eventoKey>`. Build `dias` sorted by `ordem` and a flat list of `atividades` (410–419).
2. Read `turmas-roteiro/<turma.key>` to get `customizacoes`, the `exclusivas` list and `facilitacao` (549–556).
3. For each base day `dia`, at index `i`:
   1. `atividadesBase` is the base activities with `diaKey === dia.key` (top level and children), sorted by `ordem`.
   2. For each base activity `a`, take `c = customizacoes[a.key]`:
      - If `c.removida`, push `a` to `removidas` and skip it.
      - Otherwise build `efetiva = {...a, ...c}` (shallow; a customized field replaces the base field, and `c.updatedAt` wins too).
      - Annotate it with `key`, `_status` ('alterada' if `c` exists, otherwise 'padrao'), `_facilitacao = facilitacao[a.key] || null` and `_base = a`.
   3. Add every exclusive activity with `diaKey === dia.key` as `_status: 'exclusiva'`, with its `_facilitacao`.
   4. `todas` is all of the above. `topo` is the entries without `paiKey`. Each `topo` entry gets `_filhos`, the entries of `todas` whose `paiKey` is its key, sorted by `ordem`. Children of a removed parent simply do not appear, and children never nest more than one level.
   5. Sort `topo` by `horaInicio`: activities with a time come first, compared as 'HH:MM' strings. Missing times and ties fall back to `ordem`; exclusive activities have no `ordem`, so they count as 0.
   6. Emit `{key, ordem, titulo, numero: i+1, data: sorted(turma.dias)[i] || '', atividades: topo, todasEfetivas: todas, removidas}`.
4. Exclusive activities whose `diaKey` does not match any base day are silently dropped. Customizations that point at deleted base activities are ignored, and cleaned up when the base activity is deleted.
5. Write side: `customizarAtividade` diffs the form values against `a._base`, **not** against the effective activity. It then does `set(diff)` (replacing any earlier customization, including `removida`), or `remove()` when nothing differs. Because only changed fields are stored, later base edits still show through for fields the turma never touched (559–575).
6. The day metrics are derived with the same pure functions for base and turma: `duracaoEfetiva` (a parent's duration is the sum of its children), `somaPausas` (counts leaf activities of type 'Intervalo'), `calcularResumoDia` (window, gaps, overlaps) and `agruparPorSessao`. Session grouping uses the manual `sessao` field if any activity has it; otherwise a gap of 90 minutes or more starts a new session (`LIMIAR_SESSAO_AUTO_MIN`, 1096). These live at 1039–1158.

**Can it stay in the client?** Yes. The merge is a deterministic pure function of two documents plus `turma.dias`, with no secrets or cross-user data, so it can stay in the browser unchanged. If the backend returns the two raw documents, only the data-loading functions change.

Optionally, a `GET /turmas/:id/roteiro-efetivo` endpoint would save a round trip and allow server-side filtering, but it is not required. What **must** move to the server is the write authorization, plus two things that are client-only today:
- re-sanitizing the rich-HTML fields, because the rules do no validation;
- the "exactly one responsável" rule. Today it is only kept by `definirResponsavel` demoting the previous responsável; nothing prevents two `papel:'responsavel'` entries.

### 4.4 Who may edit what: client code vs rules

| Resource | Client (UI) | Rules today |
|---|---|---|
| Base script `roteiros-evento/<ev>` (days, activities, order, duplicate, import and migrations) | Only the admin panel (`admin.js:3700–3720` → `renderRoteiroBaseEditor`; route `#admin` is admin-only) | Read: any PREVI. Write: SUPER or `fa-admins/<email with @ and . replaced, **no lowercase**>` (rules 68–73) |
| Turma script `turmas-roteiro/<t>`: customize, remove, restore, exclusive activities and sub-steps, `facilitacao` | Admin: always `editable:true` (admin.js:3744–3745). Facilitator: `editable` only if their `turmas-equipe` papel is `'responsavel'` (facilitador.js:158–161); a support facilitator gets read-only view. Facilitation selects appear only when editable and the team is non-empty (3693). | **Any PREVI user can read and write any turma** (rules 80–85). The UI restriction is not enforced. |
| Team `turmas-equipe/<t>` and `turmas/<t>/responsavelFacilitadorKey` | Admin panel only (`openEquipeModal`, admin.js:3590–3700) | Any PREVI user can write (rules 61–66, 104–109) |
| `roteiro-tipos-atividade` | Admin tab only | Any PREVI user can read and write (rules 75–78) |
| Read of a turma's effective script | Admin, and any team member (responsável or support) through `#facilitador` | Any PREVI user |

For NestJS, the natural guards are:
- base script: admin;
- turma script and `facilitacao`: admin or the turma's responsável;
- team and activity types: admin;
- read: admin or team member (or any authenticated user, if today's behavior should be kept).

---

## 5. Realtime requirements

**Genuine push needs.** These are live classroom moments on phones, where the value is seeing the change within seconds.

1. **Reveal (`revelado`)**, facilitator to every participant (aposta.js:2005, 1942/1979). It is *the* moment of the dynamic and flips every group's Map at once. Push is needed, e.g. a WebSocket room per `turma:exec`.
2. **Group discovery (`grupos-resumo`)** while participants sit on "Escolha seu grupo" (2016–2021). Groups created by the facilitator should appear, and `qtdMembros` should tick up. Push is preferable; polling every 3–5 seconds would be acceptable.
3. **Facilitator watching groups advance.** The conductor's whole-execution listener (1939) re-renders the group picker and, above all, the **Mapa da Aposta of a "Projetar"-ed group** as that group saves (autosave every 600 ms). Push is needed. Today this ships the **entire execution (all groups, all data) on every keystroke-save of any group**. A NestJS gateway should emit granular events such as `grupo:updated {grupoId, etapa, dados-diff}` to conductors of that turma and to members of that group.
4. **Same-group multi-device sync** (2048). This is weak today: echoes are ignored while editing, so it only shows on the Map, and only the first snapshot matters for entry. It is nice to have; polling or refetch on navigation would reproduce current behavior.
5. **New execution started (`atual`)** is **not** live today (read once at 1908). Participants waiting on "A dinâmica ainda não começou" or on an old execution are not updated. Pushing an `execucao:nova` event would fix a real UX gap in the migration.

**Push not needed** (fetch once or refresh on action):
- `missao` (participant; never triggers a render, 1995);
- eligibility reads (`turmas`, `turmas-interesse`, `turmas-equipe`; 1726, 1777, 162). Replace them with `GET /me/apostas/turmas-elegiveis` instead of downloading all enrollments;
- the facilitator panel modal (it redraws only after its own actions);
- the execution history (`once` by design, 6875–6878);
- CSV export;
- the whole roteiro module: base editor and turma view both use `once` plus explicit `reload()` after each write, and nothing else listens;
- `roteiro-tipos-atividade`. It is the only `on()` in roteiro.js (744), is never detached, and only feeds a `<select>` for new activities; fetch it when the form opens.

**Server-side atomic operations** that are not realtime but must replace RTDB transactions and multi-path updates:
- `POST execucoes` (CAS on `atual`, `$inc` counter, close the previous execution, all in one transaction);
- `POST grupos` (group plus summary);
- `POST grupos/:g/membros` (add self plus recount, idempotent);
- `PUT dados/:etapa` (including the inherited-etapa cascade at 5324–5344);
- `POST ciclos` (CAS on `ciclos.atual`, freeze Cycle 1, finalize the previous cycle, create the next with inherited data from `montarDadosNovoCiclo`, 2645–2666);
- `PATCH ciclos/:c/finalizar`.

The client-side locks, tokens and `LOCK_EXPIRA_MS` go away once these are server transactions.
