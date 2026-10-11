/* Configuração do backend, lida das variáveis de ambiente e validada UMA vez, na inicialização.
   Nunca inclui valores sensíveis em mensagens de erro ou de log: só os NOMES das variáveis com problema. */

export interface ConfiguracaoBanco {
  host: string;
  porta: number;
  banco: string;
  usuario: string;
  senha: string;
  /* tempo máximo de uma verificação de disponibilidade */
  timeoutMs: number;
}

export interface Configuracao {
  porta: number;
  banco: ConfiguracaoBanco;
}

export class ConfiguracaoInvalidaError extends Error {
  constructor(readonly problemas: string[]) {
    super('Configuração inválida: ' + problemas.join('; '));
    this.name = 'ConfiguracaoInvalidaError';
  }
}

type Ambiente = Record<string, string | undefined>;

function inteiro(env: Ambiente, nome: string, padrao: number, min: number, max: number, problemas: string[]): number {
  const bruto = env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < min || n > max) {
    problemas.push(`${nome} deve ser um inteiro entre ${min} e ${max}`);
    return padrao;
  }
  return n;
}

function obrigatoria(env: Ambiente, nome: string, problemas: string[]): string {
  const v = env[nome];
  if (v === undefined || v.trim() === '') {
    problemas.push(`${nome} não definida`);
    return '';
  }
  return v;
}

export function lerConfiguracao(env: Ambiente = process.env): Configuracao {
  const problemas: string[] = [];
  const configuracao: Configuracao = {
    porta: inteiro(env, 'PORT', 3000, 1, 65535, problemas),
    banco: {
      host: obrigatoria(env, 'POSTGRES_HOST', problemas),
      porta: inteiro(env, 'POSTGRES_PORT', 5432, 1, 65535, problemas),
      banco: obrigatoria(env, 'POSTGRES_DB', problemas),
      usuario: obrigatoria(env, 'POSTGRES_USER', problemas),
      senha: obrigatoria(env, 'POSTGRES_PASSWORD', problemas),
      timeoutMs: inteiro(env, 'BANCO_TIMEOUT_MS', 2000, 100, 60000, problemas)
    }
  };
  if (problemas.length) throw new ConfiguracaoInvalidaError(problemas);
  return configuracao;
}

export const CONFIGURACAO = Symbol('CONFIGURACAO');
