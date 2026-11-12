import json, sys, argparse, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
ap=argparse.ArgumentParser(); ap.add_argument('--scenario'); ap.add_argument('--port',type=int); ap.add_argument('--web'); ap.add_argument('--fixtures'); ap.add_argument('--log')
A=ap.parse_args(); WEB=Path(A.web); SNAP=json.load(open(A.fixtures))[A.scenario]; LOG=Path(A.log)
TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2'}
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def _send(self,code,body,ctype):
        self.send_response(code); self.send_header('Content-Type',ctype); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p=urlparse(self.path).path
        if p=='/api/status':
            if A.scenario=='offline': return self._send(503,b'{"error":"down"}','application/json')
            return self._send(200,json.dumps(SNAP,ensure_ascii=False).encode(),'application/json; charset=utf-8')
        if p in('/api/report.md','/api/report.json'): return self._send(200,b'# fake\n','text/plain')
        f={'/':'index.html','/style.css':'style.css','/app.js':'app.js'}.get(p)
        if f is None and p.startswith('/fonts/') and '..' not in p: f=p.lstrip('/')
        if f is None or not (WEB/f).is_file(): return self._send(404,b'{"error":"nf"}','application/json')
        return self._send(200,(WEB/f).read_bytes(),TYPES.get(Path(f).suffix,'application/octet-stream'))
    def do_POST(self):
        p=urlparse(self.path).path; n=int(self.headers.get('Content-Length','0')); raw=self.rfile.read(n)
        try: body=json.loads(raw or b'{}')
        except Exception: body={}
        logged={k:('<redacted>' if k=='api_key' and v else v) for k,v in body.items()}
        with LOG.open('a') as fh: fh.write(json.dumps({'path':p,'body':logged})+'\n')
        now=datetime.datetime.now(datetime.timezone.utc).isoformat()
        if p=='/api/approval/decision':
            for it in SNAP['approvals']:
                if it['id']==body.get('approval_id') and it['status']=='pending':
                    it['status']='approved' if body.get('approve') else 'rejected'; it['decided_at']=now
            return self._send(202,json.dumps({'ok':True,'message':'Ação condicionada aprovada.' if body.get('approve') else 'Ação condicionada rejeitada.'}).encode(),'application/json')
        if p=='/api/campaign/stop':
            SNAP['stop_requested']=True
            return self._send(202,b'{"ok":true,"message":"Interrup\\u00e7\\u00e3o solicitada."}','application/json')
        if p=='/api/campaign/start':
            if body.get('authorization_confirmed') is not True: return self._send(400,b'{"error":"Confirme a autoriza\\u00e7\\u00e3o do alvo."}','application/json')
            SNAP['scope']={**SNAP['scope'],'target':body.get('target_url','').split('#')[0]}
            SNAP.update(running=True,events=[{'timestamp':now,'type':'campaign','phase':'scope','message':'Campanha iniciada no escopo configurado.'}],result=None,approvals=[])
            return self._send(202,b'{"ok":true,"message":"Campanha iniciada."}','application/json')
        return self._send(404,b'{}','application/json')
ThreadingHTTPServer(('127.0.0.1',A.port),H).serve_forever()
