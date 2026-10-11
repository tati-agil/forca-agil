/* Identidade — a do Firebase Authentication, sempre. Sem autenticação paralela e sem mudar o login do site.

   O navegador envia o ID token do Firebase (Authorization: Bearer <token>) e o backend o valida
   (verificador-identidade-firebase.ts: assinatura RS256 pelas chaves públicas do Google, emissor e audiência = o
   projeto Firebase configurado, validade). O usuário de cada operação vem SÓ do token — nunca do corpo do pedido.
   Os perfis (admin geral, Avaliação, Avaliação + Arquitetura) vêm das listas oficiais (perfis.ts).

   Regra: toda rota passa pela GuardaAcesso (global). Só as rotas de saúde são públicas e não expõem dados. */

export interface Identidade {
  uid: string;
  email: string;
  emailVerificado: boolean;
}

export interface VerificadorIdentidade {
  /* devolve a identidade do token; IdentidadeInvalida se ele for inválido, expirado ou de outro projeto;
     AutenticacaoIndisponivel se não for possível verificar agora (sem configuração, chaves inalcançáveis) */
  verificar(idToken: string): Promise<Identidade>;
}

export class IdentidadeInvalida extends Error {
  constructor() { super('IDENTIDADE_INVALIDA'); this.name = 'IdentidadeInvalida'; }
}
export class AutenticacaoIndisponivel extends Error {
  constructor(readonly codigo: 'AUTENTICACAO_NAO_CONFIGURADA' | 'AUTENTICACAO_INDISPONIVEL') { super(codigo); this.name = 'AutenticacaoIndisponivel'; }
}

/* sem FIREBASE_PROJECT_ID: nenhuma identidade é aceita (nunca uma liberação por conveniência) */
export class VerificadorIdentidadeNaoConfigurado implements VerificadorIdentidade {
  async verificar(): Promise<Identidade> { throw new AutenticacaoIndisponivel('AUTENTICACAO_NAO_CONFIGURADA'); }
}

export const VERIFICADOR_IDENTIDADE = Symbol('VERIFICADOR_IDENTIDADE');
