/* PROVA (não entra na suíte): as regras atuais de questionarios-config deixam alterar e apagar uma "versão publicada"
   da redação de um motor. Por isso a publicação fica bloqueada no H2-a. */
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds } = require('@firebase/rules-unit-testing');
(async () => {
  const rules = fs.readFileSync('/home/user/forca-agil/database.rules.json', 'utf8');
  const env = await initializeTestEnvironment({ projectId: 'demo-prova-imut', database: { rules } });
  const ARQ = 'arq@previ.com.br', k = (e) => e.replace(/[@.]/g, '_');
  await env.withSecurityRulesDisabled(async (c) => {
    await c.database().ref('fa-avaliacao-autorizados/' + k(ARQ)).set({ email: ARQ, tipo: 'avaliacao-arquitetura' });
    await c.database().ref('questionarios-config/POSICIONAMENTO_ORGANIZACIONAL/motores/2/versoes/1').set({ perguntas: [{ codigoEstavel: 'O1', texto: 'publicado' }], motorCompativel: 2 });
  });
  const db = env.authenticatedContext(k(ARQ), { email: ARQ }).database();
  const base = 'questionarios-config/POSICIONAMENTO_ORGANIZACIONAL/motores/2/versoes/1';
  let r = [];
  try { await assertSucceeds(db.ref(base + '/perguntas/0/texto').set('ALTERADO DEPOIS DE PUBLICADO')); r.push('ALTERAR versão publicada: PERMITIDO'); } catch (e) { r.push('alterar: recusado'); }
  try { await assertSucceeds(db.ref(base).remove()); r.push('APAGAR versão publicada: PERMITIDO'); } catch (e) { r.push('apagar: recusado'); }
  try { await assertSucceeds(db.ref('questionarios-config/POSICIONAMENTO_ORGANIZACIONAL/motores/2/versaoPublicada').set(7)); r.push('TROCAR versaoPublicada sem versão: PERMITIDO'); } catch (e) { r.push('trocar ponteiro: recusado'); }
  console.log(r.join('\n'));
  await env.cleanup();
})();
