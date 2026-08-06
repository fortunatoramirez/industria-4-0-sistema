# Conexiones del sistema

## ESP32 de la banda

| Dispositivo | Señal | ESP32 |
|---|---|---:|
| Infrarrojo | OUT | GPIO 19 |
| HC-SR04 | TRIG | GPIO 5 |
| HC-SR04 | ECHO | GPIO 18 mediante divisor |
| TCS34725 | SDA | GPIO 21 |
| TCS34725 | SCL | GPIO 22 |
| TCS34725 | VCC | 3.3 V |
| TCS34725 | GND | GND |

### Divisor del HC-SR04

```text
ECHO ── 1 kΩ ──┬── GPIO 18
                │
               2 kΩ
                │
               GND
```

## ESP32 de recepción

### HX711

| HX711 | ESP32 |
|---|---:|
| VCC | 3.3 V |
| GND | GND |
| DOUT | GPIO 16 |
| SCK | GPIO 17 |

### RC522

| RC522 | ESP32 |
|---|---:|
| 3.3 V | 3.3 V |
| GND | GND |
| SDA/SS | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| IRQ | Sin conexión |

No alimentar el RC522 con 5 V.
