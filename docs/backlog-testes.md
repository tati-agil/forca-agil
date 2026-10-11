# Backlog de testes

Roteiros que **poderiam ser provados automaticamente e ainda não são**. Não é bloqueador de
nada: é a fila para evoluir a suíte, em PRs pequenos, quando a área for mexida.

> Origem: Etapa 6.2. A antiga lista "Regras que exigem validação manual" (aba ADMIN › Testes,
> 228 roteiros) foi comparada item a item com as provas automáticas. Daquela lista:
>
> - **20** exigem de fato uma pessoa e **19** dos 43 parcialmente automatizados têm uma parte
>   humana → estão no [checklist pós-deploy](checklist-pos-deploy.md);
> - **154** ficam aqui: **130** sem nenhuma prova hoje (o motivo antigo, "gravaria dados reais"
>   ou "estado transiente", deixou de valer com o Firebase falso da suíte hermética) e **24**
>   parcialmente automatizados cuja parte que falta também é automatizável;
> - **35** saíram (ver o fim deste arquivo): 15 desatualizados, 14 já automatizados, 3
>   duplicados e 3 documentais.
>
> Os números `#` são a posição do roteiro no catálogo antigo (`forca-agil/testes.js`,
> `COMPORTAMENTO_MANUAL`, na `main` em `66ed565`), para quem quiser ler o texto original.

**Como escolher o próximo:** prefira o que protege uma regra de negócio que já quebrou ou que
afeta a oficina (Turmas, lista de espera, check-in, Avaliar oficina), depois o ADMIN de uso
frequente (Eventos/Turmas, exportações), por último o Roteiro. Um teste novo entra em
`.github/scripts/suite-hermetica.json`; regras do banco vão para um `teste-rules*.js`.

### Entrar (2)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 5 | Login — botão "Aguarde…" durante autenticação | atrasar signIn e checar texto do botão | Firebase falso (suíte hermética) |
| 16 | Celular / rede lenta — inscrita NÃO pode ser rebaixada nem ver tela preta | não-rebaixamento durante leitura parcial de várias turmas (automatizável com delays por turma) | Firebase falso (suíte hermética) |

### Cadastrar (2)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 7 | Cadastro — formatação automática (nome maiúsculo, e-mail minúsculo) | cadastrar no banco falso e ler fa-users | Firebase falso (suíte hermética) |
| 8 | Cadastro — botão "Aguarde…" durante envio | createUser com atraso | Firebase falso (suíte hermética) |

### Início (2)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 9 | Interessado tem o mesmo acesso de logado — só inscrito destrava as 3 páginas | duas contas (sem interesse / interessado) + confirmação; corrigir o check vazio do painel | Firebase falso (suíte hermética) |
| 10 | Seções da Home ocupam 100vh (scroll preciso) | conferência visual do encaixe por seção (automatizável medindo getBoundingClientRect após clicar nos dots) | Firebase falso (suíte hermética) |

### Turmas (19)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 19 | Lista de espera — entrar e sair, por evento | dois eventos, entrar/sair e conferir fa-espera/<key>/lista:<ev> | Firebase falso (suíte hermética) |
| 21 | Admin — mover pessoa da lista de espera para turma | aba Eventos com fila em 2 eventos | Firebase falso (suíte hermética) |
| 22 | Admin — migrar participante de turma para lista de espera | modal de remoção + colunas Data interesse/remoção/Origem | Firebase falso (suíte hermética) |
| 32 | Divulgar ou tirar do ar um evento inteiro | evento publicado:false some da vitrine, inscrita mantém acesso | Firebase falso (suíte hermética) |
| 33 | Evento restrito a diretores some da vitrine de quem não é diretor nem admin | admin vê sem estar em Diretores, selo 'só diretores/admin' no painel, desmarcar volta para todos, Diretores não dá acesso ao painel | Firebase falso (suíte hermética) |
| 35 | Fila de espera sem turma nenhuma | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 47 | Sessão expirada com a página aberta — interesse não registra sozinho | derrubar a sessão do falso com a página aberta | Firebase falso (suíte hermética) |
| 48 | Botão "Tenho interesse" → registra e vira "Remover interesse"; clicar novamente remove e volta ao estado inicial | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 49 | Após registrar interesse → mensagem orientando inscrição no CMFlex | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 50 | Após remover interesse → mensagem "Interesse removido." e botão volta a "Tenho interesse" | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 51 | Inscrita não consegue se autorremover pelo site (botão travado) | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 52 | Interesse encerrado — card diz que as vagas acabaram, igual pra qualquer pessoa | ausência de botão (interesse/CMFlex) e mesmo resultado para inscrito em outra turma | Firebase falso (suíte hermética) |
| 53 | Card "Em andamento" — aparece automaticamente no primeiro dia da turma | relógio simulado (page.clock) perto da meia-noite | Firebase falso + relógio simulado |
| 54 | Card "Realizada" — aparece automaticamente após o último dia | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 55 | Corrida: interesse encerra entre carregar a página e clicar → "Esta turma está encerrada para novas inscrições." | mudar turmas-config no falso entre carregar e clicar | Firebase falso (suíte hermética) |
| 57 | Falha ao gravar no Firebase → "Erro ao registrar. Tente novamente." / "Erro ao remover. Tente novamente." | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 59 | Sem listener duplicado ao revisitar a página Turmas | revisitar Turmas N vezes e conferir 1 entrada em turmas-interesse-log | Firebase falso (suíte hermética) |
| 60 | Botão desabilitado durante a gravação — sem duplicação por clique duplo | clique duplo rápido grava 1 entrada | Firebase falso (suíte hermética) |
| 61 | Confirmar quem já é Inscrita em outra turma — aviso e remoção automática (só para inscrição, não interesse) | modal do Confirmar individual, caso (a) Interessada não gera aviso, e Cancelar não grava nada | Firebase falso (suíte hermética) |

