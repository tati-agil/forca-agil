#!/usr/bin/env python3
"""Proxy HTTP local que SIMULA um espelho do apt com defeito, de forma determinística.

Só para o experimento de timeout/retentativas do apt (branch experimento/apt-retentativas).
Repassa tudo ao espelho de verdade, exceto o 1º pedido de certos .deb:

  trava    — o 1º pedido dos 3 primeiros .deb fica CALADO (aceita a conexão e não responde
             nada) por 180 s. Os pedidos seguintes (as retentativas) passam normalmente.
  gotejar  — o 1º pedido dos 2 primeiros .deb com mais de 1 MB sai a 100 kB/s (chega dado,
             só que devagar). Simula o "espelho lento" que vimos de verdade (74 kB/s).
  passa    — repassa tudo, sem defeito (controle).

Escreve um registro de cada pedido em /tmp/proxy-espelho.log (usado para contar retentativas:
mesmo .deb pedido mais de uma vez).
"""
import http.client, select, socket, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODO = sys.argv[1] if len(sys.argv) > 1 else 'passa'
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 8899
HOP = {'connection', 'proxy-connection', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'}
TRAVA_SEGUNDOS = 180
GOTEJAR_BYTES_POR_S = 100_000

lock = threading.Lock()
vistos = {}        # url -> quantas vezes pedida
travados = set()   # urls que já receberam o defeito "trava"
gotejados = set()  # urls que já receberam o defeito "gotejar"
t0 = time.time()
log = open('/tmp/proxy-espelho.log', 'a', buffering=1)

def registra(msg):
    log.write('%7.1fs %s\n' % (time.time() - t0, msg))

class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass

    def _serve(self, corpo):
        u = urllib.parse.urlsplit(self.path)
        host = u.netloc or self.headers.get('Host')
        caminho = (u.path or '/') + ('?' + u.query if u.query else '')
        url = host + caminho
        eh_deb = caminho.endswith('.deb')
        with lock:
            vistos[url] = vistos.get(url, 0) + 1
            n = vistos[url]
            trava = (MODO == 'trava' and eh_deb and corpo and n == 1 and len(travados) < 3)
            if trava: travados.add(url)
        nome = caminho.rsplit('/', 1)[-1]
        if trava:
            registra('TRAVOU    #%d %s' % (n, nome))
            time.sleep(TRAVA_SEGUNDOS)
            self.close_connection = True
            return
        try:
            c = http.client.HTTPConnection(host, timeout=60)
            h = {k: v for k, v in self.headers.items() if k.lower() not in HOP and k.lower() != 'host'}
            c.request(self.command, caminho, headers=h)
            r = c.getresponse()
        except Exception as e:
            registra('ERRO      #%d %s %r' % (n, nome, e))
            self.send_error(502)
            return
        tam = r.getheader('Content-Length')
        gotejar = False
        if MODO == 'gotejar' and eh_deb and corpo and tam and int(tam) > 1_000_000:
            with lock:
                if url not in gotejados and len(gotejados) < 2:
                    gotejados.add(url); gotejar = True
        self.send_response(r.status, r.reason)
        for k, v in r.getheaders():
            if k.lower() not in HOP: self.send_header(k, v)
        if tam is None: self.send_header('Connection', 'close'); self.close_connection = True
        self.end_headers()
        registra('%s #%d %s %s' % ('GOTEJANDO' if gotejar else 'serviu   ', n, r.status, nome))
        if not corpo: return
        try:
            while True:
                b = r.read(10_000 if gotejar else 65536)
                if not b: break
                self.wfile.write(b)
                if gotejar: time.sleep(len(b) / GOTEJAR_BYTES_POR_S)
        except (BrokenPipeError, ConnectionResetError):
            registra('CORTADO   #%d %s (o apt desistiu)' % (n, nome))
            self.close_connection = True

    def do_CONNECT(self):
        # HTTPS: só abre o túnel, sem defeito nenhum (o defeito simulado é só no HTTP).
        host, _, porta = self.path.partition(':')
        try:
            up = socket.create_connection((host, int(porta or 443)), timeout=30)
        except Exception as e:
            registra('ERRO      CONNECT %s %r' % (self.path, e))
            self.send_error(502)
            return
        self.send_response(200, 'Connection established')
        self.end_headers()
        registra('tunel     CONNECT %s' % self.path)
        a, b = self.connection, up
        try:
            while True:
                r, _, _ = select.select([a, b], [], [], 120)
                if not r: break
                fim = False
                for s in r:
                    d = s.recv(65536)
                    if not d: fim = True; break
                    (b if s is a else a).sendall(d)
                if fim: break
        except OSError:
            pass
        finally:
            up.close()
            self.close_connection = True

    def do_GET(self): self._serve(True)
    def do_HEAD(self): self._serve(False)

ThreadingHTTPServer.daemon_threads = True
registra('proxy no ar, modo=%s' % MODO)
ThreadingHTTPServer(('127.0.0.1', PORTA), H).serve_forever()
