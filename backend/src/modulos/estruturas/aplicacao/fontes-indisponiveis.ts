import { FontePosicionamento, FonteTaxonomia, ReferenciaOficialIndisponivel, ReferenciasTaxonomia } from './portas';
import type { PosicionamentoVigente } from '../../../nucleo/estruturas';

/* Enquanto a leitura das fontes oficiais não estiver ligada ao backend, toda operação que depende delas é
   recusada. Nada de valor padrão, lista local ou dado de exemplo em execução: dados sintéticos só nos testes. */
export class FonteTaxonomiaIndisponivel implements FonteTaxonomia {
  async referencias(): Promise<ReferenciasTaxonomia> { throw new ReferenciaOficialIndisponivel('taxonomia'); }
}

export class FontePosicionamentoIndisponivel implements FontePosicionamento {
  async vigenteDoObjeto(): Promise<PosicionamentoVigente | null> { throw new ReferenciaOficialIndisponivel('posicionamento'); }
}
