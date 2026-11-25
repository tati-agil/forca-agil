/* A Última Transmissão — jogo de revisão do Episódio I (treinamento do tipo JOGO, ver game-data.js).
   Roda dentro da moldura aberta por game.js; nada é gravado no banco. */
/* Aberto direto pelo endereço: volta para o Treinamento, onde o acesso é conferido. */
if (window.top === window.self) location.replace('/index.html#treinamento');
else (function () {
'use strict';
const H=['Matriz CSD','Mapa de Stakeholders','FOFA','É, Não É, Faz, Não Faz','5 Porquês','GUT','OKR','E se…?','Ideação Reversa','6 Chapéus','Impacto × Esforço','Votação','Prototipação','Scrum','Kanban','Liderança Ágil','Agilidade Organizacional'];
const T=[
['Dizem que há um espião a bordo. Tem quem jure que viu, quem ache que ouviu e quem só sonhou com isso. Como separar tudo?','Matriz CSD','Certezas, Suposições e Dúvidas: separa o que se sabe do que é palpite.','São três colunas.'],
['O hiperpropulsor quebrou de novo! Já trocamos a mesma peça três vezes, uma delas com raiva. Como descobrir a verdadeira causa do problema?','5 Porquês','Pergunta “por quê?” várias vezes até chegar à causa raiz, em vez de só consertar o sintoma.','Parece criança de quatro anos perguntando.'],
['Um piloto acha que a nave nova é de resgate. Outro, que é de ataque. Outro já instalou uma máquina de pipoca. Como combinar, antes de construir, o que entra e o que fica de fora?','É, Não É, Faz, Não Faz','Alinha o que o produto é, não é, faz e não faz, antes de começar a construir.','São quatro quadrantes.'],
['Escudo falhando, motor pegando fogo, oxigênio caindo e o café acabou. Ainda não temos soluções: qual PROBLEMA atacar primeiro, antes que piore?','GUT','Gravidade, Urgência e Tendência: prioriza problemas. Impacto × Esforço prioriza soluções.','São três letras, e uma delas é Urgência.'],
['Acabaram as boas ideias! Vamos listar tudo o que faria a missão FRACASSAR e depois virar cada item do avesso. Que técnica é essa?','Ideação Reversa','Imagina como piorar tudo e depois inverte para achar soluções.','A ideia é pensar ao contrário.'],
['Vinte naves na oficina. Todas começadas. Nenhuma voa. E alguém começou mais uma! Como enxergar e destravar essa fila?','Kanban','Torna o fluxo visível e limita o trabalho em andamento: pare de começar, comece a terminar.','Falta um quadro e um limite.'],
['Antes de gastar dez anos construindo a nave, dá para testar com sucata e fita adesiva?','Prototipação','Testa a ideia cedo e barato, para aprender antes de construir.','Uma versão simples, só para aprender.'],
['Asteroide na frente! O comandante não desvia: “Essa rota está no plano, e plano é plano!” Que valor do Manifesto Ágil ele esqueceu?','Responder a mudanças mais que seguir um plano','É um dos 4 valores do Manifesto Ágil: quando o cenário muda, o plano muda junto.','O asteroide não leu o plano.',['Indivíduos e interações mais que processos e ferramentas','Software em funcionamento mais que documentação abrangente','Colaboração com o cliente mais que negociação de contratos','Responder a mudanças mais que seguir um plano']],
['A comandante da base decide tudo sozinha: a rota, o almoço e até quando podemos espirrar. A tripulação parou de pensar. O que precisa mudar na ponte de comando?','Liderança Ágil','Quem lidera dá direção, remove obstáculos e abre espaço para o time decidir.','O problema está na cadeira do capitão.'],
['Um esquadrão virou ágil! Mas o pedido dele passa por 14 hangares, 9 carimbos e só volta na próxima lua cheia. O que falta na frota inteira?','Agilidade Organizacional','Não basta um time ágil: a organização toda precisa se adaptar e entregar valor junta.','Não é o time: é a frota toda.']];
const ROTA=['FOFA','Mapa de Stakeholders','OKR','E se…?','6 Chapéus','Impacto × Esforço','Votação','Scrum'];
const CRIT=['Entender o cenário: FOFA e Mapa de Stakeholders','Definir o objetivo: OKR','Gerar ideias: E se…? e 6 Chapéus','Escolher a melhor: Impacto × Esforço e Votação','Executar em ciclos curtos: Scrum'];
const ETAPAS=[['Entender o cenário',2],['Definir o objetivo',1],['Gerar ideias',2],['Escolher a melhor',2],['Executar em ciclos',1]];
const VAGA=ETAPAS.flatMap(([,q],e)=>Array(q).fill(e)),V=VAGA.map(()=>null),etapaDe=h=>VAGA[ROTA.indexOf(h)];
const EMB=['Scrum','E se…?','Votação','FOFA','6 Chapéus','OKR','Impacto × Esforço','Mapa de Stakeholders'];
// um ponto por ferramenta na etapa certa (a ordem dentro da etapa é livre)
function festa(){if(calmo)return;const cor=['#ffc35c','#5fe3ff','#58e08a','#b48cff','#ff9a4d'];for(let i=0;i<90;i++){const c=document.createElement('i');c.className='conf';c.style.cssText='left:'+(3+Math.random()*90)+'%;background:'+cor[i%5]+';animation-delay:'+Math.random()*2+'s;animation-duration:'+(3+Math.random()*3)+'s';document.body.append(c);setTimeout(()=>c.remove(),9000)}}
function confere(){V.forEach((h,i)=>{C[i]=!!h&&etapaDe(h)===VAGA[i]})}
const META=11,DICA=25;
const R=T.map(()=>({luz:false,erros:0,aberto:false})),C=VAGA.map(()=>false);
let extra=0,passo=0,tick=null;
const tela=document.getElementById('tela'),topo=document.getElementById('topo');
const luz=()=>R.filter(r=>r.luz).length+C.filter(Boolean).length,sombra=()=>R.reduce((s,r)=>s+r.erros+(r.aberto&&!r.luz?1:0),extra);
let AC=null;
function som(...ns){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();let t=AC.currentTime;for(const [f,d,tp] of ns){const o=AC.createOscillator(),g=AC.createGain();o.type=tp||'triangle';o.frequency.value=f;g.gain.setValueAtTime(.14,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d);t+=d*.7;}}catch(e){}}
const sCerto=()=>som([523,.15],[659,.15],[784,.15],[1047,.4]),sErro=()=>som([392,.15],[330,.3]),sRadio=()=>som([880,.06,'square'],[660,.06,'square'],[990,.1,'square']);
const robo='<svg viewBox="0 0 100 110" aria-hidden="true"><path d="M50 4v14" stroke="#5fe3ff" stroke-width="4"/><circle cx="50" cy="5" r="5" fill="#ffc35c"/><rect x="16" y="18" width="68" height="46" rx="12" fill="#dfe8fa"/><rect x="24" y="28" width="52" height="22" rx="9" fill="#0d1a36"/><circle cx="39" cy="39" r="6" fill="#58e08a"/><circle cx="61" cy="39" r="6" fill="#58e08a"/><path d="M40 57h20" stroke="#0d1a36" stroke-width="4" stroke-linecap="round"/><rect x="26" y="68" width="48" height="34" rx="9" fill="#9db4dc"/><text x="50" y="91" font-size="17" font-weight="700" text-anchor="middle" fill="#0d1a36" font-family="Arial">K-99</text></svg>';
function el(h){tela.innerHTML=h}
function bts(a){return '<div class="bts">'+a.map(([id,t,c])=>`<button id="${id}" class="${c||''}">${t}</button>`).join('')+'</div>'}
const on=(id,f)=>document.getElementById(id).onclick=f;
function grade(certo,ops){if(ops)return '<div class="grade g2">'+ops.map(h=>`<div class="holo ${h===certo?'certo':''}">${h}</div>`).join('')+'</div>';const us=new Set(T.filter((_,i)=>R[i].aberto).map(t=>t[1]));return '<div class="grade g6">'+H.map(h=>`<div class="holo ${h===certo?'certo':us.has(h)?'usado':''}">${h}</div>`).join('')+'</div>'}
function placar(){topo.innerHTML=passo<3?'':`<span class="lz">FORÇA ${luz()}</span><div class="barra"><i style="width:${luz()/(T.length+C.length)*100}%"></i><u style="left:${META/(T.length+C.length)*100}%">META ${META}</u></div><span class="apr">APRENDIZADOS ${sombra()}</span>`}
function parar(){clearInterval(tick);tick=null}
function ir(n){parar();passo=Math.max(0,Math.min(N-1,n));desenhar()}
function rodada(i){
  const [q,resp,pq,dica,ops]=T[i],r=R[i];
  if(r.aberto){
    el(`<div class="cart ${r.luz?"ganhou":""}"><p class="aviso ${r.luz?"lz":""}">${r.luz?"✓ ACERTOU! +1 ponto da Força":"Novo aprendizado da turma!"}</p><p class="sub">${r.luz?"O holocron certo é mesmo":"O holocron certo era"}</p><h2>${resp}</h2><p class="sub" style="color:var(--gelo)">${pq}</p></div>${grade(resp,ops)}${bts([['av',i<T.length-1?'Próxima transmissão':'Última missão','pri']])}`);
    on('av',()=>ir(passo+1));return;
  }
  el(`<p class="sub">TRANSMISSÃO ${i+1} DE ${T.length}</p><div class="rad">${robo}<p>“${q}”</p></div><p class="dica" id="dica"></p><div class="tempo"><i id="tp"></i></div>${grade(0,ops)}${bts([['rv','Mostrar a resposta','pri'],['ok','Aceitar outra resposta','disc'],['no','Errou','oculto']])}`);
  sRadio();const t0=Date.now(),mostra=()=>{const d=document.getElementById('dica');if(d)d.innerHTML=(r.erros?'<b class="apr">Ainda não! Virou aprendizado.</b> ':'')+'Dica do K-99: '+dica};
  if(r.erros)mostra();
  tick=setInterval(()=>{const f=Math.max(0,1-(Date.now()-t0)/1000/DICA);document.getElementById('tp').style.width=f*100+'%';if(!f){parar();mostra()}},100);
  on('ok',()=>{parar();r.luz=true;r.aberto=true;sCerto();desenhar()});
  on('no',()=>{parar();r.erros++;sErro();placar();mostra()});
  // clicar na ferramenta que a pessoa falou já confere a resposta
  tela.querySelectorAll('.holo:not(.usado)').forEach(h=>{h.classList.add('cl');h.onclick=()=>{if(h.classList.contains('err'))return;if(h.textContent===resp)document.getElementById('ok').click();else{h.classList.add('err');document.getElementById('no').click()}}});
  on('rv',()=>{parar();r.aberto=true;desenhar()});
}
const P=[
()=>{el(`<p class="sub">Episódio I · O Despertar da Força Ágil</p><h1>A Última Transmissão</h1><p class="sub">A Força Ágil contra a névoa do Lado Sombrio</p>${bts([['av','Começar','pri']])}`);on('av',()=>{sRadio();ir(1)})},
()=>{el(`<div id="crawl"><div><h2>O Despertar da Força Ágil</h2><p>A névoa do Lado Sombrio caiu sobre a galáxia. Planos intermináveis, reuniões sem decisão e naves que nunca ficam prontas dominam os sistemas.</p><br><p>Antes de silenciar, o droide K-99 enviou dez pedidos de socorro. As respostas estão guardadas nos holocrons da Força Ágil.</p><br><p>Só uma turma na galáxia sabe qual deles abrir. Infelizmente, é esta aqui…</p></div></div>${bts([['av','Pular','']])}`);on('av',()=>ir(2))},
()=>{el(`<h2>Como salvar a galáxia</h2><div class="lista"><div><b>1.</b> Ouça o pedido de socorro do K-99.</div><div><b>2.</b> Levantou a mão primeiro? Fale como no rádio:<br>&nbsp;&nbsp;&nbsp;&nbsp;<b>“Base, aqui é (seu nome)! Abram o holocron…”</b></div><div><b>3.</b> Não foi? Vira aprendizado: o K-99 dá uma dica e outra pessoa tenta.</div><div><b>4.</b> Acertou? Sua mão descansa. Deixe a Força fluir!</div><div><b>Meta da turma:</b> ${META} pontos da Força.</div></div>${bts([['av','Receber transmissões','pri']])}`);on('av',()=>ir(3))},
...T.map((_,i)=>()=>rodada(i)),
()=>{let conf=false,ligou=false;el(`<h2>Última missão: salvar a colônia</h2><p class="sub">Qual ferramenta entra em cada etapa? Levante a mão quem ainda não respondeu!</p><div class="etapas" id="et"></div><div class="grade" id="rota"></div><div id="rel">1:30</div><p class="aviso" id="res" hidden></p>${bts([['av','Conferir','pri'],['lp','Limpar']])}`);
  const pinta=()=>{let k=0;if(conf){const n0=luz();confere();if(luz()!==n0)placar();if(luz()>n0)sCerto()}
    document.getElementById('et').innerHTML=ETAPAS.map(([nome,q],e)=>'<div class="etapa"><b>'+(e+1)+'. '+nome+'</b>'+Array.from({length:q},()=>{const i=k++,h=V[i],c=!conf?'':h&&etapaDe(h)===e?'bom':'ruim';return '<div class="vaga '+(h?'cheia ':'')+c+'" data-i="'+i+'">'+(h?(c==='bom'?'✓ ':c==='ruim'?'↻ ':'')+h:'?')+'</div>'}).join('')+'</div>').join('');
    document.getElementById('rota').innerHTML=EMB.map(h=>'<div class="holo cl '+(V.includes(h)?'usado':'')+'" data-h="'+h+'">'+h+'</div>').join('');
    tela.querySelectorAll('#rota .holo').forEach(x=>x.onclick=()=>{const h=x.dataset.h,i=V.indexOf(h);if(i>=0)V[i]=null;else{const l=V.indexOf(null);if(l<0)return;V[l]=h;liga();if(conf&&etapaDe(h)!==VAGA[l]){extra++;placar()}som([500+l*80,.12])}pinta()});
    tela.querySelectorAll('.vaga').forEach(x=>x.onclick=()=>{V[+x.dataset.i]=null;pinta()});
    const n=C.filter(Boolean).length,res=document.getElementById('res');document.getElementById('av').textContent=conf?'Ver o final':'Conferir';res.hidden=!conf;document.getElementById('rel').hidden=conf;res.className='aviso'+(n===8?' lz':'');res.textContent=n===8?'✓ Rota completa! +8 pontos da Força':'+'+n+' pontos. Ajustem o que tem ↻: cada acerto conta!';document.getElementById('av').className=conf&&n<8?'':'pri';document.getElementById('lp').style.display=conf&&n===8?'none':''};pinta();
  on('lp',()=>{conf=false;V.fill(null);C.fill(false);placar();pinta()});
  const liga=()=>{if(ligou)return;ligou=true;const fim=Date.now()+90000;tick=setInterval(()=>{const s=Math.max(0,Math.ceil((fim-Date.now())/1000)),r=document.getElementById('rel');r.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');r.style.color=s<=10?'var(--sombra)':'';if(!s){parar();sErro()}},200)};
  on('av',()=>{if(!conf){parar();conf=true;confere();extra+=V.filter((h,i)=>h&&!C[i]).length;C.every(Boolean)?sCerto():sErro();pinta();placar()}else ir(passo+1)})},
()=>{const v=luz()>=META;el(v?`<h1>Sinal restaurado!</h1><p class="aviso lz">A turma dissipou a névoa do Lado Sombrio!</p><p class="sub">${luz()} pontos da Força · ${sombra()} aprendizados</p><div class="rad">${robo}<p>“Aqui é K-99! A galáxia está salva. Vocês tentaram, aprenderam e ajustaram a rota. Isso é Força Ágil!”</p></div>${bts([['av','Encerrar','pri']])}`:`<h1>Falta só mais um ciclo!</h1><p class="sub">${luz()} de ${META} pontos da Força · ${sombra()} aprendizados</p><div class="rad">${robo}<p>“Sinal recebido! Tentamos, aprendemos e agora sabemos o que ajustar. Vamos para mais um ciclo?”</p></div>${bts(C.every(Boolean)?[['av','Encerrar','pri']]:[['mais','Mais um ciclo','pri'],['av','Encerrar']])}`);if(v)festa();v?som([523,.2],[659,.2],[784,.2],[1047,.2],[1319,.7]):som([392,.3],[440,.3],[523,.6]);on('av',()=>ir(passo+1));if(document.getElementById('mais'))on('mais',()=>ir(passo-1))},
()=>{el(`<h1>Que a Força Ágil esteja com a gente!</h1>${bts([['ini','Voltar ao início']])}`);on('ini',()=>{R.forEach(r=>{r.luz=false;r.erros=0;r.aberto=false});V.fill(null);C.fill(false);extra=0;ir(0)})}];
const N=P.length;
function desenhar(){scrollTo(0,0);placar();tela.classList.remove('treme');P[passo]();document.body.dataset.passo=passo}
addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();const r=R[passo-3];if(passo>=3&&passo<3+T.length&&r.aberto){r.aberto=false;r.luz=false;desenhar()}else ir(passo-1)}
 else if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();const b=document.getElementById('av')||document.getElementById('rv');if(b)b.click()}
 else if(e.key==='a'||e.key==='A')document.getElementById('ok')?.click();else if(e.key==='e'||e.key==='E')document.getElementById('no')?.click();
 else if(e.key==='f'||e.key==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.().catch(()=>{})}});
const cv=document.getElementById('ceu'),cx=cv.getContext('2d');let st=[];
function tam(){cv.width=innerWidth;cv.height=innerHeight;st=Array.from({length:220},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,z:Math.random()*1.5+.3}))}
addEventListener('resize',tam);tam();
const calmo=matchMedia('(prefers-reduced-motion:reduce)').matches;
(function anda(){cx.clearRect(0,0,cv.width,cv.height);for(const s of st){s.x-=calmo?0:s.z*(passo===3+T.length?6:.18);if(s.x<0)s.x=cv.width;cx.fillStyle=`rgba(220,232,255,${s.z/(passo===3+T.length?5:2)})`;cx.fillRect(s.x,s.y,passo===3+T.length&&!calmo?s.z*14:s.z*1.3,s.z*1.3)}requestAnimationFrame(anda)})();
desenhar();
})();