### Check-in (4)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 63 | Turma não finalizada → "Esta turma ainda não teve as inscrições finalizadas" | turma não finalizada → mensagem | Firebase falso (suíte hermética) |
| 64 | Check-in do dia não aberto → "O check-in não está aberto no momento..." | finalizada sem diaAtivo → mensagem | Firebase falso (suíte hermética) |
| 65 | Pessoa não inscrita na turma → "Você não está inscrita nesta turma" | os 3 casos (sem registro/removida/interessada) | Firebase falso (suíte hermética) |
| 106 | Admin — Turmas: fechar check-in do dia | fechar check-in bloqueia #checkin | Firebase falso (suíte hermética) |

### Repositório (6)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 68 | Adicionar conteúdo ao Holocron | adicionar conteúdo | Firebase falso (suíte hermética) |
| 69 | Formulário — URL auto-completa https:// | digitar URL sem esquema | Firebase falso (suíte hermética) |
| 70 | Formulário — bloqueia URL duplicada | URL duplicada recusada | Firebase falso (suíte hermética) |
| 71 | Remover conteúdo próprio | remover conteúdo próprio | Firebase falso (suíte hermética) |
| 72 | Moderação Admin — ocultar/restaurar conteúdo curado | ocultar/restaurar | Firebase falso (suíte hermética) |
| 73 | Moderação Admin — deletar conteúdo de usuários | deletar conteúdo de usuário | Firebase falso (suíte hermética) |

### Minha Área (6)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 152 | Admin: "Ver esta tela como" mostra a tela da pessoa certa (escolhendo cada situação) | não aparecer p/ não-admin, cada situação escolhida (confirmada/interesse/espera/removida), pedidos da pessoa, e confirmar que nada foi gravado | Firebase falso (suíte hermética) |
| 153 | A vitrine só oferece turma onde dá para entrar | lista só com turmas que aceitam interesse; automatizável com banco falso | Firebase falso (suíte hermética) |
| 154 | Frequência e certificado batem com os dados reais | frequência × check-ins reais e liberação do certificado após encerrar | Firebase falso (suíte hermética) |
| 155 | Certificado baixado pelo aluno é idêntico ao emitido pelo admin | baixar pelos dois caminhos e comparar os arquivos | Firebase falso (suíte hermética) |
| 156 | Os quatro estados aparecem corretamente | transição em análise→confirmada após o admin confirmar e o estado de COEXISTÊNCIA (3 blocos juntos, sem boas-vindas) | Firebase falso (suíte hermética) |
| 158 | Turma programada não cobra frequência de quem ainda não começou | sem frequência/certificado em programada, contagem regressiva e migração para Em andamento; automatizável com datas relativas | Firebase falso + relógio simulado |

### Ajuda (1)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 141 | Formulário "Faça um pedido" — envio com login funciona | nomeEnviou/emailEnviou gravados, ordem mais recente primeiro e cor do chip (#8a93a8) | Firebase falso (suíte hermética) |

