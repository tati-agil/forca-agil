# 07 — Infraestrutura: servidor Linux, Docker, Nginx, MongoDB, backups

> Pré-requisito: [02-arquitetura-alvo.md](02-arquitetura-alvo.md).
> Todos os arquivos deste documento ficam em `infra/` (a ser criado na Fase 1 do [plano](11-plano-de-execucao.md)).
> Os conteúdos abaixo são **modelos completos** — copie, ajuste os valores marcados com `<<…>>` e versione.

---

## 1. Visão dos containers

| Serviço (compose) | Imagem | Porta exposta no host | Ambientes | Função |
|---|---|---|---|---|
| `web` | build de `infra/web/Dockerfile` (base `nginx:1.27-alpine`) | **443** (e 80 → redireciona para 443) | todos | Site estático + proxy `/api` e `/socket.io` |
| `api` | build de `backend/Dockerfile` (base `node:22-alpine`) | nenhuma (só rede interna) | todos | NestJS |
| `mongo` | `mongo:7.0` | nenhuma em produção; `127.0.0.1:27017` em dev | todos | Banco |
| `mongo-init` | `mongo:7.0` | — | todos (executa uma vez e sai) | Inicia o replica set e cria usuários |
| `mailpit` | `axllent/mailpit:latest` | `127.0.0.1:8025` (UI) | **só dev/homolog** | Captura e-mails |
| `backup` | `mongo:7.0` + cron (ou cron do host) | — | homolog/prod | `mongodump` diário |

Redes Docker:
- `borda` — só `web` (e, portanto, só ele recebe tráfego de fora);
- `interna` — `web`, `api`, `mongo`, `mailpit`, `backup` (marcada `internal: true` em produção para `mongo` não ter saída para a internet).

---

## 2. Preparação do servidor Linux (uma vez)

### 2.1 Requisitos mínimos

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD (dados + imagens + backups locais de 30 dias) |
| SO | Ubuntu Server 22.04/24.04 LTS, RHEL/Rocky/Alma 9 ou Debian 12 | idem |
| Rede | Acesso da rede interna na 443; saída para o SMTP interno; saída para o registro de imagens (ou build local) | |

> A base de dados atual da Força Ágil é pequena (algumas dezenas de MB no máximo). O dimensionamento é dominado pelo Node + MongoDB em memória, não pelo volume de dados.

### 2.2 Instalação do Docker Engine + Compose v2

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

**RHEL/Rocky/Alma:**
```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

> Se a empresa usa **proxy corporativo** para sair para a internet, configure-o para o Docker em `/etc/systemd/system/docker.service.d/http-proxy.conf` (`Environment="HTTP_PROXY=..." "HTTPS_PROXY=..." "NO_PROXY=localhost,127.0.0.1,.previ.com.br"`) e rode `sudo systemctl daemon-reload && sudo systemctl restart docker`. Se a empresa tem **registro de imagens interno** (Harbor, Nexus, Artifactory, GitLab Registry), use-o como espelho — ver pendência P-06 no [documento 12](12-riscos-decisoes-e-pendencias.md).

Verifique:
```bash
docker --version          # 24+ 
docker compose version    # v2.20+
```

### 2.3 Usuário de serviço e diretórios

```bash
sudo useradd --system --create-home --home-dir /opt/forcaagil --shell /bin/bash forcaagil
sudo usermod -aG docker forcaagil
sudo mkdir -p /opt/forcaagil/{app,backups,certs,logs}
sudo chown -R forcaagil:forcaagil /opt/forcaagil
sudo chmod 700 /opt/forcaagil/certs /opt/forcaagil/backups
```

- `/opt/forcaagil/app` — clone do repositório (ou só `infra/` + imagens, se o deploy for por registro).
- `/opt/forcaagil/certs` — `fullchain.pem` e `privkey.pem` do certificado HTTPS emitido pela TI.
- `/opt/forcaagil/backups` — saída do `mongodump` (sincronizar com NAS/backup corporativo).

### 2.4 Firewall

Somente 443 (e 80 para redirecionar) abertos para a rede interna; SSH só da rede de administração.

```bash
# Ubuntu (ufw)
sudo ufw default deny incoming
sudo ufw allow from <<rede-admin>> to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=https --add-service=http
sudo firewall-cmd --reload
```

> **Atenção:** o Docker manipula o `iptables` diretamente e **ignora o ufw** para portas publicadas. Por isso **nenhum** serviço além do `web` pode ter `ports:` em produção. O MongoDB em dev publica só em `127.0.0.1`.

### 2.5 DNS e certificado

- Pedir à TI um nome interno, ex.: `forcaagil.previ.com.br` (pendência P-02).
- Pedir certificado TLS emitido pela CA interna (ou pública, se o nome for público). Colocar em `/opt/forcaagil/certs/fullchain.pem` e `privkey.pem` (permissão 600, dono `forcaagil`).
- Em dev, gerar autoassinado: `openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout privkey.pem -out fullchain.pem -subj "/CN=localhost"`.

---

## 3. Estrutura da pasta `infra/`

```
infra/
├── docker-compose.yml             ← base comum a todos os ambientes
├── docker-compose.dev.yml         ← sobreposições de desenvolvimento
├── docker-compose.prod.yml        ← sobreposições de produção/homologação
├── .env.example                   ← modelo das variáveis (NUNCA versionar o .env real)
├── web/
│   ├── Dockerfile                 ← imagem Nginx com o site dentro
│   ├── nginx.conf                 ← configuração principal
│   ├── seguranca.conf             ← cabeçalhos (CSP etc.), incluído pelo nginx.conf
│   └── .dockerignore
├── mongo/
│   ├── init-replica.sh            ← inicia rs0 e cria usuário da aplicação
│   └── gerar-keyfile.sh           ← gera o keyfile do replica set
├── backup/
│   ├── backup.sh                  ← mongodump + rotação
│   └── restore.sh                 ← restauração assistida
└── scripts/
    ├── deploy.sh                  ← pull/build + up -d + healthcheck
    └── rollback.sh                ← volta para a tag anterior
