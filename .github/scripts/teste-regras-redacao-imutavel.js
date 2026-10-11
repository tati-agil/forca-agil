/* B2 (H2-b) — guarda ESTRUTURAL das regras (sem emulador, sem rede): a redação publicada de motor novo não pode
 * voltar a ser mutável por uma edição futura de database.rules.json. A prova de comportamento é do emulador
 * (teste-rules-redacao-motor.js); esta guarda impede o retrocesso silencioso mesmo antes do emulador rodar:
 *   - nenhum .write nos ancestrais de motores/<v>/versoes/<n> (questionarios-config, <código>, motores, <v>, versoes),
 *     porque um .write num nó de cima vale para tudo abaixo e anularia a proteção;
 *   - versoes/<n> e a auditoria só aceitam criar (!data.exists() && newData.exists());
 *   - o ponteiro nunca é apagado, só avança de 1 em 1 e respeita a suspensão;
 *   - a suspensão é só do admin geral (sem o perfil Avaliação + Arquitetura) e nunca se apaga;
 *   - a versão tem lista fechada de campos (a tela não grava "validada"), autoria por UID e horário do servidor. */
'use strict';
const fs = require('fs');
const path = require('path');
let total = 0, falhas = 0;
function afirma(c, msg) { total++; console.log((c ? '  ok    ' : '  FALHA ') + msg); if (!c) falhas++; }
const r = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;
const qc = r['questionarios-config'], cod = qc && qc.$codigo, mot = cod && cod.motores, v = mot && mot.$versaoMotor;
afirma(!!v && !!v.versoes && !!v.versoes.$n, 'a trilha motores/<v>/versoes/<n> existe nas regras');
const ancestrais = [['questionarios-config', qc], ['<código>', cod], ['motores', mot], ['<v>', v], ['versoes', v.versoes]];
afirma(ancestrais.every(([, n]) => !Object.prototype.hasOwnProperty.call(n, '.write')), 'nenhum .write nos ancestrais da versão publicada (' + ancestrais.map(([nome]) => nome).join(', ') + ')');
const so = (w) => typeof w === 'string' && /&& !data\.exists\(\) && newData\.exists\(\)$/.test(w);
afirma(so(v.versoes.$n['.write']), 'versão publicada: só criar');
const aud = r['questionarios-motor-auditoria'];
afirma(!!aud && !aud['.write'] && !aud.$codigo['.write'] && !aud.$codigo.$versaoMotor['.write'] && so(aud.$codigo.$versaoMotor.$push['.write']), 'auditoria: só acréscimo, sem .write acima');
const vp = v.versaoPublicada;
afirma(/&& newData\.exists\(\)/.test(vp['.write']) && /publicacaoSuspensa/.test(vp['.write']), 'ponteiro: nunca apagado e bloqueado pela suspensão');
afirma(/newData\.val\(\) === \(data\.exists\(\) \? data\.val\(\) : 0\) \+ 1/.test(vp['.validate']), 'ponteiro: só avança de 1 em 1');
const ps = v.publicacaoSuspensa;
afirma(/&& newData\.exists\(\)$/.test(ps['.write']) && !/avaliacao-autorizados/.test(ps['.write']), 'suspensão: só admin geral, nunca apagada');
const n = v.versoes.$n;
afirma(n.$outro && n.$outro['.validate'] === false && !n.validacao && !n.validadaParaAtivacao, 'versão: lista fechada de campos (a tela não grava "validada")');
afirma(/auth\.uid/.test(n.publicadoPor['.validate']) && n.publicadoEm['.validate'] === 'newData.val() === now', 'versão: autoria por UID e horário do servidor');
afirma(/=== now/.test(aud.$codigo.$versaoMotor.$push['.validate']) && /auth\.uid/.test(aud.$codigo.$versaoMotor.$push['.validate']), 'auditoria: UID e horário do servidor');
console.log('\n' + total + ' verificações, ' + falhas + ' falha(s).');
process.exit(falhas ? 1 : 0);
