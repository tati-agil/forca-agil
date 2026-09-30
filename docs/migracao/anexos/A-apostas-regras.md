# Anexo A — Regras de autorização de `apostas/**` (Construção da Aposta)

> **Documento normativo.** O backend (`backend/src/rules/regras.apostas.ts`) implementa **exatamente** esta tabela, e cada linha tem teste (porte do `.github/scripts/teste-rules.js`, 115 verificações). Fonte: `database.rules.json` (bloco `apostas`, ~l. 191-316), conferido no commit desta documentação.
> Se o `database.rules.json` mudar antes do corte, esta tabela e o backend precisam mudar junto.

---

## 1. Predicados

`K` = chave da pessoa logada, **nas regras de apostas calculada com minúsculas**: `auth.token.email.toLowerCase().replace('@','_').replace('.','_')` (no RTDB, `replace` troca todas as ocorrências). No backend usar **a `emailKey` do site** (doc. 04 §5) — idêntica para os e-mails @previ.com.br reais (sem `-`, `+` etc.); ver doc. 01 §9 K-13.

Estados lidos **antes** da escrita (`root`/`data`), salvo quando indicado "depois" (`newData`).

| Nome | Condição |
|---|---|
| `PREVI` | logada **e** e-mail termina em `@previ.com.br` |
| `SUPER` | e-mail ∈ {`tatianefdirene@previ.com.br`, `danielfrazao@previ.com.br`} |
| `ADMIN` | `SUPER` **ou** existe `fa-admins/K` |
| `FAC_TURMA(t)` | existe `fa-facilitadores/K` **e** existe `turmas-equipe/t/K` (as duas; `papel` e `ativo` não importam) |
| `CONDUTOR(t)` | `ADMIN` **ou** `FAC_TURMA(t)` |
| `CONFIRMADA(t)` | `turmas-interesse/t/K/status === 'inscrito'` **e** existe `turmas-interesse/t/K/confirmedByAdmin` **e** `turmas-interesse/t/K/removed !== true` |
| `ATUAL(t,e)` | `e === apostas/t/atual` |
| `ABERTA(t,e)` | `apostas/t/execucoes/e/status !== 'encerrada'` (execução **sem** `status` — legado — conta como aberta) |
| `MEMBRO(t,e,g)` | existe `apostas/t/execucoes/e/grupos/g/membros/K` |
| `SEM_CICLOS(t,e,g)` | **não** existe `apostas/t/execucoes/e/grupos/g/ciclos/atual` |
| `CICLO_ATUAL(t,e,g,c)` | `c === apostas/t/execucoes/e/grupos/g/ciclos/atual` |
| `CICLO_ABERTO(t,e,g,c)` | `apostas/t/execucoes/e/grupos/g/ciclos/porId/c/status !== 'FINALIZADO'` |

Todas as regras abaixo começam com `PREVI &&` (omitido na tabela).

---

## 2. Tabela

`t` = turma, `e` = execução, `g` = grupo, `c` = ciclo, `m` = chave de membro, `et` = id de etapa.
"(cascata)" = concedido por um ancestral; no RTDB uma permissão concedida acima **não pode** ser revogada abaixo.

