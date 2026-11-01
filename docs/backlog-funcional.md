# Backlog funcional

Entregas funcionais aprovadas pela responsável pelo repositório e ainda não iniciadas, **em ordem de prioridade**.
Cada uma começa só com autorização própria; registrar aqui não autoriza implementar. Testes que ainda não
existem ficam em [backlog-testes.md](backlog-testes.md).

## 1. Jornada Guiada do Mapa da Floresta — entregue na PR 4

*Registrada em 2026-10-13; proposta aprovada e implementada na PR 4 e no ajuste de usabilidade seguinte ("Jornada de Avaliação e Posicionamento", sobre o
Catálogo do Mapa da Floresta — ver `docs/referencia-tecnica.md`). Mantida aqui como registro do requisito.*

**Problema (homologação):** mesmo conhecendo o sistema, a responsável se perdeu entre a Avaliação de
Produto/Serviço (P1–P16), o Posicionamento Organizacional (O1–O9), o cadastro de estruturas concretas, o vínculo da
estrutura responsável e o Mapa da Floresta. O sistema precisa orientar a pessoa durante toda a jornada, sem exigir
que ela memorize quais telas acessar nem quais etapas já concluiu.

**O que entregar:** aproveitando o Catálogo do Mapa da Floresta e as funcionalidades existentes, mostrar **por
objeto** (item de Produto/Serviço ou objeto organizacional da Porta 2):

1. o que já foi concluído;
2. o que ainda está pendente;
3. qual é o próximo passo aplicável;
4. um acesso direto à ação necessária;
5. a distinção entre etapas obrigatórias e opcionais;
6. a diferença entre cadastrar uma estrutura concreta e vincular a responsabilidade por um objeto;
7. quando falta uma decisão organizacional, e não apenas o preenchimento de um campo;
8. como retomar o trabalho sem perder o contexto.

**Restrições:**

- Respeitar as duas portas de entrada; não exigir P1–P16 para atuações organizacionais (Porta 2).
- Não criar outro motor, questionário ou módulo desnecessário; priorizar simplicidade, clareza e reutilização do
  Catálogo.
- Não presumir posicionamentos ainda não confirmados.
- Celular e computador (375 px e tela larga), rede lenta e "ainda não sei" ≠ "não tem", como em todo o site.

**Casos de homologação:** Capec, Assessoria Previdenciária, Jurídico e Agilidade — sem presumir posicionamentos
ainda não confirmados.

**Próximo passo:** depois da Porta 2 homologada, apresentar uma proposta visual enxuta e os critérios de aceite para
aprovação, antes de qualquer implementação.

## Públicos — ativação (PR 2): técnico deixa de ser "quem não é gerente"

*Especificado e aprovado em 2026-11-01; implementar só com autorização própria, DEPOIS de ADMIN › Outros públicos (PR 1)
publicado, preenchido pela administração e conferido por leitura agregada (quantidades, sobreposições, impacto nas turmas).*

**Hoje** (`turmas-util.js`, `montar-regras-inscricoes.js`): "Técnicos" = quem não está em `fa-gerentes`. Diretores,
estagiários, menores aprendizes e conselheiros entram como técnicos.

