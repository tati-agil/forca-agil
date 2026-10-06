# teste-aposta — esperas fixas restantes (dívida técnica conhecida)

Registro do Bloco 3 do PR 2 (otimização da suíte). O Bloco 3 foi encerrado de propósito aqui: o teste caiu de
240 s para 181 s (−25%) com as 950 verificações, e o resto não traz ganho relevante no fluxo completo.
Regra: só se mexe nestas esperas se uma delas esconder um defeito real ou se o ganho no fluxo completo valer.

Medição de origem: sonda do Bloco 3 (4 rodadas, 1 sozinha e 3 sob carga), que registrou o que muda durante
cada espera (tela, campos, banco, escritas, modal, URL). Linhas = arquivo no commit de encerramento do Bloco 3.

| Categoria | Pontos | Execuções por rodada | Tempo por rodada | Recomendação |
|---|---|---|---|---|
| A2-1 | 28 | 56 | 18.2 s | manter a janela até existir um sinal de "tela assentada"; liberarLock() não devolve promessa (sem sinal). |
| A2-2 | 27 | 54 | 14.2 s | removíveis sem substituto (a janela antiga, ≤300 ms, nunca cobriu o salvamento de 600 ms); 27 pontos, ~14 s. |
| B2 | 22 | 54 | 14.4 s | converter para a gravação esperada (esperarGravacao) caso a caso. |
| E | 6 | 12 | 8.4 s | esperar o estado de tela que a verificação lê. |
| C | 1 | 2 | 0.8 s | esperar o modal/toast. |
| Z | 2 | 0 | 0.0 s | manter. |
| **total** | **86** | **178** | **56.0 s** | |

## A2, classe 1 — ausência real (verificação de que algo NÃO aconteceu depois de clique/modal/CONTINUAR bloqueado/criação/lock)

- L508 — 400 ms × 2 — clique (outro) — "remover a missão-base pede confirmação e volta o botão para "Salvar missão-base", sem selo nem ação de remover"
- L686 — 200 ms × 2 — clique (outro) — "clicar "Usar Atingir" no alerta de "Manter" muda a direção (nunca sozinho) e o alerta some"
- L864 — 200 ms × 2 — clique (outro) — ""Usar Reduzir" no alerta de Atingir troca só a direção — nunca os números (67 e 50 continuam lá)"
- L1267 — 300 ms × 2 — G2 avançar etapa — "o bloqueio de coerência não tem escape nenhum — clicar no botão desabilitado não muda nada"
- L1406 — 300 ms × 2 — G2 avançar etapa — "Hipótese incompleta bloqueia CONTINUAR"
- L1465 — 300 ms × 2 — G2 avançar etapa — "Ideia de solução incompleta bloqueia CONTINUAR"
- L1509 — 1400 ms × 2 — G2 avançar etapa
- L1569 — 300 ms × 2 — G2 avançar etapa — "Experimento incompleto bloqueia CONTINUAR"
- L1698 — 300 ms × 2 — G2 avançar etapa — "Continuar bloqueia de verdade até o Plano de Evidência estar completo"
- L2006 — 300 ms × 2 — G7 modal — "CANCELAR fecha o modal sem sair do Mapa e sem criar ciclo nenhum"
- L2358 — 300 ms × 2 — G2 avançar etapa — "o bloqueio de Evidência incompleta NÃO tem escape nenhum — nem clicando no botão desabilitado"
- L2487 — 300 ms × 2 — G7 modal — ""AINDA NÃO" no modal fecha o modal e mantém a etapa em planejamento, sem mudar de modo"
- L2801 — 300 ms × 2 — G2 avançar etapa — "Decisão sem decisão escolhida bloqueia CONTINUAR/VER O MAPA, sem escape por segundo clique"
- L2818 — 300 ms × 2 — G2 avançar etapa — "Decisão com decisão escolhida mas sem próxima ação continua bloqueando"
- L2844 — 150 ms × 2 — clique (outro) — ""MANTER AMPLIAR" só dispensa o alerta — não muda a decisão escolhida"
- L2901 — 150 ms × 2 — clique (outro) — ""Manter" a data informada não a substitui pela sugestão"
- L3097 — 250 ms × 2 — G7 modal — ""CANCELAR" não cria execução nenhuma nem muda "atual""
- L3218 — 200 ms × 2 — G7 modal — "BUGFIX — fechar o Histórico de Execuções não restaura a Decisão antiga: a tela continua no estado vazio da exe"
- L3498 — 300 ms × 2 — outro (bloco/evaluate) — "liberarLock() com o token de uma tentativa antiga NÃO remove o lock de uma tentativa mais nova"
- L3631 — 200 ms × 2 — G7 modal — "fechar o histórico não deixa modal nenhum aberto, e não altera "atual""
- L3703 — 500 ms × 2 — outro (bloco/evaluate) — "clique duplo rápido em "Criar grupo" cria só UM grupo (não dois)"
- L3729 — 500 ms × 2 — outro (bloco/evaluate) — "múltiplos cliques (3x) enquanto a criação está pendente também criam só UM grupo"
- L3801 — 300 ms × 2 — abertura/carga — "grupo antigo sem ciclos/ não ganha a estrutura só por ser aberto (Ciclo 1 implícito)"
- L4382 — 300 ms × 2 — outro (bloco/evaluate) — "clicar num card do Ciclo 1 (não-atual) não navega, não abre modal e não muda cicloAtual (Invariante 7)"
- L4688 — 300 ms × 2 — clique (outro) — "G — com dados incompletos, o modal mostra "Complete a aposta-base..." e a lista do que falta, sem gerar prompt"
- L4704 — 200 ms × 2 — G7 modal — "fechar o aviso de estado incompleto não deixa nenhum modal preso — o Mapa continua normal"
- L4908 — 250 ms × 2 — G1 preencher/selecionar — "re-salvar a Decisão (clicar CONTINUAR de novo) preserva a dataDecisao já gravada — não some, não vira outra"
- L5210 — 300 ms × 2 — abertura/carga — "(c) assim que a leitura lenta responde, o convite aparece sozinho e o painel também, sem precisar recarregar"

