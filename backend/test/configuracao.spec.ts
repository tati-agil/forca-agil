import { ConfiguracaoInvalidaError, lerConfiguracao } from '../src/configuracao/configuracao';

const valido = { POSTGRES_HOST: 'postgres', POSTGRES_DB: 'forca_agil', POSTGRES_USER: 'forca_agil', POSTGRES_PASSWORD: 'senha-sintetica-de-teste' };

describe('configuração', () => {
  it('lê os valores e aplica padrões', () => {
    const c = lerConfiguracao(valido);
    expect(c.porta).toBe(3000);
    expect(c.banco).toEqual({ host: 'postgres', porta: 5432, banco: 'forca_agil', usuario: 'forca_agil', senha: 'senha-sintetica-de-teste', timeoutMs: 2000 });
  });

  it('recusa variáveis obrigatórias ausentes, citando só os nomes', () => {
    try {
      lerConfiguracao({ POSTGRES_HOST: 'postgres' });
      throw new Error('deveria ter recusado');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfiguracaoInvalidaError);
      expect((e as ConfiguracaoInvalidaError).problemas).toEqual(['POSTGRES_DB não definida', 'POSTGRES_USER não definida', 'POSTGRES_PASSWORD não definida']);
    }
  });

  it('recusa portas e tempos inválidos', () => {
    expect(() => lerConfiguracao({ ...valido, PORT: 'abc' })).toThrow(/PORT deve ser um inteiro/);
    expect(() => lerConfiguracao({ ...valido, POSTGRES_PORT: '70000' })).toThrow(/POSTGRES_PORT/);
    expect(() => lerConfiguracao({ ...valido, BANCO_TIMEOUT_MS: '5' })).toThrow(/BANCO_TIMEOUT_MS/);
  });

  it('nunca inclui valores nas mensagens de erro (só nomes)', () => {
    try {
      lerConfiguracao({ ...valido, POSTGRES_DB: '', PORT: 'porta-secreta-123' });
    } catch (e) {
      expect((e as Error).message).not.toMatch(/senha-sintetica-de-teste|porta-secreta-123/);
    }
  });
});
