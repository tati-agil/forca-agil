/* CAMADA 2 — Núcleo de Avaliação, Taxonomia e Mapa da Floresta.

   O núcleo NÃO é reescrito nem copiado para o backend: este arquivo carrega a MESMA fonte que o site usa
   (forca-agil/estruturas-nucleo.js, domínio puro, sem Firebase, banco, NestJS ou DOM). Contratos em
   docs/estruturas-nucleo-contratos.md. No repositório e na imagem Docker o caminho relativo é o mesmo:
     backend/src/nucleo  ou  backend/dist/nucleo   →   ../../../forca-agil/estruturas-nucleo.js
   (a imagem copia só esse arquivo para /app/forca-agil/, ao lado de /app/backend/).

   Regra de dependência: nada em src/nucleo importa NestJS, pg ou qualquer infraestrutura
   (test/arquitetura.spec.ts confere). */
import * as path from 'path';

export const CAMINHO_NUCLEO_ESTRUTURAS = path.resolve(__dirname, '../../../forca-agil/estruturas-nucleo.js');

/* Tipagem mínima do que o backend usa hoje; o comportamento é todo do arquivo original. */
export interface ResultadoOperacao {
  ok: boolean;
  mudancas?: { entidade: string; id: string; antes: unknown; depois: unknown; revisaoAnterior: number | null }[];
  eventos?: Record<string, unknown>[];
  erros?: { codigo: string }[];
}
export interface NucleoEstruturas {
  criarEstrutura(estado: unknown, dados: unknown, ctx: unknown, ref: unknown): ResultadoOperacao;
  vincularResponsavel(estado: unknown, dados: unknown, posicionamento: unknown, ctx: unknown, ref: unknown): ResultadoOperacao;
  situacaoResponsavel(estado: unknown, objetoId: string, posicionamento: unknown, ref: unknown): { situacao: string };
  aplicar(estado: unknown, mudancas: unknown): { ok: boolean; estado?: unknown; erro?: string };
  [operacao: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const nucleoEstruturas: NucleoEstruturas = require(CAMINHO_NUCLEO_ESTRUTURAS);
