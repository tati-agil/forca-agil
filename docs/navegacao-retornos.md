# Navegação de ida e volta — matriz e regra

Referência para quem mantém o FORÇA ÁGIL. Diz como as telas guardam de onde a pessoa veio e para onde o botão de retorno leva.

A prova automática está em `.github/scripts/teste-navegacao-retornos.js`. Ela percorre os caminhos abaixo no navegador, no computador e a 375 px, testando o botão da tela, o Voltar e o Avançar do navegador e o F5.

## Regra

1. **Voltar para a origem.** Uma tela aberta a partir de outra guarda a origem na entrada do histórico do navegador, na chave `navOrigem` (`{ hash, rotulo, aba? }`), criada por `faNav.ir()` em `forca-agil/admin.js`.
   - O botão de retorno da tela mostra o rótulo da origem real ("← Voltar para o Posicionamento", "← Voltar para Trabalhos de avaliação", "← Voltar para Avaliações e Mapa"…).
   - O retorno é conferido (`faVoltarParaOrigem`): usa o Voltar do navegador, que mantém a área e a posição. Se o histórico não levar à origem, vai direto ao endereço guardado.
2. **Voltar para a área.** Sem origem registrada (link direto, F5 de uma entrada sem marca, entrada pela própria tela), cada tela mantém o retorno de sempre, para a sua área.
3. **Voltar do navegador.** As telas que empilham entradas próprias copiam a marca (`faNav.comOrigem`). Assim, Voltar e Avançar refazem o caminho real, e um F5 continua sabendo a origem.
4. **Retorno ≠ cancelar.** Sair de um formulário com alteração continua pedindo confirmação. A confirmação aceita leva à origem, e nada é gravado.

As entradas criadas por `faNav.ir()` têm `avp: 1`. Por isso a área Avaliação (`avaliacao-produto.js`, que reescreve entradas sem essa marca) não as apaga. `faNav.ir()` empilha a entrada já com a origem e só depois avisa as telas (`hashchange`). Trocar `location.hash` primeiro avisava as telas antes de a marca existir.

## Matriz

| Origem → ação | Destino | Retorno esperado | Antes | Agora |
|---|---|---|---|---|
| Posicionamento (ficha) → "Avaliar Adequação à Squad" | Squad (nova ou em andamento) | a ficha | lista da Squad; com Squad em andamento, o Início | "← Voltar para o Posicionamento" → a ficha (também após F5 e após "Cancelar" confirmado) |
| Jornada (item) → "Acessar Adequação à Squad" | Squad | o item da Jornada | lista da Squad / Início | "← Voltar para a Jornada do Mapa" → o item |
| Trabalhos → "Ver adequações à Squad" / "Ver avaliações de Posicionamento" | listas da Avaliação | Trabalhos | (pelo painel do Início, removido) | "← Voltar para Trabalhos de avaliação" |
| ADMIN › Avaliações e Mapa → Abrir Mapa / jornada | Mapa / Jornada | Avaliações e Mapa | ok desde o #384 | idem, sem perder a origem nos links internos do Mapa |
| Mapa → "Definição oficial do Mapa" | seção do Mapa no ADMIN (`#admin?arq=inicio`) | o Mapa | Documentação e mapas | "← Voltar para o Mapa da Floresta" → o Mapa |
| ADMIN › qualquer funcionalidade → Voltar (da tela, do navegador ou depois de link direto) | início de Avaliações e Mapa | a seção de origem aberta | seções sempre abertas | a seção que contém a funcionalidade reabre |
| Ficha de Produto/Serviço → "Posicionar" | Posicionamento (escolher) | a ficha | Início | "← Voltar para a avaliação de Produto/Serviço" |
| Jornada (item) / Mapa (estrutura) → "Abrir Posicionamento" | Posicionamento | o item / a estrutura | Início | "← Voltar para a Jornada do Mapa" / "o Mapa da Floresta" |
| Lista de Posicionamentos → ficha | ficha | a lista | o botão do topo ia ao Início (o do rodapé já voltava à lista) | "← Voltar para os Posicionamentos" → a lista |
| Início → Trabalhos → qualquer destino | lista/ficha/Jornada/Mapa | Trabalhos | Início (Trabalhos nunca era destino) | "← Voltar para Trabalhos de avaliação" |
| Trabalhos → "Voltar" | Início | Início | empilhava o Início (ciclo no histórico) | Voltar do histórico (sem ciclo) |
| Mapa (estrutura `&e=`) → objeto | item da Jornada | a estrutura no Mapa | só "Voltar para a lista" / Início | "← Voltar para o Mapa da Floresta" → a mesma estrutura |
| Jornada: lista → item → "Voltar para a lista" | lista | lista | empilhava a lista de novo (ciclo) | Voltar do histórico (o Avançar devolve o item) |
| Mapa → cadastro de estruturas / ficha da estrutura | ADMIN › Estruturas | o Mapa | ADMIN › Avaliações e Mapa | "← Voltar para o Mapa da Floresta" |
| Mapa → "Definição e documentação do Mapa" | ADMIN › Documentação | o Mapa | ADMIN › Avaliações e Mapa | "← Voltar para o Mapa da Floresta" |
| Avaliações e Mapa → "Abrir a aba Taxonomia" | Taxonomia | Avaliações e Mapa | ok desde o #383/#384 (retorno conferido, confirmação com edição aberta) | idem |
| Posicionamento → "Cadastrar estrutura do tipo" | ADMIN › Estruturas | a ficha (bloco do responsável) | link fixo para a ficha | sem mudança (já leva ao lugar certo) |
| Porta 2 (análises de área) | lista → análise → responsabilidades | hierarquia da Porta 2 | links fixos (análise → lista → atuações) | sem mudança — hierarquia fixa; ver pendência |

## Pendência que depende de decisão

- **Porta 2 (`analises-organizacionais.js`).** Os retornos são uma hierarquia fixa: a análise volta para a lista de análises, e a lista volta para as responsabilidades (`?po=atuacoes`), seja qual for a origem. Pode ser intencional. Se a Porta 2 também deve voltar à origem (Trabalhos, Início), dá para aplicar a mesma regra.
