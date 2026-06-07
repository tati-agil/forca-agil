# 🎖 FORÇA ÁGIL — Guia Completo Firebase + QR Code

## ✅ O que foi feito:

### 1. **Firebase Integrado** 🔥
- Firebase Realtime Database sincroniza rankings em tempo real
- Credenciais já configuradas no `index.html`
- Todos os 600 usuários veem o mesmo ranking automaticamente
- Dados persistem na nuvem (não desaparecem quando o navegador fecha)

### 2. **Game Atualizado** 🎮
- 25+ desafios sobre Agile, Kanban, Lean e Kaizen
- Timer de 30 segundos por questão
- Sistema de pontos com bônus de velocidade
- Ranking em tempo real sincronizado com Firebase

### 3. **QR Code Gerador** 📱
- Acesse: `http://localhost:8000/qrcode.html`
- Exibe QR Code para compartilhar
- Permite editar URL antes de compartilhar
- Pronto para distribuir a 600 pessoas

---

## 🚀 Como Usar AGORA:

### **Passo 1: Abra o Game no Navegador**
```
http://localhost:8000/index.html
```

### **Passo 2: Teste Localmente**
1. Digite um nome (ex: "Tati")
2. Clique em "Começar a Jornada"
3. Responda 30 questões
4. Veja seu ranking em tempo real

### **Passo 3: Veja o QR Code**
```
http://localhost:8000/qrcode.html
```

---

## 📡 Como Distribuir para 600 Pessoas?

### **OPÇÃO 1: GitHub Pages (GRATUITO + RÁPIDO)**

1. **Criar repositório no GitHub:**
   - Vá para github.com
   - Clique "New Repository"
   - Nome: `forca-agil` ou `kyber-agil`
   - Deixe público

2. **Fazer upload dos arquivos:**
   ```bash
   cd "C:\Users\User\Downloads\Design System (2)"
   git init
   git add .
   git commit -m "Força Ágil com Firebase"
   git remote add origin https://github.com/SEU_USER/forca-agil.git
   git branch -M main
   git push -u origin main
   ```

3. **Ativar GitHub Pages:**
   - Vá para: Settings > Pages
   - Source: main branch / root
   - Salve
   - Seu site estará em: `https://seu-user.github.io/forca-agil/`

4. **Gerar QR Code:**
   - Acesse: `https://seu-user.github.io/forca-agil/qrcode.html`
   - Copie a URL
   - Compartilhe o QR Code com 600 pessoas

---

### **OPÇÃO 2: Vercel (GRATUITO + AINDA MAIS FÁCIL)**

1. **Vá para vercel.com**
   - Clique "Import Project"
   - Selecione seu repositório GitHub do passo anterior
   - Clique "Deploy"

2. **Seu site estará em:**
   ```
   https://forca-agil.vercel.app/
   ```

3. **QR Code:** `https://forca-agil.vercel.app/qrcode.html`

---

### **OPÇÃO 3: Netlify (GRATUITO)**

1. **Vá para netlify.com**
   - Clique "Add new site > Import an existing project"
   - Selecione GitHub
   - Escolha seu repositório
   - Deploy automático

2. **Seu site estará em:**
   ```
   https://forca-agil.netlify.app/
   ```

---

## 🔒 Segurança Firebase (Após 30 dias)

Seu Firebase está em **modo teste** (qualquer um pode ler/escrever). Para produção segura:

```json
{
  "rules": {
    "rankings": {
      ".write": true,
      ".read": true,
      "$uid": {
        ".validate": "newData.hasChildren(['name', 'score', 'date'])"
      }
    }
  }
}
```

Atualize em: Firebase Console > Realtime Database > Rules

---

## 📊 Monitorar Rankings

1. **Firebase Console:**
   - Vá para: console.firebase.google.com
   - Projeto: "Kyber Agil"
   - Realtime Database
   - Veja todos os rankings em tempo real

2. **No jogo:**
   - Todo ranking novo aparece automaticamente
   - Não precisa recarregar a página
   - Sincroniza em tempo real entre 600 usuários

---

## 🎯 Timeline Sugerido

| Quando | O que fazer |
|--------|-----------|
| **Hoje** | ✅ Testar jogo localmente |
| **Amanhã** | ✅ Hospedar no GitHub Pages ou Vercel |
| **Dia 3** | ✅ Gerar QR Code e enviar para 600 pessoas |
| **Semana 1** | 📊 Monitorar rankings no Firebase |
| **Dia 30** | 🔒 Atualizar segurança do Firebase |

---

## 🐛 Troubleshooting

### "Firebase não inicializa"
- Verifique conexão com internet
- Verifique se as credenciais no `index.html` estão corretas
- Abra DevTools (F12) > Console para ver erros

### "Rankings não sincronizam"
- Espere 2-3 segundos após terminar o jogo
- Recarregue a página
- Verifique se Firebase Database está ativa

### "QR Code não funciona"
- Certifique-se que hospedou em URL pública (não localhost)
- Teste a URL manualmente primeiro
- Regenere o QR Code no `qrcode.html`

---

## ✨ Próximos Passos (Opcional)

1. **Adicionar autenticação:** Cada usuário tem conta própria
2. **Leaderboard por equipe:** Ranking de times em vez de indivíduos
3. **Badges/Achievements:** Prêmios por performance
4. **Analytics:** Gráficos de participação e scores
5. **Modo multiplayer:** Desafios em tempo real contra outros

---

**Pronto para começar? Execute:**
```bash
http://localhost:8000/index.html
```

**Dúvidas? Verifique:**
- DevTools (F12) > Console
- Firebase Console (logs de erro)
- Este arquivo (INSTRUCOES.md)