```

O `backend/Dockerfile` fica dentro de `backend/` (documento 05).

---

## 4. `infra/.env.example`

```dotenv
# ===== Identificação do ambiente =====
AMBIENTE=dev                       # dev | homolog | prod
COMPOSE_PROJECT_NAME=forcaagil
TAG_IMAGEM=local                   # tag das imagens web/api (ex.: git SHA em homolog/prod)

# ===== Site =====
DOMINIO=localhost                  # ex.: forcaagil.previ.com.br
URL_PUBLICA=https://localhost      # usada nos links dos e-mails
CAMINHO_CERTS=./certs-dev          # em prod: /opt/forcaagil/certs

# ===== MongoDB =====
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=<<gerar: openssl rand -base64 32>>
MONGO_APP_USER=forcaagil_app
MONGO_APP_PASSWORD=<<gerar: openssl rand -base64 32>>
MONGO_DB=forcaagil
MONGO_REPLSET=rs0
# a API monta a URI a partir das variáveis acima:
# mongodb://forcaagil_app:<senha>@mongo:27017/forcaagil?replicaSet=rs0&authSource=forcaagil

# ===== API =====
API_PORTA=3000
SESSAO_SEGREDO=<<gerar: openssl rand -base64 48>>
SESSAO_DURACAO_HORAS=720           # 30 dias (Firebase mantém a pessoa logada indefinidamente)
SESSAO_NOME_COOKIE=fa_sessao
DOMINIO_EMAIL_PERMITIDO=previ.com.br
SUPER_ADMINS=tatianefdirene@previ.com.br,danielfrazao@previ.com.br
LOG_NIVEL=info                     # debug em dev
RATE_LIMIT_LOGIN_POR_MIN=10

# ===== Compatibilidade de senhas do Firebase (documento 04, seção 3.4) =====
FIREBASE_SCRYPT_SIGNER_KEY=<<base64_signer_key do console Firebase>>
FIREBASE_SCRYPT_SALT_SEPARATOR=<<base64_salt_separator>>
FIREBASE_SCRYPT_ROUNDS=8
FIREBASE_SCRYPT_MEM_COST=14

# ===== E-mail =====
SMTP_HOST=mailpit                  # em prod: <<smtp interno da empresa>>
SMTP_PORTA=1025                    # em prod: 25/587
SMTP_SEGURO=false                  # true se 465
SMTP_USUARIO=
SMTP_SENHA=
EMAIL_REMETENTE="Força Ágil <nao-responda@previ.com.br>"

# ===== Backup =====
BACKUP_DIR=/opt/forcaagil/backups
BACKUP_RETENCAO_DIAS=30
```

Regras:
- `.env` **nunca** é commitado (adicionar `infra/.env` ao `.gitignore` na Tarefa 1.1).
- Em produção, o `.env` fica em `/opt/forcaagil/app/infra/.env` com permissão `600`, dono `forcaagil`.
- Segredos gerados com `openssl rand -base64 N` — **nunca** reaproveitar entre ambientes.

---

## 5. `infra/docker-compose.yml` (base)

```yaml
name: ${COMPOSE_PROJECT_NAME:-forcaagil}

