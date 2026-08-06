#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <HX711.h>
#include <math.h>

// ==================================================
// DATOS QUE CADA EQUIPO DEBE MODIFICAR
// ==================================================
const char* NOMBRE_WIFI = "NOMBRE_DE_LA_RED";
const char* CONTRASENA_WIFI = "CONTRASENA_DE_LA_RED";
const char* IP_SERVIDOR = "192.168.1.25";
const uint16_t PUERTO_SERVIDOR = 3000;
const char* CLAVE_DISPOSITIVO = "clave-banda-industria-40";
const char* NOMBRE_DISPOSITIVO = "bascula_01";

// Sustituir por el factor obtenido al calibrar la celda.
const float FACTOR_CALIBRACION = -421.782013;

// ==================================================
// HX711
// ==================================================
const int PIN_HX711_DOUT = 16;
const int PIN_HX711_SCK = 17;
HX711 bascula;

// ==================================================
// RC522
// ==================================================
const int PIN_RFID_SS = 5;
const int PIN_RFID_RST = 22;
const int PIN_SPI_SCK = 18;
const int PIN_SPI_MISO = 19;
const int PIN_SPI_MOSI = 23;
MFRC522 lectorRFID(PIN_RFID_SS, PIN_RFID_RST);

// ==================================================
// PARÁMETROS DE PESAJE
// ==================================================
const float UMBRAL_NUEVA_PIEZA_G = 10.0;
const float TOLERANCIA_ESTABLE_G = 2.0;
const int LECTURAS_ESTABLES_NECESARIAS = 4;
const unsigned long TIEMPO_MAXIMO_ESTABILIDAD_MS = 10000;
const float UMBRAL_RETIRO_G = 30.0;
const unsigned long INTERVALO_LATIDO_MS = 15000;
const unsigned long INTERVALO_REINTENTO_MS = 2000;

bool cajaActiva = false;
bool sistemaListo = false;
String uidCajaActiva = "";
String nombreCajaActiva = "";
float capacidadCajaG = 0.0;

float pesoAnterior = 0.0;
int contadorPiezas = 0;
unsigned long ultimoLatido = 0;
unsigned long ultimaLecturaSerial = 0;
unsigned long ultimoReintento = 0;

// Evento de peso conservado hasta que el servidor lo confirme.
bool pesoPendiente = false;
float pesoEstablePendiente = 0.0;
int numeroPiezaPendiente = 0;
int inspeccionPendienteId = 0;

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

bool postJson(const String& ruta, const String& datos, String& respuesta, int& codigo) {
  conectarWiFi();
  HTTPClient http;
  http.setTimeout(5000);
  http.begin(url(ruta));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", CLAVE_DISPOSITIVO);
  codigo = http.POST(datos);
  respuesta = codigo > 0 ? http.getString() : "";
  http.end();
  return codigo >= 200 && codigo < 300;
}

bool getTexto(const String& ruta, String& respuesta, int& codigo) {
  conectarWiFi();
  HTTPClient http;
  http.setTimeout(5000);
  http.begin(url(ruta));
  http.addHeader("x-api-key", CLAVE_DISPOSITIVO);
  codigo = http.GET();
  respuesta = codigo > 0 ? http.getString() : "";
  http.end();
  return codigo >= 200 && codigo < 300;
}

void enviarLatido() {
  if (millis() - ultimoLatido < INTERVALO_LATIDO_MS) return;
  ultimoLatido = millis();

  String datos = "{";
  datos += "\"nombre\":\"" + String(NOMBRE_DISPOSITIVO) + "\",";
  datos += "\"tipo\":\"estacion_recepcion\",";
  datos += "\"detalle\":\"HX711 + RC522\"";
  datos += "}";

  String respuesta;
  int codigo;
  postJson("/api/dispositivo/latido", datos, respuesta, codigo);
}

