import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, UseFilters } from '@nestjs/common';
import { Acesso, AcessoAtual, Permissao } from '../../../compartilhado/autenticacao/guarda-acesso';
import { EstruturasServico } from '../aplicacao/estruturas.servico';
import { FiltroEstruturas } from './filtro-estruturas';
import { chaveIdempotencia, corpo, identificador, revisao, situacao } from './pedido';

/* CAMADA 1 — API das Estruturas Organizacionais Concretas. Toda rota passa pela guarda global (identidade Firebase
   + perfil oficial): "consultar" = admin geral, Avaliação + Arquitetura e Avaliação; "manter" = só os dois primeiros.
   Gravação com cabeçalho opcional Idempotency-Key (repetir o mesmo pedido devolve a mesma resposta). */

@UseFilters(FiltroEstruturas)
@Controller('estruturas')
export class EstruturasController {
  constructor(private readonly servico: EstruturasServico) {}

  @Get() @Permissao('consultar')
  listar(@Query('situacao') s?: string, @Query('tipo') tipo?: string) {
    return this.servico.listarEstruturas({ situacao: situacao(s), tipo: tipo || undefined });
  }

  @Get(':id') @Permissao('consultar')
  obter(@Param('id') id: string) { return this.servico.obterEstrutura(identificador(id)); }

  @Get(':id/historico') @Permissao('consultar')
  historico(@Param('id') id: string) { return this.servico.historico('estrutura', identificador(id)); }

  @Post() @Permissao('manter')
  criar(@AcessoAtual() a: Acesso, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    return this.servico.criarEstrutura(a, corpo(b, ['tipo', 'nome', 'sigla', 'descricao']), chaveIdempotencia(k));
  }

  /* nome, sigla e descrição; o tipo é imutável (o núcleo recusa) */
  @Patch(':id') @Permissao('manter')
  alterar(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    const { justificativa, revisaoEsperada, ...alteracoes } = corpo(b, ['nome', 'sigla', 'descricao', 'tipo', 'justificativa', 'revisaoEsperada']);
    return this.servico.alterarEstrutura(a, identificador(id), alteracoes, { justificativa, revisaoEsperada: revisao(revisaoEsperada) }, chaveIdempotencia(k));
  }

  @Post(':id/encerramento') @HttpCode(200) @Permissao('manter')
  encerrar(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    const c = corpo(b, ['motivo', 'revisaoEsperada']);
    return this.servico.encerrarEstrutura(a, identificador(id), c.motivo, { revisaoEsperada: revisao(c.revisaoEsperada) }, chaveIdempotencia(k));
  }
}

@UseFilters(FiltroEstruturas)
@Controller('relacoes')
export class RelacoesController {
  constructor(private readonly servico: EstruturasServico) {}

  /* ?situacao=ativa|encerrada|todas; ?revisao=pendente lista só as que precisam de revisão (ou não verificáveis agora) */
  @Get() @Permissao('consultar')
  listar(@Query('situacao') s?: string, @Query('revisao') r?: string) {
    return this.servico.listarRelacoes({ situacao: situacao(s), aRevisar: r === 'pendente' });
  }

  @Get(':id') @Permissao('consultar')
  obter(@Param('id') id: string) { return this.servico.obterRelacao(identificador(id)); }

  @Get(':id/historico') @Permissao('consultar')
  historico(@Param('id') id: string) { return this.servico.historico('relacao', identificador(id)); }

  @Post() @Permissao('manter')
  criar(@AcessoAtual() a: Acesso, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    return this.servico.criarRelacao(a, corpo(b, ['origem', 'tipo', 'destino', 'justificativa']), chaveIdempotencia(k));
  }

  /* alterar uma relação = encerrar a atual e criar a substituta, com motivo, numa só operação */
  @Post(':id/substituicao') @Permissao('manter')
  substituir(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    const { motivo, ...novos } = corpo(b, ['origem', 'tipo', 'destino', 'justificativa', 'motivo']);
    return this.servico.substituirRelacao(a, identificador(id), novos, motivo, chaveIdempotencia(k));
  }

  @Post(':id/encerramento') @HttpCode(200) @Permissao('manter')
  encerrar(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    return this.servico.encerrarRelacao(a, identificador(id), corpo(b, ['motivo']).motivo, chaveIdempotencia(k));
  }
}

@UseFilters(FiltroEstruturas)
@Controller()
export class ResponsaveisController {
  constructor(private readonly servico: EstruturasServico) {}

  /* responsável principal do objeto avaliado e a situação calculada */
  @Get('objetos/:objetoId/responsavel') @Permissao('consultar')
  responsavel(@Param('objetoId') objetoId: string) { return this.servico.responsavelDoObjeto(identificador(objetoId, true)); }

  @Post('objetos/:objetoId/responsavel') @Permissao('manter')
  vincular(@AcessoAtual() a: Acesso, @Param('objetoId') objetoId: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    return this.servico.vincularResponsavel(a, identificador(objetoId, true), corpo(b, ['estruturaId', 'justificativa']), chaveIdempotencia(k));
  }

  @Get('vinculos/:id') @Permissao('consultar')
  obter(@Param('id') id: string) { return this.servico.obterVinculo(identificador(id)); }

  @Get('vinculos/:id/historico') @Permissao('consultar')
  historico(@Param('id') id: string) { return this.servico.historico('vinculo', identificador(id)); }

  @Post('vinculos/:id/substituicao') @Permissao('manter')
  substituir(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    const { motivo, ...dados } = corpo(b, ['estruturaId', 'justificativa', 'motivo']);
    return this.servico.substituirResponsavel(a, identificador(id), dados, motivo, chaveIdempotencia(k));
  }

  @Post('vinculos/:id/encerramento') @HttpCode(200) @Permissao('manter')
  encerrar(@AcessoAtual() a: Acesso, @Param('id') id: string, @Body() b: unknown, @Headers('idempotency-key') k?: string) {
    return this.servico.encerrarVinculo(a, identificador(id), corpo(b, ['motivo']).motivo, chaveIdempotencia(k));
  }
}
