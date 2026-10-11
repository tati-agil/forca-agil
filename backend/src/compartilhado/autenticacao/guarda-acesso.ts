import { CanActivate, createParamDecorator, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { FONTE_PERFIS, FontePerfis, Perfil, PerfisIndisponiveis, permite, Permissao as TipoPermissao } from './perfis';
import { AutenticacaoIndisponivel, Identidade, IdentidadeInvalida, VERIFICADOR_IDENTIDADE, VerificadorIdentidade } from './verificador-identidade';

/* Guarda GLOBAL: toda rota exige identidade Firebase válida + perfil oficial com a permissão declarada.
   Uma rota sem declaração é recusada (nada fica aberto por esquecimento). Só @Publica() dispensa (rotas de saúde). */
const CHAVE_PERMISSAO = 'forca-agil:permissao';
const CHAVE_PUBLICA = 'forca-agil:publica';

export const Permissao = (p: TipoPermissao) => SetMetadata(CHAVE_PERMISSAO, p);
export const Publica = () => SetMetadata(CHAVE_PUBLICA, true);

export interface Acesso { identidade: Identidade; perfil: Perfil }
type PedidoComAcesso = Request & { acesso?: Acesso };

/* o usuário de uma operação vem só daqui (do token verificado), nunca do corpo do pedido */
export const AcessoAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Acesso => {
  const acesso = ctx.switchToHttp().getRequest<PedidoComAcesso>().acesso;
  if (!acesso) throw new HttpException({ message: 'Não autenticado', codigo: 'NAO_AUTENTICADO' }, HttpStatus.UNAUTHORIZED);
  return acesso;
});

function recusa(status: HttpStatus, codigo: string, mensagem: string): HttpException {
  return new HttpException({ message: mensagem, codigo }, status);
}

@Injectable()
export class GuardaAcesso implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(VERIFICADOR_IDENTIDADE) private readonly verificador: VerificadorIdentidade,
    @Inject(FONTE_PERFIS) private readonly perfis: FontePerfis
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICA, alvos)) return true;
    const permissao = this.reflector.getAllAndOverride<TipoPermissao>(CHAVE_PERMISSAO, alvos);
    if (!permissao) throw recusa(HttpStatus.FORBIDDEN, 'ROTA_SEM_PERMISSAO_DECLARADA', 'Rota sem permissão declarada');

    const pedido = ctx.switchToHttp().getRequest<PedidoComAcesso>();
    const m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(pedido.headers.authorization || '');
    if (!m) throw recusa(HttpStatus.UNAUTHORIZED, 'NAO_AUTENTICADO', 'É preciso enviar o ID token do Firebase (Authorization: Bearer)');
    let identidade: Identidade, perfil: Perfil;
    try {
      identidade = await this.verificador.verificar(m[1]);
    } catch (e) {
      if (e instanceof IdentidadeInvalida) throw recusa(HttpStatus.UNAUTHORIZED, 'IDENTIDADE_INVALIDA', 'ID token inválido ou expirado');
      if (e instanceof AutenticacaoIndisponivel) throw recusa(HttpStatus.SERVICE_UNAVAILABLE, e.codigo, 'Não é possível verificar a identidade agora');
      throw e;
    }
    try {
      perfil = await this.perfis.perfilDe(identidade);
    } catch (e) {
      if (e instanceof PerfisIndisponiveis) throw recusa(HttpStatus.SERVICE_UNAVAILABLE, 'PERFIS_INDISPONIVEIS', 'Não é possível consultar os perfis oficiais agora');
      throw e;
    }
    if (!permite(perfil, permissao)) throw recusa(HttpStatus.FORBIDDEN, 'SEM_PERMISSAO', 'Seu perfil não permite esta operação');
    pedido.acesso = { identidade, perfil };
    return true;
  }
}
