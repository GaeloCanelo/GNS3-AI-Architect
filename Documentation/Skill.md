# Skill: Diseñador y Configurador de Redes GNS3 (MCP) — v3.3.0

Este documento describe las directrices, estándares y lecciones aprendidas para que un Agente de IA pueda diseñar, configurar y validar topologías de red en GNS3. **Léelo COMPLETO antes de ejecutar cualquier acción.**

---

## 1. Entrada de Referencia — Lectura de Topologías (`Topology_Workspace/`)

### Regla Fundamental: Fidelidad Total a la Fuente
Cuando el usuario proporciona una imagen (`.jpeg`, `.png`), PDF u otro archivo en `Topology_Workspace/`, el agente **DEBE**:

1.  **Leer primero, actuar después.** Antes de crear cualquier dispositivo, analizar **exhaustivamente** la imagen/documento proporcionado y extraer:
    *   Nombres exactos de todos los dispositivos (R1, SW1, PC3, etc.)
    *   Direcciones IP y máscaras de cada interfaz (LAN y WAN)
    *   Interfaces específicas asignadas (Fa0/0, Fa1/1, etc.)
    *   Tipo de enrutamiento indicado (Estático, RIP, OSPF, etc.)
    *   Áreas OSPF (si aplica): qué routers pertenecen a cada área y cuáles son ABR
    *   Costos OSPF (si aplica): el costo visible en cada enlace
    *   Decoraciones, etiquetas, notas y rótulos visibles en el diagrama
    *   Requisitos especiales (seguridad, ruta por defecto, etc.)
2.  **Replicar, no interpretar.** La topología en GNS3 debe ser una **copia exacta** del diagrama proporcionado. No se debe:
    *   Inventar nombres de subredes que no aparezcan en la imagen
    *   Cambiar asignaciones de interfaces
    *   Omitir dispositivos o conexiones
    *   Asumir IPs o máscaras no especificadas (preguntar al usuario si faltan datos)
3.  **Confirmar la lectura.** Antes de proceder a crear dispositivos, el agente debe mostrar al usuario un **resumen estructurado** de lo que interpretó de la imagen para validación. El formato se adapta al protocolo identificado:

```
📋 Lectura de Topología — [nombre del archivo]
Dispositivos: [lista completa de nodos con tipo, ej: R1, R2, R3, SW1, PC1-PC4 — 9 dispositivos]

Redes LAN:
  [Subred N]: [red/máscara] — Gateway: [Router] ([Interfaz]) — VPCs: [PC1, PC2...]
Redes WAN (punto a punto):
  [Subred N]: [red/máscara] — [R1 (Interfaz)] ↔ [R2 (Interfaz)]

Enrutamiento: [Estático | RIPv2 | OSPF Multi-Area | Mixto]

  [Si es Estático]
  Rutas identificadas: [N rutas estáticas]
  Ruta por defecto: [sí/no]

  [Si es RIPv2]
  Protocolo: RIPv2 — no auto-summary
  Redes a anunciar por router: [resumen]

  [Si es OSPF]
  Áreas: [Área 0 (Backbone), Área 1, ...]
  ABRs: [R3 (Área 1↔0), R6 (Área 0↔2)]
  Costos identificados: [Enlace R1-R3: costo 6, ...]

  [Si es Mixto]
  Descripción del esquema mixto

Decoraciones: [etiquetas de subredes, rótulos WAN, rectángulos de área si es OSPF]
Seguridad: [ninguna | contraseña: *** (indicada por el usuario)]
Datos no legibles (pendientes de confirmación del usuario):
  • [Cualquier IP, interfaz o máscara que no se pudo leer claramente]

¿Es correcto este análisis? Confirme para proceder al despliegue.
```

### Acceso a Archivos Multimedia
*   **Imágenes:** Usar la sintaxis `@Topology_Workspace/archivo.jpeg` para que el modelo las procese visualmente, o usar la herramienta `read_file` del sistema.
*   **PDFs:** Leer con herramientas de archivo. Si el PDF contiene imágenes embebidas, solicitar al usuario que exporte la página relevante como imagen.
*   **Múltiples archivos:** Si hay varios archivos, el agente debe preguntar cuál usar si no es obvio.

