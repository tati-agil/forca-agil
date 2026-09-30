# 12 — Decisões (ADRs), riscos e pendências

---

## 1. Registro de decisões arquiteturais (ADRs)

Formato: contexto → decisão → alternativas descartadas → consequências. Uma decisão só muda com um novo ADR que a substitua (registrar aqui).

### ADR-001 — Backend NestJS entre o navegador e o MongoDB
- **Contexto:** hoje o navegador acessa o banco direto e o `database.rules.json` protege no servidor do Google. MongoDB não pode ser exposto ao navegador.
- **Decisão:** API NestJS (TypeScript) como única porta do banco, com autenticação, regras, tempo real e e-mails.
- **Alternativas descartadas:**
  - *Acesso direto ao MongoDB pelo navegador / Atlas Data API*: sem modelo de permissão equivalente; Data API foi descontinuada pela MongoDB; exigiria nuvem externa.
  - *Express puro*: viável, mas sem a estrutura padronizada (módulos/guards/gateways) que facilita a continuidade por outra pessoa ou IA.
  - *Supabase/Appwrite/PocketBase auto-hospedados* (BaaS com regras): trocariam uma dependência por outra, com banco Postgres/SQLite (a TI pediu MongoDB) e ainda exigiriam reescrever as regras e o cliente.
  - *Firebase Emulator Suite em produção*: não é suportado para produção.
- **Consequências:** equipe precisa manter um serviço Node; ganho: auditoria, dados dentro da empresa, possibilidade de mover validações para o servidor (Fase B).

### ADR-002 — Migração em duas fases com cliente de compatibilidade
- **Contexto:** ~20 arquivos, 400+ chamadas ao SDK, regras de negócio no navegador; histórico de incidentes quando telas mudam.
- **Decisão:** Fase A troca só a camada de acesso (cliente `fa-api-client.js` que imita o SDK compat + API de caminhos no backend); Fase B evolui por domínio depois do corte.
- **Alternativas descartadas:** *reescrever todas as telas para REST antes do corte* (custo e risco altos, atrasaria a saída do Firebase em meses); *reescrever o site num framework* (fora de escopo).
- **Consequências:** a Fase A herda as brechas das regras atuais (doc. 04 §9) — consciente e documentado; a API de caminhos é mais "genérica" do que uma API de domínio.

### ADR-003 — Sessão por cookie `HttpOnly` guardada no MongoDB (não JWT)
- **Decisão e motivos:** doc. 04 §2.
- **Consequência:** a API precisa consultar a sessão a cada requisição (cache de 30 s resolve).

### ADR-004 — MongoDB em replica set de 1 nó
- **Motivo:** transações multi-documento (atomicidade do `update()` multi-caminho) e change streams exigem replica set.
- **Consequência:** sem alta disponibilidade (1 nó). Aceitável para o porte; se a empresa exigir HA, evoluir para 3 nós (primary + secondary + arbiter/secondary) sem mudar a aplicação.

### ADR-005 — Um documento por turma em `apostas`
- **Motivo e riscos:** doc. 03 §8.

### ADR-006 — Chaves do Firebase preservadas (`emailKey`, push keys) na Fase A
- **Motivo:** o site monta caminhos com elas em centenas de pontos; links e referências cruzadas dependem delas.
- **Consequência:** "corrigir e-mail" continua movendo dados entre chaves; ID estável fica para a Fase B (doc. 03 §11).

### ADR-007 — Tempo real por "aviso + releitura" (Socket.IO)
- **Motivo:** impossível vazar dado pelo canal em tempo real; reaproveita a checagem de leitura. Doc. 05 §7.4.

### ADR-008 — Senhas preservadas via hash scrypt do Firebase
- **Motivo:** evitar que centenas de pessoas precisem redefinir senha no dia do corte. Doc. 04 §3.4.

### ADR-009 — Fontes e bibliotecas servidas localmente
- **Motivo:** intranet pode bloquear CDNs; CSP mais restrita (`'self'`).

### ADR-010 — Contêineres Docker + Compose (não Kubernetes)
- **Motivo:** 3-4 serviços num único servidor; Compose é suficiente, simples de operar e de entender. Se a empresa padronizar Kubernetes/OpenShift, as mesmas imagens servem (traduzir o compose para manifests).

---

## 2. Riscos

