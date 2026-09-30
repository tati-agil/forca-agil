# 03 — Modelo de dados no MongoDB

> Pré-requisitos: [01](01-diagnostico-sistema-atual.md) (os nós e suas chaves) e [02](02-arquitetura-alvo.md) (por que a Fase A mantém os caminhos do Firebase).

---

## 1. Princípios

1. **Um nó de primeiro nível do Firebase = uma coleção do MongoDB.** Nome da coleção = nome do nó com `-` trocado por `_` (`turmas-interesse` → `turmas_interesse`). Previsível para quem implementa e para quem consulta o banco.
2. **As chaves do Firebase são preservadas byte a byte.** `emailKey`, *push keys* (`-NxYz…`), datas `AAAA-MM-DD`, `lista:<eventoKey>`, códigos (`CLASSIFICACAO_ARQUITETURAL`) — todas continuam sendo as chaves. Nada de `ObjectId` na Fase A: dezenas de lugares do site montam caminhos com essas chaves, e links como `#admin?avp=<pushKey>` dependem delas.
3. **Cada coleção tem uma "profundidade de documento"** (quantos segmentos de chave, abaixo do nó, formam **um** documento). Tudo abaixo dessa profundidade fica **dentro** do documento, como subdocumento — exatamente a forma que o Firebase guardaria.
4. **O conteúdo do Firebase fica no campo `v`** do documento; os campos de controle começam com `_`. Assim nenhum nome de campo do site (há chaves como `_migracoesBackup` em `roteiros-evento`) colide com os campos de controle.
5. **Semântica do RTDB preservada**: `null` apaga, objeto vazio não existe, documento cujo `v` fica vazio é **removido** (seção 4).

---

## 2. Chaves

| Tipo de chave | Formato | Onde nasce | Regra na migração |
|---|---|---|---|
| `emailKey` | `email.toLowerCase().replace(/[@.]/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,64)` — ex.: `maria_silva_previ_com_br` | site (`auth.js` l. 28 e cópias em `app.js`, `aluno.js`, `avaliacao.js`, `checkin.js`, `facilitador.js`, `game.js`, `firebase.js`, `admin.js`, `aposta.js`, `roteiro.js`) | Mantida. O backend implementa **a mesma função** (documento 04, seção 5) e **nunca** a variante das regras (`replace('@','_').replace('.','_')`). |
| push key | 20 caracteres `[-0-9A-Za-z_]`, ordenável por tempo (8 de timestamp + 12 aleatórios) | `ref.push()` no navegador | Mantida. O cliente de compatibilidade **gera no navegador com o mesmo algoritmo** (documento 06, seção 3.6). |
| data | `AAAA-MM-DD` | `turmas-checkin/<t>/<data>`, `turmas/<t>/dias[]`, `turmas-config/<t>/diaAtivo` | Mantida como string (não converter para `Date`). |
| origem da fila | `<turmaKey>` \| `lista:<eventoKey>` \| `lista` (legado) | `fa-espera/<emailKey>/<origem>` | Mantida. Contém `:` — permitido em nomes de campo do MongoDB. |
| seedKey | URL em minúsculas, não-alfanuméricos → `_`, 80 caracteres | `repo.js` l. 60-62 | Mantida. |
| códigos | `CLASSIFICACAO_ARQUITETURAL`, `ADEQUACAO_SQUAD`, códigos de camada/veredito | Arquitetura | Mantidos. |

> Nomes de campo do MongoDB não podem conter `.` nem começar com `$`; chaves do Firebase não podem conter `. $ # [ ] /`. Logo **toda chave do Firebase é um nome de campo válido no MongoDB**. Não há necessidade de escapar nada.

---

## 3. Formato do documento ("envelope")