**A ativar, coerente na página Turmas, Minha Área, ADMIN (＋ Participante, Confirmar, Mover, "Ver como", selo "Fora do
público atual") e nas regras do banco:**
- **Técnicos**: classificação operacional — conta @previ fora de Gerentes, Diretores e das seis categorias de Outros
  públicos, com TODAS as leituras respondidas (pendência ou falha nunca vira técnico). Não comprova vínculo empregatício.
- **Públicos efetivos novos em "Quem participa"**: Estagiários, Menores aprendizes, Estagiários e menores aprendizes,
  Membros do COAUD, Conselho Deliberativo, Conselho Fiscal, Conselho Consultivo, Conselheiros (= os três conselhos, sem o
  COAUD). Agrupados calculados das categorias, sem registro próprio; sem precedência entre listas.
- **Diretores** passa a restringir (= `fa-diretores`). Conferência de 01/11: o único evento real com esse público tem lista
  de 7 pessoas, 6 em Diretores; a turma já foi realizada — nada muda hoje. A 7ª pessoa pode ter participado como
  substituta: não é erro e nada é alterado.
- O formulário diz, em cada opção, se ela **restringe** ou é **só descrição**.
- **Público-alvo ≠ participantes efetivos — substituição autorizada:** quem está fora do público não manifesta interesse
  sozinho, mas o ADMIN pode incluir alguém que substitui uma pessoa do público (ex.: um técnico no lugar de um gerente),
  por um caminho seguro e auditável (motivo registrado). A exceção vale só para aquela turma, não muda o cadastro da
  pessoa nem autoriza outros eventos. Nada histórico é tratado como irregular, nada é removido. Antes de desenhar,
  examinar como ＋ Participante, Confirmar, Mover e a inclusão por lista tratam hoje quem está fora do público, e o que as
  regras do banco permitem ao admin (hoje o admin grava sem a conferência de público do banco; a tela confere).
- **Continuam só descrição** até haver fonte de dados: Empregados, Cedidos, Quadro próprio (ver abaixo) e Executivos.

**Vínculo funcional (Cedidos, Quadro próprio, Empregados) — decisão pendente.** Definições: Cedidos são técnicos ou
gerentes; Quadro próprio não é cedido; técnicos e gerentes podem ser de um ou de outro; Empregados = Cedidos + Quadro
próprio. Não existe hoje nenhuma fonte de vínculo (`fa-users` só tem e-mail, nome e área); "Quadro próprio = não cedido"
por exclusão não é seguro. Alternativa recomendada: cadastro explícito dos dois vínculos a partir de uma lista do RH.

## Públicos — "Aberto (interno e externo)" (evolução futura)

*Registrado em 2026-11-01. Necessidade real (ex.: BBDW 2026); sem implementação.*

O site é inteiramente @previ.com.br: o login desconecta outros domínios, o cadastro os recusa e as regras do banco exigem
@previ. Não há fluxo externo no site (nenhum participante de fora em cadastros, inscrições, fila ou listas, em
01/11/2026). Por isso a opção NÃO entra em "Quem participa" até existir suporte: oferecê-la prometeria uma inscrição que
o sistema não faz. O BBDW continua administrado como hoje — os participantes externos fora do site; no site, o evento
segue com a configuração atual (não publicado, com lista). A evolução exige autenticação externa e revisão das regras do
banco, sem dar a externos acesso às áreas internas — projeto próprio.

## Turmas — inconsistências de público na lista de espera

*Registrada em 2026-11-01 (decisão 3 do planejamento de inconsistências de público). Fora da primeira entrega do selo
"Fora do público atual" do ADMIN.*

**Situação:** quem está na lista de espera de um evento pode deixar de atender ao público dele depois de entrar na fila
(o cargo mudou, o público do evento mudou, saiu da lista do evento). Hoje nada sinaliza isso no ADMIN › Lista de espera.

**A avaliar:** se a fila deve ganhar a mesma sinalização (só informativa, calculada da configuração vigente, sem
remover ninguém nem gravar marcação), e com quais motivos — a fila é do evento, então os critérios de turma não se
aplicam.

**Restrições:** não mexer na fila, nos botões, na elegibilidade, nos dados nem nas gravações dela sem aprovação própria.

## Turmas — confirmação do ADMIN não confere "só diretores"

*Registrada em 2026-11-01 (decisão 4). Tratar em PR própria; não corrigir junto de outras entregas.*

**Divergência:** a marcação "só diretores" do evento (`restritoADiretores`) é conferida na vitrine e nas regras do banco
para a própria pessoa, mas as portas do ADMIN (Confirmar, ＋ Participante, Mover da fila) não a conferem — as listas e o
cargo, sim (`barradoPeloPublico` e `regrasDeEntrada`). Um admin consegue confirmar quem não é diretor num evento só de
diretores. Hoje nenhum evento real usa essa marcação (o público de diretores é feito por lista).

**A decidir:** alinhar as portas do ADMIN às outras restrições de público (e como isso convive com a confirmação
excepcional de interesse preexistente, se aprovada).

## Turmas — pintura dupla da página depois do login (melhoria técnica, prioridade baixa)

*Registrada em 2026-11-01, na homologação C68 (PR #455). Defeito preexistente, não introduzido pela #455.*

**Situação:** logo depois do login, a página Turmas é desenhada duas vezes em poucos milissegundos, porque
`initTurmaInterest` (`app.js`) é disparada por mais de um aviso de prontidão (`fa-auth-change`, `fa-diretor-ready`,
`fa-admin-ready`). Para a pessoa o efeito é mínimo (um bloco recolhido nesse instante volta a abrir); nos testes, é a
causa de intermitência — `teste-turmas-ordem-exibicao.js` passou a esperar a página assentar (PR #455), mas a pintura
dupla continua no site.

**A avaliar:** juntar os disparos numa só pintura depois que a sessão assenta, sem atrasar a primeira exibição em rede
lenta nem tratar "ainda não sei" como "não tem acesso". Sem mudança de regra nem de dados; PR própria, quando a área for
mexida.

## Turmas — lista de espera ligada por padrão, mesmo em evento já realizado

*Registrada em 2026-11-01, na PR #457 (eventos em três partes). Achado preexistente; as regras da fila não mudaram.*

**Situação:** a fila de espera vale como ligada quando o evento não tem o campo (`esperaAtiva !== false` em `app.js` e
`admin.js`), e o formulário de evento novo já vem com a caixa marcada. Ou seja: "fila ligada" não indica uma decisão do
admin. Duas consequências:
- evento com todas as turmas realizadas continua mostrando o card "Lista de espera" com o botão de entrar, agora sob
  "Eventos já realizados" — a pessoa entra numa fila de um evento que talvez não tenha turma nova (antes da #457, o
  evento nem descia para os realizados por causa disso);
- pela regra aprovada na #457, evento com turma por vir e todas as inscrições encerradas sobe para a parte de
  inscrições abertas sempre que a fila estiver ligada — por padrão, quase sempre. A parte "Próximas turmas — inscrições
  encerradas" só recebe os eventos em que o admin desligou a fila.

**Não verificado:** quantos eventos reais estão em cada caso (a contagem só de leitura não foi feita).

**A decidir:** se a fila deve deixar de ser ligada por padrão (exige tratar os eventos que não têm o campo), se o card da
fila deve sumir ou mudar em evento sem turma por vir, ou se fica como está. Não mexer na fila sem aprovação própria.

## Turmas — "Remover interesse" em turma com inscrições encerradas

*Registrada em 2026-11-01, na PR #457. Possível evolução, sem implementação.*

**Situação:** o card de turma com inscrições encerradas não tem botão; desde a #457 ele mostra o vínculo de quem já tem
registro ("Sua inscrição nesta turma está confirmada." ou "Seu interesse nesta turma continua registrado."). Quem tem só
interesse não consegue removê-lo por esse card — o "Remover interesse" existe só enquanto a turma está aberta.

**A avaliar:** oferecer "Remover interesse" (só para interesse, nunca para inscrição confirmada, que segue com o admin)
no card encerrado, e o efeito disso na lista do ADMIN e nas regras de uma turma por pessoa.

## Pendência arquitetural — composição Squad × Linha (decisão de governança)

*Registrada em 2026-10-13 (consulta só de leitura ao banco oficial, autorizada pela responsável). Não resolver sem
decisão própria: nada de cadastrar relações, ligar herança ou mudar regras por conta.*

- **Conceito oficial (Taxonomia vigente):** Squad (camada "Organização do trabalho") compõe Linha — relação
  `SQUAD__compoe__LINHA`, ativa, com a nota de que, por herança, os tipos de Linha também são compostos por Squads
  ("regra do modelo, não fato comprovado pelos textos-fonte das Plataformas").
- **Regra implementada:** o cadastro de estruturas (tela e `database.rules.json`) só aceita Squad concreta e `compõe`
  com a relação EXATA `<conceito de trabalho>__compoe__<tipo específico de Linha>` (os 6 códigos do ramo Linha), sem
  herança pelo pai (decisões C2/C3).
- **Dados cadastrados:** não existe relação específica para nenhum dos 6 tipos; em produção não há Squad concreta nem
  `compõe` — e hoje não é possível cadastrá-los.
- **A apresentar depois:** alternativas (relações específicas na Taxonomia × herança na tela e nas regras) e
  consequências para o modelo, o Firebase e a paridade com o PostgreSQL.

## Indicador "P1–P16 concluídas" × versão vigente (27 × 25) — decisão pendente

*Registrado em 2026-10-31 (D1 da conclusão do Mapa; nada alterado).* A regra documentada em `avaliacao-produto.js`
`baseDoItem` é: vale a PONTA da cadeia de reavaliações; com a ponta na Lixeira, a versão anterior continua superada e o
item só aparece pela Lixeira. A jornada até o Mapa e a lista "Ver avaliações" seguem a regra (25 itens). O indicador
"P1–P16 concluídas" (`resumoProdutos`) descarta as versões excluídas e conta a maior versão restante — por isso conta
também 2 itens cuja reavaliação (v2) está na Lixeira e a v1 concluída ("teste" e "Trilha de Educação Previdenciária"):
27. Excluir só marca o registro; restaurar desfaz.

**Correção mínima recomendada (aguarda aprovação):** o indicador passar a usar `baseDoItem` (a mesma regra da jornada e
da lista), sem mudar a Lixeira, as avaliações ou as versões. Alternativa a decidir: se a regra for "excluir a
reavaliação devolve o item à versão anterior", a mudança seria na regra (jornada, lista e indicador), não só no indicador.

## Acompanhamento (não é entrega; observar e agir se repetir)

### Smoke contra o Firebase real: login recusado de forma intermitente

*Registrado em 2026-10-13.* Na PR #355 (commit `a185838`), o Smoke (`.github/scripts/smoke-site-real.js`, job
"Smoke test — login real no site publicado") falhou num único passo — "Avaliação: escolher a nota da seção 1 avança
sozinho e o rascunho fica guardado" — com `login falhou: E-mail ou senha inválidos.`, enquanto os outros logins da
MESMA conta de teste, na mesma execução, funcionaram. A PR não mexia em login. Rodar de novo só esse job passou.

Hipótese (não comprovada): limitação de tentativas do Firebase Authentication real por muitos logins seguidos da
mesma conta, que a tela mostra como "E-mail ou senha inválidos". O Smoke não bloqueia o merge.

**Se repetir:** registrar a data e o passo; conferir no log se é sempre o mesmo passo; avaliar fazer o Smoke
reaproveitar a sessão já aberta nesse passo (menos logins) e distinguir na tela "muitas tentativas" de "senha
inválida". Nada disso entra numa PR funcional.