x-logging: &logging
  driver: json-file
  options:
    max-size: "20m"
    max-file: "5"

services:
  mongo:
    image: mongo:7.0
    command: ["mongod", "--replSet", "${MONGO_REPLSET:-rs0}", "--bind_ip_all",
              "--keyFile", "/etc/mongo-keyfile/keyfile", "--auth"]
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongo-dados:/data/db
      - mongo-keyfile:/etc/mongo-keyfile:ro
    networks: [interna]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "mongosh --quiet -u \"$${MONGO_INITDB_ROOT_USERNAME}\" -p \"$${MONGO_INITDB_ROOT_PASSWORD}\" --authenticationDatabase admin --eval 'db.adminCommand({ping:1}).ok' | grep -q 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s
    logging: *logging

  mongo-init:
    image: mongo:7.0
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      MONGO_ROOT_USER: ${MONGO_ROOT_USER}
      MONGO_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_APP_USER: ${MONGO_APP_USER}
      MONGO_APP_PASSWORD: ${MONGO_APP_PASSWORD}
      MONGO_DB: ${MONGO_DB}
      MONGO_REPLSET: ${MONGO_REPLSET:-rs0}
    volumes:
      - ./mongo/init-replica.sh:/init-replica.sh:ro
    entrypoint: ["bash", "/init-replica.sh"]
    networks: [interna]
    restart: "no"

  api:
    image: forcaagil/api:${TAG_IMAGEM:-local}
    build:
      context: ../backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://${MONGO_APP_USER}:${MONGO_APP_PASSWORD}@mongo:27017/${MONGO_DB}?replicaSet=${MONGO_REPLSET:-rs0}&authSource=${MONGO_DB}
    depends_on:
      mongo-init:
        condition: service_completed_successfully
    networks: [interna]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging: *logging

  web:
    image: forcaagil/web:${TAG_IMAGEM:-local}
    build:
      context: ..                      # raiz do repositório (onde estão index.html e forca-agil/)
      dockerfile: infra/web/Dockerfile
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ${CAMINHO_CERTS}:/etc/nginx/certs:ro
    networks: [borda, interna]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "--no-check-certificate", "https://127.0.0.1/index.html"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging: *logging

volumes:
  mongo-dados:
  mongo-keyfile:

networks:
  borda:
  interna:
```

### 5.1 `infra/docker-compose.dev.yml`

```yaml
services:
  mongo:
    ports:
      - "127.0.0.1:27017:27017"     # para usar MongoDB Compass/mongosh da máquina de dev
  api:
    build:
      target: dev                    # estágio de desenvolvimento do Dockerfile (hot reload)
    environment:
      NODE_ENV: development
      LOG_NIVEL: debug
    volumes:
      - ../backend/src:/app/src      # hot reload
    command: ["npm", "run", "start:dev"]
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "127.0.0.1:8025:8025"        # UI web para ver os e-mails: http://localhost:8025
    networks: [interna]
  web:
    volumes:
      # em dev, o Nginx serve os arquivos DIRETO do repositório: editou, recarregou o navegador
      - ../index.html:/usr/share/nginx/html/index.html:ro
      - ../forca-agil:/usr/share/nginx/html/forca-agil:ro
      - ../robots.txt:/usr/share/nginx/html/robots.txt:ro
```

Subir em dev:
```bash
cd infra
cp .env.example .env               # e preencher
./mongo/gerar-keyfile.sh           # só na primeira vez
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api
# site: https://localhost  (aceitar o certificado autoassinado)
# e-mails: http://localhost:8025
```

### 5.2 `infra/docker-compose.prod.yml`

```yaml
services:
  api:
    build: !reset null              # em prod não constrói: usa imagem do registro
    deploy:
      resources:
        limits: { cpus: "1.5", memory: 1g }
  web:
    build: !reset null
  mongo:
    deploy:
      resources:
        limits: { memory: 2g }
    command: ["mongod", "--replSet", "${MONGO_REPLSET:-rs0}", "--bind_ip_all",
              "--keyFile", "/etc/mongo-keyfile/keyfile", "--auth",
              "--wiredTigerCacheSizeGB", "1"]
  backup:
    image: mongo:7.0
    depends_on:
      mongo:
        condition: service_healthy
    env_file: .env
    volumes:
      - ./backup/backup.sh:/backup.sh:ro
      - ${BACKUP_DIR}:/backups
    entrypoint: ["bash", "-c", "while true; do bash /backup.sh; sleep 86400; done"]
    networks: [interna]
    restart: unless-stopped

