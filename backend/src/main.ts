import { criarAplicacao } from './aplicacao';
import { ConfiguracaoInvalidaError, lerConfiguracao } from './configuracao/configuracao';

async function iniciar(): Promise<void> {
  let configuracao;
  try {
    configuracao = lerConfiguracao();
  } catch (e) {
    if (e instanceof ConfiguracaoInvalidaError) {
      /* só os nomes das variáveis com problema; nenhum valor */
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const app = await criarAplicacao(configuracao);
  await app.listen(configuracao.porta, '0.0.0.0');
  console.log(`API no ar na porta ${configuracao.porta} (rotas em /api).`);
}

iniciar().catch((e: Error) => {
  console.error(`Falha ao iniciar a API: ${e.name}`);
  process.exit(1);
});
