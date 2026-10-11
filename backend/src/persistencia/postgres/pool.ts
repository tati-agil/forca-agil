import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import type { ConfiguracaoBanco } from '../../configuracao/configuracao';

export const POOL_POSTGRES = Symbol('POOL_POSTGRES');

/* O pool não conecta ao ser criado: a API sobe mesmo com o banco fora do ar, e a verificação de saúde do banco
   diz que ele está indisponível. Erros de conexões ociosas são registrados sem detalhes sensíveis. */
export function criarPool(c: ConfiguracaoBanco): Pool {
  const pool = new Pool({
    host: c.host,
    port: c.porta,
    database: c.banco,
    user: c.usuario,
    password: c.senha,
    max: 10,
    connectionTimeoutMillis: c.timeoutMs,
    application_name: 'forca-agil-backend'
  });
  const logger = new Logger('PostgreSQL');
  pool.on('error', (e: Error & { code?: string }) => logger.warn(`Conexão ociosa encerrada com erro (${e.code || e.name}).`));
  return pool;
}
