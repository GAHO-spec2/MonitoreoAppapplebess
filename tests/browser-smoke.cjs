const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { makeFirebaseMock } = require('./fixtures/firebase-mock.cjs');
const root = path.resolve(__dirname, '..');
const artifactDir = path.join(root, 'artifacts', 'browser');
const views = ['dashboard.html', 'tickets.html', 'alertas.html', 'canjes.html', 'clientes.html', 'gerentes.html', 'auditoria.html', 'estadisticas.html', 'configuracion.html', 'ticket-detalle.html?ticketKey=t', 'cliente-detalle.html?uid=c'];
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.html': 'text/html' };

(async () => {
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404).end('missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser, activePage, scenario = 'inicio';
  const errors = [], requestsFailed = [];
  async function newPage(options = {}, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
      contentType: 'application/javascript',
      body: route.request().url().includes('firebase-app-compat') ? makeFirebaseMock(options) : ''
    }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${scenario}: ${error.message}`));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) requestsFailed.push(response.url()); });
    activePage = page;
    return page;
  }
  // La franja principal es el objetivo: Configuración tiene otro indicador con el mismo texto.
  const status = page => page.locator('#estadoMonitoreo > strong');
  async function ready(page, file) {
    await page.goto(base + file);
    await status(page).getByText('Lecturas recibidas', { exact: true }).waitFor({ timeout: 10000 });
  }
  async function expectText(locator, value) { await locator.getByText(value, { exact: true }).waitFor(); }
  async function check(name, run) { scenario = name; await run(); console.log(`OK ${name}`); }
  try {
    browser = await chromium.launch({ headless: true });
    const page = await newPage();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      for (const file of views) await check(`${width}px ${file}`, async () => {
        await ready(page, file);
        assert.equal(await page.locator('.monitor-error').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Desbordamiento en ${file}`);
      });
    }
    await check('Inicio público redirige al acceso y sesión autorizada al dashboard', async () => {
      await page.goto(base);
      await page.waitForURL('**/dashboard.html');
      await expectText(status(page), 'Lecturas recibidas');
    });
    await check('Configuración puede mostrar dos indicadores sin ambigüedad en la prueba', async () => {
      await ready(page, 'configuracion.html');
      assert.equal(await page.getByText('Lecturas recibidas', { exact: true }).count(), 2);
      assert.equal(await status(page).count(), 1);
    });
    await check('Desconexión y recuperación conservan datos y cambian el aviso', async () => {
      await ready(page, 'dashboard.html');
      await page.evaluate(() => __firebaseTest.emit('.info/connected', false));
      await expectText(status(page), 'Sin conexión a Realtime Database');
      assert.equal(await page.locator('#kpiAlertas').textContent(), '1');
      assert.match(await page.locator('#estadoMonitoreo').textContent(), /desactualizada/);
      await page.evaluate(() => __firebaseTest.emit('.info/connected', true));
      await expectText(status(page), 'Lecturas recibidas');
    });
    await check('Permiso denegado en tickets se informa y una recarga recupera la lectura', async () => {
      await ready(page, 'tickets.html');
      await page.evaluate(() => __firebaseTest.deny('tickets'));
      await expectText(status(page), 'Lecturas con errores');
      assert.match(await page.locator('#estadoMonitoreo').textContent(), /Permiso denegado/);
      await ready(page, 'tickets.html');
    });
    await check('Filtro se conserva con actualizaciones y enlace de detalle funciona', async () => {
      await ready(page, 'tickets.html');
      await page.locator('#buscarTicket').fill('BUSCADO');
      await page.evaluate(() => __firebaseTest.emit('tickets', { t: { folio: 'BUSCADO', status: 'aprobado' }, otro: { folio: 'OCULTO' } }));
      assert.match(await page.locator('#tablaTickets').textContent(), /BUSCADO/);
      assert.doesNotMatch(await page.locator('#tablaTickets').textContent(), /OCULTO/);
      await page.locator('[data-ticket-key="t"]').click();
      await page.waitForURL('**/ticket-detalle.html?ticketKey=t');
      await expectText(page.locator('#detalleTotalValidado'), '$0.00');
    });
    await check('Configuración acepta ceros y escribe junto con auditoría', async () => {
      await ready(page, 'configuracion.html');
      await page.locator('#porcentajeMonedero').fill('0');
      await page.locator('#toleranciaTotal').fill('0');
      await page.locator('[onclick="guardarConfiguracion()"]').click();
      await page.waitForFunction(() => __firebaseTest.writes.length === 1);
      const writes = await page.evaluate(() => __firebaseTest.writes);
      assert.equal(writes[0]['config/programa/porcentajeMonedero'], 0);
      assert.equal(writes[0]['config/programa/toleranciaTotal'], 0);
      assert.equal(writes[0]['auditLogs/test-log'].type, 'CONFIG_ACTUALIZADA');
    });
    await check('Configuración rechaza límites inválidos y errores de guardado no anuncian éxito', async () => {
      await ready(page, 'configuracion.html');
      await page.locator('#maxTicketsDia').fill('-1');
      await page.locator('[onclick="guardarConfiguracion()"]').click();
      await page.getByText(/No se confirmó el guardado/).waitFor();
      assert.equal(await page.evaluate(() => __firebaseTest.writes.length), 0);
      await page.locator('#maxTicketsDia').fill('2');
      await page.evaluate(() => __firebaseTest.rejectWrites(true));
      await page.locator('[onclick="guardarConfiguracion()"]').click();
      await page.getByText(/No se confirmó el guardado.*Permiso denegado/).waitFor();
      assert.equal(await page.evaluate(() => __firebaseTest.writes.length), 0);
    });
    await check('Gerente consulta configuración sin poder editar', async () => {
      const p = await newPage({ data: { 'users/u': { role: 'gerente' } } });
      await ready(p, 'configuracion.html');
      assert.equal(await p.locator('#porcentajeMonedero').isDisabled(), true);
      assert.equal(await p.locator('[onclick="guardarConfiguracion()"]').isDisabled(), true);
      await p.context().close();
    });
    await check('Cuenta inactiva no accede al dashboard', async () => {
      const p = await newPage({ data: { 'users/u': { role: 'gerente', activo: false } } });
      await p.goto(base + 'dashboard.html');
      await p.waitForURL('**/login-admin.html');
      assert.equal(await p.locator('#emailAdmin').isVisible(), true);
      await p.context().close();
    });
    await check('Cuenta bloqueada no accede al dashboard', async () => {
      const p = await newPage({ data: { 'users/u': { role: 'gerente', bloqueado: true } } });
      await p.goto(base + 'dashboard.html');
      await p.waitForURL('**/login-admin.html');
      assert.equal(await p.locator('#emailAdmin').isVisible(), true);
      await p.context().close();
    });
    await check('Revocación con panel abierto vuelve al acceso', async () => {
      const p = await newPage();
      await ready(p, 'dashboard.html');
      await p.evaluate(() => __firebaseTest.emit('users/u', { role: 'sistemas', activo: false }));
      await p.waitForURL('**/login-admin.html');
      await p.context().close();
    });
    await check('Acceso conserva espacios de contraseña y bloquea envíos duplicados', async () => {
      const p = await newPage({ signedOut: true });
      await p.goto(base + 'login-admin.html');
      await p.locator('#emailAdmin').fill('test@example.invalid');
      await p.locator('#passwordAdmin').fill(' prueba-ficticia ');
      await p.evaluate(() => { void loginAdmin(); void loginAdmin(); });
      await p.waitForURL('**/dashboard.html');
      const result = await p.evaluate(() => JSON.parse(sessionStorage.getItem('__testSignIns')));
      assert.equal(result.length, 1);
      assert.equal(result[0].password, ' prueba-ficticia ');
      await p.context().close();
    });
    await check('Cerrar sesión no permite reingreso automático', async () => {
      const p = await newPage();
      await ready(p, 'dashboard.html');
      p.once('dialog', dialog => dialog.accept());
      await p.locator('[onclick="cerrarSesion()"]').click();
      await p.waitForURL('**/login-admin.html');
      await p.locator('#emailAdmin').waitFor();
      assert.equal(await p.evaluate(() => firebase.auth().currentUser), null);
      await p.context().close();
    });
    assert.deepEqual(errors, [], 'Errores JavaScript del navegador');
    assert.deepEqual(requestsFailed, [], 'Recursos locales con respuesta de error');
    console.log('22 vistas y 13 escenarios funcionales correctos, con Firebase simulado.');
  } catch (error) {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'failure.txt'), `${scenario}\n${error.stack}\n${errors.join('\n')}`);
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(artifactDir, 'failure.html'), await activePage.content().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
