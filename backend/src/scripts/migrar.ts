import { join } from 'path';
import { ConfiguracaoInvalidaError, lerConfiguracao } from '../configuracao/configuracao';
import { aplicarMigracoes } from '../persistencia/postgres/migracoes';
import { criarPool } from '../persistencia/postgres/pool';

/* npm run migrar  (ou, no Docker: docker compose exec api npm run migrar)
   Aplica as migrações de backend/migracoes que ainda não foram aplicadas. */
async function migrar(): Promise<void> {
  let configuracao;
  try {
    configuracao = lerConfiguracao();
  } catch (e) {
    if (e instanceof ConfiguracaoInvalidaError) { console.error(e.message); process.exit(1); }
    throw e;
  }
  const pool = criarPool(configuracao.banco);
  try {
    const r = await aplicarMigracoes(pool, join(__dirname, '..', '..', 'migracoes'));
    console.log(`Migrações aplicadas agora: ${r.aplicadas.length ? r.aplicadas.join(', ') : 'nenhuma'}; já aplicadas: ${r.jaAplicadas.length}.`);
  } finally {
    await pool.end();
  }
}

migrar().catch((e: Error) => {
  console.error(`Falha nas migrações: ${e.message}`);
  process.exit(1);
});
