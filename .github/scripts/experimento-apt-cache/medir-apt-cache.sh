#!/usr/bin/env bash
# EXPERIMENTO (branch experimento/apt-retentativas, nunca vai para a main): cache dos .deb do apt.
# Mede o MESMO comando do CI (`npx playwright install-deps chromium`), sem mudar a lista de pacotes.
# O cache é só um "pool" de .deb copiado para /var/cache/apt/archives ANTES do apt rodar; o apt
# decide sozinho o que reaproveitar (confere versão e hash contra o índice assinado).
#   uso: medir-apt-cache.sh <modo>
#     vazio        — sem cache (é o CI de hoje)
#     semear       — sem cache; no fim, o workflow SALVA os .deb baixados
#     cheio        — com o cache restaurado
#     versao-nova  — cache restaurado, mas 2 pacotes trocados por uma versão ANTIGA (espelho "mais novo que o cache")
#     invalido     — cache restaurado, mas 2 .deb apagados, 1 truncado, 1 vazio, 1 corrompido (mesmo tamanho)
set -u
modo=${1:?modo}
ARQ=/var/cache/apt/archives
POOL=/tmp/apt-debs
mkdir -p "$POOL"
# o apt do runner pode apagar os .deb depois de instalar; garante que ele os mantenha (só para o experimento poder guardá-los)
printf '%s\n' 'Debug::pkgAcquire::Worker "true";' 'APT::Keep-Downloaded-Packages "true";' | sudo tee /etc/apt/apt.conf.d/zzz-experimento-apt-cache >/dev/null
echo "== apt efetivo =="; apt-config dump | grep -iE '^(Acquire::Retries|Acquire::http::Timeout|APT::Keep-Downloaded-Packages) '

