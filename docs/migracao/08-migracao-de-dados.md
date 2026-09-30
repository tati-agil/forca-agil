# 08 — Migração de dados (Firebase → MongoDB) e plano de volta

> Pré-requisitos: [03](03-modelo-de-dados-mongodb.md) (mapeamento), [04 §3.4](04-autenticacao-e-autorizacao.md#34-migração-das-senhas-do-firebase-ninguém-precisa-redefinir-senha) (senhas).
> Ferramentas ficam em `tools/migracao-dados/` (criadas na Fase 7 do [plano](11-plano-de-execucao.md)).

---

## 1. Visão geral

```
Firebase (kyber-agil)                              Servidor interno
─────────────────────                              ────────────────
RTDB  ──(firebase database:get)──► rtdb.json ──┐
                                               ├─► importar.ts ──► MongoDB (coleções do doc. 03 + usuarios_auth)
Auth  ──(firebase auth:export)───► auth.json ──┘        │
                                                         └─► relatorio-conferencia.md (contagens, hashes, pendências)

Plano de volta:  MongoDB ──► exportar-para-rtdb.ts ──► rtdb-volta.json ──(firebase database:set)──► Firebase
```

Princípios:
- **Idempotente:** rodar a importação duas vezes dá o mesmo resultado (usa `replaceOne(..., {upsert: true})` por `_id`).
- **Verificável:** toda importação gera um relatório com contagem e *hash* por nó, comparando origem × destino.
- **Ensaiada:** a importação é executada **pelo menos 3 vezes** em homologação com dados reais antes do dia do corte.
- **Sem transformação de negócio:** os valores vão exatamente como estão (só a normalização RTDB do doc. 03 §4, que é neutra).

---

## 2. Pré-requisitos (pedir antes de começar — pendência P-03)

- [ ] Conta Google com papel **Proprietário (Owner)** ou **Editor** no projeto Firebase `kyber-agil`.
- [ ] Node 20+ e `npx firebase-tools@13` numa máquina com internet (pode ser a máquina de quem implementa; **não** precisa ser o servidor).
- [ ] `firebase login` feito com essa conta.
- [ ] Parâmetros do hash de senha (Console → Authentication → Users → ⋮ → *Password hash parameters*): `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`. Guardar num cofre de senhas.
- [ ] Canal seguro para levar os arquivos exportados até o servidor (os arquivos contêm dados pessoais e hashes de senha — **nunca** commitar, nunca mandar por e-mail/chat). Apagar das máquinas intermediárias depois da importação.

---

## 3. Exportação

### 3.1 Dados do Realtime Database

```bash
mkdir -p ~/migracao-fa && cd ~/migracao-fa
npx firebase-tools@13 database:get / --project kyber-agil --output rtdb-$(date +%F_%H%M).json
ls -lh rtdb-*.json
```

- O banco atual é pequeno (MBs); `database:get /` baixa tudo de uma vez. Se um dia falhar por tamanho, baixar por nó: `database:get /turmas-interesse -o turmas-interesse.json` para cada nó da tabela do doc. 03 §5.
- Conferir que o JSON abre (`node -e "JSON.parse(require('fs').readFileSync('rtdb-....json','utf8'))"`).

### 3.2 Usuários do Authentication (com hash de senha)

```bash
npx firebase-tools@13 auth:export auth-$(date +%F_%H%M).json --format=json --project kyber-agil
```

Formato de cada usuário (campos relevantes):
```json
{ "localId": "uid...", "email": "maria.silva@previ.com.br", "emailVerified": true,
  "passwordHash": "base64...", "salt": "base64...", "createdAt": "1690000000000",
  "lastSignedInAt": "1695000000000", "disabled": false }
```

> Se `passwordHash` vier vazio para todos, a conta usada não tem permissão suficiente — refazer com Owner.

---

## 4. Ferramenta de importação (`tools/migracao-dados/`)

```
tools/migracao-dados/
├── package.json            ← dependências: mongodb, (usa o código do backend via caminho relativo)
├── tsconfig.json
├── importar.ts             ← importa rtdb.json + auth.json
├── conferir.ts             ← recalcula contagens/hashes e gera o relatório (pode rodar sozinho)
├── exportar-para-rtdb.ts   ← plano de volta: MongoDB → JSON no formato do RTDB
└── README.md               ← como rodar (resumo deste documento)
```

**Reutilizar, não duplicar:** `importar.ts` importa do backend `backend/src/path-mapping/mapa-colecoes.ts`, `caminho.ts` e `normalizar-rtdb.ts`. Assim a importação usa **exatamente** o mesmo mapeamento que a API usa para ler.

### 4.1 Algoritmo do `importar.ts`

```text
entrada: --rtdb rtdb.json --auth auth.json --mongo <URI> [--dry-run] [--somente <no1,no2>]

1. carregar rtdb.json → objeto raiz R
2. PARA cada chave de primeiro nível N em R:
     se N não está no mapa de coleções → registrar em "nós desconhecidos" (NÃO importar; relatório) e continuar
     d = profundidade(N); col = coleção(N)
     percorrer R[N] até a profundidade d, gerando (k1..kd, valor)
       - d = 0: um documento {_id:'_raiz', _k:[], v: R[N]}
       - folhas acima de d (valor primitivo antes de atingir d): registrar em "formato inesperado" e importar
         mesmo assim como documento com o prefixo disponível (ex.: fa-espera legado — ver 4.3)
     para cada (chaves, valor):
       v = normalizarComoRtdb(valor); se v vazio → pular
       doc = {_id: chaves.join('|'), _k: chaves, _rev: 1, _em: agora, _por: 'importacao', v}
       acumular replaceOne({_id}, doc, {upsert:true}) em lotes de 500 (bulkWrite ordered:false)
3. usuários (auth.json):
     para cada usuário u com email:
       k = emailKey(u.email)
       doc = {_id: k, email: u.email.toLowerCase(), senhaHash: null,
              firebaseHash: u.passwordHash ? {hash: u.passwordHash, salt: u.salt} : null,
              emailVerificado: !!u.emailVerified, firebaseUid: u.localId,
              criadoEm: new Date(+u.createdAt), ultimoLoginEm: u.lastSignedInAt ? new Date(+u.lastSignedInAt) : null,
              desabilitadoNoFirebase: !!u.disabled, tentativasFalhas: 0, bloqueadoAte: null}
       replaceOne em usuarios_auth
     conflito: dois usuários com a mesma emailKey → relatório (não sobrescrever; decidir manualmente)
4. gravar em _migracoes: {_id: 'importacao-<data>', origem: {arquivoRtdb, sha256, arquivoAuth, sha256}, contagens, duracaoMs}
5. rodar conferir.ts
```

- `--dry-run`: faz tudo menos gravar; imprime contagens.
- Índices: **não** criar aqui — a API cria na subida (doc. 05 §2 `indices.ts`). Subir a API uma vez antes da importação.
- **Antes** de importar numa base que já tem dados (re-execução), não é preciso apagar: o `upsert` substitui. Mas documentos que existiam no Mongo e **não** existem mais no Firebase ficariam — por isso a importação **final** (dia do corte) é feita numa base **vazia** (`db.dropDatabase()` com confirmação digitada).

### 4.2 `conferir.ts` — relatório de conferência

Para cada nó `N` do mapa:

| Métrica | Origem (rtdb.json) | Destino (MongoDB) | Deve ser |
|---|---|---|---|
| Nº de documentos (entradas na profundidade `d`) | contar | `countDocuments()` | igual |
| Hash do nó | SHA-1 do JSON canônico de `normalizarComoRtdb(R[N])` | montar a árvore a partir dos documentos (mesma função da API de leitura) e calcular o mesmo hash | **igual** |
| Amostra | 5 chaves aleatórias | ler pela **API** (`GET /api/db/N/<chave>` com um usuário admin de teste) | valor idêntico |

Mais:
- Nº de usuários `auth.json` × `usuarios_auth`.
- Nº de `fa-users` sem conta em `usuarios_auth` (esperado 0 ou poucos; listar).
- Nº de contas em `usuarios_auth` sem `fa-users` (contas criadas no Auth cujo perfil não foi gravado; listar).
- Nós desconhecidos e formatos inesperados (seção 4.3).

Saída: `relatorio-conferencia-<data>.md` (guardar junto com os artefatos do corte). **Critério de aceite: todos os hashes iguais.**

### 4.3 Formatos legados conhecidos (tratar sem "consertar")

| Caso | Onde | Como importar |
|---|---|---|
| `fa-espera/<emailKey>` com os campos direto (sem nível `<origem>`) | anexo B2 §2 | Profundidade 1 → o documento `<emailKey>` recebe `v` = os campos. A API devolve igual; o site (`turmas-util.js` l. 258-303) já entende os dois formatos. |
| Arrays guardados como objetos `{ "0":…, "1":… }` | `roteiros-evento` (`materiais`), `treinamentos-conteudo`, `aposta` (`herdadas`) | Importar como veio (objeto). O site já normaliza (`paraLista`). |
| `roteiros-evento/<ev>/_migracoesBackup` | anexo B3 §4.1 | Importar como veio. |
| Execuções da Aposta sem `status` (legado) | anexo B3 §3.3 item 5 | Importar como veio (contam como abertas — paridade). |
| `fa-ranking`, `players` | legado | Importar (paridade; `players` é consultado no "resetar progresso"). |

---

## 5. Plano de volta (`exportar-para-rtdb.ts`)

Se houver problema grave depois do corte e for decidido voltar ao Firebase (critérios no doc. 11, Fase 8), os dados **gravados no sistema novo** não podem se perder:

```bash
# no servidor
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm \
  -v /opt/forcaagil/volta:/saida api node /app/tools/exportar-para-rtdb.js --mongo "$MONGO_URI" --saida /saida/rtdb-volta.json
# levar o arquivo para a máquina com firebase-tools e:
npx firebase-tools@13 database:set / rtdb-volta.json --project kyber-agil --force
# e reativar as regras normais (seção 6.3) + o workflow de deploy
```

- Monta a árvore de cada coleção (inverso do `importar.ts`, usando a mesma função de montagem da API) e grava um JSON único.
- **Usuários criados no sistema novo** não voltam automaticamente para o Firebase Auth (o hash é argon2id, que o Firebase não aceita): listar em `usuarios-novos.csv` para a admin recriar ou para as pessoas usarem "esqueci minha senha". Contas **migradas** continuam no Firebase Auth como estavam.
- Ensaiar o plano de volta **uma vez** em homologação (Tarefa 7.6), usando um projeto Firebase de teste (nunca o `kyber-agil` num ensaio).

---

## 6. Dia do corte — roteiro de dados

> Roteiro completo do dia (comunicação, DNS, verificação de telas) no doc. 11, Fase 8. Aqui só a parte de dados.

### 6.1 Janela

- Fora de dia de oficina; preferencialmente fim de tarde de sexta ou sábado de manhã.
- Duração estimada: 1-2 h (exportação e importação levam minutos; o resto é conferência).
- Avisar com 1 semana de antecedência: "o site ficará em manutenção das X às Y; terminem avaliações pendentes (o rascunho da avaliação fica no navegador e não é migrado)".

### 6.2 Passo a passo

1. **T-30 min:** backup extra do MongoDB de produção (vazio ou com dados de ensaio) — por segurança.
2. **T-0 — congelar o Firebase** (seção 6.3): publicar as regras "somente leitura". A partir daqui ninguém grava no Firebase.
3. Publicar no Firebase Hosting uma página de manutenção (seção 6.4) — quem abrir o site antigo vê o aviso.
4. **Exportar** RTDB e Auth (seção 3). Calcular `sha256sum` dos dois arquivos.
5. Transferir os arquivos para o servidor pelo canal seguro.
6. Na base de produção **vazia**: subir a API (cria índices) → `importar.ts` → `conferir.ts`.
7. **Conferência obrigatória:** relatório com todos os hashes iguais. Se algum diferir → **parar**, investigar; se não resolver na janela → abortar o corte (seção 6.5).
8. Teste de fumaça em produção (doc. 11, Fase 8, lista de verificação): login com as 3 contas de teste, uma participante real voluntária, abrir cada tela principal no celular.
9. Liberar: trocar a página de manutenção do Firebase Hosting por um **redirecionamento** para o endereço novo; comunicar.
10. Guardar em local seguro (e fora do repositório): arquivos exportados, relatório de conferência, `sha256` — por 90 dias.

### 6.3 Regras "somente leitura" do Firebase (congelamento)

Gerar a partir das regras atuais, **removendo todas as permissões de escrita** e mantendo as de leitura (o site antigo continua abrindo, em modo consulta, durante o período de retorno):

```bash
python3 - <<'EOF'
import json
r = json.load(open('database.rules.json'))
def tira_write(n):
    if isinstance(n, dict):
        n.pop('.write', None)
        for v in n.values(): tira_write(v)
tira_write(r)
r['rules']['.write'] = False
json.dump(r, open('database.rules.somente-leitura.json', 'w'), indent=2, ensure_ascii=False)
print('ok')
EOF
npx firebase-tools@13 deploy --only database --project kyber-agil \
  --config <(jq '.database.rules = "database.rules.somente-leitura.json"' firebase.json)
```
(Se o `--config` com substituição de processo não funcionar no seu shell, copie o `firebase.json` para um arquivo temporário, troque o caminho das regras e use `--config firebase.congelado.json`.)

> **Importante:** depois do corte, **desativar o workflow `firebase-deploy.yml`** (ou remover o segredo `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL`), senão o próximo push na `main` republica as regras normais e **descongela** o Firebase. Ver doc. 10 §6.

### 6.4 Página de manutenção / redirecionamento no Firebase Hosting

Numa pasta temporária **fora** do repositório:
```bash
mkdir -p /tmp/fa-redirect/public && cd /tmp/fa-redirect
cat > public/index.html <<'EOF'
<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Força Ágil mudou de endereço</title>
<body style="font-family:system-ui;background:#0b0f19;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">
<div><h1>A Força Ágil mudou de endereço</h1><p>Acesse: <a style="color:#f5c542" href="https://<<NOVO_DOMINIO>>/">https://<<NOVO_DOMINIO>>/</a></p>
<p style="opacity:.7">Seu login e seus dados continuam os mesmos.</p></div></body></html>
EOF
cat > firebase.json <<'EOF'
{ "hosting": { "public": "public", "rewrites": [{ "source": "**", "destination": "/index.html" }] } }
EOF
npx firebase-tools@13 deploy --only hosting --project kyber-agil
```
(Na fase de manutenção, trocar o texto por "Em manutenção até HH:MM".)

### 6.5 Abortar o corte (antes de liberar)

Se a conferência falhar e não houver solução na janela:
1. Republicar as regras normais do Firebase (`firebase deploy --only database`).
2. Republicar o site normal no Firebase Hosting (`firebase deploy --only hosting` a partir do repositório).
3. Comunicar "manutenção encerrada, site normal".
4. Registrar no `PROGRESSO.md` o que falhou; nada foi perdido (o Firebase ficou congelado, não apagado).

---

## 7. Depois do corte

- **30 dias:** Firebase congelado (somente leitura) e intocado. Não apagar nada.
- **Dia 30:** reunião de decisão (doc. 11, Fase 10): se estável, exportar uma última cópia do Firebase para arquivo, e só então considerar desativar o projeto (decisão da dona do repositório e da TI).
- Os scripts de operação que liam o Firebase (`audit-facilitadores-turmas.js`, `diagnostico-execucao-vazamento-grupo.js`, `backfill-grupos-resumo.js`) passam a ser consultas no MongoDB — doc. 10 §5.
