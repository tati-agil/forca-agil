/* Estruturas Organizacionais Concretas — cenários de negócio v1 contra a REFERÊNCIA EM MEMÓRIA do contrato de
 * persistência (forca-agil/estruturas-casos-de-uso.js › persistenciaEmMemoria). Só Node: sem navegador, sem banco.
 * É o primeiro dos três executores do MESMO conjunto (memória, Firebase Emulator na Etapa 2, PostgreSQL na Etapa 3):
 * o relatório identifica o conjunto, a versão e o sha256 do arquivo executado.
 * Também confere, de forma estática, que o caso de uso não tem regra de negócio própria (só orquestra o núcleo). */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./estruturas-cenarios');
const N = require('../../forca-agil/estruturas-nucleo.js');
const U = require('../../forca-agil/estruturas-casos-de-uso.js');

(async () => {
  const r = await R.executar({ rotulo: 'referência em memória', criarPortas: (referencias) => U.persistenciaEmMemoria(N, { referencias }) });
  let falhas = r.falhas;
  /* guarda estática: o caso de uso não decide nada que seja do núcleo */
  const fonte = fs.readFileSync(path.join(__dirname, '..', '..', 'forca-agil', 'estruturas-casos-de-uso.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const proibidos = ['MAX', 'TIPO_IMUTAVEL', 'MOTIVO_OBRIGATORIO', 'CAMPO_OBRIGATORIO', 'TIPO_NAO_ADMITIDO', 'firebase', 'require(', 'Date.now', 'new Date', 'Math.random'];
  const achados = proibidos.filter((p) => fonte.indexOf(p) !== -1);
  console.log((achados.length ? '  FALHA ' : '  ok    ') + 'caso de uso sem regra de negócio, banco, relógio ou sorteio próprios' + (achados.length ? ' → ' + achados.join(', ') : ''));
  if (achados.length) falhas++;
  /* o conjunto cobre os três tipos de estrutura do Mapa e as três operações */
  const { conj } = R.carregar();
  const ops = new Set(), tipos = new Set();
  conj.cenarios.forEach((c) => c.passos.forEach((p) => (p.concorrentes || [p]).forEach((x) => { ops.add(x.operacao); if (x.entrada && x.entrada.tipo) tipos.add(x.entrada.tipo); })));
  const cobre = ['criarEstrutura', 'alterarEstrutura', 'encerrarEstrutura'].every((o) => ops.has(o)) && ['NEGOCIOS', 'AREA_ESPECIALIZADA', 'COE'].every((t) => tipos.has(t));
  console.log((cobre ? '  ok    ' : '  FALHA ') + 'o conjunto cobre criar, alterar e encerrar, e Linha, Área Especializada e CoE');
  if (!cobre) falhas++;
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO', e && e.stack || e); process.exit(1); });
