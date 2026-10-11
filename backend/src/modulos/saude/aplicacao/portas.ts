/* Porta da aplicação: como verificar a disponibilidade do banco. A aplicação não sabe qual banco é;
   o adaptador em persistencia/postgres implementa. */

export type MotivoIndisponibilidade = 'TEMPO_ESGOTADO' | 'CONEXAO_RECUSADA' | 'AUTENTICACAO' | 'FALHA';

export interface VerificacaoBanco {
  disponivel: boolean;
  latenciaMs?: number;
  motivo?: MotivoIndisponibilidade;
}

export interface VerificadorBanco {
  verificar(): Promise<VerificacaoBanco>;
}

export const VERIFICADOR_BANCO = Symbol('VERIFICADOR_BANCO');
