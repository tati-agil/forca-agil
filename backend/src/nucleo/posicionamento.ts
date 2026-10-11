/* CAMADA 2 — o motor de Posicionamento Organizacional é a fonte oficial dos códigos FIRMES (os 8 posicionamentos
   que podem sustentar um responsável principal). Como em estruturas.ts, o backend carrega o MESMO arquivo do site
   (forca-agil/motor-posicionamento-nucleo.js) — nenhuma lista copiada. Só leitura: o backend não avalia O1–O9, não
   muda a versão em vigor (v1) e não toca na v2 inativa. */
import * as path from 'path';

export const CAMINHO_NUCLEO_POSICIONAMENTO = path.resolve(__dirname, '../../../forca-agil/motor-posicionamento-nucleo.js');

interface NucleoPosicionamento { CODIGOS_FIRMES: readonly string[] }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nucleo: NucleoPosicionamento = require(CAMINHO_NUCLEO_POSICIONAMENTO);

export const CODIGOS_FIRMES: readonly string[] = Object.freeze(nucleo.CODIGOS_FIRMES.slice());
