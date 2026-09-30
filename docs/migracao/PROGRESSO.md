# PROGRESSO — Migração Firebase → NestJS + MongoDB + Docker

> Diário da execução do plano [`11-plano-de-execucao.md`](11-plano-de-execucao.md). **Atualize no mesmo PR que conclui cada tarefa.**
> O marcador no título da tarefa (doc. 11) é a fonte da verdade do status; esta tabela deve coincidir com ele.

**Legenda:** `[ ]` não iniciada · `[~]` em andamento/parcial · `[x]` concluída (aceite demonstrado) · `[!]` bloqueada · `[-]` dispensada

**Situação geral:** Fase atual: 0 · Última atualização: — · Responsável: —

## Tarefas


### Fase 0 — Preparação

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 0.1 Responder as pendências com a TI e a dona do repositório | `[ ]` | nenhum. | | | | | |
| 0.2 Corrigir o problema K-01 (antes de migrar) | `[ ]` | nenhum (independente da migração; pode andar em paralelo a 0.1). | | | | | |
| 0.3 Ler toda a documentação e abrir o `PROGRESSO.md` | `[ ]` | nenhum. | | | | | |
| 0.4 Criar as contas de teste no Firebase (para validar a migração de senhas depois) | `[ ]` | nenhum (pode andar em paralelo a 0.1-0.3). | | | | | |

### Fase 1 — Infraestrutura base

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 1.1 Proteger o deploy atual e preparar o repositório | `[ ]` | 0.1. | | | | | |
| 1.2 Preparar o servidor Linux (homolog primeiro) | `[ ]` | 0.1; P-01 (servidor), P-02 (DNS/certificado). | | | | | |
| 1.3 Criar `infra/` com compose, Nginx e Mongo | `[ ]` | 1.1, 1.2. | | | | | |
| 1.4 Marco: site atual servido pelo Nginx interno | `[ ]` | 1.3. | | | | | |
| 1.5 Backup e restauração | `[ ]` | 1.3. | | | | | |

### Fase 2 — Esqueleto do backend

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 2.1 Criar o projeto NestJS | `[ ]` | 1.1. | | | | | |
| 2.2 Configuração validada | `[ ]` | 2.1. | | | | | |
| 2.3 Conexão MongoDB + índices + health | `[ ]` | 2.2, 1.3 (Mongo no ar). | | | | | |
| 2.4 Dockerfile e integração no compose | `[ ]` | 2.3, 1.3. | | | | | |

### Fase 3 — Autenticação

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 3.1 Coleções e serviço de sessão | `[ ]` | 2.3. | | | | | |
| 3.2 Senhas (argon2id + fallback do Firebase) | `[ ]` | 3.1. | | | | | |
| 3.3 Endpoints `/api/auth/*` | `[ ]` | 3.1, 3.2. | | | | | |
| 3.4 E-mails | `[ ]` | 3.3; P-05 (SMTP). | | | | | |
| 3.5 Decisão: exigir a senha da admin nos endpoints administrativos? | `[ ]` | 0.1 (P-13), 3.3. | | | | | |
| 3.6 Endpoints administrativos `/api/admin/usuarios/*` | `[ ]` | 3.4, 3.5. | | | | | |

### Fase 4 — API de dados e regras

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 4.1 Mapeamento de caminhos + normalização RTDB | `[ ]` | 2.3. | | | | | |
| 4.2 `DataService`: ler, escrever pares, `_multi`, consultas | `[ ]` | 4.1. | | | | | |
| 4.3 Motor de regras — tabela geral | `[ ]` | 4.2, 3.1 (identidade da sessão). | | | | | |
| 4.4 Motor de regras — `apostas` | `[ ]` | 4.3. | | | | | |
| 4.5 Transações (compare-and-swap) | `[ ]` | 4.3, 4.4. | | | | | |
| 4.6 Diferencial de regras contra o emulador | `[ ]` | 4.4, 4.5. | | | | | |

