/* B4 — Cloud Functions (2ª geração) da fronteira confiável do motor de Posicionamento.
 * Só liga as operações de fronteira.js a funções chamáveis (onCall): a identidade é o token autenticado
 * (request.auth), nunca um e-mail informado pela tela. Sem instância sempre ligada (minInstances 0, o padrão).
 * Implantação: só pelo workflow manual deploy-functions.yml — o deploy da main não publica funções. */
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { ServerValue } = require('firebase-admin/database');
const { criarFronteira, ioDoAdmin, ErroFronteira, UID_FRONTEIRA } = require('./fronteira.js');
const modulos = require('./modulos-site.js');

/* a mesma região do Realtime Database (kyber-agil-default-rtdb = us-central1); o site chama a mesma (posicionamento-servicos.js) */
const REGIAO = 'us-central1';
/* a ATIVAÇÃO fica implementada e testada no emulador, mas DESLIGADA aqui: destravar é do H3-b, por PR próprio */
const ATIVACAO_HABILITADA = false;

setGlobalOptions({ region: REGIAO, maxInstances: 2 });
admin.initializeApp();
let fronteira = null;
/* H3-b: lê com o Admin SDK pleno (recalcular exige ver tudo), mas GRAVA com a identidade restrita 'fronteira-confiavel'
   (databaseAuthVariableOverride): toda gravação do servidor passa pelas regras do banco, que só deixam essa identidade
   gravar o que é da fronteira */
function f() {
  if (fronteira) return fronteira;
  const restrito = admin.apps.find((a) => a && a.name === 'fronteira-restrita') ||
    admin.initializeApp(Object.assign({}, admin.app().options, { databaseAuthVariableOverride: { uid: UID_FRONTEIRA } }), 'fronteira-restrita');
  return (fronteira = criarFronteira(ioDoAdmin(admin.database(), restrito.database(), ServerValue.TIMESTAMP), modulos));
}

function tratar(executar) {
  return Promise.resolve().then(executar).catch((e) => {
    if (e instanceof ErroFronteira) throw new HttpsError(e.codigo, e.message);
    console.error('fronteira: erro inesperado', e && e.stack || e);
    throw new HttpsError('internal', 'Erro interno da fronteira confiável.');
  });
}
exports.validarRedacaoPublicada = onCall((req) => tratar(() => f().validarRedacaoPublicada(req.auth, req.data)));
exports.conferirEntradaEmVigor = onCall((req) => tratar(() => f().conferirEntradaEmVigor(req.auth, req.data, { habilitada: ATIVACAO_HABILITADA })));
exports.ativarEntradaEmVigor = onCall((req) => tratar(() => f().ativarEntradaEmVigor(req.auth, req.data, { habilitada: ATIVACAO_HABILITADA })));
exports.concluirAvaliacaoPosicionamento = onCall((req) => tratar(() => f().concluirAvaliacaoPosicionamento(req.auth, req.data)));