networks:
  interna:
    internal: true                  # nada da rede interna sai para a internet
```

> Se a versão do Compose não suportar `!reset`, remova o bloco `build:` do arquivo base na cópia de produção ou use `docker compose ... up -d --no-build`.
> Se a política da empresa preferir **cron do host** a um container de backup em loop, use o `backup.sh` via `crontab -e` do usuário `forcaagil` (seção 8.2) e remova o serviço `backup`.

Subir em produção:
```bash
cd /opt/forcaagil/app/infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

---

## 6. MongoDB: replica set de um nó

### 6.1 `infra/mongo/gerar-keyfile.sh`

```bash
#!/usr/bin/env bash
# Gera o keyfile exigido quando replica set + --auth estão ligados.
# Roda UMA vez por ambiente. O arquivo vai para o volume nomeado mongo-keyfile.
set -euo pipefail
PROJETO="${COMPOSE_PROJECT_NAME:-forcaagil}"
docker volume create "${PROJETO}_mongo-keyfile" >/dev/null
docker run --rm -v "${PROJETO}_mongo-keyfile:/k" alpine:3.20 sh -c \
  'apk add --no-cache openssl >/dev/null && openssl rand -base64 756 > /k/keyfile && chmod 400 /k/keyfile && chown 999:999 /k/keyfile'
echo "keyfile criado no volume ${PROJETO}_mongo-keyfile"
```

(O UID 999 é o do usuário `mongodb` dentro da imagem oficial.)

### 6.2 `infra/mongo/init-replica.sh`

```bash
#!/usr/bin/env bash
# Idempotente: pode rodar a cada "docker compose up" sem estragar nada.
set -euo pipefail
MONGO="mongosh --quiet --host mongo -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD --authenticationDatabase admin"

echo "[init] verificando replica set..."
if ! $MONGO --eval 'rs.status().ok' 2>/dev/null | grep -q 1; then
  echo "[init] iniciando replica set $MONGO_REPLSET"
  $MONGO --eval "rs.initiate({_id: '$MONGO_REPLSET', members: [{ _id: 0, host: 'mongo:27017' }]})"
  # espera virar PRIMARY
  for i in $(seq 1 30); do
    if $MONGO --eval 'db.hello().isWritablePrimary' | grep -q true; then break; fi
    sleep 1
  done
fi

echo "[init] garantindo usuário da aplicação"
$MONGO --eval "
  const d = db.getSiblingDB('$MONGO_DB');
  if (!d.getUser('$MONGO_APP_USER')) {
    d.createUser({ user: '$MONGO_APP_USER', pwd: '$MONGO_APP_PASSWORD',
                   roles: [{ role: 'readWrite', db: '$MONGO_DB' }] });
    print('usuario criado');
  } else { print('usuario ja existe'); }
"
echo "[init] ok"
```

> **Por que `host: 'mongo:27017'`:** os clientes dentro da rede Docker resolvem `mongo`. Se um dia for preciso conectar de fora (Compass em dev), use `directConnection=true` na URI (`mongodb://...@localhost:27017/?directConnection=true`).

### 6.3 Índices e validação de esquema

Não são criados pelo `init-replica.sh`: são criados pela **própria API na inicialização** (`OnModuleInit` do `DatabaseModule`, idempotente — `createIndex` não recria o que já existe). A lista completa de índices está no [documento 03](03-modelo-de-dados-mongodb.md), seção 5.

---

## 7. Nginx

### 7.1 `infra/web/Dockerfile`

```dockerfile
# Contexto de build = raiz do repositório (ver docker-compose.yml)
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY infra/web/nginx.conf      /etc/nginx/nginx.conf
COPY infra/web/seguranca.conf  /etc/nginx/seguranca.conf

# Mesmo conjunto de arquivos que o firebase.json publica hoje.
# (firebase.json ignora: scraps/, screenshots/, uploads/, preview-chars.html, *.md, *.txt, dotfiles)
COPY index.html   /usr/share/nginx/html/index.html
COPY robots.txt   /usr/share/nginx/html/robots.txt
COPY forca-agil/  /usr/share/nginx/html/forca-agil/

# Garante que nada de documentação/rascunho entra na imagem
RUN find /usr/share/nginx/html -name '*.md' -delete \
 && find /usr/share/nginx/html -name '.*' -mindepth 1 -prune -exec rm -rf {} +

EXPOSE 80 443
```