| Caminho | Leitura | Escrita | Condições extras / observações |
|---|---|---|---|
| `apostas` | ✗ | ✗ | |
| `apostas/t` | ✗ | ✗ | Ninguém lê/grava a turma inteira de uma vez. |
| `apostas/t/atual` | `CONDUTOR(t)` ou `CONFIRMADA(t)` | `CONDUTOR(t)` | Sem validação de que aponta para execução existente. |
| `apostas/t/criacaoExecucaoEmAndamento` | `CONDUTOR(t)` | `CONDUTOR(t)` | Trava de criação (transação T1/T2). |
| `apostas/t/contadorExecucoes` | `CONDUTOR(t)` | `CONDUTOR(t)` | Contador (transação T3). |
| `apostas/t/execucoes` | `CONDUTOR(t)` — **cascata para tudo abaixo** | ✗ | |
| `…/execucoes/e` | (cascata) | `CONDUTOR(t)` **e** `!data.exists()` | Só **criar**. Tudo que vier no payload de criação é aceito (inclusive `grupos`). Campos sem regra própria (`numero`, `criadaEm`, `criadaPor*`, `turmaKey`, `turmaLabel`, `eventoKey`) ficam imutáveis depois. |
| `…/e/status`, `encerrada`, `encerradaEm`, `encerradaPor`, `encerradaPorNome` | (cascata) | `CONDUTOR(t)` **e** `ABERTA(t,e)` | Depois de `status='encerrada'`, **ninguém** (nem super-admin) altera. |
| `…/e/missao` | `CONFIRMADA(t)` **e** `ATUAL(t,e)` (+ cascata `CONDUTOR`) | `CONDUTOR(t)` **e** `ABERTA(t,e)` | |
| `…/e/revelado` | `CONFIRMADA(t)` **e** `ATUAL(t,e)` (+ cascata) | `CONDUTOR(t)` **e** `ABERTA(t,e)` | |
| `…/e/grupos-resumo` | `CONFIRMADA(t)` **e** `ATUAL(t,e)` (+ cascata) | ✗ | |
| `…/e/grupos-resumo/g` | (acima) | `CONDUTOR(t)` **e** `ABERTA(t,e)` **e** `!data.exists()` **e** `newData.nome === (depois) …/e/grupos/g/nome` **e** ( [grupo `g` **não** existia antes **e** `newData.qtdMembros === 0`] **ou** [grupo `g` já existia antes **e** `newData.qtdMembros >= 0`] ) | Resumo nasce junto com o grupo (mesmo `update`) ou por *backfill* de grupo legado; nunca é sobrescrito. |
| `…/e/grupos-resumo/g/qtdMembros` | (acima) | `ABERTA(t,e)` **e** `CONFIRMADA(t)` **e** ( se `MEMBRO(t,e,g)` antes: `newData === data` ; senão: `newData === data + 1` **e** (depois) existe `…/e/grupos/g/membros/K` ) | **CONDUTOR não aparece aqui**: nem admin corrige a contagem. O invariante é "+1 exatamente, na mesma escrita que adiciona a **própria** chave". |
| `…/e/grupos` | (cascata `CONDUTOR`) | ✗ | |
| `…/e/grupos/g` | `MEMBRO(t,e,g)` (+ cascata `CONDUTOR`) | `CONDUTOR(t)` **e** `ABERTA(t,e)` **e** `!data.exists()` | Membro lê o próprio grupo **em qualquer execução**, inclusive passadas (intencional — teste S5). Só criar. |
| `…/g/membros` | (cascata) | ✗ | |
| `…/g/membros/m` | `CONFIRMADA(t)` **e** `ATUAL(t,e)` **e** `m === K` (+ cascata) | `ABERTA(t,e)` **e** ( `CONDUTOR(t)` **ou** ( `m === K` **e** `newData.email === e-mail da sessão` ) ) | Para descobrir "qual é o meu grupo" sem ler os grupos dos outros. **Entrar no grupo não exige `CONFIRMADA`** quando gravado sem `qtdMembros` (brecha herdada — doc. 04 §9; anexo B3 §3.3). |
| `…/g/etapa` | (cascata) | `ABERTA` **e** `SEM_CICLOS` **e** (`CONDUTOR` **ou** `MEMBRO`) | Caminho legado ("Ciclo 1 implícito"); congela quando existe `ciclos`. |
| `…/g/dados` | (cascata) | ✗ | |
| `…/g/dados/et` | (cascata) | `ABERTA` **e** `SEM_CICLOS` **e** (`CONDUTOR` **ou** `MEMBRO`) | Idem. |
| `…/g/atualizadoEm`, `atualizadoPorNome` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) | |
| `…/g/ciclos` | (cascata) | ✗ | |
| `…/g/ciclos/atual` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) | Sem validação do alvo. |
| `…/g/ciclos/criacaoCicloEmAndamento` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) | Trava de ciclo (transações T4/T5). |
| `…/g/ciclos/porId` | (cascata) | ✗ | |
| `…/g/ciclos/porId/c` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) **e** `!data.exists()` | Só criar. |
| `…/porId/c/status`, `finalizadoEm` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) **e** `CICLO_ABERTO(c)` | Qualquer ciclo não finalizado (não só o atual). `FINALIZADO` nunca volta. |
| `…/porId/c/etapa`, `herdadas`, `pontoDeReinicio` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) **e** `CICLO_ATUAL(c)` **e** `CICLO_ABERTO(c)` | Só o ciclo atual e aberto é editável. |
| `…/porId/c/dados` | (cascata) | ✗ | |
| `…/porId/c/dados/et` | (cascata) | `ABERTA` **e** (`CONDUTOR` **ou** `MEMBRO`) **e** `CICLO_ATUAL(c)` **e** `CICLO_ABERTO(c)` | |