> ⚠️ **Limitación conocida:** La interpretación de imágenes complejas puede tener errores. Números de interfaz, direcciones IP pequeñas, y texto superpuesto son propensos a errores de lectura. El agente debe **priorizar la claridad sobre la suposición**: si un dato no es legible con confianza, PREGUNTAR al usuario.

---

## 2. Herramientas del Servidor MCP

### Gestión de Proyectos
*   `obtener_proyectos`: Lista todos los proyectos con nombre e ID.
*   `crear_proyecto`: Crea un nuevo proyecto, lo abre en la GUI y devuelve el `project_id`.
*   `obtener_nodos_proyecto`: Inventario completo de nodos (estados, IDs, puertos de consola, tipo).
*   `obtener_enlaces_proyecto`: Mapa completo de conexiones físicas (adapter/port de cada extremo, Link IDs).
*   `limpiar_proyecto`: Borra TODOS los nodos, enlaces y decoraciones de forma segura (stop → polling → delete secuencial).

### Construcción y Diseño
*   `agregar_dispositivo`: Busca la plantilla correcta por tipo (`c7200`, `vpcs`, etc.), crea el nodo en la posición (x, y) indicada y devuelve el `node_id` y el puerto de consola. Las coordenadas deben replicar fielmente el layout del diagrama.
*   `conectar_nodos`: Une dos nodos por sus `node_id`, especificando `adapter` y `port` de cada extremo. Devuelve el `link_id`. Es obligatorio respetar los números de interfaz del diagrama (Fa0/0, Fa1/0, etc.).
*   `agregar_decoracion`: **Obligatoria** una vez completado el diseño. Dibuja rectángulos, elípses o textos SVG en el canvas de GNS3. Ver §4 para reglas de posicionamiento y proporciones.

### Configuración y Diagnóstico
*   `configurar_vpc`: Config IP para VPCS.
*   `configurar_router_cisco`: Comandos IOS via Telnet. **Inyecta `logging synchronous` automáticamente.** Devuelve output filtrado (sin basura de boot), mostrando cada comando con ✅/⚠️.
*   `ejecutar_comando_router`: **Para verificación** (`show ip route`, `show ip ospf neighbor`, `traceroute`, etc.). Devuelve output limpio con el prompt visible del router. **USAR ESTE, NO `configurar_router_cisco`, para consultas.**
*   `verificar_conectividad`: Pings con drain de buffer previo.
*   `exportar_configuraciones`: Extrae `running-config`.

### Cálculo y Planificación OSPF
*   `calcular_ospf`: **Usar SIEMPRE antes de configurar OSPF.** Calcula wildcards, genera bloques IOS `network`, detecta ABRs y muestra resumen por área para confirmación del usuario. **NO configurar OSPF sin haber ejecutado esta herramienta primero.**

### Reportes y Backup
*   `generar_reporte_excel`: Excel con hojas WAN/LAN/Resumen. Si los datos incluyen campos OSPF (`wildcard`, `area_ospf`, `costo_ospf`), agrega columnas automáticamente. **Siempre guarda en `Topology_Reports/`.**
*   `generar_backup_comandos`: Markdown con comandos IOS/VPCS por dispositivo + sección de verificación. **Siempre en `Topology_Reports/`.**
*   `generar_traceroute_md`: Markdown de trazado de rutas. **Solo si el usuario lo solicita explícitamente.**
*   `validar_ruta_archivo`: Helper para verificar que una ruta apunta a `Topology_Reports/`.

---

## 3. Capacidades Internas del Servidor
*   **Smart Boot Polling:** Polling TCP activo (45s routers, 5s VPCS).
*   **Active Prompt Polling:** Envía `\r\n` cada 3s durante boot, detecta Bootstrap dialog → `no`. Timeout 60s.
*   **Arranque Automático Completo:** `configurar_router_cisco` inyecta esta secuencia ANTES de los comandos del agente: `enable` → `configure terminal` → `no ip domain-lookup` → `line con 0` → `logging synchronous` → `exec-timeout 0 0` → `exit`. Esto garantiza que el router esté en modo `(config)#`, sin intentos de resolución DNS y con consola estable antes de procesar los comandos del agente.
*   **Output Filtrado:** El output de `configurar_router_cisco` elimina el banner de boot y muestra solo los comandos enviados con indicador ✅/⚠️.
*   **Forzado de Topology_Reports/:** `generar_reporte_excel`, `generar_backup_comandos`, `generar_traceroute_md` y `validar_ruta_archivo` corrigen automáticamente cualquier ruta incorrecta.
*   **Manejo EBUSY:** Si el Excel está abierto, se guarda como `_v2.xlsx` automáticamente.