### Fase 5 — Tempo real

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 5.1 Gateway Socket.IO + barramento | `[ ]` | 4.4, 3.1. | | | | | |
| 5.2 Efeitos de escrita | `[ ]` | 5.1, 3.1. | | | | | |

### Fase 6 — Frontend

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 6.1 `fa-api-client.js` — banco | `[ ]` | 4.5, 5.1, 2.4. | | | | | |
| 6.2 `fa-api-client.js` — auth | `[ ]` | 6.1, 3.3. | | | | | |
| 6.3 `index.html`, fontes locais, CSP | `[ ]` | 6.2, 1.3. | | | | | |
| 6.4 `auth.js` (cadastro, criar conta, corrigir e-mail) | `[ ]` | 6.2, 3.6. | | | | | |
| 6.5 `router.js` e `testes.js` | `[ ]` | 6.2. | | | | | |
| 6.6 Tela `#conta` | `[ ]` | 6.4, 3.4. | | | | | |
| 6.7 Testes Playwright: nova interceptação | `[ ]` | 6.6 (as telas novas precisam estar prontas para entrar nos testes). | | | | | |
| 6.8 Testes Playwright no modo real + tempo real com 3 aparelhos | `[ ]` | 6.7, 2.4, 5.2. | | | | | |

### Fase 7 — Migração de dados

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 7.1 `importar.ts` + `conferir.ts` | `[ ]` | 4.1, 4.2. | | | | | |
| 7.2 Primeira exportação real e importação em homolog | `[ ]` | 7.1, 6.8 (cliente e backend completos); P-03 (acesso Owner), 0.4 (contas de teste). | | | | | |
| 7.3 Validação manual em homolog com dados reais | `[ ]` | 7.2, 6.8. | | | | | |
| 7.4 Segundo e terceiro ensaio de importação | `[ ]` | 7.3. | | | | | |
| 7.5 `exportar-para-rtdb.ts` (plano de volta) | `[ ]` | 7.1. | | | | | |
| 7.6 Ensaio do plano de volta num projeto Firebase de teste | `[ ]` | 7.5. | | | | | |

### Fase 8 — Homologação e corte

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 8.1 Ensaio de oficina | `[ ]` | 6.8, 7.4. | | | | | |
| 8.2 Critérios de liberação | `[ ]` | 8.1, 7.6, 0.2. | | | | | |
| 8.3 Comunicação | `[ ]` | 8.2 (data e janela definidas). | | | | | |
| 8.4 Dia do corte — roteiro | `[ ]` | 8.2, 8.3. | | | | | |

### Fase 9 — Pós-corte

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 9.1 CI/CD interno definitivo | `[ ]` | 8.4. | | | | | |
| 9.2 Desligar workflows do Firebase e portar scripts de operação | `[ ]` | 9.1. | | | | | |
| 9.3 Monitoramento e alertas | `[ ]` | 8.4. | | | | | |
| 9.4 Atualizar a documentação viva do site e do repositório | `[ ]` | 8.4. | | | | | |
| 9.5 Dia 30 — decisão sobre o projeto Firebase | `[ ]` | 8.4 e 30 dias de operação. | | | | | |

### Fase 10 — Encerramento e Fase B

| Tarefa | Status | Depende de | Início | Fim | Quem (pessoa/IA) | PR | Observações / desvios |
|---|---|---|---|---|---|---|---|
| 10.1 Retrospectiva e backlog da Fase B | `[ ]` | 9.4. | | | | | |
| 10.2 Teste de restauração mensal agendado | `[ ]` | 9.3. | | | | | |

## Decisões tomadas durante a execução

| Data | Decisão | Motivo | Quem aprovou |
|---|---|---|---|
| | | | |

## Problemas encontrados

| Data | Problema | Impacto | Solução / responsável | Resolvido? |
|---|---|---|---|---|
| | | | | |

## Pendências da TI (resumo; o detalhe está no doc. 12 §3)

Registrar aqui a data em que cada P-xx foi respondida (ou que ficou bloqueando alguma tarefa com `[!]`).