## A2, classe 2 — falso positivo textual ("não/sem/nunca" sobre conteúdo síncrono, depois de preencher/selecionar)

- L699 — 200 ms × 2 — G1 chip/variante — "limite mínimo maior que o máximo esconde a frase, avisa e não sugere direção nenhuma"
- L721 — 250 ms × 2 — G1 chip/variante — ""Atingir" volta a mostrar Meta desejada, sem Tipo de limite"
- L728 — 300 ms × 2 — G1 preencher/selecionar — "a frase de "Atingir" não repete "situação atual" nem usa "para""
- L739 — 200 ms × 2 — G1 preencher/selecionar — ""Atingir" com indicador que já começa pela unidade (NPS) não repete a unidade"
- L742 — 300 ms × 2 — G1 preencher/selecionar — ""Atingir" com indicador que já começa pela unidade (NPS) não repete a unidade"
- L762 — 200 ms × 2 — G1 chip/variante — ""Aumentar" com NPS não gera "NPS por dia" nem repete a unidade nos números"
- L765 — 300 ms × 2 — G1 preencher/selecionar — ""Aumentar" com NPS não gera "NPS por dia" nem repete a unidade nos números"
- L1206 — 300 ms × 2 — G1 preencher/selecionar — "a Unidade nasce vazia de verdade (não força a primeira opção)"
- L1345 — 300 ms × 2 — G1 preencher/selecionar — "Percentual preenche a Unidade com "%" sozinho, sem exigir escolha"
- L1347 — 200 ms × 2 — G1 chip/variante — "Percentual preenche a Unidade com "%" sozinho, sem exigir escolha"
- L1357 — 300 ms × 2 — G1 preencher/selecionar — ""Queremos" aceita uma direção que não é Aumentar nem Reduzir"
- L1411 — 250 ms × 2 — G1 preencher/selecionar — "com só um dos dois campos, ainda pede o que falta (não mostra a frase pela metade)"
- L1482 — 250 ms × 2 — G1 preencher/selecionar — "digitar "para que..." no efeito pretendido não duplica "para" na frase montada"
- L1840 — 250 ms × 2 — G1 preencher/selecionar — "o prazo da decisão é número + unidade, não uma data"
- L1924 — 300 ms × 2 — G1 preencher/selecionar — ""Reformular a hipótese" sem a Nova Hipótese completa mantém CONTINUAR desabilitado"
- L2293 — 300 ms × 2 — G1 preencher/selecionar — "a frase da evidência junta o que já existia com o que foi observado, sem redigitar nada"
- L2316 — 300 ms × 2 — G1 preencher/selecionar — "resultado observado igual à meta mostra "a mudança esperada foi alcançada", sem percentual"
- L2324 — 300 ms × 2 — G1 preencher/selecionar — "meta superada mostra a diferença, nunca um percentual acima de 100%"
- L2332 — 300 ms × 2 — G1 preencher/selecionar — "piora do indicador não mostra percentual negativo — mostra o que foi observado x a situação inicial"
- L2367 — 200 ms × 2 — G1 preencher/selecionar — "o card mostra "Ainda falta: o aprendizado" quando observado+fonte já existem mas o aprendizado ainda não"
- L2415 — 300 ms × 2 — G1 preencher/selecionar — "escrever o aprendizado apaga sozinha a nota "Ainda falta", sem precisar clicar em Continuar de novo"
- L2444 — 200 ms × 2 — G1 preencher/selecionar — "a classificação escolhida antes continua valendo — não reseta ao marcar "Não foi possível medir""
- L2618 — 300 ms × 2 — G1 preencher/selecionar — "preencher o segundo card não mexe no primeiro — cada card guarda o seu"
- L2873 — 250 ms × 2 — G1 preencher/selecionar — "só com o Prazo preenchido, sugere a Data de reavaliação (sem preencher sozinho)"
- L2892 — 250 ms × 2 — G1 preencher/selecionar — "Prazo e Data de reavaliação incompatíveis avisam sem trocar nada sozinho"
- L2965 — 250 ms × 2 — G1 preencher/selecionar — "preencher só a próxima ação: pendência passa a pedir só a nova hipótese, e CONTINUAR continua bloqueado (reati"
- L2976 — 250 ms × 2 — G1 preencher/selecionar — "preencher também a nova hipótese habilita CONTINUAR de verdade, reativo (sem clicar em CONTINUAR nem recarrega"

