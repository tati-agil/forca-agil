import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VerificarSaude } from '../aplicacao/verificar-saude';

/* CAMADA 1 — API. Rotas técnicas, sem dado de negócio e sem detalhe de infraestrutura na resposta (nada de host,
   usuário, senha ou mensagem do driver): por isso podem ficar sem autenticação. Rotas de negócio NUNCA ficam. */
@Controller('saude')
export class SaudeController {
  constructor(private readonly verificarSaude: VerificarSaude) {}

  /* GET /api/saude — a API está no ar (não consulta o banco) */
  @Get()
  api() {
    return this.verificarSaude.api();
  }

  /* GET /api/saude/banco — 200 se o banco responde; 503 se não responde, com o motivo resumido */
  @Get('banco')
  async banco(@Res({ passthrough: true }) res: Response) {
    const v = await this.verificarSaude.banco();
    if (!v.disponivel) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'indisponivel', banco: 'indisponivel', motivo: v.motivo };
    }
    return { status: 'ok', banco: 'disponivel', latenciaMs: v.latenciaMs };
  }
}