### ADMIN (95)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 15 | Confirmar inscrição — nunca pode gravar sem quem confirmou ("Confirmação incompleta") | banco falso com inscrito sem confirmedByAdmin, conferir selo/botão e regravação | Firebase falso (suíte hermética) |
| 23 | Coluna Destino de quem saiu da turma | três remoções e conferir coluna Destino/autoria | Firebase falso (suíte hermética) |
| 24 | Saída da turma: motivo, destino e a fila com a data original | modal de saída por motivo | Firebase falso (suíte hermética) |
| 25 | Registrar depois o motivo de uma saída em branco | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 26 | Excluir definitivamente um registro de teste | banco falso elimina o risco de dado real | Firebase falso (suíte hermética) |
| 27 | Substituída registra quem entrou no lugar | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 28 | Filtros por destino: a soma tem que fechar | somar contagens dos filtros | Firebase falso (suíte hermética) |
| 29 | Saíram da fila — a fila também presta contas | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 30 | Fila por pessoa E turma de origem | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 31 | Lista de Espera fica dentro do card de cada evento | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 36 | Lista de espera pode ser desligada por evento | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 37 | Migração: fila antiga, sem evento, ganha o dono certo | semear registro sem eventoKey e abrir o painel | Firebase falso (suíte hermética) |
| 38 | Treinamento pertence a eventos — quem vê e quem não vê | pessoa só do evento B ver 'Nenhum treinamento disponível', aviso vermelho sem evento, interessada não vê | Firebase falso (suíte hermética) |
| 39 | Treinamento não some enquanto nenhum estiver cadastrado | nó treinamentos vazio | Firebase falso (suíte hermética) |
| 40 | Treinamento — seletor aparece só com mais de um | progresso e patente independentes entre treinamentos; seletor some com um só | Firebase falso (suíte hermética) |
| 41 | Migração: o treinamento que já existia não perde ninguém nem o progresso | banco sem treinamentos + progresso antigo | Firebase falso (suíte hermética) |
| 42 | Migração de ponte: conteúdo da Missão da Jornada de Imersão | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 43 | Lista de espera — data e hora corretas | conferir dd/mm/aaaa hh:mm e data sem hora sem deslocar dia | Firebase falso (suíte hermética) |
| 44 | Certificados — a frequência tem que bater com o check-in | turma com turmas-checkin e conferir % e botões | Firebase falso (suíte hermética) |
| 46 | Lista de Espera — remover exige motivo | o fluxo inteiro (nenhuma prova hoje) | Firebase falso (suíte hermética) |
| 80 | Sorteio — só entram os confirmados | contagem = Confirmados, ninguém 'Aguardando decisão' sorteado, botão desabilitado sem confirmados | Firebase falso (suíte hermética) |
| 81 | Aba Sorteios — filtros por evento e turma | filtros evento/turma, resumo, CSV (Excel/acentos, 1 linha por pessoa) | Firebase falso (suíte hermética) |
| 82 | Sorteio — modo Ensaio não deixa rastro | ensaio não grava histórico nem consome disponíveis | Firebase falso (suíte hermética) |
| 83 | Sorteio — não repetir, histórico e limpeza | não repetir, esgotamento, limpar histórico | Firebase falso (suíte hermética) |
| 84 | Aba Eventos — a tela fica no lugar ao registrar presença em série | registrar presenças em série mantendo expansão/rolagem/filtros | Firebase falso (suíte hermética) |
| 86 | Cadastrados — corrigir nome/gerência chega em TODO lugar, não só no cadastro | aviso pré-salvamento com a contagem de registros, e que turmas-interesse-log/sorteios NÃO mudam | Firebase falso (suíte hermética) |
| 89 | Cadastrados — resetar progresso | recarga automática ao vivo da aba da usuária logada (duas abas) | Firebase falso (suíte hermética) |
| 94 | Turmas — campo "Resultado esperado da turma" ao criar/editar turma | salvar/reabrir/editar só esse campo sem perder os outros/vazio sem 'undefined' | Firebase falso (suíte hermética) |
| 95 | Turmas — público restrito: fechar a turma e montar a lista | B (fora da lista) não ver a turma nem em 'Turmas abertas no momento'; desmarcar não apagar a lista | Firebase falso (suíte hermética) |
| 98 | Turmas — público restrito: matricular a lista inteira de uma vez | (5) botão some com a lista toda na turma; (6) Cancelar não grava | Firebase falso (suíte hermética) |
| 99 | Turmas — público restrito: as portas do painel recusam quem está fora da lista | (3) aviso com o nome de B, (4)/(6) Confirmar e Mover para turma recusam sem gravar, (7) marcar restrito não remove ninguém | Firebase falso (suíte hermética) |
| 100 | Eventos — qualquer admin de verdade consegue criar/editar evento, não só os dois super-admins | criar/editar evento como admin comum (provável de automatizar no emulador) | emulador (regras) |
| 101 | Eventos — público restrito do evento: a lista vale para todas as turmas dele | (1)-(2) marcar/lista vazia, 'Turmas abertas no momento' da Minha Área, (7) desmarcar não apaga, (8) independência evento×turma | Firebase falso (suíte hermética) |
| 102 | Eventos — público restrito do evento: as portas do painel e do site recusam quem está fora | Confirmar/Mover recusando com mensagem do EVENTO, recheque ao vivo de Tenho interesse/lista de espera, inscritas não perdem acesso | Firebase falso (suíte hermética) |
| 103 | Turmas — confirmar inscrição de uma pessoa | confirmar individual em turma aberta e encerrada | Firebase falso (suíte hermética) |
| 104 | Turmas — desconfirmar inscrição de uma pessoa | desconfirmar e queda de acesso ao vivo em outra aba | Firebase falso (suíte hermética) |
| 107 | Turmas — agrupamento por evento: criar dentro do container e excluir o evento | pré-preenchimento do Evento e turmas indo para TURMAS SEM EVENTO | Firebase falso (suíte hermética) |
| 108 | Eventos — filtro "Ver evento:" isola o evento escolhido | isolar/expandir o escolhido e 'Todos' restaurar | Firebase falso (suíte hermética) |
| 109 | Turmas — filtro por status na tabela de participantes | barra de filtros, contagens e ocultação com grupo único | Firebase falso (suíte hermética) |
| 111 | Turmas — ações não somem na turma com interesse encerrado | colunas e ações visíveis/fixas com interesse encerrado (desktop e 375px) | Firebase falso (suíte hermética) |
| 112 | Turmas — check-in retroativo manual (clicar em "—") | clicar em '—' registra source:'admin' e atualiza Freq. | Firebase falso (suíte hermética) |
| 113 | Turmas — desfazer check-in (clicar em "✓ adm" ou "✓ qr") | modal próprio, remoção em turmas-checkin e Freq. atualizada | Firebase falso (suíte hermética) |
| 116 | Turmas — adicionar participante: busca em cadastros existentes | todo o fluxo do modal ＋ Participante e o registro com confirmedByAdmin; automatizável com banco falso (exceto login real da pessoa) | Firebase falso (suíte hermética) |
| 117 | Turmas — cabeçalho, filtro, sorteio e linha concordam sobre quem está confirmada | conferir que os 4 contadores concordam; automatizável com banco falso | Firebase falso (suíte hermética) |
| 119 | Modais que leem o banco abrem no tamanho certo, sem piscar | observar tamanho dos 3 modais com rede lenta, desktop e celular (julgamento visual; mensurável via boundingBox se automatizado) | Firebase falso (suíte hermética) |
| 120 | Turmas — os quatro caminhos para "Inscrita" gravam o mesmo registro | os 4 caminhos gravando o mesmo registro + acesso real das 4 contas | Firebase falso (suíte hermética) |
| 121 | Turmas — não existe estado intermediário entre confirmar e remover | ações da linha, motivos no modal Remover e selo legado só leitura | Firebase falso (suíte hermética) |
| 122 | Turmas — remover participante (interessado ou inscrito) | modal visual + removed:true/removedByAdminName; automatizável com banco falso | Firebase falso (suíte hermética) |
| 123 | Turmas — pessoa removida pode ser readicionada (site ou admin) | readição pelo site e pelo admin + evento no CSV Histórico | Firebase falso (suíte hermética) |
| 124 | Turmas — "＋ Participante" como Inscrita verifica outras turmas (igual ao "Confirmar") | aviso de outra turma ao adicionar como Inscrita | Firebase falso (suíte hermética) |
| 125 | Abas Turmas, Cadastrados e Repositório — pop-ups visuais (não nativos) | clicar cada ação; a regra 'nenhuma ação usa diálogo nativo' hoje é falsa em 3 pontos | Firebase falso (suíte hermética) |
| 126 | Turmas — encerrar turma manualmente (✓ Encerrar turma) | encerrar e ver card público 'Turma realizada' para todos | Firebase falso (suíte hermética) |
| 127 | Turmas — reabrir turma | badge ABERTA, botão e inscritos preservados | Firebase falso (suíte hermética) |
| 128 | Turmas — exportar CSV "Estado Atual" não inclui removidos | abrir CSV Estado atual sem removidos; automatizável via evento download | Firebase falso (suíte hermética) |
| 129 | Turmas — exportar CSV "Histórico" inclui removidos e identificação do admin | conteúdo do CSV Histórico | Firebase falso (suíte hermética) |
| 130 | Turmas — Confirmar/Desconfirmar aparece no CSV "Histórico" | linhas confirmar/desconfirmar no CSV Histórico | Firebase falso (suíte hermética) |
| 131 | Turmas — exportar CSV individual por turma não inclui removidos | CSV individual sem removidos | Firebase falso (suíte hermética) |
| 132 | Turmas — CSV individual por turma tem coluna "Adicionado por" com nome do admin | coluna Adicionado por no CSV da turma | Firebase falso (suíte hermética) |
| 133 | Turmas — lista de presença para impressão só traz inscritos | nova aba só com inscritos; aviso sem inscritos | Firebase falso (suíte hermética) |
| 135 | Editar evento — conteúdo público (Missão, Tópicos, Itinerário) | editar evento, renumeração D1/D2 ao remover, horas = carga ÷ dias | Firebase falso (suíte hermética) |
| 136 | Evento sem conteúdo preenchido não gera bloco vazio | evento sem conteúdo não gera bloco; só Missão → só bloco A Missão; automatizável com banco falso | Firebase falso (suíte hermética) |
| 137 | Conteúdo da Missão não vaza entre eventos | texto da Missão, dias e horas de um evento não vazarem no bloco do outro | Firebase falso (suíte hermética) |
| 139 | Turmas — exportar CSV com colunas de presença | conteúdo do CSV com DD/MM, frequência e critério | Firebase falso (suíte hermética) |
| 143 | Aba Pedidos — prazo em dias úteis considera fim de semana | contagem em dias úteis; automatizável com relógio falso (page.clock) | Firebase falso + relógio simulado |
| 146 | Dashboard — escopo por evento e por turma | item (5) evento + turma de OUTRO evento; NPS/% de participação/destaques por escopo não são conferidos | Firebase falso (suíte hermética) |
| 147 | Aba Dashboard — destaques usam só notas, não texto livre | destaques derivados de médias, não de texto livre | Firebase falso (suíte hermética) |
| 148 | Treinamentos — criar um treinamento com conteúdo próprio | editor do painel (+ Novo treinamento, resumo, aviso de buraco entre faixas, aviso amarelo no cartão) e progresso isolado entre treinamentos | Firebase falso (suíte hermética) |
| 149 | Pedidos — reenquadrar o tipo de um pedido | tipo atual pré-selecionado, 2º reenquadramento mantendo o ORIGINAL, contagem nos filtros e texto/autor inalterados | Firebase falso (suíte hermética) |
| 150 | Aba Pedidos — status sobre ativos + Lixeira separada | contagens Pendentes+Respondidos=Todos, lixeira, restaurar, filtro por tipo combinado | Firebase falso (suíte hermética) |
| 192 | Equipe de facilitação — único responsável, com confirmação ao substituir | Fluxo de responsável único, substituição com confirmação, seletor sem duplicata, remoção, inativação. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável | Firebase falso (suíte hermética) |
| 193 | Roteiro-base do evento — dias, atividades e reordenação persistem | Dias/atividades, cálculo início/duração/fim, reordenação persistida, duplicar, excluir dia. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenh | Firebase falso (suíte hermética) |
| 194 | Roteiro-base — qualquer admin de verdade consegue gravar, e uma escrita negada mostra erro em vez de sumir em silêncio | (1) admin comum grava de verdade; (2) erro 'Não foi possível salvar…' com escrita negada. As duas partes são automatizáveis (emulador e Firebase falso, que o próprio item cita) — nenhuma prova existe. | emulador (regras) |
| 195 | Roteiro da turma — personalização por campo, exclusiva e restauração | Personalização por campo, herança, restaurar, exclusiva, remover/restaurar, reordenação, condução/apoio. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizá | Firebase falso (suíte hermética) |
| 197 | Roteiro — resumo do dia bate com a matemática (janela = programado + lacunas) | Conta do resumo do dia (janela, lacunas, pausas, facilitação). Cálculo puro, automatizável; sem prova. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizáve | Firebase falso (suíte hermética) |
| 198 | Roteiro — seção com sub-etapas: formulário completo, duração somada, numeração e recolher/expandir | Etapas: formulário, soma, numeração X.Y, recolher, recálculo, exclusão/duplicação em cascata. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas ne | Firebase falso (suíte hermética) |
| 199 | Roteiro-base — recalcular horários seguintes ao mudar duração, e aviso de ordem divergente | Recalcular/manter horários e aviso de ordem divergente. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenhuma prova existe hoje. | Firebase falso (suíte hermética) |
| 200 | Roteiro — "Roteiro completo" mostra só os campos preenchidos, nunca uma mensagem de "vazio" | Conteúdo da janela de impressão (campos preenchidos, numeração, continuação). O HTML da janela é verificável por teste; a abertura do diálogo nativo exige humano. | Firebase falso (suíte hermética) |
| 201 | Roteiro — "Passo a passo" mostra só esse campo, sem os demais campos internos | Só 'Passo a passo' em cada bloco. Conteúdo automatizável; sem prova. | Firebase falso (suíte hermética) |
| 202 | Roteiro — formatação básica (negrito, itálico, sublinhado, listas, alinhar) nas caixas de texto da atividade | Seleção de texto + botões N/I/S/listas/cores e persistência (interação real, seletor de cor nativo). | Firebase falso (suíte hermética) |
| 203 | Roteiro — campos "Resultado esperado" e "Prompt para IA" | Posição dos campos, persistência, ausência quando vazio e ordem na impressão. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenhuma prova exis | Firebase falso (suíte hermética) |
| 204 | Roteiro — botões de recuo e seletor de tamanho de fonte nas caixas de texto | Recuo e tamanho de fonte por seleção, persistência e impressão. | Firebase falso (suíte hermética) |
| 205 | Roteiro — continuar numeração/marcador digitado à mão e botão "↵ Espaço" | Continuação de numeração ao digitar, Enter em linha vazia, Tab, ↵ Espaço (Playwright poderia digitar, mas não existe prova). | Firebase falso (suíte hermética) |
| 209 | Roteiro — pausa de 30 min dentro de uma seção conta em "Pausas" (não fica 0) | Intervalo dentro de seção somando em 'Pausas'. Cálculo puro, automatizável; sem prova. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenhuma p | Firebase falso (suíte hermética) |
| 210 | Roteiro — duração de uma seção (com sub-etapas) trava no formulário e é calculada sozinha | Campo Duração travado com a soma, completar Início/Fim, voltar a editável sem etapas. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenhuma pr | Firebase falso (suíte hermética) |
| 211 | Roteiro — aviso de sobreposição de horário | Banner de sobreposição, item na barra, sessões diferentes não comparadas. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas nenhuma prova existe h | Firebase falso (suíte hermética) |
| 212 | Roteiro — rótulo "Lacunas reais" igual na barra de cada sessão e no resumo agregado | Mesmo rótulo nas barras de sessão, no agregado e na Agenda resumida. Automatizável por texto; sem prova. | Firebase falso (suíte hermética) |
| 213 | Roteiro — Sessões/janelas: o intervalo entre Manhã e Tarde não vira "lacuna" | Agrupamento por sessão, janela por sessão, almoço não vira lacuna, ordenar só dentro da sessão. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas  | Firebase falso (suíte hermética) |
| 214 | Roteiro — detecção automática de sessões (sem preencher "Sessão / janela") e resumo agregado | Detecção automática de sessões (corte ≥90 min) e números do resumo agregado. Lógica pura, automatizável; sem prova. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é | Firebase falso (suíte hermética) |
| 215 | Roteiro-base — "+ Etapa" atrás do menu "⋯" numa atividade simples | Menu ⋯ com '+ Etapa', fechar ao clicar fora, botão direto depois da 1ª etapa. Clique real é automatizável com Playwright; sem prova. | Firebase falso (suíte hermética) |
| 218 | Roteiro — exportar "Agenda + Objetivos" (tabela + Objetivo/Resultado esperado) | Colunas iguais à Agenda resumida, linhas extras só com Objetivo/Resultado, Markdown formatado. O HTML da janela seria verificável; sem prova. | Firebase falso (suíte hermética) |
| 220 | Roteiro — "Resultado esperado da turma" aparece na "Agenda resumida" (só do Roteiro da turma) | Bloco na Agenda resumida da turma (negrito, quebras), ausente quando vazio e no roteiro-base. | Firebase falso (suíte hermética) |
| 221 | Roteiro — Markdown de campo de texto renderizado (não mais à mostra) no PDF exportado | Interpretação de Markdown (escapado, misto com HTML) no PDF e texto cru na tela. A conversão é testável por função; sem prova. | Firebase falso (suíte hermética) |
| 226 | Roteiro — Tipo de atividade: lista administrável em ordem alfabética | Ordem alfabética, mesma lista no formulário, Intervalo contando em Pausas, tipo antigo sem seleção. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável,  | Firebase falso (suíte hermética) |
| 227 | Aba: Tipos de atividade — adicionar, editar e remover | Adicionar, duplicado (maiúsc./minúsc.), editar, cancelar, remover, concorrência entre 2 abas. Obs.: o motivo 'grava dados reais' está superado — a suíte hermética já grava roteiros-evento no Firebase falso (teste-roteiro-texto-rico.js); é automatizável, mas ne | Firebase falso (suíte hermética) |
| 228 | Formulários com rótulo em maiúsculo (ex: Roteiro) não forçam maiúscula no texto digitado | Texto digitado sem virar maiúsculo, persistência, <select> com grafia normal. Computed style seria automatizável; sem prova. | Firebase falso (suíte hermética) |