sudo rm -f "$ARQ"/*.deb
n_pool=$(ls "$POOL"/*.deb 2>/dev/null | wc -l)
[ "$n_pool" -gt 0 ] && sudo cp "$POOL"/*.deb "$ARQ"/
echo "pool restaurado: $n_pool .deb, $(du -sh "$POOL" | cut -f1)"
extra=""

case "$modo" in
  versao-nova)
    sudo apt-get update -qq >/dev/null 2>&1
    trocados=""
    for p in libgbm1 libglx-mesa0; do
      cand=$(apt-cache policy "$p" | sed -n 's/^ *Candidate: //p')
      velha=$(apt-cache madison "$p" | awk '{print $3}' | grep -vxF "$cand" | head -1)
      if [ -n "$velha" ]; then
        ( cd /tmp && apt-get download "$p=$velha" >/dev/null 2>&1 )
        if ls /tmp/${p}_*.deb >/dev/null 2>&1; then
          sudo rm -f "$ARQ/${p}_"*.deb; sudo cp /tmp/${p}_*.deb "$ARQ"/; rm -f /tmp/${p}_*.deb
          trocados="$trocados $p(cache=$velha,espelho=$cand)"
        fi
      fi
    done
    extra="trocados:${trocados:- NENHUM(sem versão antiga no espelho)}"
    echo "$extra"
    ;;
  invalido)
    mapfile -t L < <(ls "$ARQ"/*.deb | sort)
    sudo rm -f "${L[0]}" "${L[1]}"                                  # ausentes
    sudo truncate -s $(( $(stat -c %s "${L[2]}") / 2 )) "${L[2]}"    # truncado
    sudo truncate -s 0 "${L[3]}"                                     # vazio
    printf 'X' | sudo dd of="${L[4]}" bs=1 seek=1000 count=1 conv=notrunc 2>/dev/null   # mesmo tamanho, conteúdo corrompido
    extra="estragados: ausentes=$(basename "${L[0]}"),$(basename "${L[1]}") truncado=$(basename "${L[2]}") vazio=$(basename "${L[3]}") corrompido=$(basename "${L[4]}")"
    echo "$extra"
    ;;
esac

cd /tmp/pw-deps
pacotes=$(npx playwright install-deps --dry-run chromium 2>&1 | grep -o 'apt-get install -y --no-install-recommends .*' | sed 's/apt-get install -y --no-install-recommends //; s/"$//')
n_antes=$(ls "$ARQ"/*.deb 2>/dev/null | wc -l)

t0=$(date +%s)
npx playwright install-deps chromium 2>&1 | while IFS= read -r l; do printf '%(%s)T %s\n' -1 "$l"; done > /tmp/apt.log
rc=${PIPESTATUS[0]}
seg=$(( $(date +%s) - t0 ))

faltando=0; instalados=0; : > /tmp/versoes.txt
for p in $pacotes; do
  if dpkg -s "$p" 2>/dev/null | grep -q '^Status: install ok installed'; then instalados=$((instalados+1)); else faltando=$((faltando+1)); fi
  dpkg-query -W -f='${Package}=${Version}\n' "$p" 2>/dev/null >> /tmp/versoes.txt
done
sort -o /tmp/versoes.txt /tmp/versoes.txt
hash=$(sha256sum /tmp/versoes.txt | cut -c1-12)

# versao-nova: o instalado é o do espelho (o mais novo) e não o antigo do cache?
if [ "$modo" = versao-nova ]; then
  for p in libgbm1 libglx-mesa0; do
    cand=$(apt-cache policy "$p" | sed -n 's/^ *Candidate: //p'); inst=$(dpkg-query -W -f='${Version}' "$p")
    extra="$extra | $p instalado=$inst candidato=$cand $([ "$inst" = "$cand" ] && echo IGUAL-ao-espelho || echo DIFERENTE)"
  done
fi

# guarda os .deb novos no pool (o workflow decide se salva)
sudo cp -n "$ARQ"/*.deb "$POOL"/ 2>/dev/null; sudo chown -R "$(id -u):$(id -g)" "$POOL"

python3 - "$modo" "$rc" "$seg" "$instalados" "$faltando" "$hash" "$n_pool" "$n_antes" "$extra" <<'PY'
import re, sys, os
modo, rc, seg, ok, falta, h, n_pool, n_antes, extra = sys.argv[1:10]
log = open('/tmp/apt.log', errors='replace').read()
uris = set(re.findall(r'600%20URI%20Acquire%0aURI:%20(\S+?)%0a', log))
debs = {u.split('%0a')[0] for u in uris if u.split('%0a')[0].endswith('.deb')}
setting = len(re.findall(r'^\d+ Setting up ', log, re.M))
reuso = max(setting - len(debs), 0)
need = re.search(r'Need to get ([0-9.,]+ ?[kMG]?B(?:/[0-9.,]+ ?[kMG]?B)?) of archives', log)
fetched = re.findall(r'^\d+ Fetched ([\d.,]+ \S+) in (\S+(?: \S+)*?) \(', log, re.M)
indices = ' '.join(fetched[0]) if fetched else '-'
pacotes = ' '.join(fetched[1]) if len(fetched) > 1 else 'nada baixado'
falhas = len(re.findall(r'400%20URI%20Failure', log))
avisos = [l[:160] for l in log.splitlines() if re.search(r'(Hash Sum mismatch|corrupt|Size mismatch|is not a valid|E: )', l)][:4]
msg = ('%s · apt %ss · rc=%s · instalados %s/%d (faltando %s) · versões sha=%s · "Setting up" %d · .deb baixados %d · .deb reaproveitados %d · '
       'cache antes do apt: %s .deb (pool %s) · "Need to get" %s · índices(update) %s · pacotes(install) %s · falhas %d%s%s') % (
       modo, seg, rc, ok, int(ok) + int(falta), falta, h, setting, len(debs), reuso, n_antes, n_pool,
       need.group(1) if need else '-', indices, pacotes, falhas, (' · ' + extra) if extra else '',
       (' · AVISOS: ' + ' // '.join(avisos)) if avisos else '')
print('::notice title=Experimento cache .deb %s::%s' % (modo, msg))
open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a').write('### %s\n- %s\n\n<details><summary>versões instaladas</summary>\n\n```\n%s\n```\n</details>\n' % (modo, msg, open('/tmp/versoes.txt').read()))
PY
tail -n 12 /tmp/apt.log | cut -c1-200
exit 0
