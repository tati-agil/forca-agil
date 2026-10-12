# Paridade Firebase × PostgreSQL — requisitos e critérios de aceite

Decisão da responsável pelo repositório, 2026-10-11. Vale para todo incremento do Núcleo de Avaliação, Taxonomia e Mapa
da Floresta que grave dados. É requisito obrigatório, não meta.

## Situação hoje (não apresentar como mais do que isto)

- O **Firebase Realtime Database** (plano Spark) é a **única fonte oficial de gravação** do site.
- O **PostgreSQL** é só local, com dados **sintéticos** de teste. Não tem dados reais e não está sincronizado com nada.
- **Não existe nenhum teste real de equivalência Firebase × PostgreSQL.** O que existe:
  - o conjunto versionado de cenários das Estruturas (`.github/scripts/cenarios/estruturas-concretas.v1.json`) com o
    executor compartilhado e o **primeiro** dos três executores, a referência em memória
    (`teste-estruturas-cenarios-referencia.js`) e o **segundo**, o Firebase Emulator pelo adaptador `estruturas-firebase.js`
    (`teste-rules-estruturas-concretas.js`, com as gravações diretas inválidas); a tela de cadastro (Etapa 4) grava pelo mesmo caso de
    uso e adaptador, só no Firebase Emulator (`teste-estruturas-jornada.js`); o executor do PostgreSQL ainda não existe;
  - `forca-agil/estruturas-nucleo.js` é o mesmo arquivo no site e no backend (`backend/test/nucleo-estruturas.spec.ts`);
  - `teste-estruturas-nucleo.js` prova o núcleo em memória; `backend/test/integracao/` prova o PostgreSQL com cenários
    próprios. São cenários diferentes, então não são prova de paridade.
- P1–P16, O1–O9, S1–S8, I2 e a Taxonomia existem só no Firebase. Estruturas, relações e vínculos existem só no
  PostgreSQL (o site ainda não os grava).

## Duas garantias diferentes

1. **Resultados iguais:** os mesmos dados, decisões e versões de regras produzem o mesmo resultado nos dois ambientes.
   Isso se comprova com testes.
2. **Dados consistentes:** numa migração, todos os registros, vínculos, versões e históricos são preservados e
   conferidos. Isso exige migração controlada e reconciliação dos dados reais. Testes de paridade não sincronizam bancos.

## Regras

- **Uma regra de negócio, uma fonte:** os arquivos de núcleo e motores de `forca-agil/`. O backend carrega os mesmos
  arquivos; nenhum motor paralelo.
- **Uma fonte oficial de gravação por vez.** Nada de gravação dupla pelo navegador nem de sincronização presumida.
- **Horário canônico = horário do servidor.** Nunca o relógio do navegador, celular ou computador.
- **Autoria autenticada, identificadores estáveis, revisões e eventos históricos** são preservados. Numa migração, os
  horários originais e os identificadores dos eventos são mantidos, nunca recriados.
- **Permissões:** uma única matriz funcional como referência. As políticas aplicadas no Firebase (`database.rules.json`)
  e no backend (`backend/src/compartilhado/autenticacao/perfis.ts`) são verificadas por testes equivalentes, incluindo
  tentativas proibidas. `database.rules.json` não é reescrito nem gerado automaticamente sem revisão específica e
  autorização da responsável.
- **Hierarquia sem ciclos:** relações `compõe` (e outras sujeitas a ciclo) **não são gravadas no site** enquanto não
  houver solução demonstrada que garanta a mesma integridade nos dois ambientes, inclusive sob concorrência. Não se
  presume que a Taxonomia atual resolva isso. Isso não bloqueia o cadastro de estruturas nem os vínculos de
  responsável principal, desde que as garantias deles estejam comprovadas.

## Critério de aceite de uma operação que grava

Uma operação que exista nos dois bancos só é considerada **validada nos dois** com:

1. **um único conjunto de cenários de negócio**, com o mesmo contexto e as mesmas entradas (identificadores, usuário e
   horário fixos no teste), executado contra:
   - o núcleo puro de referência (`aplicar()`);
   - o **Firebase Realtime Database Emulator**;
   - o **PostgreSQL local de testes**;
2. **comparação automática** dos resultados de negócio normalizados: aceitação, recusa (com os mesmos códigos), estado
   persistido, validações, revisões, vínculos, eventos, integridade e auditoria.

Só diferenças técnicas sem valor de negócio podem ser normalizadas (por exemplo, a hora em que dois testes
independentes rodaram). Normalização nunca pode esconder divergência funcional. Execução em um só ambiente não valida a
operação nos dois.

Funcionalidade **só de consulta**, sem gravação nova (como o Catálogo preparatório do Mapa da Floresta), pode ser
concluída antes dos adaptadores, com essa limitação dita.

## Migração futura (troca da fonte oficial)

Só com: congelamento das gravações na origem; transferência verificável preservando identificadores, decisões,
versões e históricos; reconciliação automática (contagens, hash canônico por registro, integridade referencial,
reaplicação dos eventos reproduzindo o estado final, situações derivadas recalculadas e comparadas nos dois lados); e
**divergência zero**. Qualquer divergência bloqueia a troca, e a fonte atual continua oficial.