### Avaliar oficina e Avaliação de Produto/Serviço (10)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 160 | Ninguém lê nem sobrescreve a avaliação de outra pessoa | leitura/escrita negada a terceiros e Dashboard do admin; automatizável no emulador (teste-rules-*) | emulador (regras) |
| 170 | Uma resposta por pessoa, por turma | trava por pessoa+turma após enviar, F5 e outro aparelho; automatizável com banco falso | Firebase falso (suíte hermética) |
| 172 | Admin libera avaliação por turma — aba aparece para inscrito | Liberar pelo menu ⋯ da turma (modal, botão vira 'Encerrar avaliação') e o item aparecer para inscrito confirmado da turma liberada — nenhuma prova; smoke é só com admin. | Firebase falso (suíte hermética) |
| 173 | Admin revisa avaliação: trocar de turma troca o formulário | (1) Turma lista só as do evento; (2) trocar turma troca formulário; (3) aviso '(Você já enviou uma resposta de teste...)' (texto existe em avaliacao.js). | Firebase falso (suíte hermética) |
| 174 | Inscrito sem turma liberada não vê a aba Avaliação | Tudo: menu oculto e mensagem no acesso direto para inscrito sem liberação. Automatizável com Firebase falso, mas não existe prova. | Firebase falso (suíte hermética) |
| 175 | Validação de seções obrigatórias no envio | Bloqueio do envio, expansão da seção faltante e aviso vermelho. Automatizável no Firebase falso; hoje nenhuma prova. | Firebase falso (suíte hermética) |
| 176 | Identificação opcional — anônimo por padrão | Envio anônimo × identificado e o conteúdo gravado em avaliacoes/<turma>/<email>. | Firebase falso (suíte hermética) |
| 177 | Envio único por turma — tela de agradecimento após envio | Tela de agradecimento 🚀, não reaparecer após recarregar, gravação no banco. | Firebase falso (suíte hermética) |
| 178 | Múltiplas avaliações pendentes — pessoa inscrita em mais de uma turma/oficina | Aviso dourado, <select> de pendências, rascunho por turma, encadeamento e agradecimento final. | Firebase falso (suíte hermética) |
| 179 | Admin encerra avaliação — aba some para inscritos | Modal, troca do botão e sumiço do item para o inscrito. | Firebase falso (suíte hermética) |