| # | Risco | Prob. | Impacto | Mitigação | Dono |
|---|---|---|---|---|---|
| R-01 | Regra de permissão traduzida mais **frouxa** que no Firebase (vazamento/alteração indevida) | média | alto | Porte das 115 verificações do `teste-rules.js`; tabela geral testada; **diferencial contra o emulador** (doc. 09 §2.3); negar por padrão | dev |
| R-02 | Regra traduzida mais **rígida** (botão que abre mas não salva) | média | alto | Mesmo diferencial; matriz manual de telas (doc. 09 §7.1) | dev |
| R-03 | Cliente de compatibilidade com diferença sutil do SDK (ordem de eventos, `null`, arrays, `forEach`) | média | médio/alto | Especificação detalhada (doc. 06 §3); os ~28 testes com banco falso + testes no modo real | dev |
| R-04 | Tempo real com atraso/queda na rede da Previ (proxy corta WebSocket) | média | alto na oficina | Socket.IO com fallback *long-polling*; ensaio de oficina com aparelhos reais (doc. 09 §7.3); pedir à TI que o proxy não corte conexões longas (P-10) | infra |
| R-05 | Não conseguir os parâmetros de hash de senha do Firebase | baixa | médio | Plano B: redefinição de senha em massa com comunicação prévia (doc. 04 §3.4) | dona do repo |
| R-06 | E-mails do SMTP interno caindo em spam ou bloqueados | média | médio | Remetente oficial `@previ.com.br`, SPF/DKIM pela TI (P-05); testar com contas reais antes do corte | infra |
| R-07 | Perda de dados na importação | baixa | alto | Conferência por hash de cada nó; 3 ensaios; Firebase congelado 30 dias; plano de volta ensaiado | dev |
| R-08 | Servidor único cai em dia de oficina | baixa | alto | `restart: unless-stopped`, monitoramento com alerta, backup diário, runbook de restauração; considerar VM com snapshot | infra |
| R-09 | Créditos da IA acabam no meio de uma tarefa | alta | médio | Tarefas pequenas com critério de aceite; `PROGRESSO.md`; prompt de retomada (doc. 11, apêndice) | todos |
| R-10 | Troca de domínio perde dados locais (rascunho de avaliação) | alta | baixo | Comunicação prévia; progresso do quiz é restaurado do servidor | dona do repo |
| R-11 | Documento de `apostas` crescer demais | muito baixa | médio | Alerta de tamanho > 8 MB (doc. 03 §8) | infra |
| R-12 | Deploy acidental do Firebase depois do corte "descongelar" o banco antigo | média | médio | Desativar `firebase-deploy.yml` no mesmo PR do corte (doc. 10 §6) | dev |
| R-13 | Alguém corrigir brechas herdadas "de carona" e quebrar telas | média | médio | Princípio de paridade; revisão de PR; brechas listadas para a Fase B | revisão |

---

## 3. Pendências (perguntas para a TI e para a dona do repositório)

Preencher a coluna **Resposta** na Tarefa 0.1 do plano.

| # | Pergunta | Para quem | Bloqueia | Resposta |
|---|---|---|---|---|
| P-01 | Qual servidor (VM) será usado? SO, CPU, RAM, disco? Há um segundo servidor para homologação? | TI | Fase 1 | |
| P-02 | Qual nome DNS interno (ex.: `forcaagil.previ.com.br`)? Quem emite o certificado TLS e com que validade/renovação? | TI | Fase 1 | |
| P-03 | Quem tem papel **Owner** no projeto Firebase `kyber-agil` para exportar dados e usuários (com hash de senha)? | dona do repo | Fase 7 | |
| P-04 | Existe SSO/AD/LDAP corporativo que possa ser usado no futuro (Fase B)? Protocolo (LDAP, OIDC, SAML)? | TI | Fase B | |
| P-05 | Qual SMTP interno usar (host, porta, TLS, autenticação)? Remetente permitido? SPF/DKIM configurados para ele? | TI | Fase 3 | |
| P-06 | Existe registro de imagens Docker interno (Harbor, Nexus, GitLab, Artifactory)? Espelho do Docker Hub? | TI | Fase 9 (e build sem internet) | |
| P-07 | Onde rodará o CI/CD: runner auto-hospedado do GitHub, GitLab CI, Jenkins, Azure DevOps, ou deploy manual? O servidor tem saída para `github.com`? | TI | Fase 9 | |
| P-08 | Política de backup corporativo: para onde copiar os `mongodump`? Retenção exigida? | TI | Fase 1 | |
| P-09 | Existe coletor central de logs/monitoramento (ELK, Graylog, Zabbix, Grafana)? | TI | Fase 9 | |
| P-10 | O proxy/firewall interno permite WebSocket e conexões longas (≥ 1 h) entre as estações/celulares e o servidor? A rede Wi-Fi das salas de oficina alcança o servidor? | TI | Fase 5/8 | |
| P-11 | A política de senha atual (só números, mínimo 8) deve ser mantida? (Paridade = sim.) | dona do repo | — | |
| P-12 | Manter a senha padrão `12345678` para contas criadas pela admin (paridade) ou passar a "definir senha no primeiro acesso"? | dona do repo | Fase 3 | |
| P-13 | Os endpoints administrativos devem continuar pedindo a senha da admin? (doc. 11, Tarefa 3.6) | dona do repo | Fase 3 | |
| P-14 | O site ficará acessível **só pela rede interna** ou também de fora (VPN / internet)? Participantes remotas (formato remoto/híbrido) precisam acessar? | TI + dona do repo | Fase 1 | |

---

## 4. Premissas assumidas nesta documentação (confirmar)

- Volume de uso: centenas de cadastros, dezenas de acessos simultâneos em dia de oficina.
- O servidor terá saída para a internet **durante a instalação** (baixar imagens e pacotes npm) ou haverá espelhos internos (P-06).
- A equipe tem pelo menos uma pessoa com acesso SSH ao servidor e permissão para usar Docker.
- A dona do repositório aprova os PRs (política do `CLAUDE.md`: "o merge continua sendo dela").