## B2 — gravação só em parte das execuções (salvamento automático cruzando a janela)

- L681 — 300 ms × 2 — G2 avançar etapa — ""Manter" incoerente com o limite também bloqueia CONTINUAR"
- L845 — 300 ms × 2 — G2 avançar etapa — "Atingir com meta igual à situação atual também bloqueia CONTINUAR"
- L1324 — 600 ms × 2 — G1 preencher/selecionar — "corrigir só o VALOR (1200, mantendo Aumentar) resolve a incoerência — CONTINUAR reabilita"
- L2454 — 200 ms × 2 — clique (outro) — ""Não foi possível medir" + Motivo + "Nossa hipótese foi": CONTINUAR libera (não precisa de número)"
- L2528 — 300 ms × 2 — clique (outro) — ""Encerrar por agora" fecha a dinâmica e mostra o aviso de sucesso já na página de trás (Treinamento)"
- L2575 — 300 ms × 12 — G7 modal — ""Manter" ("
- L2706 — 300 ms × 2 — G7 modal — ""Não foi possível medir" desliga o resultado observado e a fonte"
- L2719 — 200 ms × 2 — clique (outro) — ""não foi possível medir" + motivo + "Nossa hipótese foi" também libera Continuar (é a outra forma válida de co"
- L2806 — 200 ms × 2 — clique (outro) — "o exemplo de "Próxima ação" muda com a decisão escolhida"
- L2951 — 200 ms × 2 — clique (outro) — "escolher "Reformular a hipótese" mostra a microexplicação exata embaixo dos botões"
- L3889 — 200 ms × 2 — G1 preencher/selecionar — ""Investigar mais" sem ponto de reinício escolhido mantém CONTINUAR desabilitado"
- L3927 — 200 ms × 2 — G1 preencher/selecionar — ""Interromper esta ideia" finaliza sem criar ciclo nenhum — vai direto ao Mapa"
- L3960 — 200 ms × 2 — G1 preencher/selecionar
- L4141 — 200 ms × 2 — clique (outro) — "item 2 — trocar PARA "Concluir a aposta" habilita CONTINUAR na hora, sem digitar nada"
- L4180 — 200 ms × 2 — clique (outro) — "item 2 — voltar para "Ampliar" restaura a exigência normal de Próxima ação (CONTINUAR desabilita de novo)"
- L4270 — 200 ms × 2 — G1 preencher/selecionar
- L5039 — 300 ms × 2 — outro (bloco/evaluate) — "(1) Ciclo 1 → criação bem-sucedida → nasce Ciclo 2 (número 2)"
- L5047 — 300 ms × 2 — outro (bloco/evaluate) — "(2) Ciclo 2 → criação bem-sucedida → nasce Ciclo 3 (número 3)"
- L5064 — 200 ms × 2 — outro (bloco/evaluate) — "(3)/(4) falha ao criar o sucessor do Ciclo 3 e retry: nasce o Ciclo 4 (número 4) — nunca um número 5 pulando o"
- L5329 — 400 ms × 2 — G2 avançar etapa — "clicar CONTINUAR com Missão completa (com prazo) avança para a etapa seguinte"
- L5464 — 200 ms × 2 — G7 modal — "G — cancelar a confirmação preserva o texto já digitado (nunca apaga sozinho)"
- L5470 — 200 ms × 2 — G2 avançar etapa — "G — confirmando "PULAR E DESCARTAR", a etapa é descartada e avança normalmente"

## E — a tela muda (abertura/carga; painel do facilitador)

- L337 — 900 ms × 2 — abertura/carga — "quem não está confirmada em turma liberada não vê o convite"
- L473 — 1200 ms × 2 — outro (bloco/evaluate)
- L2192 — 600 ms × 2 — G2 avançar etapa — "gravação recusada NÃO avança a tela — sem isso, a Missão sumia sem ninguém perceber"
- L5131 — 300 ms × 2 — abertura/carga — "(a) facilitadora global COM vínculo real em turmas-equipe vê o painel do facilitador"
- L5165 — 600 ms × 2 — abertura/carga — "(b) FALHA FECHADA: leitura de turmas-equipe falhando nunca concede convite algum, mesmo com vínculo real grava"
- L5200 — 600 ms × 2 — abertura/carga — "(c) enquanto turmas-equipe não respondeu (rede lenta), o convite começa AUSENTE — nunca aparece "otimista""

## C — modal abre/fecha

- L4641 — 400 ms × 2 — clique (outro) — "clicar "Copiar prompt" dá feedback de sucesso (toast "Prompt copiado." ou o texto pronto para selecionar)"

## Z — nunca executadas (ramo condicional)

- L2025 — 350 ms × 0 — G2 avançar etapa
- L2030 — 350 ms × 0 — G2 avançar etapa