```js
{
  _id:  "t1|maria_silva_previ_com_br",    // segmentos de chave unidos por "|" (nenhuma chave do Firebase contém "|")
  _k:   ["t1", "maria_silva_previ_com_br"],// os mesmos segmentos, em array (para consultas por prefixo)
  _rev: 17,                                // incrementado a CADA escrita no documento
  _em:  ISODate("2026-10-01T12:00:00Z"),   // hora (do servidor) da última escrita
  _por: "tatianefdirene_previ_com_br",     // emailKey de quem fez a última escrita (ou "sistema")
  v: {                                     // o valor que o Firebase guardaria em turmas-interesse/t1/maria_silva_previ_com_br
    name: "MARIA SILVA", email: "maria.silva@previ.com.br", area: "GEROP",
    date: "2026-08-01T10:22:31.000Z", status: "inscrito",
    confirmedByAdmin: "tatianefdirene@previ.com.br", confirmedByAdminName: "TATIANE", confirmedDate: "2026-08-03T09:00:00.000Z"
  }
}
```

- Para coleções de profundidade **0** (documento único), `_id: "_raiz"` e `_k: []`.
- `v` pode ser qualquer JSON, inclusive um valor primitivo (ex.: `fa-seeds-hidden/<seedKey>` = `true` → `{ _id: "<seedKey>", v: true }`).

---

## 4. Normalização "igual ao RTDB" (aplicada em TODA escrita)

Função `normalizarComoRtdb(valor)` no backend, aplicada ao valor de cada escrita **antes** de gravar, e verificação de vazio **depois** de aplicar:

1. `null`/`undefined` em qualquer nível → o campo é **removido** (no nível de caminho: `$unset`).
2. Objeto sem campos (após remover os nulos) → tratado como `null` (removido).
3. Arrays: mantidos como array do MongoDB; elementos `null` **no final** são removidos; elementos `null` no meio são mantidos como `null` (o RTDB devolveria o array com buracos preenchidos por `null` — mesmo resultado na leitura).
4. Números, strings e booleanos: gravados como vieram. **Não** converter strings de data para `Date` (o site compara strings).
5. Marcador de hora do servidor `{".sv": "timestamp"}` (vindo de `ServerValue.TIMESTAMP`) → substituído por `Date.now()` (número, milissegundos).
6. Depois de aplicar a escrita, se o `v` de um documento ficou vazio (`{}`/ausente) → **apagar o documento**.
7. Na leitura, um subobjeto cujas chaves são todas inteiros `0..n` (herança de dados que vieram do Firebase como "array esparso") é devolvido **como veio** — o site já trata os dois formatos.

---

## 5. Tabela de mapeamento (a peça central)

Esta tabela é implementada literalmente em `backend/src/path-mapping/mapa-colecoes.ts`. **Nó que não está na tabela = caminho inválido (400).** Ordem das colunas: nó do Firebase → coleção → profundidade → exemplo de `_id` → índices além do `_id`.

