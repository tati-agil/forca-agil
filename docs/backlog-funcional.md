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
