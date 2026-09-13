---
name: editar-e-salvar
description: Antes de criar ou revisar qualquer tela deste projeto (forca-agil) que deixe algo ser editado e tenha um botão de Salvar, confira que quem CONSEGUE abrir a edição também CONSEGUE gravar — nas regras do banco, não só na tela. Use sempre que adicionar um formulário de edição, um botão "Salvar"/"Confirmar" ligado a uma escrita no Firebase, ou mexer em database.rules.json.
---

# Editar sem conseguir salvar não é uma funcionalidade menor — é quebrada

## A regra

Uma tela deste site é uma de duas coisas, nunca uma terceira:
1. **Só consulta** — não mostra nenhum jeito de editar, para quem não pode gravar.
2. **Edição de verdade** — quem consegue abrir o formulário e digitar também
   consegue apertar Salvar e ver o dado persistir.

Não existe meio-termo correto. Mostrar um campo editável e um botão "Salvar"
para alguém cuja gravação vai ser recusada pelo Firebase é pior do que não
mostrar nada: a pessoa investe tempo preenchendo, acha que salvou (ou vê um
erro genérico "tente novamente", que sugere problema passageiro), e o dado
nunca muda. Nas palavras de quem pediu esta skill: **"se admin pode mexer,
pode gravar. ou não deixa mexer ou deixa e salva."**

## O caso que originou esta skill

13/09/2026 — o Roteiro-base (aba Eventos → "📋 Roteiro" do painel) deixava
QUALQUER admin abrir "Editar atividade" e mexer nos campos, mas
`roteiros-evento/$eventoKey` só podia ser GRAVADO por dois e-mails fixos nas
regras do banco (`database.rules.json`). A tela não avisava nada: `roteiro.js`
nunca conferia o erro que o Firebase devolve, então "editar e salvar" parecia
funcionar mesmo quando não gravava nada (corrigido na PR #135). Só depois de
expor esse erro é que ficou claro que a causa não era rede nem acaso: era a
regra do banco em si, copiada de `fa-admins` (que restringe DE VERDADE quem
pode adicionar outro admin) sem o "ou está em `fa-admins`" que as demais áreas
restritas a admin (`fa-diretores`, `fa-facilitadores`, `turmas-publico`) já
tinham (corrigido na PR #136). Auditando as outras regras com o mesmo padrão
apareceu um segundo caso idêntico: `eventos/$eventoKey` também herdava o
mesmo engano — "+ Novo evento"/"Editar evento" abertos para qualquer admin no
painel, gravação restrita aos dois mesmos e-mails — corrigido na mesma
sessão, assim que encontrado.

## O que fazer, sempre

1. **Toda vez que adicionar um botão que abre edição** (formulário, modal,
   campo inline), pergunte: quem vê este botão? Depois confira, em
   `database.rules.json`, se o `.write` do nó gravado permite exatamente
   esse mesmo público — nem mais restrito (edição fantasma) nem mais aberto
   (falha de segurança).
2. **Toda vez que mexer numa regra `.write` de `database.rules.json`**,
   procure quem, no código (`admin.js`, `roteiro.js`, `facilitador.js` etc.),
   expõe uma ação que grava naquele nó, e confira se o público que enxerga o
   botão bate com o público que a regra permite gravar.
3. **Os dois padrões de admin já usados no projeto — reaproveite, não
   invente um terceiro:**
   - **"qualquer admin de verdade"** (o que a maioria das áreas do painel
     precisa):
     `auth != null && (auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br' || root.child('fa-admins').child(auth.token.email.replace('@','_').replace('.','_')).exists())`
     — usado em `fa-diretores`, `fa-facilitadores`, `turmas-publico`,
     `roteiros-evento`, `eventos`.
   - **"só os dois super-admins"**
     (`auth.token.email === 'tatianefdirene@previ.com.br' || auth.token.email === 'danielfrazao@previ.com.br'`,
     sem o `fa-admins`) — reservado para o que só essas duas pessoas devem
     poder fazer de verdade: hoje, só `fa-admins` em si (adicionar/remover
     outro admin). Antes de copiar esse padrão para um nó novo, pare e
     confirme: é ESTE o caso, ou é "qualquer admin" com o padrão errado
     colado?
4. **Toda ação de escrita precisa checar o erro do callback do Firebase** e
   mostrar algo visível para a pessoa — nunca seguir em frente (fechar
   modal, recarregar tela) como se tivesse dado certo. Isso é rede de
   segurança para qualquer OUTRA causa de falha (conexão caindo, por
   exemplo), mas não substitui o item 1: um erro visível numa ação que NUNCA
   vai funcionar para aquele público ainda é uma funcionalidade quebrada —
   só que agora avisada em vez de silenciosa.