| Nó (Firebase) | Coleção | Prof. | Chaves do documento | Exemplo de `_id` | Índices extras | Observações |
|---|---|---|---|---|---|---|
| `fa-users` | `fa_users` | 1 | emailKey | `maria_silva_previ_com_br` | `{ "v.email": 1 }` | Perfil. **Não confundir** com `usuarios_auth` (credenciais, seção 7). |
| `fa-users-log` | `fa_users_log` | 1 | emailKey | `maria_silva_previ_com_br` | — | Entradas `<pushKey>` dentro de `v`. |
| `fa-admins` | `fa_admins` | 1 | emailKey | | — | |
| `fa-diretores` | `fa_diretores` | 1 | emailKey | | — | |
| `fa-facilitadores` | `fa_facilitadores` | 1 | emailKey | | — | |
| `fa-progress` | `fa_progress` | 1 | emailKey | | — | `v` guarda strings JSON brutas (`fa_game_v3` etc.) — não interpretar. |
| `fa-progress-historico` | `fa_progress_historico` | 1 | emailKey | | — | `v.<treino>.<pushKey>` |
| `fa-reset-signal` | `fa_reset_signal` | 1 | emailKey | | — | |
| `fa-espera` | `fa_espera` | 1 | emailKey | | — | `v.<origem>`; **formato legado** (campos direto em `v`) continua aceito. |
| `fa-seeds-hidden` | `fa_seeds_hidden` | 1 | seedKey | | — | `v: true` |
| `fa-seeds-deleted` | `fa_seeds_deleted` | 1 | seedKey | | — | `v: true` |
| `fa-holocron-hidden` | `fa_holocron_hidden` | 1 | pushKey | | — | `v: true` |
| `fa-ranking` | `fa_ranking` | 1 | chave legada | | — | Legado. Migrar mesmo assim (paridade). |
| `players` | `players` | 1 | pushKey | | `{ "v.email": 1 }` | Legado; consultado por e-mail no "resetar progresso". |
| `eventos` | `eventos` | 1 | eventoKey | `-NaB…` | — | |
| `eventos-publico` | `eventos_publico` | 2 | eventoKey, emailKey | `-NaB…|maria_silva_previ_com_br` | `{ "_k.0": 1 }` | |
| `turmas` | `turmas` | 1 | turmaKey | | — | |
| `turmas-config` | `turmas_config` | 1 | turmaKey | | — | |
| `turmas-interesse` | `turmas_interesse` | 2 | turmaKey, emailKey | `t1|maria_…` | `{ "_k.0": 1 }`, `{ "_k.1": 1 }` | `_k.1` acelera "em quais turmas esta pessoa está" (auth). |
| `turmas-interesse-log` | `turmas_interesse_log` | 2 | turmaKey, emailKey | | `{ "_k.0": 1 }` | Entradas `<pushKey>` dentro de `v`. |
| `turmas-publico` | `turmas_publico` | 2 | turmaKey, emailKey | | `{ "_k.0": 1 }` | |
| `turmas-checkin` | `turmas_checkin` | 3 | turmaKey, data, emailKey | `t1|2026-08-11|maria_…` | `{ "_k.0": 1, "_k.1": 1 }`, `{ "_k.2": 1 }` | |
| `turmas-sorteio` | `turmas_sorteio` | 2 | turmaKey, pushKey | | `{ "_k.0": 1 }` | |
| `turmas-equipe` | `turmas_equipe` | 2 | turmaKey, emailKey | | `{ "_k.0": 1 }`, `{ "_k.1": 1 }` | |
| `turmas-roteiro` | `turmas_roteiro` | 1 | turmaKey | | — | `v.customizacoes`, `v.exclusivas`, `v.facilitacao` |
| `roteiros-evento` | `roteiros_evento` | 1 | eventoKey | | — | `v.dias`, `v.atividades`, `v._migracoesBackup` (legado) |
| `roteiro-tipos-atividade` | `roteiro_tipos_atividade` | 1 | pushKey | | — | O painel às vezes grava o **nó inteiro** (semente) → ver seção 6.3. |
| `treinamentos` | `treinamentos` | 1 | treinamentoKey | | — | |
| `treinamentos-conteudo` | `treinamentos_conteudo` | 1 | treinamentoKey | | — | |
| `avaliacoes` | `avaliacoes` | 2 | turmaKey, emailKey | | `{ "_k.0": 1 }` | Dashboard lê tudo (só admin). |
| `pedidos` | `pedidos` | 1 | pushKey | | `{ "v.emailEnviou": 1 }` | |
| `holocron` | `holocron` | 1 | pushKey | | `{ "v.createdAt": 1 }` | Consultado com `orderByChild('createdAt')`. |
| `apostas` | `apostas` | 1 | turmaKey | | — | **Um documento por turma** com toda a árvore (`atual`, `contadorExecucoes`, `criacaoExecucaoEmAndamento`, `execucoes.<id>.grupos.<id>…`). Justificativa na seção 8. |
| `avaliacoes-produto` | `avaliacoes_produto` | 1 | pushKey | | `{ "v.itemId": 1, "v.versao": 1 }`, `{ "v.versaoAnteriorKey": 1 }` | |
| `avaliacoes-squad` | `avaliacoes_squad` | 1 | pushKey | | `{ "v.itemId": 1, "v.status": 1 }` | |
| `questionarios-config` | `questionarios_config` | 1 | código | `CLASSIFICACAO_ARQUITETURAL` | — | |
| `questionarios-auditoria` | `questionarios_auditoria` | 2 | código, pushKey | | `{ "_k.0": 1 }` | Somente inclusão (append-only) — seção 9. |
| `motor-arquitetura-config` | `motor_arquitetura_config` | **0** | — | `_raiz` | — | Documento único; alvo da `transaction()` de `publicarRegras`. |
| `motor-arquitetura-auditoria` | `motor_arquitetura_auditoria` | 1 | pushKey | | `{ "v.dataHora": -1 }` | Append-only. |
| `motor-squad-config` | `motor_squad_config` | **0** | — | `_raiz` | — | Idem. |
| `motor-squad-auditoria` | `motor_squad_auditoria` | 1 | pushKey | | `{ "v.dataHora": -1 }` | Append-only. |