String convertirUidATexto() {
  String uid = "";
  for (byte i = 0; i < lectorRFID.uid.size; i++) {
    if (lectorRFID.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(lectorRFID.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

String leerUidRFID() {
  if (!lectorRFID.PICC_IsNewCardPresent()) return "";
  if (!lectorRFID.PICC_ReadCardSerial()) return "";
  String uid = convertirUidATexto();
  lectorRFID.PICC_HaltA();
  lectorRFID.PCD_StopCrypto1();
  return uid;
}

bool identificarCaja(const String& uid, String& nombre, float& capacidad) {
  String datos = "{";
  datos += "\"uid_rfid\":\"" + uid + "\",";
  datos += "\"dispositivo\":\"" + String(NOMBRE_DISPOSITIVO) + "\"";
  datos += "}";

  String respuesta;
  int codigo;
  postJson("/api/dispositivo/rfid/identificar", datos, respuesta, codigo);
  Serial.print("Respuesta RFID: ");
  Serial.println(respuesta);

  if (codigo != 200 || !respuesta.startsWith("OK|")) return false;

  int s1 = respuesta.indexOf('|');
  int s2 = respuesta.indexOf('|', s1 + 1);
  int s3 = respuesta.indexOf('|', s2 + 1);
  if (s1 < 0 || s2 < 0 || s3 < 0) return false;

  nombre = respuesta.substring(s2 + 1, s3);
  capacidad = respuesta.substring(s3 + 1).toFloat();
  return true;
}

void revisarRFID() {
  String uid = leerUidRFID();
  if (!uid.length()) return;

  Serial.print("UID leído: ");
  Serial.println(uid);

  if (cajaActiva) {
    Serial.println(uid == uidCajaActiva ? "Esta caja ya está activa." : "Retire la caja actual antes de cambiarla.");
    delay(800);
    return;
  }

  String nombre;
  float capacidad;
  if (!identificarCaja(uid, nombre, capacidad)) {
    Serial.println("Caja no registrada o inactiva.");
    delay(800);
    return;
  }

  uidCajaActiva = uid;
  nombreCajaActiva = nombre;
  capacidadCajaG = capacidad;
  cajaActiva = true;

  Serial.print("Caja autorizada: ");
  Serial.println(nombreCajaActiva);
  Serial.println("No toque la plataforma. Realizando tara...");
  delay(2000);
  bascula.tare(20);

  pesoAnterior = 0.0;
  contadorPiezas = 0;
  pesoPendiente = false;
  inspeccionPendienteId = 0;
  sistemaListo = true;
  Serial.println("Estación preparada.");
}

float leerPeso() {
  if (!bascula.wait_ready_timeout(1000)) return NAN;
  float peso = bascula.get_units(5);
  if (peso > -1.0 && peso < 1.0) peso = 0.0;
  return peso;
}

float esperarPesoEstable() {
  unsigned long inicio = millis();
  float anterior = leerPeso();
  if (isnan(anterior)) return NAN;
  int estables = 0;

  while (millis() - inicio < TIEMPO_MAXIMO_ESTABILIDAD_MS) {
    delay(250);
    float actual = leerPeso();
    if (isnan(actual)) continue;

    float variacion = fabs(actual - anterior);
    Serial.print("Estabilizando: ");
    Serial.print(actual, 2);
    Serial.print(" g | variación: ");
    Serial.println(variacion, 2);

    estables = variacion <= TOLERANCIA_ESTABLE_G ? estables + 1 : 0;
    anterior = actual;
    if (estables >= LECTURAS_ESTABLES_NECESARIAS) return actual;
  }
  return NAN;
}

bool obtenerInspeccionPendiente(int& id) {
  String respuesta;
  int codigo;
  getTexto("/api/dispositivo/inspecciones/pendiente", respuesta, codigo);
  if (codigo != 200 || !respuesta.startsWith("OK|")) return false;
  id = respuesta.substring(3).toInt();
  return id > 0;
}

bool completarInspeccion() {
  if (!pesoPendiente || inspeccionPendienteId <= 0) return false;

  String datos = "{";
  datos += "\"uid_rfid\":\"" + uidCajaActiva + "\",";
  datos += "\"numero_pieza_caja\":" + String(numeroPiezaPendiente) + ",";
  datos += "\"peso_anterior_g\":" + String(pesoAnterior, 2) + ",";
  datos += "\"peso_actual_g\":" + String(pesoEstablePendiente, 2) + ",";
  datos += "\"dispositivo\":\"" + String(NOMBRE_DISPOSITIVO) + "\"";
  datos += "}";

  String ruta = "/api/dispositivo/inspecciones/" + String(inspeccionPendienteId) + "/completar-peso";
  String respuesta;
  int codigo;
  bool correcto = postJson(ruta, datos, respuesta, codigo);

  Serial.print("Completando inspección #");
  Serial.print(inspeccionPendienteId);
  Serial.print(". HTTP ");
  Serial.println(codigo);
  if (respuesta.length()) Serial.println(respuesta);
  return correcto;
}

void procesarPesoPendiente() {
  if (!pesoPendiente) return;
  if (ultimoReintento != 0 && millis() - ultimoReintento < INTERVALO_REINTENTO_MS) return;
  ultimoReintento = millis();

  if (inspeccionPendienteId == 0) {
    if (!obtenerInspeccionPendiente(inspeccionPendienteId)) {
      Serial.println("El peso está listo, pero todavía no existe una inspección pendiente.");
      return;
    }
    Serial.print("Inspección pendiente asignada: #");
    Serial.println(inspeccionPendienteId);
  }

  if (completarInspeccion()) {
    pesoAnterior = pesoEstablePendiente;
    contadorPiezas = numeroPiezaPendiente;
    pesoPendiente = false;
    pesoEstablePendiente = 0.0;
    numeroPiezaPendiente = 0;
    inspeccionPendienteId = 0;
    Serial.println("Inspección completada y peso confirmado.");
  } else {
    Serial.println("No se confirmó la inspección. Se reintentará con los mismos datos.");
  }
}

void desactivarCaja() {
  Serial.print("Caja retirada: ");
  Serial.println(nombreCajaActiva);
  Serial.print("Piezas confirmadas: ");
  Serial.println(contadorPiezas);

  cajaActiva = false;
  sistemaListo = false;
  uidCajaActiva = "";
  nombreCajaActiva = "";
  capacidadCajaG = 0.0;
  pesoAnterior = 0.0;
  contadorPiezas = 0;
  pesoPendiente = false;
  inspeccionPendienteId = 0;
  Serial.println("Coloque una caja vacía y acerque su llavero RFID.");
}

void setup() {
  Serial.begin(115200);

  bascula.begin(PIN_HX711_DOUT, PIN_HX711_SCK);
  bascula.set_scale(FACTOR_CALIBRACION);

  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_RFID_SS);
  lectorRFID.PCD_Init();
  delay(100);

  conectarWiFi();
  Serial.println("ESTACIÓN DE RECEPCIÓN PREPARADA");
  Serial.println("Coloque una caja vacía y acerque su llavero RFID.");
}

void loop() {
  enviarLatido();
  revisarRFID();
  procesarPesoPendiente();

  if (!cajaActiva || !sistemaListo || pesoPendiente) {
    delay(50);
    return;
  }

  float pesoActual = leerPeso();
  if (isnan(pesoActual)) {
    Serial.println("No fue posible leer el HX711.");
    delay(500);
    return;
  }

  if (millis() - ultimaLecturaSerial >= 1000) {
    ultimaLecturaSerial = millis();
    Serial.print("Caja: ");
    Serial.print(nombreCajaActiva);
    Serial.print(" | Peso acumulado: ");
    Serial.print(pesoActual, 2);
    Serial.println(" g");

    if (capacidadCajaG > 0 && pesoActual >= capacidadCajaG) {
      Serial.println("ALERTA: capacidad máxima de la caja alcanzada.");
    }
  }

  float cambio = pesoActual - pesoAnterior;

  if (cambio >= UMBRAL_NUEVA_PIEZA_G) {
    Serial.println("Aumento de peso detectado.");
    float estable = esperarPesoEstable();
    if (isnan(estable)) {
      Serial.println("El peso no logró estabilizarse.");
      return;
    }

    float pesoPieza = estable - pesoAnterior;
    if (pesoPieza < UMBRAL_NUEVA_PIEZA_G) return;

    pesoEstablePendiente = estable;
    numeroPiezaPendiente = contadorPiezas + 1;
    pesoPendiente = true;
    inspeccionPendienteId = 0;
    ultimoReintento = 0;

    Serial.print("Peso individual pendiente: ");
    Serial.print(pesoPieza, 2);
    Serial.println(" g");
    procesarPesoPendiente();
  }

  // Solo se interpreta como retiro si no existe un peso esperando confirmación.
  if (cambio <= -UMBRAL_RETIRO_G) desactivarCaja();

  delay(100);
}