---

## 4. Estándares de Diseño Físico

### Nombres de Dispositivos (CRÍTICO — Fidelidad Total)
Los nombres de dispositivos en GNS3 deben ser **EXACTAMENTE** los que aparecen en la imagen o diagrama del usuario:
*   **Prohibido** añadir sufijos (`R1_E2`, `SW1_Lab`), prefijos, números extra o cualquier modificación.
*   **Prohibido** abreviar o expandir: si el diagrama dice `PC-A`, en GNS3 se llama `PC-A`, no `PCA` ni `PC1`.
*   **Prohibido** asumir nombres si hay ambigüedad — PREGUNTAR al usuario.
*   Los nombres se pasan en el parámetro `name` de `agregar_dispositivo`.

### Posicionamiento
*   **Margen:** 200 unidades de distancia mínima entre nodos para que el canvas quede legible.
*   **Distribución:** Respetar la disposición espacial de la imagen original (si R1 está arriba-izquierda en el diagrama, colocarlo arriba-izquierda en GNS3). No reorganizar la topología.

### Decoraciones y Etiquetas — `agregar_decoracion` (OBLIGATORIO)

Después de trazar los enlaces, el agente **DEBE** replicar con `agregar_decoracion` **TODAS** las etiquetas, notas y rótulos visibles en el diagrama original. Esto incluye:

*   **Nombres de redes/subredes:** `"Red 1"`, `"LAN Ventas"`, `"WAN R1-R2"`, etc.
*   **Rangos IP / Máscaras:** `"192.168.1.0/24"`, `"10.0.0.0/30"`, etc.
*   **Cualquier texto informativo** que aparezca en la imagen (nombres de áreas, notas de seguridad, etc.)

El orden de creación es: primero los rectángulos de fondo (z bajo) y luego los textos encima (z alto).

#### Fórmulas de Proporción SVG (para que el tamaño sea homogéneo y simétrico)

```
ancho_svg    = len(contenido) * (font_size * 0.62) + 10   ← Proporcional al texto
alto_svg     = font_size * 1.3                              ← Altura proporcional
fill_opacity = 1.0  (etiquetas con fondo sólido)
             = 0.0  (solo texto, sin fondo)
```

#### Directrices de Formato (Homogeneidad)

| Tipo de Etiqueta | Posición | `bg_color` | Color texto | `font_size` | `z` |
|---|---|---|---|---|---|
| **Nombre de red LAN** | 100u **arriba** del switch o router gateway (x centrado en la LAN) | `#2c3e50` (azul oscuro) | `#FFFFFF` | 11 | 5 |
| **Rango IP LAN** | +30u **abajo** del nombre de red (mismo nodo referencia) | `#2c3e50` | `#FFFFFF` | 10 | 5 |
| **Enlace WAN** | Punto medio entre los dos routers, 80u **arriba** de la línea media | `#1a5276` (azul marino) | `#FFFFFF` | 10 | 5 |
| **Notas especiales** | Cerca del dispositivo relevante, 120u **abajo** | `#7d3c98` (violeta) | `#FFFFFF` | 10 | 5 |
| **Ruta por defecto** | Junto al router que la aplica | `#7d3c98` | `#FFFFFF` | 10 | 5 |

> **Regla de centrado LAN:** La coordenada `x` de una etiqueta LAN = **promedio X de todos los dispositivos de esa LAN** − (ancho_svg / 2).

