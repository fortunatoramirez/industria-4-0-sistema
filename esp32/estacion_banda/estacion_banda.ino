#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_TCS34725.h>

// ==================================================
// DATOS QUE CADA EQUIPO DEBE MODIFICAR
// ==================================================
const char* NOMBRE_WIFI = "NOMBRE_DE_LA_RED";
const char* CONTRASENA_WIFI = "CONTRASENA_DE_LA_RED";
const char* IP_SERVIDOR = "192.168.1.25";
const uint16_t PUERTO_SERVIDOR = 3000;
const char* CLAVE_DISPOSITIVO = "clave-banda-industria-40";

const int PRODUCTO_ID = 1;
const char* NOMBRE_DISPOSITIVO = "banda_01";
const float DISTANCIA_BANDA_CM = 30.0;

// ==================================================
// PINES
// ==================================================
const int PIN_SENSOR_IR = 19;
const int PIN_TRIG = 5;
const int PIN_ECHO = 18;  // Utilizar divisor de voltaje.
const int PIN_SDA = 21;
const int PIN_SCL = 22;
const int ESTADO_OBJETO = LOW;

// ==================================================
// PARÁMETROS DE MEDICIÓN
// ==================================================
const int TOTAL_MUESTRAS_DISTANCIA = 5;
const int TOTAL_MUESTRAS_COLOR = 5;
const unsigned long RETARDO_CENTRADO_MS = 80;
const unsigned long TIEMPO_LIBRE_MS = 150;
const unsigned long INTERVALO_LATIDO_MS = 15000;
const unsigned long INTERVALO_REINTENTO_MS = 2000;

Adafruit_TCS34725 sensorColor(
  TCS34725_INTEGRATIONTIME_24MS,
  TCS34725_GAIN_4X
);

struct LecturaColor {
  uint32_t rojo;
  uint32_t verde;
  uint32_t azul;
  uint32_t claro;
};

bool objetoProcesado = false;
unsigned long inicioZonaLibre = 0;
unsigned long ultimoLatido = 0;
unsigned long ultimoReintento = 0;
uint32_t contadorEventos = 0;

String envioPendiente = "";
String tokenPendiente = "";

String url(const String& ruta) {
  return "http://" + String(IP_SERVIDOR) + ":" + String(PUERTO_SERVIDOR) + ruta;
}

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("Conectando a WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(NOMBRE_WIFI, CONTRASENA_WIFI);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi conectado. IP: ");
  Serial.println(WiFi.localIP());
}

bool postJson(const String& ruta, const String& datos, String& respuesta) {
  conectarWiFi();
  HTTPClient http;
  http.setTimeout(5000);
  http.begin(url(ruta));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", CLAVE_DISPOSITIVO);

  int codigo = http.POST(datos);
  respuesta = codigo > 0 ? http.getString() : "";
  http.end();

  Serial.print("HTTP ");
  Serial.println(codigo);
  if (respuesta.length()) Serial.println(respuesta);
  return codigo >= 200 && codigo < 300;
}

void enviarLatido() {
  if (millis() - ultimoLatido < INTERVALO_LATIDO_MS) return;
  ultimoLatido = millis();

  String datos = "{";
  datos += "\"nombre\":\"" + String(NOMBRE_DISPOSITIVO) + "\",";
  datos += "\"tipo\":\"estacion_banda\",";
  datos += "\"detalle\":\"IR + HC-SR04 + TCS34725\"";
  datos += "}";

  String respuesta;
  postJson("/api/dispositivo/latido", datos, respuesta);
}

float medirDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  unsigned long duracion = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duracion == 0) return -1.0;
  return duracion * 0.0343 / 2.0;
}

void ordenar(float valores[], int cantidad) {
  for (int i = 0; i < cantidad - 1; i++) {
    for (int j = 0; j < cantidad - i - 1; j++) {
      if (valores[j] > valores[j + 1]) {
        float temporal = valores[j];
        valores[j] = valores[j + 1];
        valores[j + 1] = temporal;
      }
    }
  }
}

float obtenerDistanciaEstable() {
  float muestras[TOTAL_MUESTRAS_DISTANCIA];
  int validas = 0;
  int intentos = 0;

  while (validas < TOTAL_MUESTRAS_DISTANCIA && intentos < TOTAL_MUESTRAS_DISTANCIA * 2) {
    float distancia = medirDistanciaCm();
    intentos++;

    if (distancia > 1.0 && distancia < DISTANCIA_BANDA_CM) {
      muestras[validas++] = distancia;
    }
    delay(25);
  }

  if (validas < 3) return -1.0;
  ordenar(muestras, validas);
  int centro = validas / 2;
  return validas % 2 ? muestras[centro] : (muestras[centro - 1] + muestras[centro]) / 2.0;
}

