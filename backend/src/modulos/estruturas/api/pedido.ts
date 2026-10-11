import { HttpException, HttpStatus } from '@nestjs/common';

/* Validação de FORMA do pedido (a de conteúdo é do núcleo): corpo é objeto, só campos conhecidos (nada de id,
   usuário, data ou situação vindos do cliente), revisão inteira, identificadores e chave de idempotência bem formados. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const OBJETO = /^[A-Za-z0-9_-]{1,128}$/;
const CHAVE = /^[A-Za-z0-9_-]{8,128}$/;

function invalido(codigo: string, mensagem: string, extra: Record<string, unknown> = {}): HttpException {
  return new HttpException({ message: mensagem, codigo, ...extra }, HttpStatus.BAD_REQUEST);
}

export function corpo(valor: unknown, permitidos: string[]): Record<string, unknown> {
  if (valor === undefined || valor === null) return {};
  if (typeof valor !== 'object' || Array.isArray(valor)) throw invalido('CORPO_INVALIDO', 'O corpo do pedido deve ser um objeto JSON');
  const desconhecidos = Object.keys(valor).filter((k) => !permitidos.includes(k));
  if (desconhecidos.length) throw invalido('CAMPO_DESCONHECIDO', 'Campos não aceitos: ' + desconhecidos.join(', '), { campos: desconhecidos });
  return valor as Record<string, unknown>;
}

export function revisao(valor: unknown): number | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1) throw invalido('REVISAO_INVALIDA', 'revisaoEsperada deve ser um inteiro positivo');
  return valor;
}

export function identificador(valor: string, objeto = false): string {
  if (!(objeto ? OBJETO : ID).test(valor)) throw new HttpException({ message: 'Não encontrado', codigo: 'IDENTIFICADOR_INVALIDO' }, HttpStatus.NOT_FOUND);
  return valor;
}

export function chaveIdempotencia(valor: string | undefined): string | null {
  if (valor === undefined || valor === '') return null;
  if (!CHAVE.test(valor)) throw invalido('CHAVE_DE_IDEMPOTENCIA_INVALIDA', 'Idempotency-Key: 8 a 128 caracteres entre letras, números, _ e -');
  return valor;
}

export function situacao(valor: string | undefined): 'ativa' | 'encerrada' | 'todas' {
  if (valor === undefined || valor === '') return 'ativa';
  if (valor !== 'ativa' && valor !== 'encerrada' && valor !== 'todas') throw invalido('FILTRO_INVALIDO', 'situacao: ativa, encerrada ou todas');
  return valor;
}