> **Critério usado para escolher a profundidade:** o menor nível em que (a) os documentos ficam pequenos, (b) as transações do site (`transaction()`) ficam **dentro de um único documento**, e (c) as leituras mais frequentes são "um documento" ou "todos os documentos com o mesmo prefixo". As 7 transações do site ficam todas dentro de um documento: as 5 do `aposta.js` dentro do documento da turma em `apostas`, e as 2 dos motores no documento único `_raiz`.

---

## 6. Como cada operação do Firebase vira MongoDB

Seja `P` um caminho, `N` o nó (primeiro segmento), `d` a profundidade de `N`, e `resto` os segmentos depois de `N`.

### 6.1 Leitura (`GET /api/db/P`)

| Caso | O que o backend faz |
|---|---|
| `len(resto) == d` (exatamente um documento) | `findOne({_id})` → devolve `v` (ou `null`). |
| `len(resto) > d` (dentro de um documento) | `findOne({_id}, {projection: {"v.<sub.caminho>": 1}})` → extrai o subvalor. |
| `len(resto) < d` (vários documentos — ex.: `turmas-interesse/t1`, ou o nó inteiro) | `find({"_k.0": resto[0], ...})` (prefixo) → **monta a árvore** `{ <k_i>: { <k_j>: v } }` exatamente como o Firebase devolveria. |
| Nó inteiro de profundidade 1 | `find({})` → `{ <_id>: v, ... }` |
| Nada encontrado | `null` (e `exists()` = false no cliente). |

### 6.2 Escrita de um par `(P, valor)`

| Caso | Operação |
|---|---|
| `len(resto) == d`, valor não nulo | `replaceOne({_id}, {_id, _k, _rev: +1, _em, _por, v: valor}, {upsert: true})` (preservando/incrementando `_rev`) |
| `len(resto) == d`, valor nulo | `deleteOne({_id})` |
| `len(resto) > d`, valor não nulo | `updateOne({_id}, {$set: {"v.<sub>": valor, _em, _por}, $inc: {_rev: 1}, $setOnInsert: {_k}}, {upsert: true})` — com upsert o documento nasce com `_k` preenchido |
| `len(resto) > d`, valor nulo | `updateOne({_id}, {$unset: {"v.<sub>": ""}, ...})` e depois, se `v` ficou vazio, `deleteOne` (regra 4.6) |
| `len(resto) < d`, valor nulo | `deleteMany({"_k.0": ..., })` (ex.: excluir turma apaga `turmas_interesse` com `_k.0 = t`) |
| `len(resto) < d`, valor objeto | "substituir a subárvore": `deleteMany(prefixo)` + `insertMany` de um documento por folha de profundidade `d` |

