# Programas de los ESP32

El sistema utiliza dos tarjetas:

- `estacion_banda/estacion_banda.ino`: sensor infrarrojo, HC-SR04 y TCS34725.
- `estacion_recepcion/estacion_recepcion.ino`: celda de carga con HX711 y RFID RC522.

## Bibliotecas de Arduino IDE

Instalar desde el Administrador de bibliotecas:

1. **Adafruit TCS34725**
2. **HX711 Arduino Library**
3. **MFRC522**

`WiFi`, `HTTPClient`, `Wire` y `SPI` se incluyen con el soporte del ESP32.

## Valores que deben coincidir

En ambos programas:

- `NOMBRE_WIFI`
- `CONTRASENA_WIFI`
- `IP_SERVIDOR`
- `PUERTO_SERVIDOR`
- `CLAVE_DISPOSITIVO`

La `CLAVE_DISPOSITIVO` debe ser igual a `DEVICE_API_KEY` en el archivo `.env` del servidor.

En la estación de banda también se modifica:

- `PRODUCTO_ID`
- `DISTANCIA_BANDA_CM`
- `RETARDO_CENTRADO_MS`, si es necesario.

En la estación de recepción se modifica:

- `FACTOR_CALIBRACION`
- Umbrales de peso, si las piezas son muy ligeras o muy pesadas.
