# Monitoreo de lealtad Applebee’s

Panel estático conectado a Firebase. Entrada: `index.html` o `login-admin.html`.

## Cambios de funcionamiento

- Dashboard, Tickets, Alertas y detalle comparten `calcularRiesgo` en `js/common.js`. Una alerta es cualquier ticket con puntuación mayor que cero. Los intentos y correcciones son señales históricas, incluso en tickets aprobados; no demuestran fraude. Los niveles bajo/medio/alto usan umbrales 0/40/80.
- Las vistas de operación, estadísticas y detalles se actualizan mediante listeners. Los filtros escritos se conservan entre actualizaciones.
- La franja superior distingue conexión, lecturas pendientes, lecturas recibidas y errores. Conserva datos anteriores con advertencia explícita cuando pierde conexión. La hora es la última lectura recibida en esta sesión, no la última operación del negocio ni una comprobación del backend OCR/API.
- Lecturas sin respuesta generan error visible después de 20 segundos. Los listeners se liberan al salir.
- Se rechazan perfiles con `activo: false`. Cambiar el rol o desactivar el perfil mientras la página está abierta revoca su acceso al panel. Los roles existentes sin campo `activo` mantienen compatibilidad.
- Totales validados en cero se conservan; fechas y reportes diarios usan `America/Ciudad_Juarez`.
- Los cambios de configuración y su auditoría se escriben en una sola actualización atómica con hora del servidor. Los límites se validan y los ceros permitidos se conservan. Una operación que agota el tiempo de espera puede aún confirmarse más tarde: revisar la lectura de configuración antes de reintentar.
- El catálogo vacío ya no se presenta como si las sucursales base estuvieran guardadas.

## Pruebas y disponibilidad

Con Node.js 22 o superior, sin instalar dependencias:

```sh
npm run check
npm test
npm run monitor
```

`verificar-panel.yml` comprueba sintaxis, recursos y regresiones en pushes y pull requests. También instala Playwright 1.62.1 y prueba 22 vistas (escritorio/móvil) con Firebase simulado, sin credenciales ni operaciones reales. Esta simulación no valida las reglas ni la conexión al proyecto Firebase real. `monitorear-sitio.yml` comprueba cada hora la disponibilidad HTTP del sitio y sus recursos locales; también se puede ejecutar desde Actions. GitHub puede retrasar los horarios y desactivar workflows programados por inactividad. El chequeo público no inicia sesión ni comprueba Firebase, OCR, saldo o canjes. `MONITOR_SITE_URL` permite usar otro alojamiento. No incorporar contraseñas ni tokens en este repositorio público.

## Validación pendiente en Firebase

Este repositorio no incluye las reglas desplegadas ni credenciales de administración. Las comprobaciones del navegador no sustituyen las reglas del servidor. Antes de dar el sistema por validado con datos reales:

1. Revisar las reglas actuales de Realtime Database: permitir lectura global solo a los roles autorizados que correspondan al alcance de la operación; impedir que un cliente cambie su propio rol/estado; rechazar operaciones de perfiles inactivos; restringir configuración y auditoría. Probar con cuentas reales y emulador, sin reemplazar reglas de la app a ciegas.
2. Verificar que `js/firebase.js` apunta al proyecto y a la instancia RTDB correctos. Si la instancia no es la predeterminada del proyecto, agregar su `databaseURL` real desde la consola. La clave web de Firebase es configuración del cliente, no una credencial de administrador.
3. Revisar índices `tickets.createdAt`, `tickets.userId`, `redemptions.userId` y `auditLogs.createdAt` en las reglas existentes para las consultas de este panel.
4. Ingresar con administrador, gerente activo, gerente inactivo y cliente. Confirmar el alcance permitido por sucursal según las reglas operativas. Probar también una revocación de perfil con el panel abierto.
5. Generar un ticket de prueba y seguir su validación, saldo, canje y auditoría, contrastando con la app y el backend. Desconectar la red y probar permisos denegados.

El selector `ambienteSistema` es una etiqueta de configuración; **no crea una base separada ni impide movimientos reales**. Si no existe configuración, el formulario propone “pruebas”, sin guardarla automáticamente. Para aislar las pruebas se requiere un proyecto/instancia Firebase y backend separados. No se cambió la configuración desplegada ni sus reglas desde este repositorio.

## Avisos

La franja del panel informa errores en la sesión abierta. El chequeo horario y las notificaciones de ChatGPT sobre GitHub cubren disponibilidad pública y resultados de Actions. Para alertas internas de tickets, OCR o saldos con el navegador cerrado hace falta integrar una fuente de salud del backend y un canal de avisos autenticado. No publicar datos de clientes para habilitar esa integración.
