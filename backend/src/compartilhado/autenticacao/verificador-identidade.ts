/* Identidade — preparação para o Firebase Authentication (sem implementação nesta entrega).

   O site continua autenticando pelo Firebase Authentication. Quando houver rotas de negócio, o navegador enviará o
   ID token do Firebase (Authorization: Bearer <token>) e o backend o validará com o Firebase Admin SDK
   (verifyIdToken: assinatura pelas chaves públicas do Google, emissor e audiência = o projeto Firebase, validade),
   implementando esta porta num adaptador próprio. Sem autenticação paralela: a identidade é sempre a do Firebase.
   Os perfis (admin geral, Avaliação, Avaliação + Arquitetura) continuam vindo das mesmas listas oficiais.

   Regra: nenhuma rota de negócio fica sem um guard que use esta porta. As rotas de saúde não expõem dados e são as
   únicas públicas. Detalhes em backend/README.md (Autenticação). */

export interface Identidade {
  uid: string;
  email: string;
  emailVerificado: boolean;
}

export interface VerificadorIdentidade {
  /* devolve a identidade do token ou lança erro se ele for inválido, expirado ou de outro projeto */
  verificar(idToken: string): Promise<Identidade>;
}

export const VERIFICADOR_IDENTIDADE = Symbol('VERIFICADOR_IDENTIDADE');
