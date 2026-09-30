> **Anexo B4 — inventário bruto (material de apoio).** Levantamento feito lendo o código na íntegra, no commit `c38cfe0` (merge da PR #244). Os números de linha valem para esse commit; se o arquivo mudar, localize pelo nome da função/trecho citado. Escopo: módulo "Arquitetura" (avaliação de produto/squad, motores, questionários) e CI/CD + scripts de operação. **Escrito em inglês** (levantamento técnico original).
> Os documentos 01-12 já consolidam o que importa daqui; use este anexo para conferir detalhes, achar a linha exata de uma chamada ao Firebase ou checar se nada ficou de fora ao adaptar/testar uma tela.

---

# Inventory: "Arquitetura" admin module + CI/CD and ops scripts

Repo: `/home/user/forca-agil` (read-only inspection, 2026-09-30). All line numbers refer to the files as they are on disk today.

---

# AREA 1: "Arquitetura" admin module

## 1.0 Files, load order and entry points

| File | Lines | Global | Role |
|---|---|---|---|
| `forca-agil/questionarios-config.js` | 442 | `window.faQuestionarios` | Editorial content of the questions (P1–P16, S1–S8): versioning, draft, audit |
| `forca-agil/motor-arquitetura.js` | 674 | `window.faMotorArquitetura` | Declarative rule engine P1–P16 → camada; governance of `motor-arquitetura-config` |
| `forca-agil/avaliacao-produto.js` | 4104 | `window.faInitAvaliacaoProduto` | "Arquitetura" tab UI: evaluations CRUD, decision, reprocessing, PDF/Excel, config screens for questionnaires and the arch motor |
| `forca-agil/motor-squad.js` | 679 | `window.faMotorSquad` | Declarative rule engine S1–S8 → two axes + indication; governance of `motor-squad-config` |
| `forca-agil/avaliacao-squad.js` | 1456 | `window.faInitAvaliacaoSquad`, `window.faAvaliacaoSquad` | Squad evaluation UI, reprocessing, PDF, config screens for the squad motor |

- Loaded in `index.html:1769-1773` in this order: questionarios-config → motor-arquitetura → avaliacao-produto → motor-squad → avaliacao-squad.
- Initialized from `forca-agil/admin.js:128-129` (`faInitAvaliacaoProduto()`, then `faInitAvaliacaoSquad()`).
- Every module defines its own `function db() { return firebase.database(); }`: questionarios-config.js:50, motor-arquitetura.js:77, motor-squad.js:115, avaliacao-produto.js:336, avaliacao-squad.js:96.
- Node-name constants:
  - `questionarios-config.js:47-48`: `NODE_CONFIG='questionarios-config'`, `NODE_AUDITORIA='questionarios-auditoria'`
  - `motor-arquitetura.js:68-69`: `NODE_CONFIG='motor-arquitetura-config'`, `NODE_AUDITORIA='motor-arquitetura-auditoria'`
  - `motor-squad.js:112-113`: `NODE_CONFIG='motor-squad-config'`, `NODE_AUDITORIA='motor-squad-auditoria'`
  - `avaliacao-produto.js:97`: `NODE='avaliacoes-produto'`
  - `avaliacao-squad.js:91-92`: `NODE='avaliacoes-squad'`, `NODE_ARQUITETURA='avaliacoes-produto'`
- Security rules (`database.rules.json:384-420`): all 8 nodes (`avaliacoes-produto`, `avaliacoes-squad`, `questionarios-config`, `questionarios-auditoria`, `motor-squad-config`, `motor-squad-auditoria`, `motor-arquitetura-config`, `motor-arquitetura-auditoria`) use the same `.read`/`.write` expression: the 2 hardcoded super-admin e-mails OR `fa-admins/<email with first '@' and first '.' replaced by '_'>` exists. There is **no `.validate`**: no schema, no append-only rule on the audit nodes, and nothing enforces version monotonicity. The comments say "audit never deletable" (e.g. motor-squad.js header, questionarios-config.js:36-37), but that holds only because the app has no delete code. Any admin can overwrite or delete audit entries directly. **The backend must enforce append-only audit and admin-only access.**
- Identity in every audit/author field (`usuario`, `publicadoPor`, `atualizadoPor`, `criadoPor`, `responsavel`, `alteradoPor`, `excluidoPor`) comes from the client: `sessaoAtual()` = `{name, email}` from `window.faAuth.getSession()` (avaliacao-produto.js:287-290, avaliacao-squad.js:107-110). **The server must derive it from the token, not trust the payload.**
- Timestamps are client-side `new Date().toISOString()` everywhere, never `ServerValue.TIMESTAMP`. The server should stamp them.

---

## 1.1 Complete DB-operation inventory

Legend: `on` = realtime listener (`ref.on('value')`); `once` = single read; `set` = full replace; `update` = merge (multi-path when keys contain `/`); `tx` = `transaction()`; `push().key` = client-generated push ID without a write.

### questionarios-config.js

| Line | Path | Op | Purpose |
|---|---|---|---|
| 249 | `questionarios-config/<codigo>` | `on('value')` | One listener per questionnaire code (lazy, `garantirSync` 246-253); fills `cache[codigo]`; fans out to `listeners[codigo]` |
| 301 | `questionarios-config/<codigo>/rascunho` | `set` | `salvarRascunho`: `{perguntas, atualizadoEm, atualizadoPor}` (last writer wins) |
| 308 | `questionarios-config/<codigo>/rascunho` | `remove` | `descartarRascunho` |
| 355 | `questionarios-auditoria/<codigo>` | `push().key` | Generates audit keys |
| 364 | root | multi-path `update` | `publicarConteudo` (342-367), atomic: `versaoPublicada`, `versoes/<n+1>`, `rascunho=null`, `nome`, plus N audit entries (one per changed field per question). **No compare-and-swap**: `novaVersao = versaoAtual(cache)+1`, so two concurrent publishes both write `versoes/<n+1>` and the last writer wins. |
| 407 | `questionarios-auditoria/<codigo>` | `once('value')` | `auditoria(codigo, cb)` (sorted desc by `dataHora` client-side) |

Callers: avaliacao-produto.js:1898 (auditoria), 2034 (salvarRascunho), 2057 (salvarRascunho, fire-and-forget) and **2058 (publicarPerguntas, sent in parallel with the draft save at 2057; the draft write and the publish that nulls `rascunho` race each other)**, and 2115 (publicarVersaoAnterior). `onMudanca`: avaliacao-produto.js:4046-4047 and avaliacao-squad.js:1424.

### motor-arquitetura.js (motor-squad.js is structurally identical; its line numbers are in brackets)

| Line [squad] | Path | Op | Purpose |
|---|---|---|---|
| 371 [382] | `motor-*-config` | `on('value')` | Single listener (`garantirSync`), whole config doc in `cache`. It only starts after the first `onMudanca()` call. |
| 414 [432] | `motor-*-config/rascunho` | `set` | `salvarRascunhoRegras`: `{regras, atualizadoEm, atualizadoPor, versaoBase}` (last writer wins) |
| 424 [442] | `motor-*-config/rascunho` | `remove` | `descartarRascunhoRegras` |
| 468/472 [488/492] | root → `motor-*-auditoria/<push>` | `push().key` + `update` | `registrarConflitoPublicacao` (audit type `conflito_publicacao`) |
| 528 [530] | `motor-*-config` | **`transaction`** | `publicarRegras` (see 1.4) |
| 560/564 [562/566] | root → `motor-*-auditoria/<push>` | `update` | Audit `sem_alteracao` after a committed no-op |
| 571/578 [573/580] | root → `motor-*-auditoria/<push>…` | multi-path `update` | Audit `regra` entries (one per changed rule) after a committed publish. **This is a separate write after the transaction, so publish and audit are NOT atomic.** |
| 609-622 [617-631] | root → `motor-*-config/textos/<cod>` + `motor-*-auditoria/<push>` | multi-path `update` (atomic) | `salvarTextos`: text changes and their `texto` audit entries in one write. No CAS (compares against the cache). |
| 638 [646] | `motor-*-auditoria` | `once('value')` | `auditoria(cb)` |

Callers:
- **Arch motor**, from avaliacao-produto.js: 2430-2431 (iniciarOuObterRascunhoRegras/versaoBaseDoRascunho), 2446 (auditoria), 2517 (salvarRascunhoRegras with `c.versaoBase`), 2525 (validarRegras), 2528 (simular), 2579 (publicarRegras, **called without `versaoBase`**, so it falls back to the cached `versaoAtual()`), 2624/2642 (descartar), 2633-2634 (diffRegras), 2708 (salvarTextos), 2766 (publicarVersaoAnterior), 4055 (onMudanca), and in the domain wrapper 476-477 (regrasDaVersao + identificarCamada), 3189/3825 (versaoAtual stamped on the evaluation), 3747 (precisaReprocessar).
- **Squad motor**, from avaliacao-squad.js: 1161 (salvarRascunhoRegras), 1170 (simular), 1214 (publicarRegras, also without `versaoBase`), 1253/1271 (descartar), 1255-1256 (rascunho/versaoBase), 1262-1263 (diffRegras), 1346 (salvarTextos), 1386-1387 (listarVersoes/versaoAtual), 1404 (publicarVersaoAnterior), 1427 (onMudanca), 629-634 (interpretarComMotorAtual), 698-700 (precisaReprocessarMotorSquad).

### avaliacao-produto.js (`avaliacoes-produto`)

| Line | Path | Op | Purpose |
|---|---|---|---|
| 3117 | `avaliacoes-produto` | `push().key` | Reserve the key before writing, so a retry after a timeout reuses it (idempotent retry) |
| 3192/3202 | `avaliacoes-produto/<key>` | **`set` (full replace)** | `salvarRegistro(status)` (3110-3214): save a draft or conclude; also used for new evaluations, reavaliação (new key) and duplicar. 12 s client timeout (3197-3201). |
| 2185 | `avaliacoes-produto/<key>` | `update` | `alternarBloqueioReprocessamento`: `{bloqueadaParaReprocessamentoAutomatico: bool}` |
| 2311 | `avaliacoes-produto/<key>` | `update` | Soft delete (`abrirModalExcluir`, updates at 2292-2298): `{excluido:true, excluidoEm, excluidoPor, justificativaExclusao, atualizadoEm}` |
| 2339 | `avaliacoes-produto/<key>` | `update` | `restaurarItem`: excluido fields → false/null, `atualizadoEm` |
| 3636 | `avaliacoes-produto/<key>` | `update` | `salvarDecisao` (3596-3654): `{atualizadoEm, decisaoConfirmada:true, decisaoFinal, decisaoManual, justificativaDecisao, alteradoPor, alteradoEm}` |
| 3697 | `avaliacoes-produto/<key>` | `update` with deep keys | `salvarEspecializacaoCadastrada` (3666-3721): `{especializacaoCadastrada, papelEstruturalCadastrado, 'camadaSugerida/especializacao', 'camadaSugerida/papelEstrutural', atualizadoEm}` (relative multi-path update inside one record) |
| 3860 | `avaliacoes-produto/<key>` | `update` | `reprocessarMotor` (single, 3842-3880): the result of `construirAtualizacaoReprocessamento` |
| 4024 | `avaliacoes-produto/<key>` (one per item) | `update` | `executarReprocessamentoEmLote` (3984-4039): **NOT atomic**. It is a client-side queue with `CONCORRENCIA = 3` workers (3996), one independent `update()` per item; a failure is recorded per item and never rolls back the others. |
| 4058 | `avaliacoes-produto` | `on('value')` | Loads the whole collection into memory (`state.itens`), sorted by `atualizadoEm` desc. `PERMISSION_DENIED` is mapped to `erroCarga='permissao'` (4074). |

There are no deletes: removal is a soft delete. Lists, filters, the trash view (`lixeira`), version chains, the "has a newer version" check (`temVersaoMaisNova` 1746), simulation input and exports are all computed client-side from the full in-memory collection.

### avaliacao-squad.js (`avaliacoes-squad`)

| Line | Path | Op | Purpose |
|---|---|---|---|
| 384 | `avaliacoes-produto/<avaliacaoArquiteturalId>` | `once('value')` | Read-only architectural context (camada label, resultadoAutomatico) |
| 639 | `avaliacoes-squad` | `push().key` | Reserve the key |
| 671/678 | `avaliacoes-squad/<key>` | **`set` (full replace)** | `salvarRegistro('rascunho'|'concluido')` (636-696), 12 s timeout |
| 741 | `avaliacoes-squad/<key>` | `update` | `reprocessarMotorSquad` (726-761) |
| 1430 | `avaliacoes-squad` | `on('value')` | Whole collection |
| 1445 | `avaliacoes-produto` | `on('value')` | Whole arch collection, used only for item search (a second listener on the same node as produto:4058) |

Squad has **no delete/restore UI**. `salvarRegistro` always writes `excluido:false, excluidoEm:null, excluidoPor:null, justificativaExclusao:null` (657), and readers filter `!it.excluido` (213, 224, 236, 279, 1169).

---

## 1.2 Document shape: `avaliacoes-produto/<key>`

Key: Firebase push ID (chronological, 20 chars). It is referenced by other docs (`itemId`, `versaoAnteriorKey`, `avaliacoes-squad.avaliacaoArquiteturalId`) and by the deep link `#admin?avp=<key>` (1316-1332). **Keep keys as string `_id`s, not ObjectIds.**

Written by `salvarRegistro` (3118-3190). A full `set()` means any field missing from the payload is erased, including `bloqueadaParaReprocessamentoAutomatico`, `reprocessedAt`, `reprocessedFromVersion` and the `excluido*` fields. Editing is only offered for `status==='rascunho'` (2141-2143); concluded items are reevaluated under a new key instead.

```
{
  nome: string (trimmed), descricao: string, publico: string, necessidade: string, observacoesGerais: string,
  especializacaoCadastrada: string|null,           // free-text registration metadata
  papelEstruturalCadastrado: 'essencial'|'opcional'|null,  // normalizarPapelEstrutural 294-297
  respostas: {                                      // keyed by INTERNAL id (not P-code):
    <necessidade|resultado|solucao|fronteira|autonomia|jornada|medicao|gestao|
     canal|artefato|capacidade|processo|modalidade|regra|componente|funcionalidade>: {
       valor: 'sim'|'nao',
       justificativaAuto: string,          // = conteudo.justSim/justNao of that version ("Interpretação do sistema")
       observacao: string,                  // user text
       codigoPergunta: 'P1'..'P16',
       textoPerguntaNaEpoca: string,        // snapshot at answer time
       tituloNaEpoca: string|null,
       questionnaireContentVersion: number
    } },                                    // built on click, 2943-2951; id↔code map CRITERIOS/EXCLUSOES 115-136
  questionnaireContentVersion: number,     // fixed when the evaluation starts (novoBtn 1610, reavaliação 1829, duplicar 1855)
  status: 'rascunho'|'concluido',
  itemId: string,                           // key of version 1 (a.itemId || key)
  versao: number,                           // 1, +1 on each reavaliação (1822)
  versaoAnteriorKey: string|null,           // key of the version this one re-evaluates (1821)
  responsavel: {name,email}, criadoEm: ISO, atualizadoEm: ISO,
  // computed only when status==='concluido' (3181-3191), null in rascunho:
  resultadoAutomatico: 'produto'|'nao-produto'|'a-validar'|null,
  criteriosEssenciaisFalhos: [criterioId]|null,
  exclusoesConflitantes: [exclusaoId]|null,
  criteriosAtendidos: number|null,
  camadaSugerida: { id, label, motivos:[string], conflito:[label]|null, incoerencia:bool,
                    especializacao:string|null, papelEstrutural:string|null, relacao:string|null } | null,  // computeResultado 641-670
  justificativaAutomatica: string|null,     // gerarJustificativaAutomatica 672-737
  decisaoFinal: same enum as resultadoAutomatico|null (= resultadoAutomatico on conclusion),
  decisaoManual: bool (false), decisaoConfirmada: bool (false),
  justificativaDecisao: string|null, alteradoPor: {name,email}|null, alteradoEm: ISO|null,
  motorVersion: string|null,                // code constant MOTOR_VERSION = '2026.09.29-2' (line 236)
  motorVersionArquitetura: number|null,     // faMotorArquitetura.versaoAtual() at conclusion
  historicoMotor: null,                     // reset on every set()
  // added later by update():
  bloqueadaParaReprocessamentoAutomatico: bool,           // 2185
  excluido: bool, excluidoEm: ISO|null, excluidoPor:{name,email}|null, justificativaExclusao: string|null, // 2292-2297 / 2338
  reprocessedAt: ISO, reprocessedFromVersion: string|null  // 3826-3827
}
```

**Reprocessing update** (`construirAtualizacaoReprocessamento`, 3795-3840; a pure function whose only side effect is reading the current motor/content versions):

```
{ resultadoAutomatico, criteriosEssenciaisFalhos, exclusoesConflitantes, criteriosAtendidos, camadaSugerida,
  justificativaAutomatica,
  respostas: recalcularInterpretacoesRespostas(...),   // 3765-3787: recomputes justificativaAuto/textoPerguntaNaEpoca/tituloNaEpoca
                                                       // from the evaluation's OWN questionnaireContentVersion; valor/observacao copied
  motorVersion: MOTOR_VERSION, motorVersionArquitetura: faMotorArquitetura.versaoAtual(),
  reprocessedAt: now, reprocessedFromVersion: a.motorVersion||null,
  historicoMotor: (a.historicoMotor||[]).concat([{ motorVersion, motorVersionArquitetura, resultadoAutomatico,
                    camadaSugerida, justificativaAutomatica, respostas /* full copy */, processadoEm: a.atualizadoEm||a.criadoEm }]),
  atualizadoEm: now,
  decisaoFinal: calc.resultadoAutomatico     // ONLY if !a.decisaoManual
}
```

- `precisaReprocessar(it)` (3745-3748): `status==='concluido' && (motorVersion !== MOTOR_VERSION || motorVersionArquitetura !== faMotorArquitetura.versaoAtual())`.
- `elegivelParaReprocessamentoEmLote` (3754-3756) also requires `!bloqueadaParaReprocessamentoAutomatico`. The individual button ignores the block.
- `historicoMotor` is appended with read-modify-write on the client copy. Two concurrent reprocesses (two tabs, or single plus batch) can drop an entry. On the server this should be `$push` plus a version guard, e.g. filter `{_id, motorVersion: <old>, motorVersionArquitetura: <old>}`.

**Version chain:** reavaliação clones the item, deletes `_key`, sets `itemId = it.itemId||it._key`, `versaoAnteriorKey = it._key`, `versao+1`, the current `questionnaireContentVersion`, resets `criadoEm`/`responsavel`/`excluido*` (1814-1846), and is saved as a new key. `temVersaoMaisNova(key)` scans for any doc with `versaoAnteriorKey === key` (1746). The history modal walks the chain (`abrirHistorico` 2204). Suggested Mongo indexes: `{itemId:1, versao:1}` and `{versaoAnteriorKey:1}`.

## 1.3 Document shape: `avaliacoes-squad/<key>` (salvarRegistro 636-696)

```
{
  itemId: string,                    // arch itemId, or own key when there is no arch link
  itemNome: string (trimmed),
  avaliacaoArquiteturalId: string|null,
  questionarioCodigo: 'ADEQUACAO_SQUAD',
  questionnaireContentVersion: number,  // fixed at start (335)
  status: 'rascunho'|'concluido',
  criadoEm, atualizadoEm, dataConclusao: ISO|null,
  criadoPor: {name,email}, atualizadoPor: {name,email},
  respostas: { S1..S8: { codigoPergunta, tituloNaEpoca, textoPerguntaNaEpoca, resposta:'sim'|'nao',
                         justificativaUsuario, questionnaireContentVersion, dataResposta: ISO } },  // 531-539
  excluido:false, excluidoEm:null, excluidoPor:null, justificativaExclusao:null,   // always reset by set()
  motorSquadVersion: number|null,   // only on concluido
  necessidadeCapacidadeDedicada: 'DEMONSTRADA'|'PARCIALMENTE_DEMONSTRADA'|'NAO_DEMONSTRADA'|'INDETERMINADO'|null,
  condicoesParaSquad: 'PRESENTES'|'PARCIAIS'|'LIMITADAS_PELA_AUTONOMIA'|'INDETERMINADO'|null,
  indicacaoOrganizacional: one of 5 C-codes | 'INDETERMINADO' | null,
  evidenciasFavoraveis: ['S1'..]|null, pontosADesenvolver: ['S1'..]|null,
  historicoMotorSquad: [ {motorSquadVersion, necessidadeCapacidadeDedicada, condicoesParaSquad,
                          indicacaoOrganizacional, evidenciasFavoraveis, pontosADesenvolver, processadoEm} ],
  resultadoAutomatico:null, justificativaResultado:null, decisaoFinal:null, formaDecisao:null,   // reserved
  // reprocess update (701-724, written at 741):
  reprocessedAt: ISO, reprocessedFromVersion: number|null
}
```

- Dedupe rule: never two `rascunho` docs for the same `itemId` (`buscarEmAndamentoPorItemId` 235-237, `iniciarOuAbrirParaItem` 366-371). It is client-enforced only. **The server should enforce it**, for example with a partial unique index on `{itemId}` where `status:'rascunho', excluido:false`.
- Reprocessing condition: `status==='concluido' && motorSquadVersion !== faMotorSquad.versaoAtual()` (698-700).
- Squad docs have no `bloqueadaParaReprocessamentoAutomatico` field and there is no batch reprocessing.
- `set()` resets `historicoMotorSquad` to `a.historicoMotorSquad || []` (the value from the client copy) and wipes `reprocessedAt`/`reprocessedFromVersion` unless they are in the client object. After a successful save, `Object.assign(a, payload)` keeps the client copy in sync (688).

## 1.4 Config and audit documents

### `questionarios-config/<codigo>` (codigo ∈ `CLASSIFICACAO_ARQUITETURAL`, `ADEQUACAO_SQUAD`; header 18-32)

```
{ nome, descricao?,                         // nome rewritten on each publish (352); descricao only from PADRAO (never written)
  versaoPublicada: number,                  // absent ⇒ 1
  versoes: { "<n>": { perguntas:[...], publicadoEm: ISO, publicadoPor:{name,email}|null } },  // v1 is NEVER written; factory PADRAO (57-230) is the fallback
  rascunho: { perguntas:[...], atualizadoEm, atualizadoPor } | null }
```

- Each entry of `perguntas[]` has `codigoEstavel` (immutable) plus editorial fields `CAMPOS_EDITORIAVEIS` (line 55): `titulo, texto, textoAjuda {significado, quandoSim, quandoNao}, exemplo, exemplos[], ajudaExtra, justSim, justNao, observacaoAdministrativa`.
- `diffPerguntas` (315-327) compares only those fields, iterating over the new side only (a removed question is not detected).

### `questionarios-auditoria/<codigo>/<pushKey>` (356-361)

`{ pergunta: 'P5', campo, valorAnterior, valorNovo, usuario:{name,email}|null, dataHora: ISO, versaoAnterior: n, novaVersao: n+1 }`. One entry per changed field. Values can be strings or objects (for example `textoAjuda`), stored raw, **not** JSON-stringified.

### `motor-arquitetura-config` and `motor-squad-config` (single documents)

```
{ versaoPublicada: number,                              // absent ⇒ 1
  versoes: { "<n>": { regras, publicadoEm: ISO, publicadoPor: {name,email}|null } },  // v1 never written; PADRAO_REGRAS is the fallback
  rascunho: { regras, atualizadoEm: ISO, atualizadoPor, versaoBase: number } | null,
  textos: { <codigo>: {...} } }
```

- **Arch** `regras` is an array of `{codigo, ordem, resultado (camada id), incoerencia:bool, conflito:[camadaId]|null, motivos:['P..'], condicoes}`. There are 13 factory rules, `INCOERENCIA`(0) … `FALLBACK_A_VALIDAR`(12) (motor-arquitetura.js:81-145). `textos` holds `{ <camadaId>: {rotulo} }` (PADRAO_TEXTOS 151-163).
- **Squad** `regras` is an object `{eixoA:[…A1-A3], eixoB:[…B1-B3], combinacao:[…C1-C5]}` of `{codigo, ordem, resultado, condicoes}` (motor-squad.js:124-~175). `textos` holds `{ <codigoVeredito>: {rotulo, interpretacao} }` (PADRAO_TEXTOS ~178-202).
- `condicoes` grammar is `{all:[…]}|{any:[…]}|{not:…}|{equals:…}|{campo|pergunta, valor|resposta}`. It is data, never evaluated as code.
- Note that `regrasDaVersao()` returns `{regras:[…]}` for arch (379-383) but the bare regras object for squad (395-402).

### `motor-*-auditoria/<pushKey>` (all fields present, nulls explicit in the payload but dropped by RTDB)

| tipo | Fields | Written at arch [squad] |
|---|---|---|
| `regra` | `campo` (rule code), `valorAnterior`/`valorNovo` (**JSON.stringify of the original rule object**, `null` stringified as "null" for add/remove), `usuario`, `dataHora`, `versaoAnterior` (= baseEsperada), `novaVersao` (= server's final versaoPublicada). Squad audit rows don't record the `grupo` (eixoA/B/combinacao) even though `diffRegras` returns it. | 572-576 [574-578] |
| `texto` | `campo` (camada/veredito code), `valorAnterior`/`valorNovo` (JSON strings), `usuario`, `dataHora`, `versaoAnterior = novaVersao = versaoAtual()` | 616-620 [624-629] |
| `sem_alteracao` | `campo/valorAnterior/valorNovo: null`, `usuario`, `dataHora`, `versaoAnterior = novaVersao = server version` | 560-563 [562-565] |
| `conflito_publicacao` | `campo/valorAnterior/valorNovo: null`, `usuario`, `dataHora`, `versaoBase`, `versaoAtual` (server), `origem: 'tentativa_noop'|'tentativa_publicacao'` (diagnostic from the local cache only) | 468-471 [488-491] |

---

## 1.5 The two `transaction()` calls: `publicarRegras` (compare-and-swap to reproduce in Mongo)

These are `motor-arquitetura.js:514-583` and `motor-squad.js:524-587`. The logic is identical, except that arch validates first and the squad engine does not (see below).

**Before the transaction:**

1. **Arch only:** `validarRegras({regras})` (515-516). If it returns errors, `cb('validacao', erros)` and nothing is written. **Squad has no `validarRegras` at all** (the export list at motor-squad.js:653-677 has none, and publicarRegras 524-587 does not validate). A malformed squad config can therefore be published and makes `executarRegras` return `'INDETERMINADO'` (232-239). The backend should add validation.
2. `baseEsperada = versaoBase ?? versaoAtual()` (cached). Both UI call sites (produto:2579, squad:1214) omit `versaoBase`, so in practice the base is the **cached version at click time**, not `rascunho.versaoBase`. The draft's `versaoBase` is carried in `state.configMotores.versaoBase` / `c.versaoBase` but not passed to publish. Only `salvarRascunhoRegras` receives it. `publicarVersaoAnterior` passes `versaoAtual()` explicitly (588-592 [592-596]).
3. `pareciaNoOpLocalmente = diffRegras(cachedRules, regras).length === 0`. This is only used as the `origem` label of a conflict audit.

**`transaction(updateFn)` on the WHOLE config node** (it includes versoes history, textos and rascunho). `updateFn(atual)`:

```
cfg = atual || {}
versaoServidor = cfg.versaoPublicada || 1
regrasVigentes = cfg.versoes[versaoServidor].regras || PADRAO_REGRAS(.regras)
alteradasReais = diffRegras(regrasVigentes, regras)           // semantic diff, see 1.6
if (alteradasReais empty):                                     // NO-OP: always commits, regardless of base
    return {...cfg, versaoPublicada: versaoServidor, rascunho: null}
if (versaoServidor !== baseEsperada): return undefined          // ABORT → conflict
return {...cfg, versaoPublicada: versaoServidor+1,
        versoes: {...cfg.versoes, [versaoServidor+1]: {regras, publicadoEm: agora, publicadoPor: usuario}},
        rascunho: null}
```

**onComplete(err, committed, snapshot):**

- `err` → `cb(err)`.
- `!committed` → `registrarConflitoPublicacao(baseEsperada, snapshot.versaoPublicada, usuario, origem)`, then `cb('conflito', {versaoBase, versaoAtual})`. The draft is kept. The UI then shows the conflict screen with reload, compare or discard (produto:2607-2650, squad:1236-1300).
- `committed && eraNoOp` → a separate `update` writes the `sem_alteracao` audit, then `cb(errAud, {novaVersao: v, alteradas: [], semMudanca: true})`.
- `committed` with a real change → a separate multi-path `update` writes N `regra` audit entries, then `cb(errAud, {novaVersao, alteradas})`.

**Firebase semantics to preserve:**

- `updateFn` may run several times (optimistic retry against the server value). The closure variables `alteradasReais`/`eraNoOp` hold the result of the **last** run, which is the committed one.
- The config write and the audit write are **two separate operations**. If the audit write fails, the version is already published. In Mongo, use a multi-document transaction (a replica set is required, even single-node) or put the audit inside the same document write.

**MongoDB equivalent (sketch):**

```
loop (bounded retries):
  doc = findOne({_id:'arquitetura'})                // or squad
  v = doc?.versaoPublicada ?? 1
  vigentes = doc?.versoes?.[v]?.regras ?? PADRAO
  diff = diffRegras(vigentes, regras)               // same pure function, shared server-side
  if diff empty:
     r = updateOne({_id, versaoPublicada: v /* or $exists:false when v==1 */}, {$set:{versaoPublicada:v}, $unset:{rascunho:1}}, {upsert: v==1 && !doc})
  else if v !== base: → write conflito_publicacao audit; return 409 {versaoBase: base, versaoAtual: v}
  else:
     r = updateOne({_id, versaoPublicada: v /* or missing */},
                   {$set:{versaoPublicada:v+1, ['versoes.'+(v+1)]:{regras,publicadoEm,publicadoPor}}, $unset:{rascunho:1}})
  if r.matchedCount==1: write audit (same session/transaction) and return
  // else someone changed versaoPublicada between read and write → retry (this mirrors the Firebase transaction retry)
```

- The guard field is `versaoPublicada`. Because the no-op path also re-reads and re-diffs against the current server value, "a no-op that became a real change" is handled correctly (this is the case `teste-motor-noop-atomico.js` covers).
- The initial state has no doc or no `versaoPublicada`, which means version 1 = PADRAO. Either seed `versoes.1 = PADRAO` and `versaoPublicada = 1` at migration time, or handle `$exists:false`.
- Rollback (`publicarVersaoAnterior`) = publish the rules of `versoes[n]` (or PADRAO when n=1) as a new version, with base = current version.

**Other writes that need CAS on the server** (today they have none):

- `questionarios` publish (`novaVersao = cached+1`).
- `salvarTextos` (compares against the cache and writes audit rows; concurrent edits race).
- `salvarRascunho*` (last writer wins on the draft; `versaoBase` is preserved from the cache, not the server).

## 1.6 Pure/deterministic logic vs what must move to the server

**Pure (no Firebase, no DOM). It can stay in the browser for preview and UX, and should ALSO be a shared module on the server (same code, e.g. a small ES module imported by both):**

- `motor-arquitetura.js`: `normalizarValor` 172, `avaliarCondicao` 173-183, `executarRegras` 184-190, `ordenarChavesProfundo` 214-223, `normalizarCondicaoParaComparacao` 230-252, `normalizarRegraParaComparacao` 257-267, `identificarCamada(respostasPorCodigo, regrasConfig)` 277-286, `validarRegras`/`validarCondicao` 325-358 (exhaustive 2^16 = 65536-combination fallback check at 350-355), `diffRegras` 439-457.
  - `simular` (296-318) is pure except that it reads `versaoAtual()`/`regrasDaVersao()` from the cache.
- `motor-squad.js`: same helpers (211-300), `construirContextoPerguntas` 303-310, `identificarAdequacaoSquad` 318-344, `diffRegras` 459-481, `simular` 353-368.
- `questionarios-config.js`: `diffPerguntas` 315-327, `perguntasDaVersao`/`conteudoPergunta` fallbacks (270-284, which depend on the `PADRAO` factory content).
- `avaliacao-produto.js`:
  - Domain wrapper `identificarCamada(atual)` (449-489; it converts internal ids to P-codes and then calls the motor).
  - `relacaoArquitetural` 496, `motivoJustificativa` 551, `interpretacaoSistema` 617, `computeResultado` 641-670, `gerarJustificativaAutomatica` 672-737.
  - `recalcularInterpretacoesRespostas` 3765-3787, `construirAtualizacaoReprocessamento` 3795-3840, `precisaReprocessar` 3745.
  - `calcularAlteracoesReavaliacao` 755.
  - Taxonomy constants `CRITERIOS`/`EXCLUSOES`/`CAMADAS`/`RESULTADO_POR_CAMADA`/`MOTOR_VERSION`/`ROTULOS_SINAL` (115-265), plus `ID_POR_CODIGO`, `CAMADAS_COM_ESPECIALIZACAO` and `CAMADAS_COM_PAPEL_ESTRUTURAL` (around 340-440).
- `avaliacao-squad.js`: `interpretarComMotorAtual` 629-634, `construirAtualizacaoReprocessamentoSquad` 701-724.

**Must move to the server for integrity:**

1. **Publishing rules** (`publicarRegras`, both motors): CAS on `versaoPublicada`, the semantic no-op diff against the server value, and `validarRegras` executed server-side (also add it for squad). Write audit rows atomically with the publish.
2. **Publishing questionnaire content** (`publicarConteudo`): server-assigned `novaVersao` with CAS; audit rows atomic with it.
3. **Saving texts** (`salvarTextos`): compute the diff against server state; atomic with its audit.
4. **Concluding an evaluation**: today the client computes `resultadoAutomatico`, `camadaSugerida`, `justificativaAutomatica`, `motorVersion`, `motorVersionArquitetura`, `motorSquadVersion`, both squad axes and `indicacaoOrganizacional`, then `set()`s them. A client can therefore write any "automatic" result. The server should compute these from `respostas` plus the published rules plus `MOTOR_VERSION`, or at least recompute and verify.
   - If the server computes them, the server also needs the prose generators and the questionnaire content (for `justificativaAuto`), because `motorVersion` versions prose too (comment at 212-235).
5. **Reprocessing** (single and batch): the server should compute the update and append to `historicoMotor` / `historicoMotorSquad` atomically (`$push` + version guard), respect `bloqueadaParaReprocessamentoAutomatico` for the batch, and preserve `decisaoFinal` when `decisaoManual`. A server-side batch endpoint or job replaces the 3-worker client loop.
6. **Soft delete / restore / decision / especialização / bloqueio**: plain partial updates. The server must set `excluidoPor`/`alteradoPor`/`atualizadoEm` from the auth context and validate the enums (`decisaoFinal` ∈ `produto|nao-produto|a-validar`; `papelEstrutural` ∈ `essencial|opcional|null`).
   - Especialização also recomputes `camadaSugerida.especializacao`/`papelEstrutural` from stored `respostas` (3677-3680). The server can do that.
7. **Draft-per-item uniqueness** for squad (`itemId`, status rascunho).
8. **Audit append-only** for all audit collections, with identity taken from the token.
9. **Key reservation**: the `push().key` before `set()` makes retries idempotent. With Mongo, generate the id client-side (UUID/ULID) or use a server `POST` that returns an id plus an idempotency key, so a retry after a 12 s timeout doesn't duplicate.

**Realtime dependence:** every screen re-renders from `on('value')` on the whole collection and config nodes (produto:4058, squad:1430/1445; motors 371/382; questionarios 249). The `onMudanca` listeners are how the motor version becomes visible (the comment at avaliacao-produto.js:4048-4054 says that without it `versaoAtual()` stays at 1). After migration there are three options:
- fetch on screen open plus after each write, or
- SSE/WebSocket change streams (Mongo change streams also need a replica set), or
- polling.

In every case "not yet loaded" must stay distinct from version 1. Today `versaoAtual()` returns 1 while the cache is null.

## 1.7 PDF / Excel export (purely client-side, read-only)

- The libraries are vendored locally and lazy-loaded with `carregarScript` (avaliacao-produto.js:795-808, avaliacao-squad.js:157-167). Comment at produto:784-794.
  - `forca-agil/html2pdf.bundle.min.js` (html2pdf.js).
  - `forca-agil/xlsx.mini.min.js` (SheetJS 0.18.5 "mini").
- Produto PDF: `gerarPdf(itens, nomeArquivo, cbFim)` 1012-~1100. It builds HTML (`montarDocumentoPdf` 975, sections 853-975), measures after `toContainer()`, uses A4 with 186 mm width, and adds page numbers. `nomeArquivoPdf` 820.
- Produto Excel: `gerarExcel(itensExportados, todosOsItens, nome, cb)` 1188-1212. It has 3 sheets:
  - "Resumo": `linhaResumoExcel` 1109, columns `EXCEL_COLS_RESUMO` around 1095-1108.
  - "Respostas do questionário": 1131-1150.
  - "Histórico": `linhasHistoricoExcel` 1158-1176, which needs **all** items to build the version chains.
  - Callers: `executarExportacaoExcel` 1678 and `executarExportacaoPdfLista` 1693.
- Squad PDF: `gerarPdf(it, cb)` 956-1000, with `montarDocumentoPdfSquad` 897.
- These use only already-persisted data, so they need no server change beyond read endpoints that return complete documents (including `historicoMotor` and `respostas`) and the full item set for the history sheet.
- CSP note: the libraries are served from `'self'`, so they are not affected. `firebase.json`'s CSP (`script-src 'self' https://www.gstatic.com; connect-src ... *.firebaseio.com wss://*.firebaseio.com *.googleapis.com`) must be rewritten for the new API origin.

## 1.8 Migration notes specific to data shape (RTDB → Mongo)

- RTDB drops `null` fields and empty objects/arrays. Code everywhere treats a missing field, `null` and `{}` alike (`a.respostas || {}`, `it.historicoMotor || []`), so imported docs will lack many of the "null" fields written by `set()`.
- RTDB stores arrays as objects with numeric keys when sparse. `historicoMotor`, `regras` and `motivos` should be normalized to arrays on import.
- `versoes` is keyed by numeric strings ("2", "3"…). Mongo accepts that (`versoes.2`), but consider an array or a separate collection (`motor_versoes {motor, n, regras, publicadoEm, publicadoPor}`) for easier querying.
- Candidate collections:
  - `avaliacoesProduto`
  - `avaliacoesSquad`
  - `questionariosConfig` (`_id` = codigo)
  - `questionariosAuditoria` (`codigo` field)
  - `motorConfig` (`_id` ∈ `arquitetura`, `squad`)
  - `motorAuditoria` (`motor` field)
- Indexes:
  - `avaliacoesProduto`: `{itemId, versao}`, `{versaoAnteriorKey}`, `{status, excluido}`, `{atualizadoEm:-1}`.
  - `avaliacoesSquad`: `{itemId, status}`.
  - Audit collections: `{dataHora:-1}`.
- The file `check-motor-arquitetura-equivalencia.js`, cited in comments (motor-arquitetura.js:19, avaliacao-produto.js:445), **does not exist in the repo**, so there is no committed equivalence test between the legacy and the declarative engine.

---

# AREA 2: CI/CD workflows and ops scripts

## 2.1 Workflows (`.github/workflows/`)

| File | Trigger | What it does | Secrets / permissions |
|---|---|---|---|
| `firebase-deploy.yml` (23 lines) | push `main` | Writes the SA JSON to `/tmp/sa.json`, sets `GOOGLE_APPLICATION_CREDENTIALS`, runs `npx firebase-tools@13 deploy --only hosting,database --project kyber-agil` (deploys the site and `database.rules.json`) | `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL` |
| `firebase-preview.yml` (23) | push `v2` | `hosting:channel:deploy v2-preview --expires 30d` | same |
| `firebase-preview-v3.yml` (35) | push `v3-quiz` | `hosting:channel:deploy v3quiz --expires 30d`, greps the URL into `PREVIEW_URL_V3.txt`, commits "[skip ci]" and pushes | same, plus `permissions: contents: write` (GITHUB_TOKEN) |
| `teste-rules.yml` (42) | PR → `main`/`v2`/`v3-quiz`; push to stale branch `claude/campo-direita-navegacao-rl6h3k` | Installs `firebase-tools@13` and `@firebase/rules-unit-testing` in `/tmp/rules-deps`, runs `firebase emulators:exec --only database --project demo-kyber-agil-rules-test "node .github/scripts/teste-rules.js"` against the **real RTDB emulator** | none |
| `testes-automaticos.yml` (396) | PR → `main`/`v2`/`v3-quiz` | Installs Playwright 1.56.1 and Chromium in `/tmp/pw-deps`, serves the repo with `python3 -m http.server 8811`, then runs in sequence (see 2.4): `teste-consistencia-docs.js` (no browser), about 28 hermetic Playwright scripts using `firebase-falso.js`, and finally `run-testes-automaticos.js` against **production Firebase**. Uploads `testes-automaticos-erro.png` on failure. | `FA_TEST_ADMIN_EMAIL`, `FA_TEST_ADMIN_PASSWORD` (only the last step). `FA_TEST_MEMBER_EMAIL`/`PASSWORD` are read by the script but **not passed** by the workflow, so the member-denial check is skipped. |
| `audit-facilitadores-turmas.yml` (31) | `workflow_dispatch` + push touching its own script/yml | `node .github/scripts/audit-facilitadores-turmas.js` (read-only) | `FA_TEST_ADMIN_EMAIL/PASSWORD` |
| `backfill-grupos-resumo.yml` (32) | `workflow_dispatch` only, boolean input `confirmar` (default false) | `node .github/scripts/backfill-grupos-resumo.js` with `BACKFILL_CONFIRMAR=sim|nao` (dry-run by default) | `FA_TEST_ADMIN_EMAIL/PASSWORD` |
| `diagnostico-execucao-vazamento-grupo.yml` (32) | `workflow_dispatch` + push touching its own files | `node .github/scripts/diagnostico-execucao-vazamento-grupo.js` (read-only) | `FA_TEST_ADMIN_EMAIL/PASSWORD` |

All jobs run on `ubuntu-latest` with Node 20.

Not wired into any workflow: `.github/scripts/teste-rotulos-doc.js` (it checks that button/label strings quoted in the docs exist in the UI).

Secrets summary:
- `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL` (3 deploy workflows).
- `FA_TEST_ADMIN_EMAIL` / `FA_TEST_ADMIN_PASSWORD` (4 workflows). The test admin is `teste_admin@previ.com.br` according to the pre-publicacao skill.
- Implicit `GITHUB_TOKEN` (v3 preview commit).

Hardcoded in the scripts (not secrets):
- The Firebase Web API key `AIzaSyAmnQTedd2eqL0d-3kMD2oWNeg0rwP6Lx0` (same as `forca-agil/firebase.js:8`).
- `DB_URL = https://kyber-agil-default-rtdb.firebaseio.com`.

After the migration, the deploy workflows become something like build and push Docker images (static front plus NestJS), then deploy to the internal Linux host (runner with SSH, self-hosted runner, or registry pull). "Database rules" deployment disappears; its replacement is NestJS guards shipped with the API, plus Mongo migrations/index creation.

## 2.2 Ops scripts and what they do to data

**None of the scripts uses `firebase-admin` or a service account.** The only service-account use in the repo is `firebase-tools` deploy in the three hosting workflows (`grep firebase-admin|serviceAccount|GOOGLE_APPLICATION_CREDENTIALS` hits only those three yml files). All three ops scripts:
- authenticate as the **test admin end-user** via REST (`POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>`), then
- call the RTDB REST API with `?auth=<idToken>`, so they are **subject to the Security Rules**.

They have zero npm dependencies (Node `https` only) and write the report to `GITHUB_STEP_SUMMARY`.

| Script | Reads | Writes | Purpose |
|---|---|---|---|
| `audit-facilitadores-turmas.js` (234) | `fa-facilitadores`, `turmas-equipe`, `turmas`, `fa-users` (93-98); per turma `apostas/<t>/atual` and `apostas/<t>/execucoes/<atual>` (107-113), because `GET /apostas.json` is denied even for admin | **nothing** | Markdown report: active global facilitators, links in turmas-equipe with roles, turmas with `apostaHabilitada`, facilitators who can open an Aposta without a turma link, e-mail format anomalies (dots/hyphens/uppercase in the local part, for the rules' emailKey derivation), groups in current executions (the input for the backfill decision) |
| `backfill-grupos-resumo.js` (162) | `turmas`, then per turma `apostas/<t>/atual` and `apostas/<t>/execucoes/<atual>` (115-134) | **Only if `BACKFILL_CONFIRMAR=sim`:** `PATCH apostas/<t>/execucoes/<exec>/grupos-resumo.json` with `{<grupoId>: {nome, qtdMembros}}` for each group of a current execution that has no summary (153-157). Dry-run otherwise. Never touches the group itself or historical executions. | One-off data backfill for Fase 5 (`grupos-resumo` mirror) |
| `diagnostico-execucao-vazamento-grupo.js` (180) | `turmas`, then per turma `apostas/<t>/atual` and `apostas/<t>/execucoes.json` (whole node, 83-98) | **nothing** | Detects a groupId reappearing across executions of the same turma, a group `criadoEm` earlier than the execution's `criadaEm`, and orphan `grupos-resumo` entries |

**As MongoDB maintenance scripts:**
- The two read-only diagnostics become aggregation queries or scripts run with `mongosh`/Node against the `turmas`, `turmasEquipe`, `faFacilitadores`, `faUsers` and `apostas` collections (or an admin API endpoint).
- The backfill becomes an idempotent `updateOne({_id: exec, ['gruposResumo.'+g]: {$exists:false}}, {$set: …})` with dry-run by default.
- They should authenticate with a dedicated maintenance credential or DB user (read-only for diagnostics) instead of an app admin password, and run inside the internal network (for example `docker compose run --rm ops node scripts/...`, a manual `workflow_dispatch` on a self-hosted runner, or a cron job).
- The emailKey derivation (`lowercase`, `[@.]→_`, drop `[^a-z0-9_]`, `slice(0,64)`) is duplicated in these scripts and in the app. Keep it identical if the keys survive the migration.
- Note a discrepancy: the rules' admin check uses `email.replace('@','_').replace('.','_')`, which replaces only the FIRST occurrence of each character, while the app's emailKey replaces all of them.

**`run-testes-automaticos.js`** (804) is not an ops script but touches **production**. It launches Chromium, logs in on the real site served locally (which uses real Auth and RTDB `kyber-agil`) as the test admin, opens `#admin` → Testes tab and clicks "▶ Automáticos" (the in-page suite in `forca-agil/testes.js`), and then runs extra checks:
- all admin tabs visible at 375 px;
- the member cannot reach `#admin` (skipped without member creds);
- avaliação draft save/restore via `localStorage` (it does not submit);
- `#checkin` with an unknown turma;
- logout;
- Minha Área and Turmas rendering;
- "Enviar pedido" validation (does not send);
- and others.

The header (1-9) says it is designed not to write real data. After the migration it needs a **staging** backend (NestJS + Mongo with seeded data and a test admin) instead of production.

## 2.3 `firebase-falso.js`: what it emulates

This file (319 lines) is a fake of the **Firebase compat SDK** (`window.firebase`), configured by `window.__CFG`, which is injected with `addInitScript` before page scripts run.

- **Config inputs** (`__CFG`): `db` (the whole in-memory tree, mutated in place), `user` (`{email}` or absent), `delayDefault`, `delays` (`{pathPrefix: ms}`; 999000 means "never answers"), `fail` (path prefixes that fail with `PERMISSION_DENIED`), `authDelay`, `senhas` (`{email: password}` to enforce passwords), `falharUpdateEmail` (e-mails for which `updateEmail` rejects).
- **Database** (`firebase.database().ref(path)`, 315):
  - `child`, `once(evt, ok, err)` (with a delay; fails when the path prefix is in `fail`; returns a Promise), 42-60.
  - `on` registers the listener, then does a `once`, 61-65. `off` removes it, 66-71.
  - Snapshots support `val/exists/key/forEach` (16-28).
  - `set` (230) and `update` (162-196). `update` supports relative multi-path keys with `/`, atomic fail and delay computed over all touched paths, a merge where `null` deletes, and **notifies listeners before `onComplete`**, which mirrors the SDK's optimistic local events.
  - `remove` (231, immediate).
  - `push(v, cb)` returns a ref whose `.key` is `'fake'+seq` (236-243).
  - **`transaction(updateFn, onComplete)`** (207-229): reads the current value, applies `updateFn`, `undefined` aborts (`onComplete(null,false,snap)`), otherwise writes and calls `onComplete(null,true,snap)`. It is serialized by `setTimeout`, and the comment says this gives the same guarantee as the real SDK for the concurrency tests.
  - `orderByChild/equalTo/limitToLast` are no-op passthroughs. They do **not** filter, so query semantics are not emulated.
  - `ServerValue.TIMESTAMP = 1`.
  - Change propagation: `notificar` wakes every listener on an ancestor or descendant path (129-140).
- **Write log**: every write is appended to `window.__ESCRITAS` as `{path, valor}`; multi-path root updates are split per key (80-92). Tests assert on it and on `window.__CFG.db`.
- **Auth** (`firebase.auth()`, 277-314):
  - `currentUser` and `onAuthStateChanged` (async, `authDelay`).
  - `signInWithEmailAndPassword`, which checks `senhas` when present.
  - `signOut`, `sendPasswordResetEmail`, `createUserWithEmailAndPassword` (stub).
  - The user object has `updateEmail` (it can fail and moves the password entry) and `sendEmailVerification`.
- `initializeApp` just records the config.

## 2.4 How the Playwright tests are wired, and what changes after the migration

**Current pattern** (e.g. `teste-tela-preta.js:31, 98-125`; `teste-motor-concorrencia-publicacao.js:30, 36-58`):

1. `FALSO = fs.readFileSync('firebase-falso.js')`.
2. `page.addInitScript('window.__CFG = ' + JSON.stringify(cfg))` with a seeded db tree (e.g. `fa-admins`, `turmas`, and `avaliacoes-produto`/`motor-*-config` for the motor tests), a user, and delays or failures.
3. `page.route('**/firebasejs/**', r => r.fulfill({body: FALSO, contentType:'text/javascript'}))`. This replaces all three gstatic compat SDK scripts (app/database/auth) with the fake. The "SDK down" scenario is `r.abort()`.
4. Google Fonts are stubbed or aborted.
5. `page.goto('http://127.0.0.1:8811/index.html#admin')`, where the site is served by a static Python server.
6. Tests either drive the UI or call `window.fa*` APIs directly (the motor tests call `window.faMotorArquitetura.publicarRegras(...)` and `window.faMotorSquad...` inside `page.evaluate`). They assert on DOM, on `window.__CFG.db[...]` and on `window.__ESCRITAS`. They run in desktop (1440×900 / 1280×900) and mobile (`devices['Pixel 5']` or iPhone) formats.

**28 of the 32 `teste-*.js` scripts use `firebase-falso.js`.** The exceptions:
- `teste-consistencia-docs.js` and `teste-rotulos-doc.js` (static file analysis);
- `teste-rules.js` (emulator);
- `run-testes-automaticos.js` (production).

The Arquitetura-related hermetic tests are:
- `teste-motor-reprocessamento-badge.js` (a batch reprocess clears the badge; publishing without changes does not re-mark; `historicoMotor` preserved);
- `teste-motor-diffregras-semantica.js` (removal and precedence changes version; texts and no-op do not);
- `teste-motor-normalizacao-semantica.js` (property and all/any order never version);
- `teste-motor-concorrencia-publicacao.js` (a stale base yields a conflict plus a `conflito_publicacao` audit; identical rules yield `semMudanca`; rollback creates a new version);
- `teste-motor-noop-atomico.js` (two `publicarRegras` in the same tick; no-op decided inside the transaction; `origem:'tentativa_noop'`).

**What the migration means for the tests:**

- The intercept point disappears: there will be no `**/firebasejs/**` script to swap. The client will call `fetch`/XHR to the NestJS API (for example `**/api/**`), plus a realtime channel if one is used (SSE `EventSource` or WebSocket) and a new auth flow (a login endpoint issuing JWT/cookies instead of Firebase Auth).
- Tests must then intercept those requests. There are three options:
  1. **Keep a client data-access seam.** Introduce one module (e.g. `forca-agil/api.js` exposing `window.faApi.get/list/patch/...` plus subscribe), and have the tests replace **that script** via `page.route('**/forca-agil/api.js', ...)` with a fake in-memory implementation. This is the closest to today's approach: `__CFG.db`, `__ESCRITAS`, `delays` and `fail` keep working with the same semantics.
  2. **Intercept HTTP** with `page.route('**/api/**', handler)`, where the handler, running in the Node test process, implements the REST contract over an in-memory store with delays and failures. The state then lives in Node, not in `window.__CFG.db`, so every assertion that reads `window.__CFG.db`/`__ESCRITAS` must be rewritten to query the Node-side store. Realtime pushes (today's `on('value')` notifications) need a fake SSE/WebSocket (Playwright's `page.routeWebSocket`, available since 1.48).
  3. **Run the real backend** in CI (a `docker compose` service with NestJS plus `mongo`, or `mongodb-memory-server`, seeded per test) and let Playwright hit it for real. This is the most faithful option. It loses the cheap "never answers / fails at path X" fault injection unless the backend exposes a test fault-injection hook or a proxy is used.
- **Concurrency semantics move server-side.** The fake `transaction()` currently "proves" the CAS logic that runs in the browser. After migration, the compare-and-swap lives in NestJS/Mongo, so `teste-motor-concorrencia-publicacao` and `teste-motor-noop-atomico` should become **backend integration tests** (Jest + mongodb-memory-server with replica set, firing concurrent publish requests). Browser tests would only check that the UI shows the 409 conflict screen.
- The pure semantics tests (diff, normalization, validation) can become plain unit tests of the shared rule module (no browser needed).
- The slow-network and failure scenarios that `CLAUDE.md` demands (`teste-tela-preta.js` with a read that never answers or errors per node, and "auth never answers") must be reproduced at the new boundary. That means per-endpoint delays and failures in whatever fake is chosen, plus the new auth-resolution path.
- `run-testes-automaticos.js` and `testes.js` (the in-panel suite) test "Firebase/Auth availability" and hit production. They must be retargeted to a staging stack and rewritten where they check Firebase-specific things.
- CSP in `firebase.json` and the `.firebaserc`/hosting config go away. The static server used in CI (`python3 -m http.server 8811`) can stay for option 1, or be replaced by the nginx/NestJS static serving that production uses.
- `teste-consistencia-docs.js` parses `database.rules.json` (lines 45, 86-121): it lists nodes, checks that each one is used by code and documented in `mapa.js`, and compares the "N estruturas principais" count. When the rules file disappears, this check needs a new source of truth, such as a list of Mongo collections or the Nest modules.

## 2.5 `teste-rules.js`: what it tests

This file is 851 lines with 115 `anota` checks. It runs under `firebase emulators:exec` with `@firebase/rules-unit-testing` (`initializeTestEnvironment` loading `database.rules.json`, contexts authenticated by email token). It seeds with `withSecurityRulesDisabled`.

**Scope: only the Construção da Aposta (`apostas/`) rules of "Fase 5"**, plus `emailKey` derivation (148-158). It does **not** cover the Arquitetura nodes or most other nodes (the header says it prioritizes security-deciding paths). Covered:

- Participant read scope: can read `apostas/<t>/atual`, `missao` and `revelado`, but **not** the whole execution (171-179).
- Writes to own group only; no cross-turma or cross-group writes; no touching other members, the creation lock, missao or revelado (183-208).
- Facilitator needs **both** the global `fa-facilitadores` flag **and** a `turmas-equipe` link for that turma; admin can do everything (214-242).
- Self-join only with one's own key and e-mail (249-258).
- Isolation between turmas; plain `@previ.com.br` without a link or unauthenticated users are denied (264-276).
- A closed execution is immutable, even for admin; reads still work (284-299).
- A FINALIZADO cycle is immutable; only the current cycle is writable; an atomic close + successor transition is allowed; legacy `dados/<etapa>` is frozen once `ciclos/` exists (318-366).
- S6 legacy executions still work (390-392); S5 historical execution read scoping (413-424).
- `grupos-resumo`:
  - created atomically with the group, with name matching;
  - `qtdMembros` must equal the real member count;
  - backfill allowed only to an authorized facilitator or admin, never overwriting;
  - per-key membership probing;
  - no cross-group reads;
  - fail-closed when the summary is missing (461-654).
- "Start new execution" transition (close old + create new + move `atual` in one atomic update) (699-722):
  - `encerrada*` fields immutable (729-733);
  - unauthorized attempts leave no partial state (758-767);
  - legacy execution closure (797-800);
  - one rejected path fails the whole multi-path update (835-840).

After the migration, this entire suite becomes the spec for **NestJS authorization guards and validation** on the Aposta endpoints. It can be ported one-to-one as API e2e tests (supertest against Nest with Mongo, using the same personas: admin, facilitator with and without link, team member without flag, participants A/A2/B, outsider, anonymous). The atomic multi-path cases map to Mongo transactions.

## 2.6 `.claude/skills/*` (all reference Firebase; all need updating)

| Skill | What it says | Firebase-specific content to rewrite |
|---|---|---|
| `criterio-de-estado/SKILL.md` | Before changing a rule that decides a person or turma state (inscrita, admin, facilitadora, turma aberta/finalizada/encerrada), inventory ALL write paths and ALL readers so they share one criterion. Tells the 14/08→10/09/2026 story (`confirmedByAdmin`; PRs #112/#113). Current inventories: "inscrita" = `!removed && status==='inscrito' && confirmedByAdmin` (write paths in admin.js; readers in auth.js/aluno.js/dashboard.js/avaliacao.js/admin.js; readers that knowingly check only status: checkin.js, game.js, app.js…); "público restrito" (`turmas-publico`, `barradoPeloPublico`/`turmaVisivelPara`); other states; read-readiness flags (`_adminsResolvidos`…, PR #111). | "no schema or validation on the server" and state as loose RTDB fields; the `turmas-interesse` rules accepting any logged-in user's writes (so restriction lives in the UI); `confirmedByAdmin: null` deleting the field (RTDB null semantics). After migration, some of these can become server-side invariants (DTO validation, single service method). |
| `docs-internas/SKILL.md` | After code edits, update the living docs `manual.js`, `mapa.js` and `testes.js` directly when routes, permissions/personas, admin flows, business rules or testable behavior change. | References "integração com Firebase" as testable behavior; `mapa.js` holds the "Firebase Realtime Database: 35 estruturas…" description and "7 regras" of security (cross-checked by `teste-consistencia-docs.js`). Both must be rewritten for Mongo collections and API authorization. |
| `editar-e-salvar/SKILL.md` | A screen is either read-only or real edit-and-save. Whoever can open an edit form must be able to save, which must be checked **in `database.rules.json`**, not just in the UI. Story: `roteiros-evento` and `eventos` (PRs #135/#136). Lists the two admin rule patterns (any real admin = 2 e-mails OR `fa-admins`; super-admins only = the 2 e-mails, used only for `fa-admins`). Always check the Firebase write callback error. | Entirely framed on `.write` rules and Firebase callbacks. After migration: check NestJS guards/roles per endpoint; the two admin patterns become two roles/guards (`AdminGuard`, `SuperAdminGuard`); error handling becomes HTTP status handling (401/403/409/5xx). |
| `pre-publicacao/SKILL.md` | Before push/PR: `node --check` on changed JS, validate `database.rules.json` JSON, sanity-check `index.html`, and run `teste-tela-preta.js` (desktop and mobile, fake Firebase via `page.route('**/firebasejs/**')`). Explains that the full "▶ Automáticos" suite runs only in CI against real Firebase `kyber-agil` (the sandbox proxy blocks gstatic and WebSocket), with `FA_TEST_ADMIN_*` and `teste_admin@previ.com.br`. | Rules JSON validation step, the `**/firebasejs/**` interception recipe, and the "real Firebase, no emulator" statement. After migration: add backend lint/typecheck/unit tests (npm), docker build, the new interception point, and a staging target. |

Also Firebase-bound and outside `.claude/`:
- `CLAUDE.md` (architecture, deploy and working agreements sections all describe Firebase/RTDB/rules/firebase-tools).
- `mapa.js`'s database and security description (line ~627).
- `firebase.json` / `.firebaserc`.
- `forca-agil/firebase.js`.
- `forca-agil/testes.js` (in-panel suite checks Firebase/Auth availability).