---

## 3. Em linguagem simples

- **Super-admin e admin:** leem e gravam tudo em qualquer turma, mas também são bloqueados por "execução encerrada" e "ciclo finalizado".
- **Facilitadora da turma** (flag global **e** vínculo em `turmas-equipe` daquela turma): mesmos direitos da admin, só naquela turma. Flag sozinha ou vínculo sozinho = nada.
- **Participante confirmada:** lê `atual`; lê `missao`, `revelado` e `grupos-resumo` **da execução atual**; testa a própria chave em `membros` de qualquer grupo da execução atual; entra num grupo (própria chave + `qtdMembros` +1). **Nunca** lê a execução inteira nem a coleção de grupos.
- **Membro de um grupo:** lê o grupo inteiro (inclusive de execuções passadas); grava dados, progresso e ciclos enquanto a execução está aberta.
- **@previ sem vínculo:** nada.

---

## 4. Particularidades que o backend precisa reproduzir

1. **`update()` multi-caminho tudo-ou-nada**, cada caminho avaliado com `root`/`data` **antes** e `newData` **depois** de aplicar todos os caminhos. As três gravações atômicas do `aposta.js` (criar execução + encerrar anterior + mover `atual`; criar ciclo; entrar no grupo) dependem disso (testes em `teste-rules.js` ~l. 330-363, 545-559, 686-699, 805-841).
2. **Preferência de literal sobre `$variável`** no mesmo nível (ex.: `…/e/status` tem regra própria; outros filhos de `e` caem só na regra de `…/e`).
3. **Leitura sem filtro:** ler `…/e` sem ser `CONDUTOR` falha inteira — nunca devolver "só o que pode".
4. **Execuções legadas sem `status`** contam como abertas.

---

## 5. Brechas herdadas (paridade na Fase A; corrigir na Fase B)

Da análise (anexo B3 §3.3):
1. As entradas das regras podem ser forjadas por outras brechas: qualquer @previ grava `turmas-interesse/t/<qualquer>` (vira `CONFIRMADA`) e `turmas-equipe/t` (vira `FAC_TURMA` se tiver a flag).
2. `apostaHabilitada` da turma só é checada no navegador.
3. Entrar no grupo não exige `CONFIRMADA` (se gravar sem `qtdMembros`).
4. Participante removida da turma continua `MEMBRO` e continua gravando no grupo.
5. Nada garante no servidor: "uma execução ativa por turma", "`atual` aponta para execução ativa", "`ciclos/atual` aponta para ciclo aberto", "uma pessoa em um só grupo".
6. Ninguém consegue corrigir `qtdMembros`; não existe "sair do grupo".
7. Excluir turma não apaga `apostas/t`.
