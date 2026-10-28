const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
function harness() {
  const nodes = new Map(), events = {}, listeners = [], timers = new Map();
  let nextTimer = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '', value: '', dataset: {},
      classList: { add(){}, remove(){} }, setAttribute(){}, appendChild(){}, prepend(child){ nodes.set(child.id, child); },
      addEventListener(){}, hidden: false });
    return nodes.get(id);
  };
  const document = { body: node('body'), getElementById: node, querySelector: node,
    querySelectorAll: () => [], createElement: () => ({classList:{add(){},remove(){}},setAttribute(){}}),
    addEventListener: (name, cb) => { (events[name] ||= []).push(cb); } };
  const redirects = [], toasts = [], writes = [];
  const query = name => ({
    name, on(event, cb, fail) { listeners.push({name, cb, fail, active:true}); },
    off(event, cb) { for(const l of listeners) if(l.name===name && l.cb===cb) l.active=false; },
    orderByChild(){ return this; }, limitToLast(){ return this; }, equalTo(){ return this; },
    push(){return {key:'new-log'};}, update: async changes => { writes.push(changes); },
    once: async()=>({val:()=>({role:'admin'})})
  });
  const c = vm.createContext({ console:{error(){}}, document,
    window:{addEventListener(){},location:{replace:url=>redirects.push(url),reload(){},search:''}},
    sessionStorage:{setItem(){},getItem(){return null},removeItem(){}},confirm:()=>true,
    setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    URLSearchParams, rtdb:{ref:(name='')=>query(name)},
    firebase:{database:{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}}}
  });
  const load = name => vm.runInContext(source(name),c,{filename:name});
  load('common'); load('monitoreo'); load('auth');
  c.showToast=(...args)=>toasts.push(args); c.showLoader=()=>{}; c.hideLoader=()=>{};
  const emit=(name,value)=>{for(const l of [...listeners]) if(l.active&&l.name===name) l.cb({val:()=>value});};
  return {c,node,events,listeners,timers,redirects,toasts,writes,load,emit};
}
test('un único criterio de riesgo, incluso estados con espacios',()=>{
  const {c}=harness();
  assert.equal(c.calcularRiesgo({status:' pendiente_revision_manual '}).nivel,'medio');
  assert.equal(c.calcularRiesgo({status:'aprobado',intentosValidacion:2}).score,40);
  assert.equal(c.calcularRiesgo({status:'anulado'}).nivel,'alto');
  assert.doesNotThrow(()=>c.calcularRiesgo({ticketVision:{camposCorregidos:'incorrecto'}}));
});
test('un total validado de cero se conserva y números inválidos no propagan NaN',()=>{
  const {c}=harness();
  assert.equal(c.totalTicket({total:500,totalValidado:0}),0);
  assert.equal(c.totalTicket({total:500}),500);
  assert.equal(c.money('incorrecto'),'$0.00');
});
test('fechas locales, fechas de ticket y timestamps inválidos',()=>{
  const {c}=harness();
  assert.equal(c.fechaLocal(Date.parse('2026-10-28T02:30:00Z')),'2026-10-27');
  assert.equal(c.formatDateOnly('2026-10-28'),'28/10/2026');
  assert.equal(c.fechaLocal('inválido'),'Sin fecha');
  assert.equal(c.formatDateTime({}),'---');
});
test('identidad canónica y normalización desde snapshots',()=>{
  const {c}=harness();const rows=c.registros({real:{ticketKey:'falso',status:' APROBADO '},broken:null},'ticketKey');
  assert.equal(rows.length,1);assert.equal(rows[0].ticketKey,'real');assert.equal(rows[0].status,'aprobado');
  assert.equal(c.claveFirebaseValida('../users'),false);
});
test('el panel espera lecturas, detecta permisos denegados y desconexión, y limpia listeners',()=>{
  const h=harness(),{c,node}=h;
  c.iniciarMonitoreo();c.escucharDatos(c.rtdb.ref('tickets'),()=>{},'tickets');
  h.emit('.info/connected',true);
  assert.match(node('estadoMonitoreo').innerHTML,/Esperando datos/);
  h.emit('tickets',{});assert.match(node('estadoMonitoreo').innerHTML,/Lecturas recibidas/);
  h.listeners.find(l=>l.name==='tickets').fail({code:'PERMISSION_DENIED'});
  assert.match(node('estadoMonitoreo').innerHTML,/Permiso denegado/);
  h.emit('tickets',{});h.emit('.info/connected',false);
  assert.match(node('estadoMonitoreo').innerHTML,/desactualizada/);
  c.limpiarMonitoreo();assert.ok(h.listeners.every(l=>!l.active));assert.equal(h.timers.size,0);
});
test('la ausencia de respuesta y los errores de render no se muestran como éxito',()=>{
  const h=harness();h.c.escucharDatos(h.c.rtdb.ref('tickets'),()=>{throw Error('fallo')},'tickets');
  for(const fn of [...h.timers.values()]) fn();
  assert.match(h.node('estadoMonitoreo').innerHTML,/No se pudo confirmar/);
  h.emit('.info/connected',true);h.emit('tickets',{});
  assert.doesNotMatch(h.node('estadoMonitoreo').innerHTML,/<strong>Lecturas recibidas/);
});
test('usuarios inactivos y roles ajenos no reciben acceso',async()=>{
  for(const profile of [{role:'gerente',activo:false},{role:'cliente'},null]) {
    const h=harness();h.c.auth={onAuthStateChanged:fn=>fn({uid:'u'}),signOut:async()=>{}};
    const pending=h.c.esperarLogin();h.emit('users/u',profile);
    assert.equal(await pending,null);assert.equal(h.c.getUsuarioActual(),null);assert.equal(h.redirects.at(-1),'login-admin.html');
  }
});
test('revocación de perfil en vivo detiene lecturas',async()=>{
  const h=harness();h.c.auth={onAuthStateChanged:fn=>fn({uid:'u',email:'u@example.invalid'}),signOut:async()=>{}};
  const pending=h.c.esperarLogin();h.emit('users/u',{role:' SISTEMAS ',nombre:'<img>'});
  assert.equal((await pending).role,'sistemas');assert.equal(h.node('nombreUsuario').textContent,'<img>');
  h.c.escucharDatos(h.c.rtdb.ref('tickets'),()=>{},'tickets');h.emit('users/u',{role:'sistemas',activo:false});
  assert.equal(h.c.getUsuarioActual(),null);assert.ok(h.listeners.every(l=>!l.active));
});
test('Dashboard y Alertas cuentan los mismos tickets y conservan cero validado',()=>{
  const data={a:{status:'pendiente_revision_manual'},b:{status:'aprobado',total:500,totalValidado:0,intentosValidacion:2}};
  const d=harness();d.load('dashboard');d.c.cargarKPIs();d.emit('tickets',data);
  assert.equal(d.node('kpiAlertas').textContent,2);assert.equal(d.node('kpiVenta').textContent,'$0.00');
  const a=harness();a.load('alertas');a.c.cargarAlertas();a.emit('tickets',data);
  assert.equal(a.node('kpiAlertasTotal').textContent,2);
});
test('todas las vistas de monitoreo procesan snapshots vacíos y datos representativos',()=>{
  for(const [file,fn] of [['dashboard','cargarKPIs'],['tickets','cargarTickets'],['alertas','cargarAlertas'],['canjes','cargarCanjes'],['auditoria','cargarAuditoria'],['clientes','cargarClientes'],['gerentes','cargarGerentes'],['estadisticas','cargarEstadisticas']]) {
    const h=harness();h.load(file);h.c[fn]();
    for(const name of new Set(h.listeners.map(l=>l.name))) h.emit(name,{});
    const row={createdAt:Date.parse('2026-10-28T02:30:00Z'),status:'aprobado',total:500,totalValidado:0,role:'gerente',nombre:'Prueba',ticketVision:{camposCorregidos:['total']}};
    for(const name of new Set(h.listeners.map(l=>l.name))) h.emit(name,{a:row});
    assert.ok(![...h.node('estadoMonitoreo').innerHTML.matchAll(/Lecturas con errores/g)].length, file);
    // El monitor puede estar desconectado en esta simulación; revisar errores internos directamente.
    assert.equal(vm.runInContext('[...fuentesMonitoreo.values()].filter(f=>f.error).length',h.c),0,file);
  }
});
test('filtros se mantienen al recibir actualizaciones en vivo',()=>{
  const h=harness();h.load('tickets');h.node('buscarTicket').value='BUSCADO';h.c.cargarTickets();
  h.emit('tickets',{a:{folio:'OTRO',status:'aprobado'}});assert.doesNotMatch(h.node('tablaTickets').innerHTML,/OTRO/);
  h.emit('tickets',{a:{folio:'OTRO'},b:{folio:'BUSCADO'}});assert.match(h.node('tablaTickets').innerHTML,/BUSCADO/);assert.doesNotMatch(h.node('tablaTickets').innerHTML,/OTRO/);
});
test('las claves y los estados no se insertan en código ejecutable',()=>{
  const h=harness();h.load('tickets');h.c.pintarTablaTickets([{ticketKey:"x');alert(1);//",status:'<img src=x onerror=alert(1)>'}]);
  assert.doesNotMatch(h.node('tablaTickets').innerHTML,/onclick=/);
  assert.doesNotMatch(h.node('tablaTickets').innerHTML,/<img/);
  assert.match(h.node('tablaTickets').innerHTML,/data-ticket-key=/);
});
test('configuración valida límites y conserva ceros',()=>{
  const h=harness();h.load('configuracion');
  for(const [k,v] of Object.entries({porcentajeMonedero:'0',toleranciaTotal:'0',maxTicketsDia:'2',diasRegistro:'3',vigenciaMonedero:'180',ambienteSistema:'pruebas'}))h.node(k).value=v;
  assert.equal(h.c.leerConfiguracionFormulario().porcentajeMonedero,0);
  h.node('maxTicketsDia').value='-1';assert.throws(()=>h.c.leerConfiguracionFormulario());
  h.node('maxTicketsDia').value='1.5';assert.throws(()=>h.c.leerConfiguracionFormulario());
});
test('configuración y auditoría usan una sola escritura y preservan campos desconocidos',async()=>{
  const h=harness();h.load('configuracion');h.c.getUsuarioActual=()=>({uid:'u',email:'u@example.invalid'});
  await h.c.guardarConAuditoria('config/programa',{porcentajeMonedero:0},'CONFIG_ACTUALIZADA',true);
  assert.equal(h.writes.length,1);assert.equal(h.writes[0]['config/programa/porcentajeMonedero'],0);
  assert.equal(h.writes[0]['auditLogs/new-log'].type,'CONFIG_ACTUALIZADA');
  h.c.rtdb.ref=()=>({push:()=>({key:'k'}),update:async()=>{throw Error('denegado')}});
  await assert.rejects(h.c.guardarConAuditoria('config/programa',{},'CONFIG_ACTUALIZADA',true));
});
test('agrupación diaria usa Ciudad Juárez y tolera fechas inválidas',()=>{
  const h=harness();h.load('estadisticas');
  assert.equal(h.c.fechaDeTimestamp(Date.parse('2026-10-28T02:30:00Z')),'2026-10-27');
  assert.equal(h.c.fechaDeTimestamp('mal'),'Sin fecha');
});
test('cada vista contiene los elementos que su controlador necesita',()=>{
  for(const file of ['dashboard','tickets','alertas','canjes','auditoria','clientes','gerentes','estadisticas','configuracion','ticket-detalle','cliente-detalle','login']) {
    const page=file==='login'?'login-admin':file;
    const html=fs.readFileSync(path.join(__dirname,'..',page+'.html'),'utf8');
    for(const m of source(file).matchAll(/getElementById\("([^"]+)"\)/g))assert.ok(html.includes(`id="${m[1]}"`),`${page}: falta ${m[1]}`);
  }
});
test('las estadísticas diarias incluyen todas las señales que cuenta Dashboard',()=>{
  const h=harness();h.load('estadisticas');h.c.cargarEstadisticas();
  h.emit('tickets',{a:{status:'aprobado',intentosValidacion:2,createdAt:Date.parse('2026-10-28T02:30:00Z'),totalValidado:0,total:500}});
  h.emit('redemptions',{});
  assert.match(h.node('tablaActividadDiaria').innerHTML,/2026-10-27/);
  assert.equal(h.node('statVentaAprobada').textContent,'$0.00');
  assert.equal(vm.runInContext('ticketsStats.filter(t=>calcularRiesgo(t).score>0).length',h.c),1);
});
