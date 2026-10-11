# Transferência do repositório para o Git corporativo

O repositório está hoje no GitHub pessoal (`tati-agil/forca-agil`). Este documento lista o que fica igual e o que
precisa ser refeito quando ele for para a plataforma corporativa: GitHub Enterprise, Azure DevOps, GitLab ou outra.

## O que vai junto, sem mudança

- **O histórico completo, as branches e as tags.** Use `git clone --mirror` do repositório atual e `git push --mirror` para o novo.
- **O código do site, do Núcleo e do backend.** Nenhum deles cita a URL do repositório nem usa credenciais pessoais.
- **Os comandos de teste e de ambiente.** São scripts do próprio repositório (`node …`, `npm …`, `docker compose …`) e não dependem do serviço de Git.

## O que precisa ser refeito

| Item | Hoje | Na plataforma nova |
|---|---|---|
| **Pipelines de CI/CD** | GitHub Actions, em `.github/workflows/` | Recriar na ferramenta corporativa. Os passos são os comandos dos próprios workflows. No GitHub Enterprise, os arquivos servem como estão. |
| **Deploy do site** | `firebase-deploy.yml`, ao entrar na `main` | Mesmo comando (`firebase-tools@13 deploy --only hosting,database`), com a credencial nova |
| **Segredos** | `FIREBASE_SERVICE_ACCOUNT_KYBER_AGIL`, mais os usados pelos workflows de manutenção e pelo Smoke (conta de teste) | Cadastrar de novo no cofre de segredos da plataforma corporativa. Nunca no código. |
| **Ações de terceiros** | `actions/checkout`, `actions/setup-node`, `google-github-actions/auth` | Equivalentes da plataforma, ou espelhos aprovados |
| **Proteção de branches e revisão** | regras da `main` no GitHub | Recriar: PR obrigatório e merge só pela responsável |
| **Integrações** | app do Claude no GitHub e notificações de PR | Reinstalar ou reconfigurar (Copilot e Claude, conforme a política corporativa) |
| **Imagens Docker** | Docker Hub (`node:22-alpine`, `postgres:17-alpine`) | Se a empresa usar registro próprio, definir `NODE_IMAGE` e `POSTGRES_IMAGE` no `.env`. Não há mudança de código. |
| **Rede corporativa** | — | Com proxy de inspeção TLS, passar a CA da empresa no build (ver `backend/README.md`, Problemas comuns) |
| **Links na documentação** | alguns documentos citam PRs e execuções do GitHub atual | Ficam como registro histórico; as referências novas usam a plataforma nova |

## Ordem sugerida

1. Criar o repositório corporativo vazio e fazer o *mirror*.
2. Recriar os segredos e os pipelines, começando pelos de teste.
3. Validar os testes na plataforma nova, sem deploy.
4. Só então ligar o deploy na plataforma nova e desligar o do repositório pessoal. Nunca os dois ao mesmo tempo, para não haver dois deploys concorrentes no mesmo projeto Firebase.
