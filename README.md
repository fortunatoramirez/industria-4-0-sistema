# Sistema integral de Industria 4.0

Proyecto completo para inspeccionar piezas mediante:

- Sensor infrarrojo: detecta la llegada de la pieza.
- HC-SR04: mide la altura.
- TCS34725: inspecciona el color.
- Celda de carga con HX711: obtiene el peso individual por diferencia.
- RC522: identifica la caja receptora.
- Dos ESP32: una estación en la banda y otra en la recepción.
- Node.js, Express y Socket.IO: servidor y actualización en tiempo real.
- MySQL: usuarios, productos, cajas, inspecciones, inventario y estadísticas.

El servidor crea automáticamente la base de datos y todas las tablas. No es necesario importar manualmente un archivo SQL.

---

## 1. Requisitos

Instalar:

1. Node.js 18 o posterior. Se recomienda una versión LTS.
2. MySQL Server.
3. Arduino IDE con soporte para ESP32.
4. Las bibliotecas de Arduino indicadas en `esp32/README.md`.

MySQL debe estar iniciado antes de ejecutar el servidor.

---

## 2. Preparar el servidor

### Opción sencilla en Windows

1. Descomprimir esta carpeta.
2. Ejecutar `1_PREPARAR.bat`.
3. Abrir el archivo `.env` que se habrá creado.
4. Escribir la contraseña real de MySQL en `DB_PASSWORD`.
5. Guardar el archivo.
6. Ejecutar `2_INICIAR.bat`.

### Opción mediante terminal

Abrir una terminal dentro de la carpeta del proyecto:

```bash
copy .env.example .env
```

En macOS o Linux:

```bash
cp .env.example .env
```

Editar `.env`:

```env
PORT=3000
SESSION_SECRET=cambie-esta-clave-de-sesion
DEVICE_API_KEY=clave-banda-industria-40

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=SU_CONTRASENA_MYSQL
DB_NAME=industria40_integral

ADMIN_NAME=Administrador
ADMIN_EMAIL=admin@industria40.local
ADMIN_PASSWORD=Industria40!
```

Instalar dependencias:

```bash
npm install
```

Iniciar:

```bash
npm start
```

El servidor mostrará:

```text
Sistema integral de Industria 4.0 preparado
Servidor local: http://localhost:3000
```

---

## 3. Abrir el sistema

Abrir en el navegador:

```text
http://localhost:3000
```

Si no se cambiaron los valores de `.env`, el usuario inicial será:

```text
Correo: admin@industria40.local
Contraseña: Industria40!
```

Este usuario solamente se crea cuando la tabla `usuarios` está vacía.

---

## 4. Qué se genera automáticamente

Al ejecutar `npm start`, el servidor:

1. Se conecta a MySQL.
2. Crea la base indicada en `DB_NAME` si no existe.
3. Crea las tablas.
4. Crea el usuario inicial si no hay usuarios.
5. Crea un producto de demostración si no hay productos.
6. Inicia la página web y Socket.IO.

Tablas principales:

```text
usuarios
accesos
productos
cajas
eventos_rfid
dispositivos
inspecciones
movimientos
```

---

## 5. Configurar el producto

Entrar a:

```text
Productos
```

Editar `Pieza de demostración` o registrar otro producto.

Configurar, de acuerdo con las calibraciones reales:

- Altura mínima y máxima.
- Peso mínimo y máximo.
- Color esperado.
- Porcentaje R de referencia.
- Porcentaje G de referencia.
- Porcentaje B de referencia.
- Tolerancia de color.

El ID del producto aparece en la tabla. Ese número debe colocarse en:

```cpp
const int PRODUCTO_ID = 1;
```

dentro de `esp32/estacion_banda/estacion_banda.ino`.

---

## 6. Conocer la dirección IP de la computadora

En Windows abrir `CMD` y ejecutar:

```bash
ipconfig
```

Buscar la dirección IPv4 de la computadora, por ejemplo:

```text
192.168.1.25
```

Colocarla en ambos programas:

```cpp
const char* IP_SERVIDOR = "192.168.1.25";
```

No utilizar `localhost` ni `127.0.0.1` dentro de los ESP32.

La computadora y ambos ESP32 deben estar conectados a la misma red.

Si Windows pregunta si se permite el acceso de Node.js a la red, seleccionar **Permitir** para redes privadas.

---

## 7. Preparar el ESP32 de la banda

Abrir:

```text
esp32/estacion_banda/estacion_banda.ino
```

Modificar:

```cpp
NOMBRE_WIFI
CONTRASENA_WIFI
IP_SERVIDOR
PUERTO_SERVIDOR
CLAVE_DISPOSITIVO
PRODUCTO_ID
DISTANCIA_BANDA_CM
```

`CLAVE_DISPOSITIVO` debe ser exactamente igual a `DEVICE_API_KEY` en `.env`.

Conectar:

- Sensor infrarrojo.
- HC-SR04 con divisor de voltaje en `ECHO`.
- TCS34725.

