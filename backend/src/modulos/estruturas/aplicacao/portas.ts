import type { PosicionamentoVigente, Referencias } from '../../../nucleo/estruturas';

/* Portas de LEITURA das fontes oficiais de que as Estruturas Concretas dependem. O backend não inventa conceito,
   código, correspondência nem classificação: lê da fonte oficial; se a fonte não responde, a operação é RECUSADA
   (ReferenciaOficialIndisponivel → 503), nunca executada com valores presumidos.

   Fontes oficiais no FORÇA ÁGIL (Firebase Realtime Database do site) e o que cada porta devolve:
     FonteTaxonomia → Referencias, menos codigosFirmes:
       conceitos            ← taxonomia/organizacional/conceitos/<código>/{ativo, pai}
       relacoesConceituais  ← taxonomia/organizacional/relacoes/<chave> = { de, tipo, para }; ativa = sem "encerrada"
       herancaPeloPai       ← false: a Taxonomia não tem hoje regra oficial de herança de relações pelo pai
       ligacoes             ← posicionamento-classificacoes/<código do motor> (ligação canônica com o conceito de
                              MESMO código, registrada pela governança — só as ligações existentes)
       conceitosTrabalho    ← conceitos com camada = 'trabalho' ("Organização do trabalho": Squad, Capítulo)
     codigosFirmes          ← o próprio motor de Posicionamento (src/nucleo/posicionamento.ts, mesmo arquivo do site)
     FontePosicionamento → o Posicionamento VIGENTE de um objeto (itemId da Avaliação de Produto/Serviço):
       posicionamento-vigente-por-item/<itemId> → avaliacoes-posicionamento/<id>.resultadoAutomatico.codigoResultado
       + posicionamento-decisoes/<id>.codigoFinal; null = o objeto não tem Posicionamento vigente.
   Os adaptadores que leem essas fontes ainda não existem no backend (ler o banco de produção a partir do backend
   pede uma decisão de credencial e de rede). Até lá valem os de fontes-indisponiveis.ts. */

export type ReferenciasTaxonomia = Omit<Referencias, 'codigosFirmes'>;

export interface FonteTaxonomia {
  referencias(): Promise<ReferenciasTaxonomia>;
}

export interface FontePosicionamento {
  /* null = sem Posicionamento vigente (resposta oficial); erro = não foi possível saber */
  vigenteDoObjeto(objetoId: string): Promise<PosicionamentoVigente | null>;
}

export class ReferenciaOficialIndisponivel extends Error {
  constructor(readonly fonte: 'taxonomia' | 'posicionamento') {
    super('REFERENCIA_OFICIAL_INDISPONIVEL');
    this.name = 'ReferenciaOficialIndisponivel';
  }
}

export const FONTE_TAXONOMIA = Symbol('FONTE_TAXONOMIA');
export const FONTE_POSICIONAMENTO = Symbol('FONTE_POSICIONAMENTO');
