import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { FiltroErros } from '../../../compartilhado/api/filtro-erros';
import { ConflitoDeRevisao, ViolacaoDeIntegridade } from '../../../persistencia/contratos/repositorio-estruturas';
import { IdempotenciaConflitante, NaoEncontrado, OperacaoRecusada } from '../aplicacao/estruturas.servico';
import { ReferenciaOficialIndisponivel } from '../aplicacao/portas';

/* Traduz os resultados da aplicação para HTTP, no formato padrão { erro: { status, mensagem, codigo?, erros? } }:
     recusa do núcleo → 422 com os erros dele (REVISAO_DESATUALIZADA → 409); alvo inexistente → 404;
     outra operação gravou antes / concorrência que não se resolveu → 409; fonte oficial fora do ar → 503. */
const CONCORRENCIA = new Set(['40001', '40P01']);

@Catch()
export class FiltroEstruturas implements ExceptionFilter {
  private readonly geral = new FiltroErros();

  catch(erro: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const responder = (status: number, mensagem: string, codigo: string, extra: Record<string, unknown> = {}) =>
      res.status(status).json({ erro: { status, mensagem, codigo, ...extra } });

    if (erro instanceof OperacaoRecusada) {
      const revisao = erro.erros.some((e) => e.codigo === 'REVISAO_DESATUALIZADA');
      return void responder(revisao ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY, 'Operação recusada pelas regras', 'OPERACAO_RECUSADA', { erros: erro.erros });
    }
    if (erro instanceof NaoEncontrado) return void responder(HttpStatus.NOT_FOUND, 'Não encontrado', erro.message);
    if (erro instanceof ViolacaoDeIntegridade) return void responder(HttpStatus.UNPROCESSABLE_ENTITY, 'Operação recusada pelas regras', 'OPERACAO_RECUSADA', { erros: [{ codigo: erro.codigo }] });
    if (erro instanceof ConflitoDeRevisao) return void responder(HttpStatus.CONFLICT, 'Outra operação alterou este registro; leia de novo e repita', 'CONFLITO_DE_REVISAO');
    if (erro instanceof IdempotenciaConflitante) return void responder(HttpStatus.CONFLICT, 'Esta chave de idempotência já foi usada com outro pedido', erro.message);
    if (erro instanceof ReferenciaOficialIndisponivel) return void responder(HttpStatus.SERVICE_UNAVAILABLE, 'Referência oficial indisponível; nada foi gravado', erro.message, { fonte: erro.fonte });
    const code = (erro as { code?: string })?.code;
    if (code && CONCORRENCIA.has(code)) return void responder(HttpStatus.CONFLICT, 'Muitas operações simultâneas; repita', 'CONCORRENCIA');
    this.geral.catch(erro, host);
  }
}