#### Reglas de Consistencia
*   **TODAS** las etiquetas deben usar el **mismo tamaño de fuente** dentro de su tipo (no mezclar tamaños arbitrariamente).
*   **TODAS** usan fondo oscuro con texto blanco para máxima legibilidad.
*   Si la imagen muestra una etiqueta → debe aparecer en GNS3. Si no aparece en la imagen → no inventarla (excepto rangos IP que son técnicamente necesarios para la documentación).

#### Rectángulos de Área OSPF (type: `rectangle`) — Solo si la topología usa OSPF

Cuando la topología tiene múltiples áreas OSPF, dibujar rectángulos de fondo semitransparentes que engloben visualmente todos los routers de cada área:

| Área | `bg_color` | `fill_opacity` | `z` |
|---|---|---|---|
| Área 0 (Backbone) | `#FFD700` (dorado) | 0.10–0.15 | 1 |
| Área 1 | `#4A90D9` (azul) | 0.10–0.15 | 1 |
| Área 2 | `#27AE60` (verde) | 0.10–0.15 | 1 |
| Área 3+ | `#E67E22` (naranja) | 0.10–0.15 | 1 |

**Reglas de posicionamiento del rectángulo:**
*   `x` e `y`: coordenada **mínima** de los routers del área menos un margen de **80u**.
*   `width` y `height`: span total (coordenada máx − mín de los routers del área) más **160u** de margen.
*   El rectángulo va en `z=1` (fondo). Los dispositivos quedan en z superior automáticamente.
*   Añadir una etiqueta de texto con el nombre del área (exactamente como aparece en el diagrama, ej: `"Área 0"` o `"BACKBONE"`) en la esquina superior izquierda del rectángulo: `font_size=13`, color del área correspondiente, `z=2`.

---

## 5. Configuración de Equipos Cisco (IOS)

### A. Bootstrap Dialog y Diálogos Interactivos — Manejados Automáticamente
El servidor Telnet detecta y responde a los siguientes patrones sin intervención del agente:

| Patrón detectado | Respuesta automática |
|---|---|
| `Would you like to enter the initial configuration dialog` | `no` |
| `[yes/no]` o `[confirm]` durante el boot | `no` |
| `Please answer 'yes' or 'no'` (múltiples instancias) | `no` por cada ocurrencia |

El agente **NO** necesita manejar ningún diálogo de Bootstrap ni respuestas interactivas del router.

### B. Seguridad — **SOLO si el usuario lo indica explícitamente**
No configurar `enable secret` ni `service password-encryption` por default. Si el usuario especifica una contraseña o pide seguridad, entonces:
```
enable secret <contraseña_indicada>
service password-encryption
```

### C. Comandos que el Servidor Inyecta Automáticamente— **NO incluir en el array de comandos**

El servidor prepend-ea estos **7 comandos** antes de ejecutar cualquier cosa del agente:

```
enable
configure terminal
no ip domain-lookup
line con 0
logging synchronous
exec-timeout 0 0
exit
```

> ⚠️ **IMPORTANTE:** Si el agente incluye `enable`, `configure terminal`, `no ip domain-lookup`, `line con 0`, `logging synchronous` o `exec-timeout 0 0` en su array de comandos, se ejecutarán en un contexto incorrecto y generarán errores IOS. **NO duplicarlos.**

La secuencia que el agente sí debe enviar comienza en `hostname` y sigue con las interfaces y el protocolo:

```
hostname <nombre_exacto_del_diagrama>
no ip domain-lookup
interface <Fa0/0>
duplex full
speed 100
ip address <IP> <máscara>
no shutdown
exit
! Repetir por cada interfaz activa...
```

El `end` y `write` finales también los envía el servidor automáticamente al terminar.

### D. Interpretación del Output de `configurar_router_cisco`

El output muestra un resumen por comando:

```
🔧 Configurando R1...
  R1(config)# hostname R1          ✅  ← Comando procesado correctamente
  R1(config)# no ip domain-lookup  ✅
  R1(config)# interface Fa0/0      ✅
  R1(config)# ip address 10.0.0.1 255.255.255.252  ⚠️  ← IOS detectó un % error justo después
  R1# write  ✅

🚨 Errores IOS detectados:
  % Invalid input detected at '^' marker.

🚨 ADVERTENCIA: No se detectó evidencia de que los comandos hayan sido procesados por IOS.
```

