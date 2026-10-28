const { chromium } = require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture={
 users:{u:{nombre:'Administrador de pruebas',email:'test@example.invalid',role:'sistemas'},c:{nombre:'Cliente de prueba',role:'cliente',saldoDisponible:20}},
 'users/u':{nombre:'Administrador de pruebas',email:'test@example.invalid',role:'sistemas'},
 'users/c':{nombre:'Cliente de prueba',email:'cliente@example.invalid',role:'cliente',saldoDisponible:20},
 tickets:{t:{folio:'12345',userId:'c',clienteEmail:'cliente@example.invalid',sucursal:'Applebee’s Torres',status:'pendiente_revision_manual',createdAt:1793154600000,total:500,totalValidado:0,ticketVision:{camposCorregidos:['total']}}},
 'tickets/t':{folio:'12345',userId:'c',clienteEmail:'cliente@example.invalid',sucursal:'Applebee’s Torres',status:'pendiente_revision_manual',createdAt:1793154600000,total:500,totalValidado:0},
 redemptions:{r:{userId:'c',status:'canjeado',monto:10,createdAt:1793154600000,redeemedAt:1793154600000,gerenteUid:'u'}},
 auditLogs:{l:{type:'CANJE_VALIDADO',userId:'c',createdAt:1793154600000}},
 'config/programa':{ambienteSistema:'pruebas',porcentajeMonedero:.05,maxTicketsDia:2,diasRegistro:3,vigenciaMonedero:180,toleranciaTotal:.5},
 'config/sucursales':{a:{id:'a',nombre:'Torres',ciudad:'Ciudad Juárez'}},'.info/connected':true
};
const mock=`window.__listeners=[]; const data=${JSON.stringify(fixture)};
const authMock={currentUser:{uid:'u',email:'test@example.invalid'},onAuthStateChanged(fn){setTimeout(()=>fn(this.currentUser),0);return ()=>{};},signOut:async()=>{},signInWithEmailAndPassword:async()=>({user:authMock.currentUser})};
function ref(name=''){return {on(event,cb,fail){window.__listeners.push({name,cb,fail});setTimeout(()=>cb({val:()=>data[name]||null}),0);},off(){},once:async()=>({val:()=>data[name]||null}),orderByChild(){return this},limitToLast(){return this},equalTo(){return this},push(){return{key:'log'}},update:async()=>{}}}
window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>authMock,firestore:()=>({}),storage:()=>({}),database:()=>({ref})}; firebase.database.ServerValue={TIMESTAMP:{'.sv':'timestamp'}};`;
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(file===root+'/')file=path.join(root,'index.html');try{const ext=path.extname(file);res.setHeader('content-type',ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.svg'?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('missing');}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.on('listening',r));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'application/javascript',body:route.request().url().includes('firebase-app-compat')?mock:''}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});
   for(const file of ['dashboard.html','tickets.html','alertas.html','canjes.html','clientes.html','gerentes.html','auditoria.html','estadisticas.html','configuracion.html','ticket-detalle.html?ticketKey=t','cliente-detalle.html?uid=c']){
    await page.goto(`http://127.0.0.1:${server.address().port}/${file}`);
    await page.getByText('Lecturas recibidas',{exact:true}).waitFor({timeout:5000});
    assert.equal(await page.locator('.monitor-error').count(),0,file);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`overflow ${width} ${file}`);
    if(file==='dashboard.html'&&width===1440){
      assert.equal(await page.locator('#kpiAlertas').textContent(),'1');
      await page.evaluate(()=>__listeners.find(l=>l.name==='.info/connected').cb({val:()=>false}));
      await page.getByText('Sin conexión a Realtime Database',{exact:true}).waitFor();
    }
   }
  }
  assert.deepEqual(errors,[]);console.log('22 vistas desktop/móvil sin errores, sin desbordamientos, desconexión visible.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
