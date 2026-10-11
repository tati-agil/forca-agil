import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { CONFIGURACAO, Configuracao } from '../../configuracao/configuracao';
import { MotivoIndisponibilidade, VerificacaoBanco, VerificadorBanco } from '../../modulos/saude/aplicacao/portas';
import { POOL_POSTGRES } from './pool';

/* Adaptador: implementa a porta VerificadorBanco com um "SELECT 1" limitado no tempo.
   Devolve só um motivo resumido — nunca a mensagem do driver, que pode citar host ou usuário. */
@Injectable()
export class VerificadorBancoPostgres implements VerificadorBanco {
  constructor(@Inject(POOL_POSTGRES) private readonly pool: Pool, @Inject(CONFIGURACAO) private readonly configuracao: Configuracao) {}

  async verificar(): Promise<VerificacaoBanco> {
    const inicio = Date.now();
    let relogio: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, rejeitar) => {
      relogio = setTimeout(() => rejeitar(Object.assign(new Error('tempo esgotado'), { code: 'TEMPO_ESGOTADO' })), this.configuracao.banco.timeoutMs);
    });
    try {
      await Promise.race([this.pool.query('SELECT 1'), limite]);
      return { disponivel: true, latenciaMs: Date.now() - inicio };
    } catch (e) {
      return { disponivel: false, motivo: motivoDe(e) };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}

export function motivoDe(e: unknown): MotivoIndisponibilidade {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'TEMPO_ESGOTADO' || /timeout/i.test(String((e as Error)?.message || ''))) return 'TEMPO_ESGOTADO';
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNRESET' || code === '57P03') return 'CONEXAO_RECUSADA';
  if (code === '28P01' || code === '28000') return 'AUTENTICACAO';
  return 'FALHA';
}