*   **✅** = El comando fue ejecutado y no hubo `%` IOS inmediatamente después.
*   **⚠️** = Se detectó un error `%` de IOS en el output posterior al comando.
*   **🚨 ADVERTENCIA** = El servidor no detectó ningún prompt `(config)#` en el output de los comandos del agente. Indica que los comandos probablemente no se procesaron (router en estado inesperado, contexto incorrecto, o timeout).
*   Si aparece 🚨 ADVERTENCIA: ejecutar `ejecutar_comando_router` con `show ip interface brief` para verificar el estado real del router antes de reintentar.

---

## 6. Enrutamiento — Protocolos Soportados

El tipo de enrutamiento a configurar se determina **exclusivamente** por lo que indica el diagrama. El agente **no debe asumir ningún protocolo** si no está claramente indicado.

---

### 6A. Enrutamiento Estático

**Cuándo usarlo:** Cuando el diagrama indica "rutas estáticas" o no hay indicación de protocolo dinámico. Es el más estable en GNS3 para topologías pequeñas.

**Sintaxis IOS:**
```
ip route <red_destino> <máscara_destino> <ip_next_hop>
```

Ejemplo:
```
ip route 10.10.10.128 255.255.255.224 10.10.10.98
ip route 0.0.0.0 0.0.0.0 200.1.1.1    ← Ruta por defecto (si aplica)
```

**Secuencia completa por router (Estático):**
```
enable
configure terminal
hostname R1
no ip domain-lookup
line con 0
logging synchronous
exec-timeout 0 0
exit
interface Fa0/0
duplex full
speed 100
ip address <IP_LAN> <máscara_LAN>
no shutdown
exit
interface Fa1/0
duplex full
speed 100
ip address <IP_WAN> <máscara_WAN>
no shutdown
exit
ip route <red1> <máscara1> <next_hop1>
ip route <red2> <máscara2> <next_hop2>
end
write
```

**Verificación** (usar `ejecutar_comando_router`):
```
show ip route              ← Rutas S (estáticas) en tabla de enrutamiento
show ip interface brief    ← Estado up/down de todas las interfaces
ping <IP_destino>          ← Prueba de conectividad end-to-end
```

---

### 6B. Enrutamiento Dinámico — RIPv2

**Cuándo usarlo:** Cuando el diagrama indica "RIP" o "RIPv2".

**Sintaxis IOS:**
```
router rip
version 2
no auto-summary
network <red_directamente_conectada>
```

> **IMPORTANTE:** `no auto-summary` es **OBLIGATORIO** para que RIPv2 funcione con VLSM (subredes de tamaño diferente). Sin este comando, RIP resumirá rutas incorrectamente y la comunicación fallará.

**Secuencia completa por router (RIPv2):**
```
enable
configure terminal
hostname R1
no ip domain-lookup
line con 0
logging synchronous
exec-timeout 0 0
exit
interface Fa0/0
duplex full
speed 100
ip address <IP_LAN> <máscara_LAN>
no shutdown
exit
interface Fa1/0
duplex full
speed 100
ip address <IP_WAN> <máscara_WAN>
no shutdown
exit
router rip
version 2
no auto-summary
network <red_LAN>
network <red_WAN>
exit
end
write
```

**Verificación** (usar `ejecutar_comando_router`):
```
show ip route              ← Rutas R (RIP) en tabla de enrutamiento
show ip rip database       ← Base de datos RIP (redes aprendidas)
show ip protocols          ← Confirmar versión 2 y redes anunciadas
ping <IP_destino>          ← Prueba de conectividad end-to-end
```

> **Errores comunes RIP:**
> - RIPv1 (default) no soporta VLSM — siempre usar `version 2` + `no auto-summary`.
> - Olvidar anunciar las redes LAN: las VPCs quedan sin alcanzabilidad.
> - Convergencia lenta (~30-120s) dependiendo del número de saltos.

---

### 6C. Enrutamiento Dinámico — OSPF Multi-Area

**Cuándo usarlo:** Cuando el diagrama muestra rectángulos de color agrupando routers por área, menciona "OSPF" o identifica números de área (Área 0, Área 1, etc.).

