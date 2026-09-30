> **Anexo B1 — inventário bruto (material de apoio).** Levantamento feito lendo o código na íntegra, no commit `c38cfe0` (merge da PR #244). Os números de linha valem para esse commit; se o arquivo mudar, localize pelo nome da função/trecho citado. Escopo: `forca-agil/admin.js` (painel de administração).
> Os documentos 01-12 já consolidam o que importa daqui; use este anexo para conferir detalhes, achar a linha exata de uma chamada ao Firebase ou checar se nada ficou de fora ao adaptar/testar uma tela.

---

# Inventário de acessos ao banco — `forca-agil/admin.js`

Arquivo lido na íntegra (7086 linhas, 392 KB). Números de linha referem-se ao estado atual do repositório.
Todas as chamadas usam o SDK compat (`firebase.database().ref(...)`). **Não há nenhum listener em tempo real (`.on(`), nenhum `.transaction(`** no arquivo. Há **uma** query (`orderByChild/equalTo`, l. 5642). O resto é `once('value')`, `set`, `update` (em ref específica ou multi-caminho na raiz), `push`, `remove`.

Convenções: `<eKey>` = chave do e-mail (`emailKey()`, l. 71 / `emailKeyFromEmail()`, l. 1868: minúsculas, `@` e `.` → `_`, remove o resto de não-[a-z0-9_], corta em 64). `<tk>` = chave de turma (push id). `<ek>` = chave de evento (push id). `<origem>` = chave de turma ou `"lista"` (`faTurmasUtil.ORIGEM_DIRETA`) em `fa-espera`. "Raiz" = `firebase.database().ref().update({...})` (gravação multi-caminho atômica).

Algumas operações de admin.js são **delegadas** a outros módulos e estão marcadas como tal (roteiro.js, auth.js). As abas Pedidos, Dashboard, Avaliação de produto/squad, Manual, Mapa e Testes são inicializadas por admin.js (l. 123-129) mas o código delas vive em `pedidos.js`, `dashboard.js`, `avaliacao.js`, `manual.js`, `mapa.js` e `testes.js` e **não** está neste inventário.

---

## 1. Tabela de operações

| linha(s) | caminho | operação | feature / aba | o que faz |
|---|---|---|---|---|
| 144 | `fa-espera` | once | Boot (migração `migrarEsperaPorOrigem`) | Lê a fila inteira para achar registros no formato antigo (campos da pessoa na raiz). |
| 158 | `fa-espera/<eKey>` | update-multipath (raiz) | Boot (migração) | Substitui o nó da pessoa por `{ <origem>: registroAntigo }` (desce um nível). |
| 193, 195, 197 | `fa-espera`, `turmas`, `eventos` | once (encadeados) | Boot (migração `migrarEsperaEventoKey`) | Lê tudo para preencher `eventoKey` que falta em entradas antigas da fila. |
| 221 | `fa-espera/<eKey>/<origem>/eventoKey` | update-multipath (raiz) | Boot (migração) | Grava o `eventoKey` inferido (da turma de origem, ou do único evento com turma). |
| 238 | `eventos` | once | Boot (seed `seedMissaoJornadaImersao`) | Procura o evento chamado "FORÇA ÁGIL · JORNADA DE IMERSÃO" sem itinerário. |
| 254 | `eventos/<ek>/{missaoTitulo,missaoTexto,topicos,itinerario}` | update-multipath (raiz) | Boot (seed) | Preenche textos fixos de Missão/Itinerário nesse evento. |
| 261 | `fa-admins` | once | Boot (migração `migrateNameCase`) | Lê admins para normalizar caixa. |
| 273 | `fa-admins/<k>/{name,email}` | update-multipath (raiz) | Boot (migração) | Grava nome em MAIÚSCULA e e-mail em minúscula. |
| 278 | `turmas-interesse` | once | Boot (migração `migrateNameCase`) | Lê todos os registros de interesse. |
| 292 | `turmas-interesse/<tk>/<eKey>/name` | update-multipath (raiz) | Boot (migração) | Grava nome em MAIÚSCULA. |
| 305 | `turmas` | once | Compartilhado (`loadTurmasList`) — Eventos, Sorteios, Certificados | Carrega lista de turmas (cache `TURMAS_LIST`). |
| 328, 329 | `turmas-publico`, `eventos-publico` | once (Promise.all) | Eventos (`lerPublico`) | Lê as duas listas de público restrito inteiras. |
| 342 | `eventos` | once | Compartilhado (`loadEventosList`) | Carrega lista de eventos (cache `EVENTOS_LIST`). |
| 565, 566, 567 | `turmas-interesse`, `turmas-config`, `turmas-checkin` | once (encadeados) | Eventos (`loadInterests`) | Lê tudo para desenhar a aba Eventos/Turmas. |
| 828 | `turmas/<tk>/avaliacaoHabilitada` | set (bool) | Eventos › menu ⋯ turma | Liga/desliga a Avaliação da turma. |
| 850 | `turmas/<tk>/apostaHabilitada` | set (bool) | Eventos › menu ⋯ turma | Liga/desliga a Construção da Aposta. |
| 867 | `turmas-config/<tk>/dataConclusao` | once | Eventos › "✓ Encerrar turma" | Verifica se já existe data de conclusão. |
| 871 | `turmas-config/<tk>/{encerrada,dataConclusao}` | update-multipath (raiz) | Eventos › "✓ Encerrar turma" | Marca turma encerrada e, se faltar, grava `dataConclusao = hoje`. |
| 1037 | `turmas-publico/<tk>` **ou** `eventos-publico/<ek>` | update (ref, filhos `<eKey>`) | Eventos › aviso de divergência "Incluir as N na lista" | Adiciona em lote à lista restrita quem está na turma e fora da lista. |
| 1540 | `turmas-checkin/<tk>/<dia>/<eKey>` | remove | Eventos › tabela participantes (✓ adm/qr) | Remove uma presença. |
| 1606 | `turmas-interesse/<tk>/<eKey>` | update (ref) | Eventos › "Remover" (sem ir para a espera) | Soft-delete do participante com motivo/destino/substituta. |
| 1730 | `turmas-interesse/<tk>/<eKey>/…` | update-multipath (raiz) | Eventos › quem saiu › "+ registrar/completar motivo" | Preenche motivo de saída posteriormente. |
| 1780 | `turmas-interesse/<tk>/<eKey>`, `turmas-interesse-log/<tk>/<eKey>`, `turmas-checkin/<tk>/<dia>/<eKey>` (cada dia) | update-multipath (raiz) com `null` | Eventos › quem saiu › "🗑 excluir registro" | Hard-delete do registro da pessoa naquela turma (registro, log e presenças). |
| 1890 | `turmas-config/<tk>/diaAtivo` | set (string ISO date) | Eventos › "Abrir check-in" | Abre check-in para um dia. |
| 1897 | `turmas-config/<tk>/diaAtivo` | set `null` | Eventos › "Fechar check-in" | Fecha check-in. |
| 1904-1905 | `turmas-checkin/<tk>/<dia>/<eKey>` | set | Eventos › célula "—" (presença retroativa) | Registra presença manual (`source:'admin'`). |
| 2104 | `turmas-sorteio/<tk>` | once | Eventos › Sorteio (modal) | Histórico de sorteios da turma. |
| 2098 | `turmas-sorteio/<tk>` | remove | Eventos › Sorteio › "Limpar histórico" | Apaga todos os sorteios da turma. |
| 2182 | `turmas-sorteio/<tk>/<pushId>` | push | Eventos › Sorteio › "Sortear para valer" | Registra um sorteio (ensaio não grava). |
| 2217 | `turmas-sorteio` | once | Aba Sorteios (`loadSorteios`) | Lê todos os sorteios de todas as turmas. |
| 2444 | `turmas-interesse/<tk>` | once | Eventos › Remover/Registrar motivo "Substituída" (`escolherSubstituta`) | Lista candidatas a substituta na mesma turma. |
| 2741 | `fa-users` | once | Eventos › "＋ Participante" | Carrega todos os cadastros para a busca. |
| 2857-2858 | `turmas-interesse/<tk>/<eKey>` | once | Eventos › "＋ Participante" | Verifica se a pessoa já está ativa na turma. |
| 2877 | `turmas-interesse/<tk>/<eKey>` + `turmas-interesse/<outra>/<eKey>/{removed,removedDate,removedReason}` | update-multipath (raiz) | Eventos › "＋ Participante" | Cria o registro e (se inscrita) remove inscrição em outra turma. |
| 3075 | `eventos/<ek>` | update (ref) | Eventos › "✎ Editar evento" | Atualiza campos do evento. |
| 3083 | `eventos/<pushId>` | push().set | Eventos › "+ Novo evento" | Cria evento. |
| 3210 | `turmas/<tk>` | update (ref) | Eventos › "✎ Editar turma" | Atualiza campos da turma. |
| 3218 | `turmas/<pushId>` | push().set | Eventos › "+ Nova turma" | Cria turma. |
| 3250 | `turmas/<tk>`, `turmas-interesse/<tk>`, `turmas-config/<tk>`, `turmas-checkin/<tk>`, `turmas-interesse-log/<tk>`, `turmas-equipe/<tk>`, `turmas-roteiro/<tk>`, `turmas-sorteio/<tk>`, `turmas-publico/<tk>` | update-multipath (raiz) com `null` | Eventos › "🗑 Excluir turma" | Apaga a turma e tudo que é indexado por ela. |
| 3334 | `turmas-publico/<tk>` ou `eventos-publico/<ek>` | once | Modal "👥 Público restrito" | Lista atual. |
| 3335 | `fa-users` | once | Modal "👥 Público restrito" | Candidatos a incluir. |
| 3340 / 3341 | `turmas-interesse` (evento) / `turmas-interesse/<tk>` (turma) | once | Modal "👥 Público restrito" | Mostra se cada pessoa da lista está na turma/evento. |
| 3410 | `turmas-publico/<tk>/<eKey>` ou `eventos-publico/<ek>/<eKey>` | remove | Modal Público restrito › "Remover" | Tira a pessoa da lista (não da turma). |
| 3504 | `turmas-publico/<tk>/<eKey>` ou `eventos-publico/<ek>/<eKey>` | set | Modal Público restrito › "Incluir pessoa" | Inclui pessoa na lista. |
| 3571 | `turmas-interesse/<tk>/<eKey>` (N) + `turmas-interesse/<outra>/<eKey>/{removed,removedDate,removedReason}` | update-multipath (raiz) | Modal Público restrito (turma) › "＋ Adicionar à turma as N" | Matrícula em massa como Inscritas. |
| 3612 (→ roteiro.js 613) | `turmas-equipe/<tk>` | once | Eventos › "👥 Equipe de facilitação" | Carrega equipe da turma. |
| 3613 | `fa-facilitadores` | once | Eventos › Equipe de facilitação | Facilitadores cadastrados (filtra `ativo !== false`). |
| 3662 (→ roteiro.js 647-651) | `turmas-equipe/<tk>/<facKey>` = null [+ `turmas/<tk>/responsavelFacilitadorKey` = null] | update-multipath (raiz) | Equipe › "Remover" | Remove da equipe. |
| 3670, 3684 (→ roteiro.js 632-642) | `turmas/<tk>/responsavelFacilitadorKey`, `turmas-equipe/<tk>/<facKey>`, [`turmas-equipe/<tk>/<anterior>/papel`] | update-multipath (raiz) | Equipe › "Tornar responsável" / Adicionar como Responsável | Troca atômica de responsável. |
| 3688 (→ roteiro.js 643-646) | `turmas-equipe/<tk>/<facKey>` | set | Equipe › Adicionar como Facilitador | Adiciona facilitador de apoio. |
| 3719, 3744-3745 (→ roteiro.js) | `roteiros-evento/<ek>/…`, `turmas-roteiro/<tk>/…`, `turmas-equipe/<tk>` | delegado | Eventos › "📋 Roteiro" / "📋 Roteiro da turma" | Editor de roteiro vive em roteiro.js (fora do escopo). |
| 3764 | `turmas-interesse/<outraTk>/<eKey>` (N candidatos × M turmas) | once (em laço) | `checkOutrasTurmas` — Confirmar, ＋ Participante, matrícula em massa | Descobre se a pessoa já é inscrita em outra turma. |
| 3784 | `turmas-config/<tk>/finalizada` | set true | Eventos › "Encerrar interesse" | Fecha captação de interesse. |
| 3797 | `turmas-config/<tk>/{finalizada=false, diaAtivo=null}` | update-multipath (raiz) | Eventos › "↺ Reabrir" | Reabre interesse e fecha check-in. |
| 3846 | `turmas-interesse/<tk>/<eKey>/{status,confirmedByAdmin,confirmedByAdminName,confirmedDate}` + overlaps | update-multipath (raiz) | Eventos › "Confirmar" | Confirma inscrição (e remove a de outra turma). |
| 3848 | `turmas-interesse-log/<tk>/<eKey>/<pushId>` | push | Eventos › "Confirmar" | Log `action:'confirmado'` (após sucesso, **fora** da gravação atômica). |
| 3868 | `turmas-interesse/<tk>/<eKey>/{status='interessado', confirmedBy*=null, confirmedDate=null}` | update-multipath (raiz) | Eventos › "Desconfirmar" | Desfaz confirmação. |
| 3870 | `turmas-interesse-log/<tk>/<eKey>/<pushId>` | push | Eventos › "Desconfirmar" | Log `action:'desconfirmado'` (fora da atômica). |
| 4035, 4036 | `turmas-interesse-log`, `turmas-interesse` | once | Eventos › "↓ Histórico" (CSV) | Monta histórico de ações. |
| 4135-4138 | `fa-seeds-hidden`, `fa-seeds-deleted`, `fa-holocron-hidden`, `holocron` | once (Promise.all) | Aba Repositório (`loadRepoAdmin`) | Estado de moderação do repositório. |
| 4185 | `fa-seeds-hidden/<seedKey>` | remove | Repositório › seed "Restaurar" | Reexibe seed curado. |
| 4189 | `fa-seeds-hidden/<seedKey>` | set true | Repositório › seed "Ocultar" | Oculta seed curado. |
| 4199 | `fa-seeds-deleted/<seedKey>`, `fa-seeds-hidden/<seedKey>` | update-multipath (raiz) | Repositório › seed "Deletar" | "Deleta" seed (flag). |
| 4236 | `fa-holocron-hidden/<k>` | remove | Repositório › item de usuário "Restaurar" | Reexibe item. |
| 4240 | `fa-holocron-hidden/<k>` | set true | Repositório › item "Ocultar" | Oculta item. |
| 4247, 4248 | `holocron/<k>` então `fa-holocron-hidden/<k>` | remove + remove (sequencial, não atômico) | Repositório › item "Deletar" | Apaga item enviado por usuário e sua flag. |
| 4262 | (Firebase Auth) | `sendPasswordResetEmail(email)` | Cadastrados › ⋯ › "Redefinir senha" | Envia e-mail de redefinição. |
| 4308-4311 | `fa-espera`, `turmas`, `turmas-config`, `turmas-interesse` | once (encadeados) | Eventos › Lista de Espera por evento (`loadEspera`) | Monta as filas. |
| 4522 | `fa-espera/<eKey>` | once | Lista de Espera › "Remover da lista" | Lê as entradas da pessoa. |
| 4538 | `fa-espera/<eKey>/<origem>/{removed,removedDate,motivoSaida,motivoSaidaDetalhe,removedByName,[jaParticipouTurma,jaParticipouTurmaLabel]}` (todas as origens do evento) | update-multipath (raiz) | Lista de Espera › "Remover da lista" | Soft-delete da pessoa na fila daquele evento. |
| 4637 | `fa-espera/<eKey>` | once | Lista de Espera › Saíram › "🗑 excluir registro" | Detecta formato antigo. |
| 4640 | `fa-espera/<eKey>` (antigo) ou `fa-espera/<eKey>/<origem>` | remove | idem | Hard-delete de entrada da fila. |
| 4770 | `fa-espera/<eKey>/<tk>` | once | Eventos › Remover com "colocar na lista de espera" (`migrarParaEspera`) | Lê entrada existente da mesma origem (preserva data mais antiga). |
| 4809 | `turmas-interesse/<tk>/<eKey>/…` + `fa-espera/<eKey>/<tk>` | update-multipath (raiz) | idem | Tira da turma e põe na fila, atomicamente. |
| 4843 | `fa-espera/<eKey>` | once | Lista de Espera › "Mover para turma" (`moverParaTurma`) | Lê as entradas ativas da pessoa. |
| 4851 | `turmas-interesse/<tk>/<eKey>` + `fa-espera/<eKey>/<origem>/{removed,removedDate,movedToTurma}` | update-multipath (raiz) | idem | Inscreve na turma e fecha as entradas da fila do evento. |
| 4877 | `treinamentos` | once | Aba Treinamentos (`loadTreinamentosList`) | Lista treinamentos. |
| 4897, 4899 | `treinamentos`, `eventos` | once | Boot (seed `seedTreinamentoPadrao`) | Se não há treinamento, lê eventos. |
| 4903 | `treinamentos/<pushId>` | push().set | Boot (seed) | Cria treinamento padrão ligado a todos os eventos. |
| 4921 | `treinamentos-conteudo` | once | Aba Treinamentos | Conteúdo próprio de cada treinamento. |
| 5118-5122 | `treinamentos/<k>` (update) / `treinamentos/<pushId>` (push().set) | update / push().set | Treinamentos › Editar / "+ Novo treinamento" | Salva nome, conteúdoKey, eventos. |
| 5389 | `treinamentos-conteudo/<k>` | set (substitui) | Treinamentos › "✎ Editar conteúdo" | Salva blocos/levels/ranks. |
| 5417 | `treinamentos/<k>` | remove | Treinamentos › "🗑 Excluir" | Exclui treinamento (não apaga `treinamentos-conteudo/<k>`). |
| 5476, 5478 | `turmas-interesse`, `turmas-publico`, `eventos-publico`, `turmas-equipe`, `turmas-checkin`, `fa-admins`, `fa-diretores`, `fa-facilitadores` (nós inteiros) + `fa-espera/<eKey>` | once (Promise.all) | Cadastrados › "✎ Editar" (`lerCopiasDaPessoa`) | Descobre todas as cópias de nome/área da pessoa. |
| 5528, 5530, 5531 | 15 nós inteiros (ver §5.11) + `pedidos` + `holocron` | once (Promise.all) | Cadastrados › Editar › corrigir e-mail (`moverDadosDePessoa`) | Lê tudo para mover a pessoa de chave. |
| 5589 | `fa-users-log/<eKeyNovo>` | push().key (só gera id) | idem | Id do log. |
| 5598 | (dezenas de caminhos, ver §2) | update-multipath (raiz) | idem | Move todos os dados da pessoa para a nova `eKey`. |
| 5642 | `players` **orderByChild('email').equalTo(email)** | query + once | Cadastrados › ⋯ › "Resetar progresso" | Acha os registros `players/<k>` da pessoa. |
| 5644 | `fa-progress/<eKey>`=null, `fa-progress-historico/<eKey>`=null, `fa-reset-signal/<eKey>`={at:ServerValue.TIMESTAMP}, `players/<k>`=null | update-multipath (raiz) | idem | Apaga progresso do jogo e sinaliza reset ao cliente da pessoa. |
| 5657 | `fa-users/<eKey>/blocked` | set true / null | Cadastrados › ⋯ › Bloquear/Desbloquear | Bloqueia acesso. |
| 5674 | `fa-users/<eKey>/{adminApproved,approvedByAdmin,approvedByAdminName,approvedAt}` | update-multipath (raiz) | Cadastrados › ⋯ › "Confirmar cadastro" | Aprova cadastro sem verificação de e-mail. |
| 5912 | `fa-users-log/<eKey>` | push().key | Cadastrados › Editar (nome/área) | Id do log. |
| 5920 | `fa-users/<eKey>/{name,area}` + cópias + log | update-multipath (raiz) | Cadastrados › Editar | Propaga nome/área para todas as cópias. |
| 5938 (→ auth.js 473) | (Firebase Auth) | `signInWithEmailAndPassword(antigo,'12345678')` → `updateEmail` → `signOut` → `signIn(admin)` | Cadastrados › Editar › corrigir e-mail | Troca o login antes de mover dados. |
| 5965 | `fa-users` | once (Promise) | Aba Cadastrados (`loadCadastrados`) | Lista todos os cadastros. |
| 6013 (→ auth.js 516) | (Firebase Auth) + `fa-users/<eKey>` set | `createUserWithEmailAndPassword` + set + signOut + signIn(admin) | Cadastrados › "+ Criar conta para colaboradora" | Cria conta com senha padrão. |
| 6143 | `fa-admins` | once | Aba Administradores | Lista admins adicionais. |
| 6190 | `fa-admins/<eKey>` | remove | Administradores › "Remover" (só super-admin) | Remove admin. |
| 6228 | `fa-admins/<eKey>` | set | Administradores › "Adicionar" (só super-admin) | Adiciona admin. |
| 6264 | `roteiro-tipos-atividade` | once | Aba Tipos de atividade | Lista tipos. |
| 6270, 6273 | `roteiro-tipos-atividade` | push().key ×N + set (nó inteiro) | Tipos de atividade (seed se vazio) | Semeia com `faRoteiro.TIPOS_ATIVIDADE_PADRAO`. |
| 6326 | `roteiro-tipos-atividade/<k>` | remove | Tipos › "Remover" | Remove tipo. |
| 6345 | `roteiro-tipos-atividade/<k>/nome` | set | Tipos › "Editar" › Salvar | Renomeia tipo. |
| 6370-6371 | `roteiro-tipos-atividade/<pushId>` | push().key + set | Tipos › "Adicionar" | Cria tipo. |
| 6398 | `fa-diretores` | once | Aba Diretores | Lista diretores. |
| 6442 | `fa-diretores/<eKey>` | remove | Diretores › "Remover" | Remove diretor. |
| 6469 | `fa-diretores/<eKey>` | set | Diretores › "Adicionar" | Adiciona diretor. |
| 6518-6522 | `fa-facilitadores`, `turmas-equipe`, `turmas`, `turmas-config`, `eventos` | once (Promise.all) | Aba Facilitadores | Lista + contagem "Próximas turmas" + ficha "Ver". |
| 6600 | `fa-facilitadores/<eKey>` | remove | Facilitadores › "Remover" | Remove cadastro (não mexe em `turmas-equipe`). |
| 6609 | `fa-facilitadores/<eKey>/ativo` | set bool | Facilitadores › selo ATIVO/INATIVO | Alterna ativo. |
| 6639 | `fa-facilitadores/<eKey>` | set | Facilitadores › "Adicionar" | Adiciona facilitador. |
| 6989 | `turmas-interesse/<tk>` | once | Aba Certificados (`loadInscritos`) | Inscritos da turma. |
| 7003 | `eventos/<ek>` | once | Certificados (fallback se evento não está no cache) | Nome/carga do evento. |
| 7043 | `turmas-config/<tk>` | once | Certificados | `dataConclusao`, `encerrada`. |
| 7049 | `turmas-checkin/<tk>` | once | Certificados | Presenças para calcular frequência. |

---

## 2. Gravações multi-caminho (atômicas)

Toda chamada abaixo é `firebase.database().ref().update(updates)` (ou `ref(x).update(obj)` com vários filhos), aplicada atomicamente pelo RTDB. No backend cada uma deve virar **uma transação MongoDB** (ou um único `updateOne/bulkWrite` quando couber num documento).

| linha | função | caminhos gravados juntos | por quê |
|---|---|---|---|
| 158 | `migrarEsperaPorOrigem` | `fa-espera/<eKey>` = `{<origem>: v}` para N pessoas | Migração de formato; substitui o nó inteiro porque escrever filho e apagar pai no mesmo update é caminho sobreposto. |
| 221 | `migrarEsperaEventoKey` | `fa-espera/<eKey>/<origem>/eventoKey` para N entradas | Migração idempotente. |
| 254 | `seedMissaoJornadaImersao` | `eventos/<ek>/missaoTitulo`, `/missaoTexto`, `/topicos`, `/itinerario` | Seed de conteúdo de um evento. |
| 273 | `migrateNameCase` | `fa-admins/<k>/name`, `fa-admins/<k>/email` (N) | Normalização de caixa. |
| 292 | `migrateNameCase` | `turmas-interesse/<tk>/<eKey>/name` (N) | Normalização de caixa. |
| 871 | Encerrar turma | `turmas-config/<tk>/encerrada = true`; `turmas-config/<tk>/dataConclusao = hoje` (só se vazio, lido em 867) | Encerrar e fixar data de emissão do certificado juntos. |
| 1037 | "Incluir as N na lista" | `turmas-publico/<tk>/<eKey_i>` (ou `eventos-publico/<ek>/<eKey_i>`) = registro, para cada i | Regulariza em lote quem está na turma fora da lista. |
| 1730 | `registrarMotivoDepois` | em `turmas-interesse/<tk>/<eKey>/`: `removedMotivo`, `removedReason`, [`removedParaTurma`, `removedParaTurmaLabel`] ou [`jaParticipouTurma`, `jaParticipouTurmaLabel`], [`substituidaPor`, `substituidaPorNome`], `motivoCompletadoEm`+`motivoCompletadoPor` **ou** `motivoRegistradoEm`+`motivoRegistradoPor` | Campos de um mesmo registro; atomicidade natural num documento. |
| 1780 | `excluirRegistro` | `turmas-interesse/<tk>/<eKey>` = null; `turmas-interesse-log/<tk>/<eKey>` = null; `turmas-checkin/<tk>/<dia>/<eKey>` = null para **cada** dia de `turmas/<tk>/dias` | Hard-delete de tudo daquela pessoa naquela turma. |
| 2877 | "＋ Participante" | `turmas-interesse/<tk>/<eKey>` = registro completo; para cada overlap: `turmas-interesse/<outra>/<eKey>/removed=true`, `/removedDate`, `/removedReason="Inscrita automaticamente na turma \"<label>\""` | Garante exclusividade de inscrição (ninguém inscrita em 2 turmas). |
| 3250 | `deleteTurma` | `turmas/<tk>`, `turmas-interesse/<tk>`, `turmas-config/<tk>`, `turmas-checkin/<tk>`, `turmas-interesse-log/<tk>`, `turmas-equipe/<tk>`, `turmas-roteiro/<tk>`, `turmas-sorteio/<tk>`, `turmas-publico/<tk>` — todos `null` | Exclusão em cascata. **Não** apaga `avaliacoes/<tk>`, `apostas/<tk>` nem entradas `fa-espera/<eKey>/<tk>` (origem = turma). |
| 3571 | `matricularNaTurma` | `turmas-interesse/<tk>/<eKey_i>` = `registroInscricaoAdmin(...,'inscrito')` para cada i; overlaps como em 2877 | "Ou entra todo mundo, ou ninguém" (comentário l. 3524-3525). |
| roteiro.js 641 (chamado em 3670/3684) | `definirResponsavel` | `turmas/<tk>/responsavelFacilitadorKey`; `turmas-equipe/<tk>/<facKey>` = `{email,name,papel:'responsavel',addedAt}`; [`turmas-equipe/<tk>/<anterior>/papel = 'facilitador'`] | Invariante: no máximo 1 responsável por turma, apontado em dois lugares. |
| roteiro.js 651 (chamado em 3662) | `removerDaEquipe` | `turmas-equipe/<tk>/<facKey>` = null; [`turmas/<tk>/responsavelFacilitadorKey` = null se era responsável] | Mantém os dois ponteiros coerentes. |
| 3797 | `reopenTurma` | `turmas-config/<tk>/finalizada = false`; `turmas-config/<tk>/diaAtivo = null` | Reabrir fecha check-in junto. |
| 3846 | `confirmarInscrito` | `turmas-interesse/<tk>/<eKey>/status='inscrito'`, `/confirmedByAdmin`, `/confirmedByAdminName`, `/confirmedDate`; overlaps (removed/removedDate/removedReason) | Confirmação + exclusividade. O push de log (3848) é **posterior e separado**. |
| 3868 | `desconfirmarInscrito` | `turmas-interesse/<tk>/<eKey>/status='interessado'`, `/confirmedByAdmin=null`, `/confirmedByAdminName=null`, `/confirmedDate=null` | Idem; log (3870) separado. |
| 4199 | Repositório › Deletar seed | `fa-seeds-deleted/<sk> = true`; `fa-seeds-hidden/<sk> = true` | Flags juntas. |
| 4538 | Remover da lista de espera | para cada entrada ativa de `fa-espera/<eKey>/<origem>` do evento: `removed`, `removedDate`, `motivoSaida`, `motivoSaidaDetalhe`, `removedByName`, [`jaParticipouTurma`, `jaParticipouTurmaLabel`] | Sai de todas as origens daquele evento de uma vez. |
| 4809 | `migrarParaEsperaGravar` | `turmas-interesse/<tk>/<eKey>/`: `removed`, `removedDate`, `removedReason`, `movedToEspera`, `removedMotivo`, [`substituidaPor`, `substituidaPorNome`, `substituidaEm`, `substituidaPorAdmin`], `removedByAdmin`, `removedByAdminName`; **e** `fa-espera/<eKey>/<tk>` = registro completo | Tirar da turma e entrar na fila são uma decisão só. |
| 4851 | `moverParaTurma` | `turmas-interesse/<tk>/<eKey>` = registro inscrito completo; para cada entrada ativa da fila do mesmo evento (ou sem evento): `fa-espera/<eKey>/<origem>/removed`, `/removedDate`, `/movedToTurma` | Entrar na turma e sair da fila juntos. |
| 5598 | `moverDadosDePessoa` (corrigir e-mail) | Para cada caminho da pessoa em 15 nós: `<no>/<...>/<eKeyNovo>` = cópia (name/area/email corrigidos) **e** `<no>/<...>/<eKeyAntigo>` = null; `fa-users/<eKeyNovo>` = cadastro + `emailCorrigidoDe`; `pedidos/<k>/emailEnviou`, `pedidos/<k>/nomeEnviou` (onde `emailEnviou` == antigo); `holocron/<k>/authorEmail` (onde == antigo); `fa-users-log/<eKeyNovo>/<pushId>` = log | "Ou a pessoa inteira muda de endereço, ou nada" (l. 5521-5524). |
| 5644 | `acaoResetarProgresso` | `fa-progress/<eKey>` = null; `fa-progress-historico/<eKey>` = null; `fa-reset-signal/<eKey>` = `{at: ServerValue.TIMESTAMP}`; `players/<k>` = null para cada resultado da query por e-mail | Reset total do jogo + sinal ao cliente. |
| 5674 | `acaoConfirmarCadastro` | `fa-users/<eKey>/adminApproved`, `/approvedByAdmin`, `/approvedByAdminName`, `/approvedAt` | Campos do mesmo documento. |
| 5920 | `salvarCampos` (editar cadastro) | `fa-users/<eKey>/name`, `/area`, [`/email`]; para cada cópia (§5.10): `<path>/name` (MAIÚSCULA em turmas-publico/eventos-publico), `<path>/area`, [`<path>/email`]; `fa-users-log/<eKey>/<pushId>` | Propagação atômica do nome desnormalizado. |
| 6273 | Seed de tipos de atividade | `roteiro-tipos-atividade` = `{<pushId_i>: {nome, createdAt}}` (set no nó inteiro) | Seed inicial. |

Gravações que **parecem** compostas mas **não** são atômicas (o backend pode/deve torná-las atômicas):
- 3846 → 3848 e 3868 → 3870: o log em `turmas-interesse-log` é um `push` separado, feito só se a primeira gravação deu certo.
- 4247 → 4248: `holocron/<k>` removido e depois `fa-holocron-hidden/<k>` removido.
- auth.js `criarContaPorAdmin` / `corrigirEmailPorAdmin` + `moverDadosDePessoa`: Firebase Auth e banco são dois sistemas; a ordem (Auth primeiro) é deliberada (l. 5927-5932).
- `migrarParaEspera` (4770 → 4809), `moverParaTurma` (4843 → 4851), `excluirRegistroDaFila` (4637 → 4640), Encerrar turma (867 → 871), Remover da espera (4522 → 4538), "＋ Participante" (2858 → 2877): **read-then-write sem transação** (condição de corrida possível).

---

## 3. Campos observados por nó (gravados por admin.js)

Tipos: `str`, `bool`, `num`, `ISO` = string `new Date().toISOString()`, `date` = `'YYYY-MM-DD'`, `null` = remoção.

### `eventos/<ek>` (3058-3073, 3081-3082, 254)
- `nome` str (obrigatório) · `cargaHoraria` **str** (número em string, ≥1) · `percentualMinimo` **str** (1-100; lido como `Number`)
- `missaoTitulo` str · `missaoTexto` str · `topicos` str · `itinerario` str[]
- `esperaAtiva` bool (ausente = true) · `publicado` bool (ausente = true) · `restritoADiretores` bool · `publicoRestrito` bool
- `formato` str enum `presencial|remoto|hibrido`
- `modalidadeLabel` str enum `''|Prática|Teórica|Mista` · `modalidadeDesc` str · `publicoLabel` str enum `''|Opcional|Obrigatória` · `publicoDesc` str enum `''|Diretores|Executivos|Cedidos|Quadro próprio`
- só na criação: `order` num (`Date.now()`), `createdAt` ISO

### `turmas/<tk>` (3208, 3216-3217, 828, 850; roteiro.js 634/650)
- `label` str · `dias` date[] (ordenado, ≥1) · `horarioInicio` str `HH:MM` · `horarioFim` str `HH:MM` (> início) · `cmflexLink` str · `resultadoEsperado` str · `eventoKey` str (pode ser `''`) · `publicoRestrito` bool
- `avaliacaoHabilitada` bool · `apostaHabilitada` bool · `responsavelFacilitadorKey` str|null (via roteiro.js)
- só na criação: `order` num, `createdAt` ISO

### `turmas-config/<tk>` (871, 1890, 1897, 3784, 3797)
- `finalizada` bool (interesse encerrado) · `encerrada` bool (turma realizada) · `dataConclusao` date · `diaAtivo` date|null

### `turmas-interesse/<tk>/<eKey>`
Registro completo criado por admin (`registroInscricaoAdmin`, 437-454; e `moverParaTurma`, 4831-4838):
- `name` str (MAIÚSCULA) · `email` str (minúscula) · `area` str · `date` ISO · `status` `'interessado'|'inscrito'` (o site também grava `'removido'`)
- `addedByAdmin` bool true · `addedByAdminName` str
- se inscrito: `confirmedByAdmin` str (e-mail) · `confirmedByAdminName` str · `confirmedDate` ISO
- `moverParaTurma` grava em vez de addedBy*: `removed:false`, `fromEspera:true`
Campos de remoção/saída (1587-1605, 1706-1729, 2873-2875, 4778-4790):
- `removed` bool · `removedDate` ISO · `removedReason` str · `removedMotivo` str enum (MOTIVOS_REMOCAO_TURMA: `a_pedido, outra_turma, sem_vagas, substituida, data_nao_serviu, ja_participou, nao_responde, duplicado, teste, evento_encerrado, outro`)
- `removedParaTurma` str · `removedParaTurmaLabel` str · `jaParticipouTurma` str · `jaParticipouTurmaLabel` str
- `substituidaPor` str (e-mail ou null) · `substituidaPorNome` str · `substituidaEm` ISO · `substituidaPorAdmin` str
- `removedByAdmin` str (e-mail) · `removedByAdminName` str · `movedToEspera` bool
- `motivoRegistradoEm` ISO · `motivoRegistradoPor` str · `motivoCompletadoEm` ISO · `motivoCompletadoPor` str
- Confirmar/desconfirmar: `status`, `confirmedByAdmin`, `confirmedByAdminName`, `confirmedDate` (null ao desconfirmar)
- Lidos mas não gravados por admin.js: `motivoNaoConfirmado` (legado: `sem_vagas|ja_participou|substituida`).
- Propagação de cadastro: `name`, `area`, `email`.

### `turmas-interesse-log/<tk>/<eKey>/<pushId>` (3848, 3870)
- `name`, `email`, `area` str · `action` `'confirmado'|'desconfirmado'` (o site grava `registrado|removido`) · `date` ISO · `adminName` str

### `turmas-checkin/<tk>/<date>/<eKey>` (1905)
- `name` str · `email` str · `area` str · `checkinAt` ISO · `source` `'admin'` (o QR grava outro valor)

### `turmas-publico/<tk>/<eKey>` e `eventos-publico/<ek>/<eKey>` (1030-1035, 3498-3503)
- `name` str MAIÚSCULA · `email` str · `area` str · `date` ISO · `addedBy` str (e-mail)|null · `addedByName` str|null

### `turmas-sorteio/<tk>/<pushId>` (2182-2187)
- `ganhadores` array de `{name, email}` · `quando` ISO · `sorteadoPorNome` str|null · `semRepetir` bool

### `turmas-equipe/<tk>/<facKey>` (via roteiro.js 635/644)
- `email` str · `name` str · `papel` `'responsavel'|'facilitador'` · `addedAt` ISO

### `fa-espera/<eKey>/<origem>` (4795-4808, 4528-4536, 4847-4849, 217)
- `name`, `email`, `area` str · `date` ISO (data do interesse original — ordena a fila) · `migratedAt` ISO · `migratedFrom` str (tk) · `eventoKey` str|null · `motivoEntrada` str · `motivoEntradaDetalhe` str · `migratedByName` str · `removed` bool
- saída: `removedDate` ISO · `motivoSaida` str enum (MOTIVOS_ESPERA_SAIDA: `desistiu, ja_participou, nao_responde, evento_encerrado, duplicado, outro`) · `motivoSaidaDetalhe` str|null · `removedByName` str · `jaParticipouTurma`, `jaParticipouTurmaLabel` str · `movedToTurma` str (tk)
- lidos, gravados pelo site: `removedBySelf`.

### `fa-users/<eKey>` (5657, 5674, 5892-5894, 5566-5568; auth.js 527-532)
- `name` str · `area` str · `email` str · `blocked` true|null · `adminApproved` bool · `approvedByAdmin` str · `approvedByAdminName` str · `approvedAt` ISO · `emailCorrigidoDe` str
- criado por auth.js `criarContaPorAdmin`: `email, name (MAIÚSCULA), area, adminApproved:true, createdByAdmin (e-mail do admin), createdAt ISO`
- lidos: `createdByAdmin` (habilita correção de e-mail), `emailVerificationRequired`, `createdAt`.

### `fa-users-log/<eKey>/<pushId>` (5913-5919, 5590-5596)
- `mudancas` array de `{campo: 'nome'|'area'|'email', de, para}` · `porAdmin` str · `porAdminNome` str · `quando` ISO · `copiasAtualizadas` num **ou** `registrosMovidos` num

### `fa-reset-signal/<eKey>` (5641)
- `at`: `ServerValue.TIMESTAMP` (num, epoch ms do servidor)

### `fa-admins/<eKey>`, `fa-diretores/<eKey>` (6229, 6470, 269-270)
- `email` str minúscula (@previ.com.br) · `name` str MAIÚSCULA · `addedAt` ISO

### `fa-facilitadores/<eKey>` (6640, 6609)
- `email` · `name` MAIÚSCULA · `addedAt` ISO · `ativo` bool

### `treinamentos/<k>` (5116, 5120, 4903-4908)
- `nome` str · `conteudoKey` str (`''` = conteúdo próprio) · `eventos` map `{<ek>: true}` · `order` num · `createdAt` ISO

### `treinamentos-conteudo/<k>` (5379-5388, set substitui tudo)
- `blocos` array de `{id, label, icon, afirmacoes: str[]}` · `levels` str[] (≥2) · `ranks` array de `{id, name (obrigatório), tag, icon, sym, minDiag num, maxDiag num, desc, carac str[], proximo str[], frase}` · `atualizadoEm` ISO · `atualizadoPor` str

### `roteiro-tipos-atividade/<k>` (6271, 6345, 6371)
- `nome` str · `createdAt` ISO

### Repositório
- `fa-seeds-hidden/<seedKey>` = true · `fa-seeds-deleted/<seedKey>` = true (`seedKey` = URL do seed normalizada, 80 chars, l. 4124) · `fa-holocron-hidden/<k>` = true · `holocron/<k>` (só remoção; e `authorEmail` na correção de e-mail)

### `pedidos/<k>` (apenas correção de e-mail, 5578-5579)
- `emailEnviou` str · `nomeEnviou` str

### Outros removidos
- `fa-progress/<eKey>`, `fa-progress-historico/<eKey>`, `players/<k>` (reset).

---

## 4. Listeners em tempo real

**Nenhum.** admin.js não usa `.on('value')`, `.on('child_*')` nem `.off()`. Todas as telas do painel são leituras pontuais (`once`) e se atualizam **recarregando tudo** depois de cada ação (`loadInterests()`, `loadEspera()`, `loadCadastrados()`, `render()` local, `reload()` dos modais). Consequências para o backend:
- Um REST simples com re-GET após cada mutação reproduz o comportamento atual; WebSocket não é necessário para admin.js.
- As telas re-leem nós inteiros com frequência (`turmas-interesse`, `turmas-checkin`, `fa-users`, `fa-espera`) — vale ter endpoints agregados por tela (ex.: `GET /admin/eventos-painel` devolvendo turmas+eventos+interesse+config+checkin+publico de uma vez) para o caminho lento de 4G.
- Os modais de público restrito sincronizam o cache local manualmente após gravar (`sincronizarCache`, 3291-3299), exatamente porque não há listener.

---

## 5. Fluxos compostos importantes

### 5.0 Carga do painel (`initAdmin`, 80-131)
1. Espera `fa-auth-ready` e `fa-admin-ready` (auth.js). Sai se `!faAuth.isAdmin(email)`.
2. Dispara em paralelo, **a cada abertura do painel**, migrações/seeds idempotentes: `migrateNameCase` (261/273, 278/292), `migrarEsperaPorOrigem` (144/158), `migrarEsperaEventoKey` (193-221), `seedMissaoJornadaImersao` (238/254), `seedTreinamentoPadrao` (4897-4909).
3. Carrega todas as abas: Eventos (`loadInterests` → `loadEspera`), Repositório, Cadastrados, Administradores, Tipos de atividade, Diretores, Facilitadores, Sorteios, Treinamentos, Certificados.
**Backend:** as migrações devem virar scripts únicos de migração de dados (não endpoints chamados pelo cliente). A checagem de admin precisa ser server-side (lista fixa `SUPER_ADMINS` l. 75 + coleção de admins).

### 5.1 Criar / editar evento (`openEventoFormModal`, 2906-3090)
- Lê: nada além do cache `EVENTOS_LIST`.
- Validação no cliente (3051-3057): `nome` não vazio; `cargaHoraria` numérica ≥ 1; `percentualMinimo` numérico 1-100; itens vazios do itinerário descartados; strings `trim()`.
- Grava: editar → `eventos/<ek>` update (merge, 3075); criar → `eventos` push().set com `order=Date.now()`, `createdAt` (3083).
- Não há exclusão de evento em admin.js (só de turma).
- Regras: `eventos` só grava admin (rules). **Backend:** validar enums (`formato`, `modalidadeLabel`, `publicoLabel`, `publicoDesc`) e tipos (hoje carga/percentual são gravados como string).

### 5.2 Criar / editar / excluir turma
- Criar/editar (`openTurmaFormModal`, 3093-3225). Validação (3202-3205): `label` não vazio; ≥1 data; horário início e fim preenchidos; `fim > início` (comparação de string HH:MM); datas ordenadas e vazias descartadas. Grava `turmas/<tk>` update (3210) ou push().set com `order`, `createdAt` (3218). `eventoKey` pode ser `''` (turma sem evento).
- Flags pontuais: `avaliacaoHabilitada` (828), `apostaHabilitada` (850).
- Ciclo de vida: Encerrar interesse → `turmas-config/<tk>/finalizada=true` (3784); Reabrir → `finalizada=false`+`diaAtivo=null` (3797); Abrir/fechar check-in → `diaAtivo` (1890/1897; o cliente só confirma com `confirm()` e avisa se o dia ≠ hoje); Encerrar turma (só aparece se `finalizada && !encerrada`) → lê `dataConclusao` (867) e grava `encerrada=true` + `dataConclusao=hoje` se ausente (871).
- Excluir (`deleteTurma`, 3228-3255): confirmação; update-multipath com 9 caminhos `null` (ver §2). **Não** limpa `avaliacoes/<tk>`, `apostas/<tk>`, entradas de fila com origem `<tk>`, nem `fa-espera/*/*.movedToTurma == tk`.
- **Backend:** encerrar deve ser atômico com o "se ausente" (hoje é read-then-write). Exclusão em cascata numa transação; decidir o que fazer com avaliacoes/apostas/fila.

### 5.3 Confirmar participante (`confirmarInscrito`, 3805-3857)
1. `barradoPeloPublico(tk, nome, eKey)` (516-538) usando caches `_publicoPorTurma/_publicoPorEvento` lidos em `loadInterests`: se o **evento** da turma é `publicoRestrito` a pessoa precisa estar em `eventos-publico/<ek>/<eKey>`; se a **turma** é restrita, em `turmas-publico/<tk>/<eKey>`. Se a leitura das listas falhou (`_publicoResolvido=false`) recusa.
2. `checkOutrasTurmas(tk, [eKey])` (3757-3772): lê `turmas-interesse/<outra>/<eKey>` para cada outra turma (N×M `once`); overlap = `!removed && status==='inscrito'` (**não** exige `confirmedByAdmin`).
3. Confirmação do admin; exige sessão (`sess`) — sem ela recusa (3831-3834), porque gravar `confirmedByAdmin: null` apagaria o campo.
4. Update-multipath (3846): status + 3 campos de confirmação + remoção automática das inscrições nas outras turmas.
5. Push de log `turmas-interesse-log/<tk>/<eKey>` (3848).
- Desconfirmar (3859-3878): update-multipath limpando os campos (3868) + log (3870). Não checa sessão (grava `adminName:'Admin'` se faltar).
- Critério de "inscrição válida" (418-425): `!removed && status==='inscrito' && confirmedByAdmin`.
**Backend deve impor:** admin autenticado como `confirmedByAdmin`; regra de público restrito (evento e turma); exclusividade (1 inscrição válida por pessoa entre todas as turmas), numa transação; log dentro da mesma transação.

### 5.4 "＋ Participante" (`addParticipante`, 2623-2903)
1. Lê `fa-users` inteiro (2741); filtra por público restrito do evento e da turma (2746-2755).
2. Validação: pessoa selecionada; status `interessado|inscrito`; se `inscrito` exige sessão (2847); `barradoPeloPublico` de novo (2855).
3. Lê `turmas-interesse/<tk>/<eKey>` (2858): recusa se existe e `!removed` ("já está na turma"). Se existir removido, é **sobrescrito**.
4. Se `inscrito`: `checkOutrasTurmas` + confirmação dos overlaps.
5. Update-multipath (2877): registro de `registroInscricaoAdmin` (437) + remoção dos overlaps. **Não** grava log.
**Backend:** mesma regra de exclusividade/público; upsert condicionado a "não ativo".

### 5.5 Matrícula em massa pelo modal de público restrito (`matricularNaTurma`, 3526-3577)
Exige sessão; filtra por `barradoPeloPublico` pessoa a pessoa; `checkOutrasTurmas` para todas; confirmação; update-multipath (3571) com N registros `inscrito` + remoção de overlaps. Sem log.

### 5.6 Mover da lista de espera para turma (`moverParaTurma`, 4815-4856)
1. UI (4488-4495): turma escolhida entre as do **mesmo evento** (ou qualquer uma, para órfãs) e com `turmas-config/<tk>/encerrada != true`.
2. Exige sessão; `barradoPeloPublico`.
3. Lê `fa-espera/<eKey>` (4843); para cada entrada ativa (`faTurmasUtil.esperaAtivas`) cujo `eventoKey` é vazio ou igual ao evento da turma destino → marca `removed`, `removedDate`, `movedToTurma`.
4. Update-multipath (4851): `turmas-interesse/<tk>/<eKey>` = registro inscrito (sobrescreve inteiro, `fromEspera:true`, **sem** `addedByAdmin*`) + fechamento da fila.
- **Não** chama `checkOutrasTurmas`: esta porta não garante a exclusividade de inscrição (diferente de Confirmar/＋ Participante). Não grava log.

### 5.7 Remover participante (tabela da turma, 1557-1625)
Modal `adminConfirmComMotivo` (2500-2617), validações: motivo obrigatório; `outro` exige texto; motivos `pedeTurma` (`outra_turma`, `ja_participou`) exigem turma; caixa "colocar na lista de espera" vem marcada e some/desmarca em motivos que pedem turma. `substituida` abre `escolherSubstituta` (lê `turmas-interesse/<tk>`, 2444) — cancelar aborta.
- Sem espera: `turmas-interesse/<tk>/<eKey>` update (1606) com `removed, removedParaTurma[Label], removedDate, removedReason, removedMotivo, [jaParticipouTurma*], [substituida*], [removedByAdmin*]`. Não é multi-caminho, não gera log, não toca presenças (histórico preservado).
- Com espera (`migrarParaEspera`, 4762-4813): lê `fa-espera/<eKey>/<tk>` (4770) para preservar a data mais antiga; update-multipath (4809) soft-delete na turma + `fa-espera/<eKey>/<tk>` com `date` = data original do interesse (menor entre a atual e a existente), `eventoKey` da turma, `removed:false`.
- Pós-remoção: "+ registrar/completar motivo" (1695-1744, update 1730; completar trava o motivo original) e "🗑 excluir registro" (1767-1785, hard-delete em 1780).
- Remover presença isolada: 1540. Registrar presença retroativa: 1905.

### 5.8 Lista de espera — remover / excluir (4501-4646)
- Remover: `adminConfirmComMotivo` com MOTIVOS_ESPERA_SAIDA; lê `fa-espera/<eKey>` (4522) e marca como removidas **só** as entradas ativas do mesmo evento (ou órfãs) (4538). Não toca turmas.
- Excluir de vez (só aparece em "Saíram da fila"): lê `fa-espera/<eKey>` (4637); se formato antigo (`v.email` na raiz) remove o nó inteiro, senão só `fa-espera/<eKey>/<origem>` (4640).

### 5.9 Público restrito (turma/evento) (`openPublicoModal`, 3274-3580; e 1018-1048)
- Lê lista (3334), `fa-users` (3335) e `turmas-interesse` (inteiro para evento / da turma) (3340-3341).
- Incluir (3504): só cadastros existentes em `fa-users`; grava `{name MAIÚSCULA, email, area, date, addedBy, addedByName}`.
- Remover (3410): só da lista, **não** remove da turma (aviso na UI).
- Divergência no card: "Incluir as N na lista" (1037) — `ref(path).update(payload)` com N filhos.
- A turma/evento ficar restrito é só o bool `publicoRestrito` no form (3067 / 3208); marcar não remove ninguém.
- Regras atuais: `turmas-publico`/`eventos-publico` só admin grava. **Backend:** a checagem `barradoPeloPublico` precisa ser server-side em todas as portas que produzem "inscrita" (Confirmar, ＋ Participante, Mover para turma, matrícula em massa) — hoje `turmas-interesse` é gravável por qualquer usuário @previ logado, então a restrição só é real no cliente.

### 5.10 Editar cadastro — propagação do nome (`openCadastroEditModal`, 5763-5958)
1. `lerCopiasDaPessoa(eKey)` (5474-5497): `once` nos nós inteiros de `CADASTRO_COPIAS` (5442-5452) + `fa-espera/<eKey>`. Acha todas as ocorrências da `eKey` na profundidade indicada:
   - `turmas-interesse/<tk>/<eKey>` → name, area
   - `turmas-publico/<tk>/<eKey>` → name (MAIÚSCULA), area
   - `eventos-publico/<ek>/<eKey>` → name (MAIÚSCULA), area
   - `turmas-equipe/<tk>/<eKey>` → name
   - `turmas-checkin/<tk>/<date>/<eKey>` → name, area
   - `fa-admins/<eKey>`, `fa-diretores/<eKey>`, `fa-facilitadores/<eKey>` → name
   - `fa-espera/<eKey>/<origem>` → name, area
   Se qualquer leitura falha, o botão Salvar fica desabilitado e a edição é recusada.
2. Validação: nome não vazio; área de lista fechada `AREAS_LIST` (1915-1918) ou a atual; se mudou e-mail: exige @previ.com.br, senha do admin e `createdByAdmin` no cadastro.
3. Sem mudança de e-mail (`salvarCampos`, 5888-5925): exige sessão; update-multipath (5920) com `fa-users/<eKey>/{name,area}` + `<cópia>/name` e `<cópia>/area` + log `fa-users-log/<eKey>/<push>` com `mudancas[]`, `porAdmin`, `porAdminNome`, `quando`, `copiasAtualizadas`. Se nada mudou, não grava.
- **Intencionalmente NÃO reescritos:** `turmas-interesse-log`, `turmas-sorteio` (história). Também não tocados: `players`, `pedidos.nomeEnviou`, `holocron.authorName`.
- Observação: a regra de caixa difere — `fa-users.name` recebe o nome como digitado (não força MAIÚSCULA), enquanto admins/diretores/facilitadores foram criados em MAIÚSCULA e a migração `migrateNameCase` força MAIÚSCULA em `fa-admins` e `turmas-interesse`.

### 5.11 Corrigir e-mail — migração de `emailKey` (5933-5957 + 5525-5611 + auth.js 473-514)
Pré-condição: `fa-users/<eKey>.createdByAdmin` presente (5622-5624); admin não pode corrigir o próprio e-mail (auth.js 482).
1. **Auth primeiro** (`faAuth.corrigirEmailPorAdmin`): login como a conta alvo com a senha padrão `12345678`, `updateEmail(novo)`, `signOut`, login de volta como admin com a senha digitada. Falha se a pessoa já trocou a senha.
2. `moverDadosDePessoa`: `once` em 15 nós inteiros + `pedidos` + `holocron` (5527-5531). Nós e profundidade da `eKey` (`CADASTRO_NOS_POR_CHAVE`, 5503-5519):
   - nível 1: `fa-users`, `fa-users-log`, `fa-progress`, `fa-espera`, `fa-admins`, `fa-diretores`, `fa-facilitadores`, `fa-reset-signal`
   - nível 2: `turmas-interesse/<tk>`, `turmas-interesse-log/<tk>`, `turmas-publico/<tk>`, `eventos-publico/<ek>`, `turmas-equipe/<tk>`, `avaliacoes/<tk>`
   - nível 3: `turmas-checkin/<tk>/<date>`
   Para cada ocorrência: grava cópia na `eKeyNovo` com `name` (MAIÚSCULA em turmas-publico/eventos-publico), `area`, `email` corrigidos **se o campo já existir** e apaga a antiga.
   - `fa-users/<eKeyNovo>` = cadastro + `name`, `area`, `email`, `emailCorrigidoDe` (sobrescreve a cópia genérica).
   - `pedidos/<k>/emailEnviou` e `/nomeEnviou` onde `emailEnviou == antigo`.
   - `holocron/<k>/authorEmail` onde `authorEmail == antigo`.
   - log `fa-users-log/<eKeyNovo>/<push>` com `mudancas:[{campo:'email',...}]`, `registrosMovidos`.
3. Update-multipath único (5598). Se falhar, o login já foi trocado; a mensagem pede para salvar de novo.
- **Não migrados** (lacunas a decidir no backend): `fa-progress-historico/<eKey>`, `players/*` (campo `email`), `turmas-sorteio` (ganhadores com e-mail — intencional), `apostas/*`, `holocron.authorName`, `fa-espera` de nível 2 é migrado como nó inteiro (nível 1). `turmas.responsavelFacilitadorKey` (que é uma `eKey`) **não** é atualizado quando a pessoa é responsável — ponteiro ficaria órfão.
**Backend:** com um ID de usuário estável (ObjectId) em vez de `emailKey` como chave, esta operação vira apenas `users.updateOne({email})` + troca no provedor de identidade; é a principal motivação para não reproduzir a chave por e-mail no MongoDB.

### 5.12 Resetar progresso (`acaoResetarProgresso`, 5631-5650)
Query `players` `orderByChild('email').equalTo(email)` (5642; depende de índice `.indexOn: email`), depois update-multipath (5644): `fa-progress/<eKey>`, `fa-progress-historico/<eKey>`, cada `players/<k>` = null; `fa-reset-signal/<eKey>` = `{at: ServerValue.TIMESTAMP}` (o cliente da pessoa observa esse nó para limpar estado local — backend deve emitir o equivalente, possivelmente via WebSocket).

### 5.13 Bloquear conta / confirmar cadastro
- Bloquear/desbloquear: `fa-users/<eKey>/blocked` = true | null (5657). O efeito (impedir login) é aplicado em auth.js, no cliente. **Backend deve impor** o bloqueio na autenticação/autorização.
- Confirmar cadastro (só se `emailVerificationRequired && !adminApproved`): update 5674.

### 5.14 Administradores / Diretores / Facilitadores
- Admins (6135-6246): lista `fa-admins` (6143); adicionar/remover **só super-admins** (`SUPER_ADMINS`, l. 75, checado no cliente em 6140, e nas rules). Validação: nome e e-mail obrigatórios, e-mail `@previ.com.br`; chave = `emailKey(email)`; `set` sobrescreve (6228). Remover: 6190.
- Diretores (6393-6487): igual, qualquer admin; `fa-diretores` (6398/6442/6469).
- Facilitadores (6511-6697): lê 5 nós (6518-6522); adicionar com `ativo:true` (6639); alternar `ativo` (6609); remover (6600) **não** remove de `turmas-equipe` nem limpa `turmas/<tk>/responsavelFacilitadorKey`.
- Observação: os callbacks de remove/toggle não tratam erro (6190, 6442, 6600, 6609).

### 5.15 Sorteio (2006-2200, aba 2210-2361)
- Pool = confirmados válidos da turma (`inscricaoValida`) passados pelo card; "não repetir" exclui e-mails em qualquer sorteio anterior da turma (`turmas-sorteio/<tk>` lido em 2104). Sorteio feito **no cliente** com `crypto.getRandomValues` (1988-2004). Ensaio não grava.
- Grava `push` em `turmas-sorteio/<tk>` (2182); "Limpar histórico" remove o nó da turma (2098).
- **Backend:** para lisura, considerar sortear no servidor e gravar em transação; validar que os ganhadores são inscritos válidos.

### 5.16 Equipe de facilitação (3590-3695; roteiro.js 612-652)
- Lê `turmas-equipe/<tk>` e `fa-facilitadores` (só `ativo !== false`, não já na equipe).
- Invariante: no máximo 1 `responsavel` por turma; `turmas/<tk>/responsavelFacilitadorKey` espelha. `definirResponsavel` rebaixa o anterior a `facilitador` na mesma gravação. Confirmação quando já há responsável.
- Chave do membro = `emailKey(fac.email)`.

### 5.17 Treinamentos / conteúdo (4858-5422)
- Seed (4896-4912) se `treinamentos` vazio.
- Criar/editar (5108-5128): `nome` obrigatório; `eventos` = mapa de eventos marcados; `conteudoKey` `''` = conteúdo próprio, senão chave do catálogo `window.faGameConteudos` (código).
- Editar conteúdo (5368-5398): validação cliente: toda patente tem `name`; escala ≥ 2 níveis (5325); pendências avaliadas por `window.faTreinoConteudo.problemas()` (game-data.js) — salvar incompleto é permitido de propósito; `set` substitui `treinamentos-conteudo/<k>`.
- Excluir (5417): remove só `treinamentos/<k>`; `treinamentos-conteudo/<k>` fica órfão.

### 5.18 Tipos de atividade (6259-6385)
- Se o nó está vazio, semeia (6268-6273) com `faRoteiro.TIPOS_ATIVIDADE_PADRAO`.
- Adicionar/renomear: nome não vazio e **sem duplicata case-insensitive** (6343, 6368) — checagem só no cliente. Remover não afeta atividades já gravadas (texto livre em `roteiros-evento`/`turmas-roteiro`).
- Regras atuais permitem qualquer @previ logado gravar — backend deve restringir a admin e aplicar unicidade.

### 5.19 Moderação do repositório (4108-4258)
- Seeds curados vêm de `REPO_SEEDS` (código, 4108-4120), chave = `seedKey(url)`. Ocultar/restaurar: `fa-seeds-hidden/<sk>` (4189/4185). "Deletar": `fa-seeds-deleted/<sk>` + `fa-seeds-hidden/<sk>` = true (4199) — é flag, não remoção.
- Itens de usuários (`holocron/<k>`): ocultar/restaurar `fa-holocron-hidden/<k>` (4240/4236); deletar remove `holocron/<k>` e depois a flag (4247-4248).
- Callbacks de ocultar/restaurar/deletar seed ignoram erro.

### 5.20 Pedidos
admin.js **não** modera pedidos: a aba é de `pedidos.js` (`window.faInitPedidos`, l. 126). O único acesso de admin.js a `pedidos` é na correção de e-mail (leitura 5530, gravação de `emailEnviou`/`nomeEnviou` em 5578-5579).

### 5.21 Exportações e certificados (somente leitura)
- CSV "Estado atual" (4011) usa dados já carregados; "Histórico" (4033) lê `turmas-interesse-log` e `turmas-interesse`.
- Certificados (6723-7084): lê `turmas-interesse/<tk>` (6989), `eventos/<ek>` (7003), `turmas-config/<tk>` (7043), `turmas-checkin/<tk>` (7049). Emissão só se `encerrada`; elegível se frequência ≥ `percentualMinimo` do evento (padrão 75). Geração do PNG/PDF é client-side (`certif.js`).

### Inconsistências de critério encontradas (relevantes para o backend)
- "Inscrita" é `status==='inscrito' && confirmedByAdmin && !removed` (`inscricaoValida`, 418), mas estes pontos usam só `status==='inscrito'`: `checkOutrasTurmas` (3767), `imprimirListaPresenca` (3953), `loadInscritos` de Certificados (6992), rótulo de `escolherSubstituta` (2465).
- `moverParaTurma` (4815) não verifica exclusividade de inscrição em outra turma, ao contrário de Confirmar/＋ Participante/matrícula em massa.
- `loadEventoParaTurma` (7005) monta o evento sem `percentualMinimo` no fallback (usa 75).
- Remover participante (1606) e "＋ Participante" (2877) não gravam em `turmas-interesse-log`; Confirmar/Desconfirmar gravam.

---

## 6. Uso de Firebase Auth a partir de admin.js

| linha | chamada | o que faz |
|---|---|---|
| 81, 1027, 1559, 1696, 2624, 3496, 3527, 3818, 3861, 4508, 4763, 4816, 5378, 5526, 5668, 5889, 6139 | `window.faAuth.getSession()` | Obtém `{email, name}` do admin logado para gravar autoria (`confirmedByAdmin`, `removedByAdmin`, `addedBy`, `porAdmin` etc.). Várias portas recusam gravar sem sessão. |
| 100, 107 | `faAuth.isAdminReady()`, `faAuth.isAdmin(email)` | Gate do painel. |
| 4262 | `firebase.auth().sendPasswordResetEmail(email)` | "Redefinir senha" para qualquer cadastrado (trata `auth/user-not-found`). |
| 5938 | `faAuth.corrigirEmailPorAdmin({emailAntigo, emailNovo}, senhaAdmin, cb)` (auth.js 473) | Login como a conta alvo com senha padrão `12345678` → `updateEmail` → `signOut` → login de volta como admin. |
| 6013 | `faAuth.criarContaPorAdmin({name,email,area}, senhaAdmin, cb)` (auth.js 516) | `createUserWithEmailAndPassword(email,'12345678')` (loga como a conta nova) → `set fa-users/<eKey>` `{email, name MAIÚSCULA, area, adminApproved:true, createdByAdmin, createdAt}` → `signOut` → login de volta como admin. Validação: @previ.com.br, nome, área e senha do admin obrigatórios. |
| 6005, 6219, 6460, 6630 | `faAuth.autoPreviDominio(input)` | Só UI (preenche `@previ.com.br`). |
| 5641 | `firebase.database.ServerValue.TIMESTAMP` | Timestamp do servidor em `fa-reset-signal`. |

**Backend:** criação de conta e troca de e-mail hoje dependem de a senha padrão ser conhecida e de o admin redigitar a própria senha (o SDK cliente não tem API admin). Com NestJS, isso vira chamadas administrativas do provedor de identidade (sem trocar de sessão), eliminando a senha padrão fixa e o vai-e-vem de login.
