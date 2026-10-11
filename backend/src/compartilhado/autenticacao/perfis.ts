import type { Identidade } from './verificador-identidade';

/* Perfis OFICIAIS do FORÇA ÁGIL — a mesma fonte do site, nunca uma lista própria do backend:
     - admin geral: os e-mails fixos das regras do banco + o nó fa-admins/<chave do e-mail>;
     - perfil de Avaliação: fa-avaliacao-autorizados/<chave do e-mail>/tipo = 'avaliacao' | 'avaliacao-arquitetura'.
   Permissões das Estruturas Concretas (delimitação funcional aprovada):
     - manter (estruturas, relações e vínculos): admin geral e Avaliação + Arquitetura;
     - consultar: também o perfil Avaliação.
   A leitura dessas listas no Firebase ainda não está ligada ao backend (exige decidir como o backend lê o banco de
   produção). Até lá a fonte é FontePerfisIndisponivel: toda rota de negócio é recusada (503), nunca liberada. */

export type TipoAvaliacao = 'avaliacao' | 'avaliacao-arquitetura';
export interface Perfil {
  adminGeral: boolean;
  avaliacao: TipoAvaliacao | null;
}
export type Permissao = 'manter' | 'consultar';

export function permite(perfil: Perfil, permissao: Permissao): boolean {
  const manter = perfil.adminGeral || perfil.avaliacao === 'avaliacao-arquitetura';
  return permissao === 'manter' ? manter : manter || perfil.avaliacao === 'avaliacao';
}

export interface FontePerfis {
  /* PerfisIndisponiveis quando não for possível consultar as listas oficiais agora */
  perfilDe(identidade: Identidade): Promise<Perfil>;
}

export class PerfisIndisponiveis extends Error {
  constructor() { super('PERFIS_INDISPONIVEIS'); this.name = 'PerfisIndisponiveis'; }
}

export class FontePerfisIndisponivel implements FontePerfis {
  async perfilDe(): Promise<Perfil> { throw new PerfisIndisponiveis(); }
}

export const FONTE_PERFIS = Symbol('FONTE_PERFIS');