> `robots.txt` é copiado explicitamente porque, apesar de o `firebase.json` ignorar `*.txt`, um `robots.txt` que bloqueie indexação é desejável num site interno. Confirme o conteúdo dele na Tarefa 1.3.

`infra/web/.dockerignore` **não se aplica** quando o contexto é a raiz — crie um `.dockerignore` **na raiz do repositório** com:
```
.git
.github
node_modules
backend
tools
docs
scraps
screenshots
uploads
preview-chars.html
*.md
PREVIEW_URL_V3.txt
```

### 7.2 `infra/web/nginx.conf`

```nginx
worker_processes auto;
events { worker_connections 2048; }

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;
  sendfile      on;
  server_tokens off;
  client_max_body_size 5m;          # maior payload hoje: roteiros/apostas grandes; ajustar se necessário

  log_format json escape=json '{"t":"$time_iso8601","ip":"$remote_addr","m":"$request_method",'
                              '"u":"$request_uri","s":$status,"b":$body_bytes_sent,'
                              '"rt":$request_time,"ua":"$http_user_agent"}';
  access_log /dev/stdout json;
  error_log  /dev/stderr warn;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  map $http_upgrade $connection_upgrade { default upgrade; '' close; }

  upstream api { server api:3000; keepalive 32; }

  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    http2 on;
    server_name _;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    root /usr/share/nginx/html;

    # ---- API REST ----
    location /api/ {
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Host              $host;
      proxy_set_header X-Real-IP         $remote_addr;
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Connection        "";
      proxy_read_timeout 60s;
      add_header Cache-Control "no-store" always;
    }

    # ---- Tempo real (Socket.IO) ----
    location /socket.io/ {
      proxy_pass http://api;
      proxy_http_version 1.1;
      proxy_set_header Upgrade           $http_upgrade;
      proxy_set_header Connection        $connection_upgrade;
      proxy_set_header Host              $host;
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_read_timeout 3600s;          # conexão longa
      proxy_send_timeout 3600s;
    }

    # ---- Site estático (reproduz firebase.json) ----
    location ~* \.(js|css)$ {
      add_header Cache-Control "no-cache" always;
      include /etc/nginx/seguranca.conf;
      try_files $uri =404;
    }

    location = /index.html {
      add_header Cache-Control "no-cache" always;
      include /etc/nginx/seguranca.conf;
    }

    location / {
      add_header Cache-Control "no-cache" always;
      include /etc/nginx/seguranca.conf;
      try_files $uri $uri/ /index.html;   # equivalente ao rewrite "**" → /index.html
    }
  }
}
```

### 7.3 `infra/web/seguranca.conf`

```nginx
# CSP de hoje (firebase.json) liberava gstatic.com, *.firebaseio.com, googleapis e Google Fonts.
# Depois da migração TUDO é servido pelo próprio domínio. Fontes passam a ser locais (documento 06).
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' wss://$host; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

> **Atenção à CSP:**
> - `camera=()`: o site só **gera** o QR Code do check-in (`admin.js` l. 3888); quem lê é o app de câmera do celular, que abre o link `#checkin?turma=<t>`. O site nunca acessa a câmera.
> - `img-src ... blob:` porque `html2pdf` e a geração de certificado (canvas → PNG/PDF em `certif.js`) trabalham com imagens em memória; confirme nos testes de certificado (documento 09).
> - Qualquer violação aparece no console do navegador como `Refused to ...` — os testes Playwright devem falhar se houver violação de CSP (documento 09, seção 4).
> - `add_header` dentro de um `location` **substitui** os herdados; por isso o `include seguranca.conf` é repetido em cada `location` do site.

---

## 8. Backup e restauração