`set(P, v)` = um par. `update` no `ref(P)` com objeto `{a: 1, "b/c": 2}` = pares `(P/a, 1)`, `(P/b/c, 2)` (**cada chave substitui o filho inteiro**, igual ao Firebase — não é *deep merge*). `ref().update({...})` na raiz = pares com caminhos absolutos. `remove()` = par com `null`.

**Todos os pares de uma mesma chamada** são aplicados dentro de **uma transação MongoDB** (`session.withTransaction`). Isso reproduz a atomicidade do `update()` multi-caminho.

### 6.3 Exemplos reais traduzidos

1. **Confirmar participante** (`admin.js` l. 3846):
   ```
   pares:  turmas-interesse/t1/maria…/status            = "inscrito"
           turmas-interesse/t1/maria…/confirmedByAdmin  = "tatiane…"
           turmas-interesse/t1/maria…/confirmedByAdminName = "TATIANE"
           turmas-interesse/t1/maria…/confirmedDate     = "2026-…"
           turmas-interesse/t2/maria…/removed           = true        (exclusividade)
           turmas-interesse/t2/maria…/removedDate       = "2026-…"
           turmas-interesse/t2/maria…/removedReason     = "Inscrita automaticamente…"
   Mongo (1 transação): updateOne({_id:"t1|maria…"}, {$set:{"v.status":…, "v.confirmedByAdmin":…, …}})
                         updateOne({_id:"t2|maria…"}, {$set:{"v.removed":true, …}})
   ```
2. **Excluir turma** (`admin.js` l. 3250): 9 pares com `null` → `deleteOne(turmas, t)`, `deleteMany(turmas_interesse, _k.0=t)`, `deleteOne(turmas_config, t)`, `deleteMany(turmas_checkin, _k.0=t)`, `deleteMany(turmas_interesse_log, _k.0=t)`, `deleteMany(turmas_equipe, _k.0=t)`, `deleteOne(turmas_roteiro, t)`, `deleteMany(turmas_sorteio, _k.0=t)`, `deleteMany(turmas_publico, _k.0=t)` — **uma transação**.
3. **Semear tipos de atividade** (`admin.js` l. 6273, `set` no nó inteiro): `deleteMany(roteiro_tipos_atividade, {})` + `insertMany` — uma transação.
4. **Check-in por QR** (`checkin.js` l. 61): `replaceOne({_id:"t1|2026-08-11|maria…"}, …, {upsert:true})`.
5. **Entrar num grupo da Aposta** (`aposta.js` l. 2938): dois pares no **mesmo** documento `apostas/t1` → um único `updateOne` com dois `$set` (`v.execucoes.<e>.grupos.<g>.membros.<eu>` e `v.execucoes.<e>.grupos-resumo.<g>.qtdMembros`).
6. **Publicar regras do motor** (`transaction` em `motor-arquitetura-config`): documento `_raiz` de `motor_arquitetura_config` — compare-and-swap descrito no documento 05, seção 6.

### 6.4 Consultas (`orderByChild`, `equalTo`, `limitToFirst`)

O volume de dados é pequeno (a maior coleção tem centenas a poucos milhares de documentos). **Na Fase A as consultas são resolvidas em memória no backend**: lê-se o valor do caminho (seção 6.1) e aplica-se ordenação/filtro/limite antes de devolver, **mantendo a ordem** num formato de lista de pares (documento 05, seção 4.3) para que `snapshot.forEach` percorra na ordem certa. Os índices `v.createdAt` (holocron) e `v.email` (players) já existem para, se um dia for preciso, empurrar a consulta para o MongoDB.

---

## 7. Coleções novas (não existem no Firebase)

