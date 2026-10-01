#!/usr/bin/env bash
# Mede o `npx playwright install-deps chromium` (o mesmo comando do CI) sob uma variante de
# configuração do apt. NÃO remove pacote, NÃO muda a lista, só muda timeout/retentativas.
#   uso: medir-apt.sh <variante> <cenario>
#   variante: normal | retries | timeout | retries-timeout
#   cenario : real (espelho de verdade) | trava | gotejar (espelho simulado, via proxy local)
set -u
variante=${1:?variante}; cenario=${2:-real}
RETRIES=3; TIMEOUT=15
conf=/etc/apt/apt.conf.d/99experimento-apt
{
  echo 'Debug::pkgAcquire::Worker "true";'   # só para contar retentativas no log; não muda o comportamento
  case "$variante" in
    retries|retries-timeout) echo "Acquire::Retries \"$RETRIES\";" ;;
  esac
  case "$variante" in
    timeout|retries-timeout) echo "Acquire::http::Timeout \"$TIMEOUT\";"; echo "Acquire::https::Timeout \"$TIMEOUT\";" ;;
  esac
  case "$cenario" in
    trava|gotejar) echo 'Acquire::http::Proxy "http://127.0.0.1:8899/";' ;;
  esac
} | sudo tee "$conf" >/dev/null
echo "== configuração do apt desta execução ($variante / $cenario) =="; cat "$conf"

if [ "$cenario" = trava ] || [ "$cenario" = gotejar ]; then
  : > /tmp/proxy-espelho.log
  nohup python3 "$(dirname "$0")/proxy-espelho.py" "$cenario" 8899 >/tmp/proxy.out 2>&1 &
  sleep 2
fi

cd /tmp/pw-deps
# lista de pacotes que o Playwright manda instalar (para conferir depois que TODOS ficaram instalados)
pacotes=$(npx playwright install-deps --dry-run chromium 2>&1 | grep -o 'apt-get install -y --no-install-recommends .*' | sed 's/apt-get install -y --no-install-recommends //; s/"$//')
echo "pacotes pedidos: $(echo $pacotes | wc -w)"

t0=$(date +%s)
npx playwright install-deps chromium 2>&1 | while IFS= read -r l; do printf '%(%s)T %s\n' -1 "$l"; done > /tmp/apt.log
rc=${PIPESTATUS[0]}
seg=$(( $(date +%s) - t0 ))

faltando=0; instalados=0
for p in $pacotes; do
  if dpkg -s "$p" 2>/dev/null | grep -q '^Status: install ok installed'; then instalados=$((instalados+1)); else faltando=$((faltando+1)); echo "NÃO INSTALADO: $p"; fi
done

python3 - "$variante" "$cenario" "$rc" "$seg" "$instalados" "$faltando" <<'PY'
import re, sys, collections, os
variante, cenario, rc, seg, ok, falta = sys.argv[1:7]
log = open('/tmp/apt.log', errors='replace').read()
uris = re.findall(r'600%20URI%20Acquire%0aURI:%20(\S+?)%0a', log)
pedidos = collections.Counter(uris)
retentativas = sum(n - 1 for n in pedidos.values())
falhas = len(re.findall(r'400%20URI%20Failure', log))
transit = len(re.findall(r'Transient-Failure:%20true', log))
fetched = re.findall(r'^\d+ Fetched ([\d.,]+ \S+) in (\S+(?: \S+)*?) \(([\d.,]+ \S+/s)\)', log, re.M)
setting_up = len(re.findall(r'^\d+ Setting up ', log, re.M))
erros = [l for l in log.splitlines() if re.search(r'\d+ (Err:|E: |W: Failed|Ign:\d+ .*deb)', l)][:5]
prox = ''
if os.path.exists('/tmp/proxy-espelho.log'):
    pl = open('/tmp/proxy-espelho.log').read().splitlines()
    prox = ' | proxy: ' + ', '.join('%s=%d' % (k, sum(1 for l in pl if l.split()[1].startswith(k))) for k in ('TRAVOU', 'GOTEJANDO', 'CORTADO', 'serviu'))
msg = ('apt %ss · rc=%s · pacotes instalados %s/%d (faltando %s) · "Setting up" %d · retentativas %d · '
       'falhas %d (transitórias %d) · Fetched %s%s') % (
       seg, rc, ok, int(ok) + int(falta), falta, setting_up, retentativas, falhas, transit,
       ('; '.join(' '.join(f) for f in fetched) or '-'), prox)
print('::notice title=Experimento apt %s/%s::%s' % (variante, cenario, msg))
open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a').write('### %s / %s\n- %s\n' % (variante, cenario, msg) + ''.join('- `%s`\n' % e for e in erros))
PY
echo "== últimas linhas do apt =="; tail -n 25 /tmp/apt.log | cut -c1-220
exit 0
