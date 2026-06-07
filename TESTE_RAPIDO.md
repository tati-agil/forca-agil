# ⚡ TESTE RÁPIDO — Validar Firebase + Game

## ✅ Checklist de Teste (5 minutos)

### 1. **Testar Game Localmente**
```
http://localhost:8000/index.html
```

- [ ] Página carrega sem erros
- [ ] Vejo um campo para digitar nome
- [ ] Consigo clicar "Começar a Jornada"
- [ ] Timer de 30s funciona
- [ ] Respostas são validadas (correto/errado)
- [ ] Pontuação aumenta ao acertar

### 2. **Testar QR Code**
```
http://localhost:8000/qrcode.html
```

- [ ] QR Code aparece
- [ ] Consigo copiar a URL com botão
- [ ] Posso editar a URL manualmente
- [ ] Após editar, QR Code muda

### 3. **Testar Firebase (Sincronização em Tempo Real)**

**Abra 2 abas do navegador:**

**Aba 1:**
1. Acesse: `http://localhost:8000/index.html`
2. Digite nome: "Usuario 1"
3. Clique "Começar a Jornada"
4. Responda todas as 30 questões rapidamente
5. Veja o ranking final

**Aba 2 (ao mesmo tempo ou logo após):**
1. Acesse: `http://localhost:8000/index.html`
2. Digite nome: "Usuario 2"
3. **NÃO** clique em começar ainda
4. Vá para o fim da página e veja o ranking

**Resultado esperado:**
- ✅ "Usuario 1" aparece no ranking da Aba 2 **automaticamente**
- ✅ Não precisou recarregar a Aba 2
- ✅ Score aparece corretamente

---

## 🔍 Verificar Erros (DevTools)

1. Abra: `http://localhost:8000/index.html`
2. Pressione: **F12** (ou Ctrl+Shift+I)
3. Vá para aba: **Console**

**Procure por:**

```
✅ Firebase inicializado com sucesso!
```

Se vir **erro em vermelho**, nota qual é e me manda.

---

## 📊 Testar Firebase Console

1. Vá para: https://console.firebase.google.com
2. Projeto: **Kyber Agil**
3. Realtime Database

**Você deve ver:**
- [ ] Estrutura: `rankings`
- [ ] Dentro dela, vários entries com `name`, `score`, `date`
- [ ] Cada jogo salvo cria um novo entry

---

## 🎯 Teste de Sincronização Avançado (Opcional)

**Para testar com 5 usuários simultaneamente:**

1. Abra 5 abas do mesmo navegador
2. Em cada aba, coloque um nome diferente:
   - Aba 1: "Player 1"
   - Aba 2: "Player 2"
   - ... e assim por diante

3. Clique "Começar a Jornada" em cada uma
4. Responda rapidamente em cada uma
5. Terminando cada jogo, veja o ranking atualizar

**Resultado esperado:**
- ✅ Ranking mostra todos os 5 players
- ✅ Ordenado por score (maior primeiro)
- ✅ Cada novo score atualiza automaticamente

---

## 📱 Teste em Celular (Opcional)

**Para testar QR Code em celular:**

1. Primeiro, hospede em URL pública (GitHub Pages / Vercel)
2. Use o arquivo `qrcode.html` da hospedagem
3. Abra câmera do celular
4. Aponte para QR Code
5. Clique no link
6. Game abre no celular

---

## 🐛 Se Algo Não Funcionar

**Verifique:**
1. Servidor HTTP está rodando? (Windows: `npx http-server . -p 8000`)
2. Firebase está inicializado? (Console do navegador: F12)
3. Firebase Database está em **test mode**? (Realtime Database > Rules)

**Se nada funcionar, me mande:**
1. Screenshot do erro (F12 > Console)
2. URL que está tentando acessar
3. Qual navegador está usando

---

## ✨ Próximo Passo (Após testes passarem)

```bash
1. Criar repositório GitHub
2. Fazer git push
3. Ativar GitHub Pages
4. Gerar QR Code da URL pública
5. Distribuir para 600 pessoas
```

**Quer fazer isso agora? Me avisa! 🚀**
