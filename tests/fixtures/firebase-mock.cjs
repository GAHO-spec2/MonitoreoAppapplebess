// Solo datos ficticios. Nunca contacta Firebase real.
const fixture = {
  users: {
    u: { nombre: 'Administrador de pruebas', email: 'test@example.invalid', role: 'sistemas' },
    c: { nombre: 'Cliente de prueba', role: 'cliente', saldoDisponible: 20 }
  },
  'users/u': { nombre: 'Administrador de pruebas', email: 'test@example.invalid', role: 'sistemas' },
  'users/c': { nombre: 'Cliente de prueba', email: 'cliente@example.invalid', role: 'cliente', saldoDisponible: 20 },
  tickets: { t: { folio: '12345', userId: 'c', clienteEmail: 'cliente@example.invalid', sucursal: 'Applebee’s Torres', status: 'pendiente_revision_manual', createdAt: 1793154600000, total: 500, totalValidado: 0, ticketVision: { camposCorregidos: ['total'] } } },
  'tickets/t': { folio: '12345', userId: 'c', sucursal: 'Applebee’s Torres', status: 'pendiente_revision_manual', createdAt: 1793154600000, total: 500, totalValidado: 0 },
  redemptions: { r: { userId: 'c', status: 'canjeado', monto: 10, createdAt: 1793154600000, redeemedAt: 1793154600000, gerenteUid: 'u' } },
  auditLogs: { l: { type: 'CANJE_VALIDADO', userId: 'c', createdAt: 1793154600000 } },
  'config/programa': { ambienteSistema: 'pruebas', porcentajeMonedero: .05, maxTicketsDia: 2, diasRegistro: 3, vigenciaMonedero: 180, toleranciaTotal: .5 },
  'config/sucursales': { a: { id: 'a', nombre: 'Torres', ciudad: 'Ciudad Juárez' } },
  '.info/connected': true
};

function makeFirebaseMock(options = {}) {
  return `(${installMock.toString()})(${JSON.stringify(fixture)}, ${JSON.stringify(options)});`;
}

function installMock(data, options) {
  const savedData = sessionStorage.getItem('__testData');
  if (savedData) data = JSON.parse(savedData);
  else Object.assign(data, options.data || {});
  const listeners = [], authListeners = [], writes = [];
  const signIns = JSON.parse(sessionStorage.getItem('__testSignIns') || '[]');
  const savedAuth = sessionStorage.getItem('__testAuth');
  const currentUser = savedAuth !== null ? JSON.parse(savedAuth) : options.signedOut ? null : { uid: 'u', email: 'test@example.invalid' };
  const persistData = () => sessionStorage.setItem('__testData', JSON.stringify(data));
  persistData();
  let rejectWrites = false;
  function snapshot(query) {
    let value = data[query.path] ?? null;
    if (value && query.filter) value = Object.fromEntries(Object.entries(value).filter(([, row]) => row[query.order] === query.filter.value));
    if (value && query.limit) {
      const entries = Object.entries(value).sort((a, b) => (a[1][query.order] || 0) - (b[1][query.order] || 0));
      value = Object.fromEntries(entries.slice(-query.limit));
    }
    const copy = structuredClone(value);
    return { val: () => copy };
  }
  function ref(path = '', settings = {}) {
    const query = { path, ...settings };
    return {
      on(event, callback, error) {
        const listener = { query, callback, error, active: true };
        listeners.push(listener);
        setTimeout(() => { if (listener.active) callback(snapshot(query)); }, 0);
      },
      off(event, callback) { for (const l of listeners) if (l.query.path === path && l.callback === callback) l.active = false; },
      once: async () => snapshot(query),
      orderByChild: order => ref(path, { ...settings, order }),
      equalTo: value => ref(path, { ...settings, filter: { value } }),
      limitToLast: limit => ref(path, { ...settings, limit }),
      push: () => ({ key: 'test-log' }),
      async update(changes) {
        if (rejectWrites) throw Object.assign(new Error('Permiso denegado'), { code: 'PERMISSION_DENIED' });
        writes.push(structuredClone(changes));
      }
    };
  }
  const auth = {
    currentUser,
    onAuthStateChanged(callback) {
      authListeners.push(callback);
      setTimeout(() => callback(auth.currentUser), 0);
      return () => {};
    },
    async signOut() { api.setAuth(null); },
    async signInWithEmailAndPassword(email, password) {
      signIns.push({ email, password });
      sessionStorage.setItem('__testSignIns', JSON.stringify(signIns));
      api.setAuth({ uid: 'u', email });
      return { user: auth.currentUser };
    }
  };
  const api = window.__firebaseTest = {
    writes, signIns,
    emit(path, value) {
      data[path] = value;
      persistData();
      for (const l of [...listeners]) if (l.active && l.query.path === path) l.callback(snapshot(l.query));
    },
    deny(path) {
      for (const l of [...listeners]) if (l.active && l.query.path === path) {
        l.active = false; // Firebase cancela el listener cuando deniega permisos.
        l.error?.({ code: 'PERMISSION_DENIED' });
      }
    },
    setAuth(user) { auth.currentUser = user; sessionStorage.setItem('__testAuth', JSON.stringify(user)); for (const callback of authListeners) callback(user); },
    rejectWrites(value) { rejectWrites = value; },
    activeListeners(path) { return listeners.filter(l => l.active && (!path || l.query.path === path)).length; }
  };
  window.firebase = {
    apps: [], initializeApp() { this.apps.push({}); }, auth: () => auth,
    firestore: () => ({}), storage: () => ({}), database: () => ({ ref })
  };
  window.firebase.database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
}
module.exports = { makeFirebaseMock };
