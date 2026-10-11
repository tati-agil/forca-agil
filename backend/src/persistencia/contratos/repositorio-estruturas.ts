/* CAMADA 3 — contrato de persistência das Estruturas Organizacionais Concretas (independente de banco).

   Cumpre o contrato de docs/estruturas-nucleo-contratos.md (seção 3), sempre DENTRO de uma unidade de trabalho:
     - lerEstado devolve o estado que o núcleo valida (as três coleções, por identificador);
     - gravar grava a operação, TODAS as mudanças e TODOS os eventos juntos (a unidade de trabalho dá o tudo ou nada);
       uma criação só entra se o identificador não existe e uma alteração só se a entidade ainda está na
       revisaoAnterior — senão ConflitoDeRevisao e nada fica gravado;
     - os invariantes que dependem de outros registros (um responsável principal ativo por objeto, nenhuma relação
       ativa duplicada, nenhum ciclo em "compõe") valem sob concorrência porque o núcleo os revalida sobre o estado
       lido na MESMA transação serializável que grava; o banco ainda recusa duplicidades por índice único
       (ViolacaoDeIntegridade). Nada se apaga e eventos são só acréscimo. */
import type { Entidade, Estado, Evento, Mudanca } from '../../nucleo/estruturas';
import type { ExecutorSql } from './unidade-de-trabalho';

export interface OperacaoRegistrada {
  id: string;
  operacao: string;
  usuarioId: string;
  /* idempotência (opcional): a mesma chave do mesmo usuário devolve a mesma resposta, sem gravar de novo */
  chaveIdempotencia: string | null;
  digestPedido: string | null;
  resposta: unknown;
  em: string;
}

export interface RepositorioEstruturas {
  lerEstado(sql: ExecutorSql): Promise<Estado>;
  eventosDe(sql: ExecutorSql, entidade: Entidade, id: string): Promise<Evento[]>;
  operacaoPorChave(sql: ExecutorSql, usuarioId: string, chave: string): Promise<OperacaoRegistrada | null>;
  gravar(sql: ExecutorSql, operacao: OperacaoRegistrada, mudancas: Mudanca[], eventos: Evento[]): Promise<void>;
}

/* a entidade não estava mais na revisão lida (ou o identificador já existia): outra operação gravou antes */
export class ConflitoDeRevisao extends Error {
  constructor(readonly entidade: string, readonly id: string) {
    super('CONFLITO_DE_REVISAO');
    this.name = 'ConflitoDeRevisao';
  }
}

/* o banco recusou por integridade (ex.: segundo responsável principal ativo, relação ativa duplicada) */
export class ViolacaoDeIntegridade extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = 'ViolacaoDeIntegridade';
  }
}

export const REPOSITORIO_ESTRUTURAS = Symbol('REPOSITORIO_ESTRUTURAS');