#### Conceptos Clave
*   **Área 0 (Backbone):** Obligatoria. Todos los demás áreas deben conectarse a ella a través de ABRs.
*   **ABR (Area Border Router):** Router conectado a dos o más áreas OSPF. Sus interfaces anuncian redes en cada área correspondiente. Identificable porque sus `network` statements pertenecen a múltiples áreas.
*   **ASBR (Autonomous System Boundary Router):** Router que redistribuye rutas de otro protocolo (RIP, estáticas, etc.) hacia OSPF. Usa `redistribute` en lugar de (o además de) `network`. Útil en topologías mixtas.
*   **Costo OSPF:** Métrica del enlace. Se configura con `ip ospf cost <N>` en la **interfaz** correspondiente (NO dentro del bloque `router ospf`).

#### Flujo Obligatorio para OSPF

**Paso 1 — Calcular antes de configurar:**
Usar la herramienta `calcular_ospf` pasando todas las redes de cada router. La herramienta calcula wildcards automáticamente y genera los bloques IOS correctos. Mostrar el resumen al usuario y esperar confirmación **antes de enviar cualquier comando a los routers**.

**Paso 2 — Sintaxis IOS:**
```
router ospf 1
network <ip_de_red> <wildcard> area <N>
```

**Cálculo de Wildcard:** `255.255.255.255 - máscara_de_subred`
- `/24` (255.255.255.0)   → wildcard `0.0.0.255`
- `/26` (255.255.255.192) → wildcard `0.0.0.63`
- `/27` (255.255.255.224) → wildcard `0.0.0.31`
- `/28` (255.255.255.240) → wildcard `0.0.0.15`
- `/30` (255.255.255.252) → wildcard `0.0.0.3`

**Paso 3 — Secuencia completa por router (OSPF):**
```
enable
configure terminal
hostname R1
no ip domain-lookup
line con 0
logging synchronous
exec-timeout 0 0
exit
interface <Fa0/0>
duplex full
speed 100
ip address <IP> <máscara>
no shutdown
exit
! Repetir bloque interface para cada interfaz activa del router
router ospf 1
network <red_LAN> <wildcard_LAN> area <N>
network <red_WAN1> <wildcard_WAN1> area <M>
network <red_WAN2> <wildcard_WAN2> area <K>
exit
! Si hay costo específico, configurar POR INTERFAZ (no dentro de router ospf):
interface <Fa0/1>
ip ospf cost <N>
exit
end
write
```

**Paso 4 — Verificación post-configuración** (usar `ejecutar_comando_router`):
```
show ip ospf neighbor        ← Confirmar adyacencias establecidas (estado FULL)
show ip route                ← Verificar rutas O (intra-area) y O IA (inter-area)
show ip ospf interface brief ← Estado e interfaces OSPF activas
```

#### Errores Comunes OSPF
*   **Redes LAN no anunciadas:** Las VPCs no tendrán rutas. Incluir siempre `network` para las redes LAN de cada router.
*   **ABR mal configurado:** Si un ABR no declara sus redes en ambas áreas, el área queda aislada del backbone.
*   **Wildcard incorrecta:** Causa que la red no sea anunciada o que se anuncien subredes erróneas. Siempre usar `calcular_ospf`.
*   **Duplex Mismatch:** Causa mensajes CDP que corrompen la consola. Ya mitigado por `logging synchronous` automático.
*   **Convergencia:** OSPF tarda ~30-60s en converger. Verificar con `show ip ospf neighbor` antes de hacer pings.

---

## 7. Protocolo de Comunicación en Terminal

