import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AutenticacaoIndisponivel, Identidade, IdentidadeInvalida, VerificadorIdentidade } from './verificador-identidade';

/* Validação do ID token do Firebase Authentication, conforme a documentação do Firebase para bibliotecas JWT de
   terceiros ("Verify ID tokens using a third-party JWT library"):
     - algoritmo RS256, assinado por uma das chaves públicas do Google para o Firebase (kid do cabeçalho);
     - aud = ID do projeto; iss = https://securetoken.google.com/<projeto>; exp no futuro; iat e auth_time no passado;
     - sub (o UID) não vazio, até 128 caracteres.
   Não usa conta de serviço nem segredo: só o ID público do projeto. As chaves são buscadas no Google e guardadas
   em cache; se não puderem ser obtidas, a verificação é recusada (AutenticacaoIndisponivel), nunca aceita. */
export const CHAVES_PUBLICAS_FIREBASE = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const TOLERANCIA_S = 5;

export class VerificadorIdentidadeFirebase implements VerificadorIdentidade {
  constructor(private readonly projetoId: string, private readonly chaves: JWTVerifyGetKey) {}

  static comChavesDoGoogle(projetoId: string): VerificadorIdentidadeFirebase {
    return new VerificadorIdentidadeFirebase(projetoId, createRemoteJWKSet(new URL(CHAVES_PUBLICAS_FIREBASE), { timeoutDuration: 5000, cooldownDuration: 30000 }));
  }

  async verificar(idToken: string): Promise<Identidade> {
    if (typeof idToken !== 'string' || !idToken || idToken.length > 4096) throw new IdentidadeInvalida();
    let carga;
    try {
      ({ payload: carga } = await jwtVerify(idToken, this.chaves, {
        algorithms: ['RS256'], audience: this.projetoId, issuer: 'https://securetoken.google.com/' + this.projetoId, clockTolerance: TOLERANCIA_S
      }));
    } catch (e) {
      /* chaves inalcançáveis ou fora do ar: não dá para saber se o token é bom — recusa como indisponível */
      if (e instanceof errors.JWKSTimeout || !(e instanceof errors.JOSEError)) throw new AutenticacaoIndisponivel('AUTENTICACAO_INDISPONIVEL');
      throw new IdentidadeInvalida();
    }
    const agora = Math.floor(Date.now() / 1000) + TOLERANCIA_S;
    const sub = carga.sub, email = carga.email, authTime = carga.auth_time, iat = carga.iat;
    if (typeof sub !== 'string' || !sub || sub.length > 128) throw new IdentidadeInvalida();
    if (typeof iat !== 'number' || iat > agora || typeof authTime !== 'number' || authTime > agora) throw new IdentidadeInvalida();
    /* os perfis oficiais são listas por e-mail: sem e-mail no token, não há como saber o perfil */
    if (typeof email !== 'string' || !email.includes('@')) throw new IdentidadeInvalida();
    return { uid: sub, email: email.toLowerCase(), emailVerificado: carga.email_verified === true };
  }
}