Cargar el programa al primer ESP32.

---

## 8. Preparar el ESP32 de recepción

Abrir:

```text
esp32/estacion_recepcion/estacion_recepcion.ino
```

Modificar:

```cpp
NOMBRE_WIFI
CONTRASENA_WIFI
IP_SERVIDOR
PUERTO_SERVIDOR
CLAVE_DISPOSITIVO
FACTOR_CALIBRACION
```

Conectar:

- HX711 y celda de carga.
- RC522.

Cargar el programa al segundo ESP32.

---

## 9. Registrar una caja RFID

1. Iniciar el servidor.
2. Abrir la página `Cajas RFID`.
3. Encender el ESP32 de recepción.
4. Acercar un llavero no registrado.
5. El UID aparecerá en la página.
6. Escribir el nombre de la caja, por ejemplo `CAJA_01`.
7. Escribir la capacidad máxima en gramos.
8. Registrar la caja.
9. Colocar la caja vacía sobre la báscula.
10. Acercar nuevamente el llavero.
11. El ESP32 realizará la tara.

---

## 10. Ejecutar una inspección

1. Confirmar que MySQL y Node.js estén funcionando.
2. Abrir la página `Inspecciones`.
3. Colocar una caja vacía en la báscula.
4. Identificarla con RFID.
5. Pasar una pieza por la banda.
6. El ESP32 de banda medirá altura y color.
7. El servidor creará una inspección `Esperando peso`.
8. La pieza caerá en la caja.
9. El ESP32 de recepción calculará el peso individual.
10. El servidor completará la inspección.
11. Si la pieza fue aceptada, aumentará automáticamente el inventario.

---

## 11. Orden FIFO

El sistema relaciona las estaciones en el orden de las piezas:

```text
Primera inspección de altura y color
→ primera pieza que llega a la báscula
```

Por ello:

- Las piezas deben pasar de una en una.
- No deben cambiar de orden.
- No debe retirarse una pieza entre estaciones.
- No deben caer dos piezas al mismo tiempo.

Si una pieza fue medida pero no llegará a la báscula, abrir `Inspecciones` y cancelar el registro pendiente antes de continuar.

---

## 12. Páginas incluidas

- `Panel`: resumen y estado de los ESP32.
- `Productos`: especificaciones y calibraciones.
- `Inventario`: movimientos manuales y automáticos.
- `Cajas RFID`: registro y eventos del lector.
- `Inspecciones`: historial completo y cancelación de pendientes.
- `Estadísticas`: resultados, fallas y gráficas.

---

## 13. Comprobar MySQL

Ejecutar:

```bash
npm run check-db
```

El comando intenta crear la base y muestra las tablas disponibles.

---

## 14. Problemas frecuentes

### Access denied for user

La contraseña, el usuario o los permisos de MySQL son incorrectos. Revisar `.env`.

### ECONNREFUSED 127.0.0.1:3306

MySQL Server no está iniciado o utiliza otro puerto.

### El ESP32 obtiene HTTP -1

- Revisar la IP de la computadora.
- Confirmar que los dispositivos estén en la misma red.
- Permitir Node.js en el firewall.
- Confirmar que el servidor siga abierto.

### HTTP 401 desde el ESP32

`CLAVE_DISPOSITIVO` no coincide con `DEVICE_API_KEY`.

### No existe una inspección pendiente

La pieza llegó a la báscula antes de que la estación de banda registrara altura y color, o no pasó por la estación de banda.

### El HC-SR04 marca valores incorrectos

- Revisar el divisor de voltaje.
- Medir nuevamente `DISTANCIA_BANDA_CM`.
- Colocar el sensor perpendicular a la banda.
- Usar objetos con superficie superior suficientemente plana.

### El color cambia demasiado

- Usar una cubierta.
- Mantener fija la distancia.
- Evitar luz solar directa.
- Repetir la calibración del producto.

### La báscula registra varias piezas

- Aumentar `UMBRAL_NUEVA_PIEZA_G`.
- Aumentar `TOLERANCIA_ESTABLE_G` con cuidado.
- Evitar vibraciones y contactos mecánicos.

---

## 15. Estructura del proyecto

```text
industria40_sistema_completo/
├── server.js
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── config.js
│   ├── database.js
│   ├── helpers.js
│   ├── middleware.js
│   └── routes/
├── public/
│   ├── pages/
│   ├── css/
│   └── js/
├── esp32/
│   ├── estacion_banda/
│   └── estacion_recepcion/
├── docs/
├── scripts/
└── sql/
```

---

## 16. Uso didáctico

El proyecto está preparado para que un grupo pueda implementarlo sin haber realizado las prácticas anteriores. Sin embargo, sigue siendo necesario:

- Montar correctamente los sensores.
- Calibrar altura, color y peso.
- Escribir las credenciales.
- Registrar el producto y la caja.
- Mantener el orden físico de las piezas.

El software automatiza la creación de la base de datos y la integración, pero no puede sustituir la calibración física de cada equipo.
