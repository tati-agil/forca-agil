import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/* Respostas de erro uniformes ({ erro: { status, mensagem, codigo?, erros? } }) e sem vazar detalhes internos: um erro inesperado
   vira 500 "Erro interno" e só o tipo do erro vai para o log (nunca dados de conexão nem credenciais). */
@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(erro: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const corpo = erro.getResponse();
      const c = (typeof corpo === 'string' ? {} : corpo) as { message?: string | string[]; codigo?: string; erros?: unknown[] };
      const mensagem = typeof corpo === 'string' ? corpo : c.message ?? erro.message;
      /* codigo e erros (ex.: as recusas do núcleo) acompanham a resposta quando existem */
      res.status(status).json({ erro: { status, mensagem, ...(c.codigo ? { codigo: c.codigo } : {}), ...(c.erros ? { erros: c.erros } : {}) } });
      return;
    }
    this.logger.error(`Erro não tratado: ${(erro as Error)?.name || typeof erro}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ erro: { status: 500, mensagem: 'Erro interno' } });
  }
}