### Certificados (6)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 180 | Fluxo de seleção: a lista de turmas é só do evento escolhido | (1)-(4): Evento lista todos, Turma só do evento, limpar ao trocar, 'nenhuma turma neste evento' (texto existe em admin.js) — sem prova. | Firebase falso (suíte hermética) |
| 181 | Cenário A — turma NÃO encerrada (estado Prévia) | Banner de prévia, ausência de badge, botões PNG/PDF/lote desabilitados com tooltip. Automatizável com dados falsos; não existe. | Firebase falso (suíte hermética) |
| 182 | Cenário B — turma encerrada, frequência suficiente | Badge, botões habilitados, 'Baixar todos' incluindo, dataEmissao = dataConclusao. | Firebase falso (suíte hermética) |
| 183 | Cenário C — turma encerrada, frequência insuficiente | Badge vermelho, tooltip, exclusão do lote, prévia habilitada. | Firebase falso (suíte hermética) |
| 184 | Cenário D — percentual mínimo configurado por evento | Editar o percentual e ver badges/bloqueios mudarem. | Firebase falso (suíte hermética) |
| 187 | Exportação PDF — página customizada 4:3 sem margens | Tamanho de página, zero margem e ausência de deformação no PDF gerado (o tamanho seria automatizável lendo o PDF). | Firebase falso (suíte hermética) |

