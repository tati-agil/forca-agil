#!/usr/bin/env bash
# Mede o `npx playwright install-deps chromium` (o mesmo comando do CI) sob uma variante de
# configuração do apt. NÃO remove pacote, NÃO muda a lista, só muda timeout/retentativas.
#   uso: medir-apt.sh <variante> <cenario>
#   variante: normal | retries | timeout | retries-timeout
#   cenario : real (espelho de verdade) | trava | gotejar (espelho simulado, via proxy local)
set -u
variante=${1:?variante}; cenario=${2:-real}
RETRIES=5; TIMEOUT=5   # o runner já traz Retries=1 e Timeout=15 (/etc/apt/apt.conf.d/zz-retries)
# 'zzz-' para ser lido DEPOIS do zz-retries do runner (o último arquivo ganha); com '99-' o runner sobrescrevia a variante.
conf=/etc/apt/apt.conf.d/zzz-experimento-apt
efetivo() { apt-config dump | grep -iE '(^|::)(Retries|Timeout) ' | sort; }
echo "== configuração do apt JÁ PRESENTE no runner (antes do experimento) =="
efetivo; ls /etc/apt/apt.conf.d; grep -rHiE 'retries|timeout' /etc/apt/apt.conf.d 2>/dev/null
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
echo "== valores EFETIVOS depois do experimento =="; efetivo

if [ "$cenario" = trava ] || [ "$cenario" = gotejar ]; then
  : > /tmp/proxy-espelho.log
  nohup python3 "$(dirname "$0")/proxy-espelho.py" "$cenario" 8899 >/tmp/proxy.out 2>&1 &
  sleep 2
fi

ef_ret=$(apt-config dump | sed -n 's/^Acquire::Retries "\(.*\)";/\1/p'); ef_to=$(apt-config dump | sed -n 's/^Acquire::http::Timeout "\(.*\)";/\1/p')
esp_ret=1; esp_to=15
case "$variante" in retries|retries-timeout) esp_ret=$RETRIES ;; esac
case "$variante" in timeout|retries-timeout) esp_to=$TIMEOUT ;; esac
aplicou=ok; { [ "$ef_ret" = "$esp_ret" ] && [ "$ef_to" = "$esp_to" ]; } || aplicou="NAO-APLICOU(esperado ret=$esp_ret to=$esp_to)"
echo "efetivo: Retries=$ef_ret Timeout=$ef_to -> $aplicou"
export EFETIVO="Retries=$ef_ret Timeout=${ef_to}s [$aplicou]"
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
retentativas = sum(n - 1 for u, n in pedidos.items() if u.split('%0a')[0].endswith('.deb'))
falhas = len(re.findall(r'400%20URI%20Failure', log))
transit = len(re.findall(r'Transient-Failure:%20true', log))
fetched = re.findall(r'^\d+ Fetched ([\d.,]+ \S+) in (\S+(?: \S+)*?) \(([\d.,]+ \S+/s)\)', log, re.M)
setting_up = len(re.findall(r'^\d+ Setting up ', log, re.M))
erros = [l for l in log.splitlines() if re.search(r'\d+ (Err:|E: |W: Failed|Ign:\d+ .*deb)', l)][:5]
prox = ''
if os.path.exists('/tmp/proxy-espelho.log'):
    pl = open('/tmp/proxy-espelho.log').read().splitlines()
    prox = ' | proxy: ' + ', '.join('%s=%d' % (k, sum(1 for l in pl if len(l.split()) > 1 and l.split()[1].startswith(k))) for k in ('TRAVOU', 'GOTEJANDO', 'CORTADO', 'serviu', 'tunel', 'ERRO'))
gaps = []
if os.path.exists('/tmp/proxy-espelho.log'):
    ev = [l.split(None, 3) for l in open('/tmp/proxy-espelho.log').read().splitlines() if len(l.split()) > 3]
    for i, e in enumerate(ev):
        if e[1] == 'TRAVOU':
            t1 = float(e[0].rstrip('s')); nome = e[3]
            for f in ev[i + 1:]:
                if f[3].split()[-1] == nome and f[2] == '#2':
                    gaps.append(float(f[0].rstrip('s')) - t1); break
gap_txt = (' · travada→nova tentativa: ' + '/'.join('%.0fs' % g for g in gaps)) if gaps else ''
msg = ('[' + os.environ.get('EFETIVO', '?') + '] apt %ss · rc=%s · pacotes instalados %s/%d (faltando %s) · "Setting up" %d · retentativas de .deb %d · '
       'falhas %d (transitórias %d) · Fetched %s%s%s') % (
       seg, rc, ok, int(ok) + int(falta), falta, setting_up, retentativas, falhas, transit,
       ('; '.join(' '.join(f) for f in fetched) or '-'), gap_txt, prox)
print('::notice title=Experimento apt %s/%s::%s' % (variante, cenario, msg))
open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a').write('### %s / %s\n- %s\n' % (variante, cenario, msg) + ''.join('- `%s`\n' % e for e in erros))
PY
echo "== últimas linhas do apt =="; tail -n 25 /tmp/apt.log | cut -c1-220
exit 0