| Coleção | Conteúdo | Detalhes |
|---|---|---|
| `usuarios_auth` | credenciais (hash argon2id, hash legado do Firebase, verificação, bloqueio temporário) | documento 04, seção 3.1 |
| `sessoes` | sessões de login (cookie opaco) | TTL em `expiraEm` |
| `tokens_email` | tokens de verificação/redefinição (só o SHA-256) | TTL em `expiraEm` |
| `auditoria_escritas` (opcional, recomendado) | uma linha por requisição de escrita: `{quando, por, caminhos[], ip, reqId}` | TTL de 180 dias; ajuda a investigar "quem apagou isso?" — o Firebase não oferece isso hoje |
| `_migracoes` | controle de scripts de migração de dados já aplicados (`{_id: "2026-10-01-importacao-inicial", aplicadoEm, contagens}`) | documento 08 |

---

## 8. Justificativa: `apostas` em um documento por turma

- As 5 transações do `aposta.js` (trava de criação de execução, contador, trava de criação de ciclo e suas liberações) e as 3 gravações multi-caminho críticas (criar execução + encerrar anterior + mover `atual`; criar ciclo; entrar no grupo) tocam caminhos **da mesma turma**. Com um documento por turma, **todas** ficam atômicas por natureza (MongoDB garante atomicidade por documento), e as regras que olham "estado antes/depois" (`qtdMembros` só +1 junto com a própria entrada) são avaliadas sobre um único documento carregado.
- Tamanho estimado: uma execução com 6 grupos e todas as etapas preenchidas fica na casa de dezenas a poucas centenas de KB; dezenas de execuções por turma ficam bem abaixo do limite de 16 MB por documento do MongoDB.
- **Monitoramento obrigatório:** tarefa agendada (ou endpoint `/api/admin/saude-dados`) que alerta se algum documento de `apostas` passar de 8 MB:
  ```js
  db.apostas.aggregate([{ $project: { tamanho: { $bsonSize: "$$ROOT" } } }, { $match: { tamanho: { $gt: 8 * 1024 * 1024 } } }])
  ```
- Se um dia isso acontecer (improvável), a evolução é mudar a profundidade para separar `execucoes` em outra coleção — a tabela de mapeamento suporta isso sem mudar o site.

---

## 9. Coleções somente-inclusão (append-only)

Hoje "a auditoria nunca é apagada" só é verdade porque o site não tem botão para isso — as regras permitem apagar. No backend, para as coleções `questionarios_auditoria`, `motor_arquitetura_auditoria`, `motor_squad_auditoria`, `fa_users_log`, `turmas_interesse_log`:

- **Fase A:** manter a permissão das regras (paridade), mas **registrar em `auditoria_escritas`** qualquer escrita que altere/apague uma entrada existente (alerta).
- **Fase B:** proibir `update`/`delete` de entradas existentes nessas coleções (só inclusão de chaves novas).

---

## 10. Validação de esquema

- **Fase A:** nenhuma validação de formato além da normalização RTDB — o Firebase também não valida (0 `.validate`), e validar agora poderia recusar gravações que o site faz hoje.
- **Fase B:** adicionar `$jsonSchema` por coleção (começando por `turmas_interesse`, `turmas_checkin`, `pedidos`, `avaliacoes`) junto com os endpoints de domínio. Os campos observados de cada nó estão nos anexos B1 §3 e B2 §2 e servem de base para os esquemas.

---

## 11. Evolução prevista (Fase B) — não fazer agora

- **ID estável de pessoa.** Hoje a `emailKey` é a identidade em ~15 nós, e corrigir um e-mail exige mover dados entre chaves (`admin.js` `moverDadosDePessoa`). Na Fase B, introduzir `pessoaId` estável e manter `emailKey` só como índice de busca.
- **Coleções de domínio.** Substituir o envelope `v` por documentos tipados por domínio (ex.: `inscricoes {turmaId, pessoaId, status, confirmacao{por,em}, saida{…}}`), à medida que os endpoints de domínio forem criados.
- **Versões dos motores** em coleção própria (`motor_versoes {motor, n, regras, publicadoEm, publicadoPor}`) em vez de `v.versoes.<n>` no documento único.