### Facilitador (1)

| # | Roteiro | O que falta provar | Como automatizar |
|---|---|---|---|
| 196 | "Minhas Facilitações" — só as turmas da própria pessoa, papel correto e roteiro editável só para a responsável | Lista só das próprias turmas, papéis, roteiro editável só para responsável, admin sem equipe vê vazio. Automatizável com Firebase falso; não existe. | Firebase falso (suíte hermética) |

---

## Saíram do catálogo (35)

Não entram nem no checklist nem neste backlog.

**Desatualizados (15)**

- #4 Servidor sem resposta não pode deixar a tela preta — rótulo 'Demorando para conectar' não existe no código (grep: só testes.js); o aviso real é 'Não conseguimos retomar sua sessão' (router.js:637) — teste-rotulos-doc.js:36 já aponta isso. Itens (1)(2) c
- #13 Visitante não acessa Conteúdos nem Treinamento Jedi — rota '#gamificacao' não existe (router.js:7 PAGES não a tem; vira #home); com login obrigatório não há 'visitante' em página nenhuma — smoke 'Visitante sem login: site fica oculto e só o modal de entr
- #17 Inscrito confirmado vê o mesmo card de CMFlex que todo mundo — card de interesse encerrado não orienta mais para o CMFlex (app.js:425-441 'Inscrições encerradas', sem CMFlex); o item afirma o oposto
- #18 Card "Lista de Espera" é um por evento com turma na vitrine — diz que evento sem turma não ganha card de espera; hoje eventoNaVitrine (app.js:491) mostra evento sem turma se esperaAtiva, e o card depende de esperaAtiva (contradiz 'Fila de espera sem turma nenhum
- #20 Lista de espera sem login → abre modal de login — premissa 'Visitante clica' não existe mais: sem sessão o site fica oculto (smoke 'Visitante sem login'); o ramo app.js:811-815 só ocorre com sessão expirada, como em 'Sessão expirada com a página aber
- #34 Cada evento é um bloco fechado na página — ordem descrita (cards e depois a Missão) mudou: app.js:551-563 põe a Missão ANTES da grade; com 2+ eventos o bloco nasce recolhido (app.js:592-603), coberto por teste-turmas-expansiveis.js:150-170
- #56 Corrida rara: interesse encerra com a página já aberta → botão continua até recarregar — diz que ao recarregar o card 'aparece no modo CMFlex' — esse modo não existe mais (app.js:425-441: 'Inscrições encerradas', sem CMFlex)
- #62 Sem login → "Faça login para registrar sua presença"; completa check-in automático após logar — checkin.js:131 lê turmas/<key> sem callback de erro; database.rules.json turmas/.read exige auth != null → deslogada fica em 'Verificando…' e nunca vê msgLogin; além disso login é obrigatório (smoke '
- #74 Antes de entrar: Welcome screen exibida para logado sem turma confirmada — game.js:605-611: com sessão a welcome fica SEMPRE oculta; router.js:96 e :184 mandam 'member' de #treinamento para #home ('Disponível após confirmação em uma turma.'). Logada sem turma não vê a welcom
- #75 Ao logar pela Welcome screen: tela de boas-vindas some e o jogo aparece — welcome só aparece sem sessão (game.js:605) e o login é obrigatório (o próprio item 74 admite que ninguém deslogado chega nessa tela); fluxo 'logar pela welcome' não é alcançável
- #91 Turmas — encerrar interesse — ponto (5) contradiz o código: app.js:424-444 — turma com interesse encerrado mostra 'Inscrições encerradas', o comentário diz que mandar ao CMFlex foi retirado de propósito
- #92 Turmas — cadastrar link do CMFlex ao criar/editar turma — botão 'Ir para o CMFlex' não existe (grep só em testes.js; teste-rotulos-doc.js cabeçalho: 'removido de propósito'); cmflexLink só é lido em app.js:324 e nunca renderizado no card
- #110 Turmas — layout responsivo das ações (desktop vs mobile) — pages.css:404-407 '.taa-more-btn { display: inline-flex }' com comentário 'secundárias sempre em menu ⋯' — o ⋯ existe também no desktop; o item diz que no desktop tudo fica em linha única e o ⋯ só no 
- #151 Aba Pedidos — excluir com justificativa obrigatória e restaurar — cita filtro "Excluídos" (passos 3-4): grep 'Excluídos' em pedidos.js = 0; hoje é o botão '🗑 Lixeira' (pedidos.js:259-286), já descrito no item 150
- #190 Pre-commit hook — bloqueia commit com erro de sintaxe JS — Não há hook versionado: .git/hooks só tem *.sample, não há .githooks nem core.hooksPath, e nenhum workflow roda 'node --check' (grep em .github). Só mapa.js:766 descreve o hook. Um JS quebrado hoje é 

