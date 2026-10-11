/* CAMADA 3 — contratos de persistência (independentes de banco).
   A aplicação depende destes contratos; os adaptadores (persistencia/postgres) os implementam.

   Unidade de trabalho: executa um conjunto de leituras e gravações de forma ATÔMICA (tudo ou nada) e com isolamento
   suficiente para garantir os invariantes que dependem de outros registros — por exemplo, os do núcleo de Estruturas
   Concretas (docs/estruturas-nucleo-contratos.md): um único responsável principal ativo por objeto, nenhuma relação
   ativa duplicada, nenhum ciclo em "compõe". Sob concorrência, uma das operações conflitantes é recusada ou
   repetida; nunca as duas são confirmadas. */

export interface ExecutorSql {
  consultar<T = Record<string, unknown>>(sql: string, parametros?: unknown[]): Promise<T[]>;
}

export interface UnidadeDeTrabalho {
  executar<T>(trabalho: (sql: ExecutorSql) => Promise<T>): Promise<T>;
}

export const UNIDADE_DE_TRABALHO = Symbol('UNIDADE_DE_TRABALHO');