### Fases (con emojis)
```
📋 Fase 0: Lectura de topología — resumen al usuario — esperar confirmación
         (Si es OSPF: calcular_ospf → reportar wildcards y áreas al usuario)
📡 Fase 1: Creación de Dispositivos (paralelo)
🔌 Fase 2: Cableado Físico (paralelo)
🏷️ Fase 3: Decoraciones y Etiquetas (subredes, WANs, áreas de color si OSPF)
⚙️ Fase 4: Configuración de VPCs (paralelo)
🔧 Fase 5: Configuración de Routers (IPs + interfaces en todos los routers)
🔀 Fase 6: Enrutamiento
         Estático: rutas `ip route` en cada router
         RIPv2:   `router rip / version 2 / no auto-summary / network`
         OSPF:    `router ospf 1 / network <red> <wildcard> area <N>`
🔐 Fase 7: Seguridad (SOLO si el usuario lo indicó explícitamente)
📡 Fase 8: Verificación
         Estático/RIP: `show ip route` + pings end-to-end
         OSPF:         `show ip ospf neighbor` + `show ip route` + pings
📊 Fase 9: Reportes (Excel + Backup .md en Topology_Reports/)
```

*   **Fases 1-4:** ejecutar en **paralelo** (máxima velocidad).
*   **Fases 5-6:** paralelas **por router**, con reporte de ✅/⚠️ por dispositivo.
    *   ⚠️ **Límite de paralelismo:** Dynamips se satura con demasiadas conexiones Telnet simultáneas. Con **5 o más routers**, configurar en **lotes de 3-4 routers** en lugar de todos a la vez. Esperar que cada lote termine antes de iniciar el siguiente.
*   **Fase 7:** SKIP si el usuario no pidió seguridad — **no preguntar**.
*   **Fase 8:** Adaptar los comandos de verificación según el protocolo activo.

---

## 8. Gestión de Archivos de Reporte (CRÍTICO)

**TODOS los reportes van en `Topology_Reports/` sin excepción.** El servidor los redirige automáticamente, pero el agente debe usar la ruta correcta desde el inicio.

*   **Nomenclatura:** heredar del nombre del proyecto GNS3.
    *   `Topology_Reports/Topology_<Proyecto>_IP.xlsx`
    *   `Topology_Reports/Backup_Comandos_<Proyecto>.md`
    *   `Topology_Reports/Trace_Rutas_<Proyecto>.md`
*   **EBUSY:** Si el Excel está abierto al intentar guardar, el servidor crea `_v2.xlsx` automáticamente.
*   **En caso de duda:** Usar `validar_ruta_archivo` antes de escribir cualquier reporte.

---

## 9. Resolución de Problemas (Troubleshooting)

*   **ARP Drop:** El primer ping suele fallar por resolución ARP. Siempre intentar una segunda vez antes de diagnosticar.
*   **Duplex Mismatch:** Genera mensajes CDP que corrompen la consola. Mitigado por `logging synchronous` + `duplex full / speed 100`.
*   **Reset de topología:** Usar `limpiar_proyecto` si la topología se corrompe o los nodos quedan en estado inconsistente.
*   **Convergencia RIP:** Puede tardar 30-120s. Esperar antes de hacer pings de validación.
*   **Convergencia OSPF:** ~30-60s. Verificar con `show ip ospf neighbor` (estado FULL) antes de pings.
*   **ABR aislado:** Verificar que anuncie en ambas áreas con `show ip ospf database`.
*   **Rutas estáticas no aparecen:** Verificar que el next-hop sea alcanzable (interfaz up) y que la IP del next-hop sea correcta.
*   **`% Unknown command or computer name, or unable to find computer address`:** IOS está intentando resolver el texto recibido como hostname DNS. Causa: el router no tenía `no ip domain-lookup` activo cuando llegó ruido de buffer Telnet. El servidor lo inyecta automáticamente en el bootstrap, pero si el router estaba en un estado previo con DNS habilitado puede ocurrir. Solución: ejecutar `configurar_router_cisco` con solo `['no ip domain-lookup']` para desactivarlo antes de continuar.
*   **Comandos con ✅ pero `show ip route` vacío (falso positivo):** El router recibió el texto pero Dynamips estaba saturado y no lo procesó semánticamente. Hacer `ejecutar_comando_router` con `show running-config | include router ospf` para verificar si OSPF quedó configurado. Si no aparece, reintentar la configuración en ese router.

---
*Proyecto GNS3 AI Architect — Servidor MCP v3.3.0 — Estático / RIPv2 / OSPF Multi-Area — Wildcards automáticos, Output limpio, Topology_Reports forzado, Seguridad opcional.*