**Já automatizados (14)**

- #2 A espera tem que mostrar alguma coisa desde o primeiro instante — teste-tela-preta.js:58-81 (12 cenários × desktop/celular, falha se 0 elementos visíveis aos 2s). O texto do item está defasado ('8 cenários/16 combinações'; hoje são 12/24)
- #3 Trocar de usuário sem recarregar — Arquitetura e Usuários autorizados — teste-avaliacoes-troca-usuario.js (suíte hermética, desktop+375px, sem recarregar)
- #11 Ordem da vitrine: o mais exclusivo PARA QUEM VÊ vem primeiro — teste-ordem-vitrine.js:126-135 (ordem por exclusividade com 'order' invertido de propósito, + turmas dentro do evento)
- #76 Ao concluir o autodiagnóstico: Revelar patente — confirmação real — teste-autodiagnostico-refazer.js:153-154 (revelar grava linha com patente e pontuação) + :191-196 (duas linhas, mais recente primeiro)
- #77 Refazer o autodiagnóstico não apaga o histórico — teste-autodiagnostico-refazer.js:157 (mensagem antiga ausente), :166 (modal próprio), :184 (quiz reabre limpo), :191-196 (histórico com 2 linhas, ordem)
- #78 O cartão do Treinamento fecha, mostra resumo, e abre sem perder progresso — teste-treinamento-cartao.js:118-121 (mesmo raio/cor do convite da Aposta), :131-133 (nasce fechado com resumo), :141, :153 (recolher não apaga respostas)
- #85 Admin — acesso negado para logado/inscrito (URL direta) — teste-avaliacoes-acessos.js:191 (perfil antigo, não admin: #admin barrado → #home) e :147; smoke run-testes-automaticos.js:782 existe mas é pulado no CI (FA_TEST_MEMBER_* não definidos nos workflows)
- #93 Turmas — horário de início/término ao criar/editar turma — teste-turma-horario.js:101 (legado abre 09:00–13:00), :112 (término antes do início recusado), :124/:127 (grava/não grava), :135 (card mostra horário novo)
- #97 Construção da Aposta — Analisar com IA (Conselho Jedi: uma aposta, três lentes) — teste-aposta.js ~:4535-4760: A (3 prompts, Missão real), B (8 blocos), C (evidência planejada/'ainda não executado'), D (base idêntica), E (3 afirmações ACEITAR/QUESTIONAR/REJEITAR), privacidade, Team
- #140 Formulário "Faça um pedido" — nenhuma recusa pode ser silenciosa — teste-pedido-envio.js (desktop+iPhone, suíte): l.156-173 recusa em voz alta sem tipo; marca do chip além da cor; 'gravação que nunca responde volta a permitir tentar'; botão apagado durante envio; '+ 
- #157 Contagem por fase e lista de espera dizem de qual evento — um cartão por fila — teste-minha-area-fila.js (suíte, desktop+iPhone): 'N turma(s)' por extenso, DOIS cartões de espera com o nome de cada evento
- #166 Roteador: com rede lenta, a tela não pula para o topo sozinha (conta real, celular) — teste-rolagem-decisao-tardia.js (suíte, desktop e 375px, acesso chegando 5 s depois): posição de rolagem mantida, troca de página volta ao topo
- #168 Taxonomia: "Atributos / perfil" recolhível na ficha do conceito — teste-taxonomia-atributos.js (suíte, desktop e 375px): começa recolhido com 'X definidos de N', expande, editar mantém aberto e atualiza a contagem; o próprio texto chama a checagem real de 'opcional'
- #207 Roteiro — abrir e salvar uma atividade sem editar não corrompe texto com "&" — teste-roteiro-texto-rico.js (suíte hermética, desktop+celular): abre/salva 3× sem editar e exige valor idêntico e '&' exibido (cabeçalho, linhas 1-32)

