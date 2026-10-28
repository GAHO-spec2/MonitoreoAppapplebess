// Prueba pública de disponibilidad y recursos. No autentica usuarios ni lee datos privados.
const base = new URL(process.env.MONITOR_SITE_URL || 'https://gaho-spec2.github.io/MonitoreoAppapplebess/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
async function get(resource, kind) {
  const url = new URL(resource, base);
  let lastError;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const contentType=response.headers.get('content-type')||'';
      const body=await response.text();
      if (!body.trim()) throw Error('Respuesta vacía');
      if (kind==='html' && !/<html[\s>]/i.test(body)) throw Error('HTML inválido');
      if (kind==='js' && (/text\/html/.test(contentType)||/<html[\s>]/i.test(body))) throw Error('Se recibió HTML en lugar de JavaScript');
      console.log(`OK ${url.pathname}`);
      return body;
    } catch(error) {lastError=error;}
  }
  throw Error(`${url}: ${lastError.message}`);
}
(async()=>{
  const pages=['index.html','login-admin.html','dashboard.html','tickets.html','alertas.html','clientes.html','cliente-detalle.html','ticket-detalle.html','canjes.html','gerentes.html','auditoria.html','estadisticas.html','configuracion.html'];
  const resources=new Map();
  // Limitar paralelismo para evitar picos de solicitudes.
  for(let i=0;i<pages.length;i+=4) {
    const results=await Promise.all(pages.slice(i,i+4).map(file=>get(file,'html')));
    for(const html of results) for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url=new URL(m[1],base);
      if(url.origin===base.origin && /\.(js|css|svg)$/.test(url.pathname))resources.set(url.href,url.pathname.endsWith('.js')?'js':'asset');
    }
  }
  const entries=[...resources];
  for(let i=0;i<entries.length;i+=4) await Promise.all(entries.slice(i,i+4).map(([url,kind])=>get(url,kind)));
  console.log('Sitio público y recursos disponibles. Firebase, OCR, monedero y canjes reales requieren una prueba autenticada independiente.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
