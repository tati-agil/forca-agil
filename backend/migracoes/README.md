# Migrações do esquema

Cada arquivo `NNNN_descricao.sql` é uma migração versionada. O comando `npm run migrar` aplica, em ordem, as que
ainda não foram aplicadas, cada uma em sua transação. Ele registra todas na tabela `schema_migracoes`, com o
checksum do arquivo.

- **Não edite uma migração já aplicada.** O checksum muda e o comando recusa rodar. Para corrigir, crie a próxima.
- **`0001_estruturas_concretas.sql`**: as tabelas das Estruturas Organizacionais Concretas (ver `backend/README.md`).
  Avaliações, Taxonomia e Mapa continuam no Firebase; as tabelas delas não existem aqui.
- **`0002_alocacao_divergente_colaboradoras.sql`**: E2 e E3 da alocação — `divergencia` (motivo da lista fechada e
  justificativa) só no responsável principal e imutável; papel `colaboradora`, com justificativa, no máximo uma ativa
  por (objeto, estrutura).