**Duplicados (3)**

- #12 Turma com interesse encerrado não manda ninguém ao CMFlex — mesmo conteúdo de 'Interesse encerrado — card diz que as vagas acabaram…' (n52), 'Após registrar interesse → mensagem orientando inscrição no CMFlex' (n49), 'Card Em andamento' (n53) e 'Card Realizada
- #14 Logado sem turma não acessa Conteúdos nem Treinamento Jedi — contido em 'Interessado tem o mesmo acesso de logado — só inscrito destrava as 3 páginas' (n9: menu e URL direta para conta sem turma)
- #159 QR Code de check-in NÃO aparece na área do participante — = item automático do painel 'c-minha-area-sem-qr' (testes.js:155-160: nenhum canvas nem link #checkin em #page-minha-area), executado também pelo smoke

**Documentais (3)**

- #58 Falha silenciosa na leitura inicial (sem callback de erro nem timeout) → card/botão trava no estado estático padrão — app.js:944 checkInterestState usa .once('value',cb) sem callback de erro — o item registra um defeito conhecido (botão preso), não um critério de aceitação; nenhuma prova em .github/scripts
- #118 Documentação viva confere com o que está implementado — texto 'AUTOMATIZADO NO CI, não aqui'; .github/scripts/teste-consistencia-docs.js existe e está na suite_hermetica
- #138 Administradores — erro na leitura mostra mensagem em vez de travar — é roteiro de diagnóstico ('se um dia ficar presa…'), não verificação pendente; comportamento em admin.js:6322-6324; nenhum teste injeta falha de leitura em fa-admins

## Pendência registrada (B2 do H2-b): proteger a trilha principal dos questionários

As versões publicadas da trilha principal (`questionarios-config/<código>/versoes/<n>` e `versaoPublicada`, que incluem
P1–P16, S1–S8 e a redação v1 de O1–O9) continuam graváveis pelos perfis com escrita no nó: hoje dá para alterar ou
apagar uma versão já publicada e voltar o ponteiro. O B2 protegeu só a trilha do motor novo (`motores/<v>`), por
decisão da responsável, para não arriscar regressão na Avaliação de Produto/Serviço e na Squad. **Resolver antes da
publicação final do Mapa da Floresta**, no mesmo desenho do B2 (só criar, ponteiro +1 na mesma gravação, auditoria
obrigatória), com teste de emulador e regressão dos fluxos de publicação, correção editorial e "voltar a uma versão
anterior" (que já publica como versão nova).

