import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ExecutorSql, UnidadeDeTrabalho } from '../contratos/unidade-de-trabalho';
import { POOL_POSTGRES } from './pool';

/* Adaptador PostgreSQL da unidade de trabalho: uma transação SERIALIZABLE. Duas operações concorrentes que
   leram o mesmo estado e gravariam algo incompatível não são confirmadas juntas: o PostgreSQL recusa uma delas
   (40001) e ela é repetida do começo, agora vendo o que a outra gravou. Assim os invariantes que dependem de
   outros registros (docs/estruturas-nucleo-contratos.md) valem também sob concorrência. */
const REPETIVEIS = new Set(['40001', '40P01']); /* falha de serialização, deadlock */

@Injectable()
export class UnidadeDeTrabalhoPostgres implements UnidadeDeTrabalho {
  constructor(@Inject(POOL_POSTGRES) private readonly pool: Pool) {}

  async executar<T>(trabalho: (sql: ExecutorSql) => Promise<T>, tentativas = 8): Promise<T> {
    for (let tentativa = 1; ; tentativa++) {
      /* espera curta e aleatória antes de repetir, para as operações concorrentes não colidirem de novo */
      if (tentativa > 1) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20 * tentativa)));
      const cliente = await this.pool.connect();
      try {
        await cliente.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const executor: ExecutorSql = {
          consultar: async <R>(sql: string, parametros?: unknown[]) => (await cliente.query(sql, parametros as unknown[])).rows as R[]
        };
        const resultado = await trabalho(executor);
        await cliente.query('COMMIT');
        return resultado;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        const code = (e as { code?: string }).code;
        if (code && REPETIVEIS.has(code) && tentativa < tentativas) continue;
        throw e;
      } finally {
        cliente.release();
      }
    }
  }
}