bool obtenerColorPromedio(LecturaColor& resultado) {
  uint64_t sumaR = 0, sumaG = 0, sumaB = 0, sumaC = 0;
  int validas = 0;

  for (int i = 0; i < TOTAL_MUESTRAS_COLOR; i++) {
    uint16_t r, g, b, c;
    sensorColor.getRawData(&r, &g, &b, &c);

    if (r == 0 && g == 0 && b == 0) {
      delay(35);
      continue;
    }

    sumaR += r;
    sumaG += g;
    sumaB += b;
    sumaC += c;
    validas++;
    delay(35);
  }

  if (validas < 3) return false;
  resultado.rojo = sumaR / validas;
  resultado.verde = sumaG / validas;
  resultado.azul = sumaB / validas;
  resultado.claro = sumaC / validas;
  return true;
}

String crearTokenEvento() {
  uint64_t mac = ESP.getEfuseMac();
  contadorEventos++;
  return String((uint32_t)(mac >> 32), HEX) +
         String((uint32_t)mac, HEX) + "-" +
         String(millis()) + "-" + String(contadorEventos);
}

void prepararEnvio(float distanciaObjeto, const LecturaColor& color) {
  tokenPendiente = crearTokenEvento();

  String datos = "{";
  datos += "\"token_evento\":\"" + tokenPendiente + "\",";
  datos += "\"producto_id\":" + String(PRODUCTO_ID) + ",";
  datos += "\"dispositivo\":\"" + String(NOMBRE_DISPOSITIVO) + "\",";
  datos += "\"distancia_banda_cm\":" + String(DISTANCIA_BANDA_CM, 2) + ",";
  datos += "\"distancia_objeto_cm\":" + String(distanciaObjeto, 2) + ",";
  datos += "\"rojo_raw\":" + String(color.rojo) + ",";
  datos += "\"verde_raw\":" + String(color.verde) + ",";
  datos += "\"azul_raw\":" + String(color.azul) + ",";
  datos += "\"claro_raw\":" + String(color.claro);
  datos += "}";

  envioPendiente = datos;
  ultimoReintento = 0;
}

void procesarEnvioPendiente() {
  if (!envioPendiente.length()) return;
  if (ultimoReintento != 0 && millis() - ultimoReintento < INTERVALO_REINTENTO_MS) return;
  ultimoReintento = millis();

  Serial.print("Enviando inspección con token: ");
  Serial.println(tokenPendiente);
  String respuesta;
  if (postJson("/api/dispositivo/inspecciones/iniciar", envioPendiente, respuesta)) {
    Serial.println("Inspección confirmada por el servidor.");
    envioPendiente = "";
    tokenPendiente = "";
  } else {
    Serial.println("No se confirmó. Se volverá a intentar con el mismo token.");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_SENSOR_IR, INPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);

  Wire.begin(PIN_SDA, PIN_SCL);
  if (!sensorColor.begin()) {
    Serial.println("No se encontró el TCS34725. Revise el cableado.");
    while (true) delay(1000);
  }

  conectarWiFi();
  Serial.println("ESTACIÓN DE BANDA PREPARADA");
  Serial.print("Distancia sensor-banda: ");
  Serial.print(DISTANCIA_BANDA_CM, 2);
  Serial.println(" cm");
}

void loop() {
  enviarLatido();
  procesarEnvioPendiente();

  // No aceptar una nueva pieza mientras exista un envío sin confirmar.
  if (envioPendiente.length()) {
    delay(20);
    return;
  }

  bool objetoPresente = digitalRead(PIN_SENSOR_IR) == ESTADO_OBJETO;

  if (objetoPresente && !objetoProcesado) {
    Serial.println("Pieza detectada");
    delay(RETARDO_CENTRADO_MS);

    float distanciaObjeto = obtenerDistanciaEstable();
    LecturaColor color;
    bool colorValido = obtenerColorPromedio(color);

    if (distanciaObjeto > 0 && colorValido) {
      float altura = DISTANCIA_BANDA_CM - distanciaObjeto;
      Serial.print("Altura estimada: ");
      Serial.print(altura, 2);
      Serial.println(" cm");
      Serial.printf("Color crudo R:%lu G:%lu B:%lu C:%lu\n",
                    (unsigned long)color.rojo, (unsigned long)color.verde,
                    (unsigned long)color.azul, (unsigned long)color.claro);
      prepararEnvio(distanciaObjeto, color);
      procesarEnvioPendiente();
    } else {
      Serial.println("No se obtuvieron suficientes mediciones válidas.");
    }

    objetoProcesado = true;
    inicioZonaLibre = 0;
  }

  if (!objetoPresente) {
    if (inicioZonaLibre == 0) inicioZonaLibre = millis();
    if (millis() - inicioZonaLibre >= TIEMPO_LIBRE_MS) objetoProcesado = false;
  } else {
    inicioZonaLibre = 0;
  }

  delay(10);
}
