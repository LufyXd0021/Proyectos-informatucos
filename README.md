# saldo — control de gastos

Prototipo web en español para consultar un balance calculado, registrar compras, retiros, transferencias e ingresos, y convertir el texto de una notificación bancaria en un movimiento.

## Cómo probarlo

Abre `index.html` en un navegador o sirve la carpeta desde un servidor estático. Por ejemplo:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

La primera visita muestra datos de demostración. Desde **Usar mis datos** puedes quitarlos; en **Configuración** puedes indicar un saldo inicial, elegir la moneda y guardar las preferencias de avisos por correo. Los movimientos y preferencias se guardan en el almacenamiento local del navegador.

## Importación de SMS

En **Importar SMS**, pega o selecciona un ejemplo. La página intenta reconocer compras, retiros, transferencias enviadas e ingresos; muestra una vista previa y, al confirmar, añade el movimiento y recalcula el balance. La importación manual evita duplicar exactamente el mismo mensaje.

**Limitación importante:** una página web normal no puede leer los SMS del teléfono ni consultar el saldo bancario por sí sola. La recepción automática necesitaría una aplicación móvil o un proveedor/API compatible, autorización explícita, un backend seguro y conexión con el banco o servicio de mensajería. Este prototipo no tiene dicha integración; su balance se calcula solo a partir del saldo inicial y de los movimientos de ejemplo, manuales o importados.

## Alertas por correo

En **Configuración → Avisos por correo** puedes guardar una dirección y elegir qué tipos de movimientos te gustaría notificar. Si activas esa preferencia, la interfaz avisa que no se envió ningún correo al registrar un movimiento: falta conectar un proveedor transaccional mediante el backend. No se almacenan claves de email ni de proveedor en el navegador.

## Publicación

El flujo de GitHub Pages publica la versión estática al actualizar la rama de trabajo `arena/01a10a39-proyectos-informatucos`. El repositorio es público; cuando termine correctamente la primera ejecución, la página quedará disponible en `https://lufyxd0021.github.io/Proyectos-informatucos/`.
