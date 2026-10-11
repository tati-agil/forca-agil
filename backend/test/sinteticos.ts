/* DADOS SINTÉTICOS — só para testes e demonstração local.
   Nada aqui é conceito, estrutura, avaliação, pessoa ou e-mail da PREVI: os conceitos têm prefixo SINT_, os e-mails
   são do domínio reservado .invalid e as estruturas se chamam "… (sintética)". Os códigos de motor (NEGOCIOS, COE,
   A_VALIDAR) são os códigos OFICIAIS do motor de Posicionamento, lidos do próprio motor — a correspondência deles com
   os conceitos SINT_ é sintética, de propósito diferente do código, para provar que nada presume "mesmo código". */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';
import type { Identidade } from '../src/compartilhado/autenticacao/verificador-identidade';
import type { FontePerfis, Perfil } from '../src/compartilhado/autenticacao/perfis';
import { VerificadorIdentidadeFirebase } from '../src/compartilhado/autenticacao/verificador-identidade-firebase';
import type { FontePosicionamento, FonteTaxonomia, ReferenciasTaxonomia } from '../src/modulos/estruturas/aplicacao/portas';
import { ReferenciaOficialIndisponivel } from '../src/modulos/estruturas/aplicacao/portas';
import type { PosicionamentoVigente } from '../src/nucleo/estruturas';

export const PROJETO_SINTETICO = 'projeto-sintetico-teste';

export const TAXONOMIA_SINTETICA: ReferenciasTaxonomia = {
  conceitos: {
    SINT_NEGOCIOS: { ativo: true }, SINT_COE: { ativo: true }, SINT_SQUAD: { ativo: true }, SINT_CAPITULO: { ativo: true },
    SINT_INATIVO: { ativo: false }
  },
  relacoesConceituais: [
    { de: 'SINT_SQUAD', tipo: 'compoe', para: 'SINT_NEGOCIOS', ativa: true },
    { de: 'SINT_COE', tipo: 'compoe', para: 'SINT_COE', ativa: true },
    { de: 'SINT_CAPITULO', tipo: 'aloca-em', para: 'SINT_SQUAD', ativa: true },
    { de: 'SINT_SQUAD', tipo: 'atende', para: 'SINT_NEGOCIOS', ativa: true }
  ],
  herancaPeloPai: false,
  ligacoes: { NEGOCIOS: 'SINT_NEGOCIOS', COE: 'SINT_COE', AREA_ESPECIALIZADA: 'SINT_INATIVO' },
  conceitosTrabalho: ['SINT_SQUAD', 'SINT_CAPITULO']
};

/* fonte de Taxonomia sintética, que pode ser "derrubada" para provar a recusa sem referência oficial */
export class TaxonomiaSintetica implements FonteTaxonomia {
  disponivel = true;
  async referencias(): Promise<ReferenciasTaxonomia> {
    if (!this.disponivel) throw new ReferenciaOficialIndisponivel('taxonomia');
    return JSON.parse(JSON.stringify(TAXONOMIA_SINTETICA));
  }
}

export class PosicionamentoSintetico implements FontePosicionamento {
  disponivel = true;
  vigentes: Record<string, PosicionamentoVigente | null> = {};
  async vigenteDoObjeto(objetoId: string): Promise<PosicionamentoVigente | null> {
    if (!this.disponivel) throw new ReferenciaOficialIndisponivel('posicionamento');
    return this.vigentes[objetoId] ?? null;
  }
}

export const EMAILS = {
  admin: 'admin-geral@sintetico.invalid',
  arquitetura: 'arquitetura@sintetico.invalid',
  consulta: 'avaliacao@sintetico.invalid',
  semPerfil: 'sem-perfil@sintetico.invalid'
};
export class PerfisSinteticos implements FontePerfis {
  async perfilDe(i: Identidade): Promise<Perfil> {
    if (i.email === EMAILS.admin) return { adminGeral: true, avaliacao: null };
    if (i.email === EMAILS.arquitetura) return { adminGeral: false, avaliacao: 'avaliacao-arquitetura' };
    if (i.email === EMAILS.consulta) return { adminGeral: false, avaliacao: 'avaliacao' };
    return { adminGeral: false, avaliacao: null };
  }
}

/* Emissor de ID tokens no FORMATO do Firebase, assinados por uma chave gerada no teste. O verificador usado é o
   MESMO VerificadorIdentidadeFirebase da aplicação; só o conjunto de chaves públicas é o local, em vez do Google. */
export class EmissorSintetico {
  private constructor(private readonly privada: KeyLike, readonly jwk: JWK) {}
  static async criar(kid = 'chave-sintetica'): Promise<EmissorSintetico> {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    return new EmissorSintetico(privateKey, { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' });
  }
  verificador(projeto = PROJETO_SINTETICO): VerificadorIdentidadeFirebase {
    return new VerificadorIdentidadeFirebase(projeto, createLocalJWKSet({ keys: [this.jwk] }));
  }
  async token(email: string, opcoes: { uid?: string; projeto?: string; emissor?: string; expiraEm?: string | number; authTime?: number; semEmail?: boolean } = {}): Promise<string> {
    const projeto = opcoes.projeto ?? PROJETO_SINTETICO;
    const agora = Math.floor(Date.now() / 1000);
    return new SignJWT({ ...(opcoes.semEmail ? {} : { email }), email_verified: true, auth_time: opcoes.authTime ?? agora - 10 })
      .setProtectedHeader({ alg: 'RS256', kid: this.jwk.kid as string })
      .setSubject(opcoes.uid ?? 'uid-' + email.split('@')[0])
      .setAudience(projeto)
      .setIssuer(opcoes.emissor ?? 'https://securetoken.google.com/' + projeto)
      .setIssuedAt(agora - 10)
      .setExpirationTime(opcoes.expiraEm ?? '1h')
      .sign(this.privada);
  }
}