### 8.1 `infra/backup/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
DATA=$(date +%Y-%m-%d_%H%M)
DESTINO="/backups/forcaagil_${DATA}.archive.gz"
mongodump --host mongo --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --db "$MONGO_DB" --archive="$DESTINO" --gzip
echo "[backup] gerado $DESTINO ($(du -h "$DESTINO" | cut -f1))"
find /backups -name 'forcaagil_*.archive.gz' -mtime +"${BACKUP_RETENCAO_DIAS:-30}" -delete
```

### 8.2 Alternativa com cron do host

```bash
# crontab -e (usuário forcaagil) — todo dia às 02:30
30 2 * * * cd /opt/forcaagil/app/infra && docker compose exec -T mongo bash -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db forcaagil --archive --gzip' > /opt/forcaagil/backups/forcaagil_$(date +\%F).archive.gz 2>>/opt/forcaagil/logs/backup.log
```

### 8.3 `infra/backup/restore.sh`

```bash
#!/usr/bin/env bash
# Uso: ./restore.sh /opt/forcaagil/backups/forcaagil_2026-10-01_0230.archive.gz
# ATENÇÃO: --drop apaga as coleções atuais antes de restaurar.
set -euo pipefail
ARQ="$1"
read -rp "Isto vai SUBSTITUIR o banco forcaagil por $ARQ. Digite RESTAURAR para continuar: " OK
[ "$OK" = "RESTAURAR" ] || { echo "cancelado"; exit 1; }
docker compose exec -T mongo bash -c \
  'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop --nsInclude="forcaagil.*"' < "$ARQ"
echo "restaurado. Reinicie a API: docker compose restart api"
```

### 8.4 Política

- Diário, retenção 30 dias local + cópia para o backup corporativo (pendência P-08).
- **Teste de restauração mensal** em homologação (Tarefa 10.2 do plano). Backup que nunca foi restaurado não é backup.
- Antes de **todo deploy** de produção, o `deploy.sh` roda um backup extra (documento 10).

---

## 9. Logs e monitoramento

- Todos os containers logam em **stdout/stderr** (driver `json-file` com rotação — `max-size 20m`, `max-file 5`).
- API: logs JSON via `nestjs-pino` (campos: `nivel`, `hora`, `reqId`, `usuario` (emailKey), `metodo`, `rota`, `status`, `ms`). **Nunca** logar senha, cookie, token de verificação ou corpo de `/api/auth/*`.
- Ver logs: `docker compose logs -f --tail=200 api`.
- Se a empresa tem coletor (ELK, Graylog, Loki, Splunk), trocar o driver de log ou montar um agente — pendência P-09.
- Monitoramento mínimo: checar `https://<dominio>/api/health/ready` a cada 1 min (Zabbix/Nagios/Uptime Kuma interno). Alertar a equipe se falhar 3 vezes seguidas — **principalmente em dias de oficina**.

---

## 10. Operação do dia a dia (cola rápida)

| Tarefa | Comando (dentro de `/opt/forcaagil/app/infra`) |
|---|---|
| Ver estado | `docker compose -f docker-compose.yml -f docker-compose.prod.yml ps` |
| Logs da API | `docker compose ... logs -f --tail=200 api` |
| Reiniciar API | `docker compose ... restart api` |
| Shell no Mongo | `docker compose ... exec mongo mongosh -u "$MONGO_ROOT_USER" -p --authenticationDatabase admin forcaagil` |
| Backup agora | `docker compose ... exec backup bash /backup.sh` |
| Atualizar versão | `TAG_IMAGEM=<sha> ./scripts/deploy.sh` (documento 10) |
| Voltar versão | `./scripts/rollback.sh` (documento 10) |
| Espaço em disco | `docker system df` ; `df -h /var/lib/docker /opt/forcaagil` |
| Limpar imagens velhas | `docker image prune -a --filter "until=720h"` |

---

## 11. Checklist de infraestrutura pronta (critério de aceite da Fase 1)

- [ ] Docker e Compose instalados e habilitados no boot (`systemctl is-enabled docker` → `enabled`).
- [ ] Usuário `forcaagil`, diretórios `/opt/forcaagil/*` com permissões corretas.
- [ ] Firewall só com 22 (rede admin), 80 e 443.
- [ ] DNS interno resolvendo para o servidor; certificado instalado e válido (`curl -vI https://<dominio>` sem erro de certificado a partir de uma máquina da rede).
- [ ] `docker compose ... up -d` sobe todos os serviços *healthy*.
- [ ] `rs.status()` mostra 1 membro `PRIMARY`.
- [ ] `docker compose ... exec mongo mongosh ...` com o usuário da **aplicação** consegue ler/escrever só em `forcaagil`.
- [ ] Nenhuma porta além de 80/443 aparece em `ss -tlnp` escutando em `0.0.0.0` (exceto SSH).
- [ ] Backup manual gerado e **restaurado** com sucesso numa base de teste.
- [ ] `https://<dominio>/` abre o site (mesmo que ainda sem backend funcional) e o cabeçalho `Content-Security-Policy` aparece na resposta.
