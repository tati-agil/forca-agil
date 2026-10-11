/* CAMADA 2 — Núcleo de Avaliação, Taxonomia e Mapa da Floresta.

   O núcleo NÃO é reescrito nem copiado para o backend: este arquivo carrega a MESMA fonte que o site usa
   (forca-agil/estruturas-nucleo.js, domínio puro, sem Firebase, banco, NestJS ou DOM). Contratos em
   docs/estruturas-nucleo-contratos.md. No repositório e na imagem Docker o caminho relativo é o mesmo:
     backend/src/nucleo  ou  backend/dist/nucleo   →   ../../../forca-agil/estruturas-nucleo.js
   (a imagem copia só esse arquivo para /app/forca-agil/, ao lado de /app/backend/).

   Regra de dependência: nada em src/nucleo importa NestJS, pg ou qualquer infraestrutura
   (test/arquitetura.spec.ts confere). As tipagens abaixo só descrevem o que o arquivo original já faz. */
import * as path from 'path';

export const CAMINHO_NUCLEO_ESTRUTURAS = path.resolve(__dirname, '../../../forca-agil/estruturas-nucleo.js');

export type Entidade = 'estrutura' | 'relacao' | 'vinculo';
export interface Registro { id: string; situacao: 'ativa' | 'encerrada'; revisao: number; [campo: string]: unknown }
export interface Estado { estruturas: Record<string, Registro>; relacoes: Record<string, Registro>; vinculos: Record<string, Registro> }
export interface Mudanca { entidade: Entidade; id: string; antes: Registro | null; depois: Registro; revisaoAnterior: number | null }
export interface Evento {
  id: string; operacaoId: string; tipo: string; entidade: Entidade; entidadeId: string;
  antes: Registro | null; depois: Registro | null; usuario: { id: string; email?: string }; em: string; [campo: string]: unknown;
}
export interface ErroNucleo { codigo: string; [campo: string]: unknown }
export type ResultadoOperacao = { ok: true; mudancas: Mudanca[]; eventos: Evento[] } | { ok: false; erros: ErroNucleo[] };

/* referências oficiais (lidas por quem chama; o núcleo nunca as busca) */
export interface Referencias {
  conceitos: Record<string, { ativo: boolean; pai?: string }>;
  relacoesConceituais: { de: string; tipo: string; para: string; ativa: boolean }[];
  herancaPeloPai: boolean;
  ligacoes: Record<string, string>;
  codigosFirmes: string[];
  conceitosTrabalho: string[];
}
/* Posicionamento vigente de um objeto (null = nenhum) */
export interface PosicionamentoVigente { avaliacaoId: string; recomendacao: { codigoResultado: string | null }; decisao?: { codigoFinal: string } | null }
export interface Contexto { operacaoId: string; novoId?: string; usuario: { id: string; email?: string }; agora: string }
export interface SituacaoCalculada { situacao: string; motivos: string[]; [campo: string]: unknown }

export interface NucleoEstruturas {
  TIPOS_RELACAO: string[];
  criarEstrutura(estado: Estado, dados: unknown, ctx: Contexto, ref: Referencias): ResultadoOperacao;
  alterarEstrutura(estado: Estado, id: string, alteracoes: unknown, ctx: Contexto, opcoes: { justificativa?: unknown; revisaoEsperada?: number }): ResultadoOperacao;
  encerrarEstrutura(estado: Estado, id: string, motivo: unknown, ctx: Contexto, opcoes: { revisaoEsperada?: number }): ResultadoOperacao;
  criarRelacao(estado: Estado, dados: unknown, ctx: Contexto, ref: Referencias): ResultadoOperacao;
  alterarRelacao(estado: Estado, id: string, novos: unknown, motivo: unknown, ctx: Contexto, ref: Referencias): ResultadoOperacao;
  encerrarRelacao(estado: Estado, id: string, motivo: unknown, ctx: Contexto): ResultadoOperacao;
  situacaoRelacao(estado: Estado, id: string, ref: Referencias): SituacaoCalculada | null;
  vincularResponsavel(estado: Estado, dados: unknown, posicionamento: PosicionamentoVigente | null, ctx: Contexto, ref: Referencias): ResultadoOperacao;
  substituirResponsavel(estado: Estado, vinculoId: string, dados: unknown, motivo: unknown, posicionamento: PosicionamentoVigente | null, ctx: Contexto, ref: Referencias): ResultadoOperacao;
  encerrarVinculo(estado: Estado, id: string, motivo: unknown, ctx: Contexto): ResultadoOperacao;
  situacaoResponsavel(estado: Estado, objetoId: string, posicionamento: PosicionamentoVigente | null, ref: Referencias): SituacaoCalculada;
  responsavelAtivo(estado: Estado, objetoId: string): Registro | null;
  relacoesDaEstrutura(estado: Estado, id: string, opcoes?: { incluirEncerradas?: boolean }): { saida: Registro[]; entrada: Registro[] };
  objetosDaEstrutura(estado: Estado, estruturaId: string): { objetoId: string; papel: string; vinculoId: string }[];
  historico(eventos: Evento[], entidade: Entidade, id: string): Evento[];
  aplicar(estado: Estado, mudancas: Mudanca[]): { ok: boolean; estado?: Estado; erro?: string };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const nucleoEstruturas: NucleoEstruturas = require(CAMINHO_NUCLEO_ESTRUTURAS);
