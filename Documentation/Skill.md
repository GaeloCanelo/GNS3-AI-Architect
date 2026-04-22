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
*   `obtener_decoraciones_proyecto`: Lista todas las decoraciones del proyecto con su `drawing_id`, posición y contenido. **Necesario antes de usar `eliminar_decoracion`.**
*   `limpiar_proyecto`: Borra TODOS los nodos, enlaces y decoraciones de forma segura (stop → polling → delete secuencial).
*   `limpiar_decoraciones`: Elimina **solo** las decoraciones (etiquetas, rectángulos) sin tocar nodos ni enlaces. Útil para rediseñar el etiquetado.

### Construcción y Diseño
*   `agregar_dispositivo`: Busca la plantilla correcta por tipo (`c7200`, `vpcs`, etc.), crea el nodo en la posición (x, y) indicada y devuelve el `node_id` y el puerto de consola. Las coordenadas deben replicar fielmente el layout del diagrama.
*   `conectar_nodos`: Une dos nodos por sus `node_id`, especificando `adapter` y `port` de cada extremo. Devuelve el `link_id`. Es obligatorio respetar los números de interfaz del diagrama (Fa0/0, Fa1/0, etc.).
*   `agregar_decoracion`: **Obligatoria** una vez completado el diseño. Dibuja rectángulos, elípses o textos SVG en el canvas de GNS3. Ver §4 para reglas de posicionamiento y proporciones.
*   `eliminar_dispositivo`: Elimina un nodo individual. Lo detiene primero y borra sus enlaces automáticamente. Requiere `node_id` (obtener con `obtener_nodos_proyecto`).
*   `eliminar_decoracion`: Elimina una única decoración por `drawing_id`. Obtener el ID con `obtener_decoraciones_proyecto` antes de llamarla.

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
*   **Arranque Automático Completo:** `configurar_router_cisco` inyecta esta secuencia ANTES de los comandos del agente: `enable` → `configure terminal` → `no ip domain-lookup` → `line con 0` → `logging synchronous` → `exec-timeout 0 0` → `exit`. Timing: 1200ms de pausa tras detectar el primer prompt y 1000ms entre cada comando del agente, para dar margen a Dynamips con múltiples routers en paralelo.
*   **`ejecutar_comando_router` — Máquina de estados:** Usa secuencia `drain(1200ms) → enable → [espera #] → terminal length 0 → [espera #] → comando → [espera #]`. Cada paso espera el prompt real antes de continuar, evitando que comandos lleguen fuera de contexto en Dynamips saturado.
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

### Posicionamiento y Escala del Canvas
*   **Margen mínimo entre nodos:** 200 unidades.
*   **Distribución:** Respetar la disposición espacial del diagrama original. Si R1 está arriba-izquierda, debe estar arriba-izquierda en GNS3.
*   **Escala global obligatoria:** Antes de colocar nodos, calcular la dimensión total del canvas y normalizar:
    *   Canvas de referencia: **1400 × 900 unidades** para topologías medianas (5-9 dispositivos). Ajustar proporcional para topologías más grandes.
    *   Distribuir los nodos de forma que el diagrama ocupe al menos el **70%** del canvas, no más del **90%** (margenes de 70u en los bordes).
    *   Si todos los routers caben en menos de 600u de ancho → hay una topología demasiado estrecha. Ampliar la distribución X.
*   **No reorganizar** la topología: respetar qué nodos están arriba, abajo, izquierda, derecha respecto al original.

### Decoraciones y Etiquetas — `agregar_decoracion` (OBLIGATORIO)

Después de trazar los enlaces, el agente **DEBE** replicar con `agregar_decoracion` **TODAS** las etiquetas, notas y rótulos visibles en el diagrama original. Esto incluye nombres de redes/subredes, rangos IP, costos OSPF, notas de seguridad y cualquier texto informativo que aparezca en la imagen.

**Si la imagen muestra una etiqueta → debe aparecer en GNS3. Si no aparece → no inventarla.**

#### Reglas de Posicionamiento (Simples)

*   **Etiquetas de Subred/LAN:** Colocar el texto con el nombre o rango de la subred **100 unidades por encima** del nodo central del segmento (router o switch gateway). Fondo oscuro `#2c3e50`, texto blanco.
*   **Etiquetas de Enlace WAN:** Colocar el rango del enlace punto a punto en el **punto medio** entre los dos routers, **80 unidades por encima** de la línea media entre ellos. Fondo `#1a5276`, texto blanco.
*   **Identificadores de puerto** (etiquetas de último octeto como `.65`, `.1`, `.22` pegadas a los routers): **Sin fondo** — `fill_opacity: 0.0`, color de texto `#00D4FF`, `font_size` pequeño (9–10). Posicionarlos a 20–30u del icono del router, del lado del enlace correspondiente.
*   **Homogeneidad:** Todas las etiquetas del mismo tipo deben usar el mismo formato visual. No mezclar tamaños ni colores de fondo dentro del mismo tipo.

#### Orden de creación
Primero los rectángulos de fondo (si hay áreas OSPF), luego las etiquetas de texto encima.

#### Rectángulos de Área OSPF — Solo si la topología usa OSPF

Cuando hay múltiples áreas OSPF, dibujar un rectángulo semitransparente por área que englobe visualmente todos los routers de esa área:

| Área | Color | `fill_opacity` |
|---|---|---|
| Área 0 (Backbone) | `#FFD700` (dorado) | 0.12 |
| Área 1 | `#4A90D9` (azul) | 0.12 |
| Área 2 | `#27AE60` (verde) | 0.12 |
| Área 3+ | `#E67E22` (naranja) | 0.12 |

**Posicionamiento del rectángulo:**
*   `x` = X mínima de los routers del área − **150u**
*   `y` = Y mínima de los routers del área − **150u**
*   `width` = (X_max − X_min) + **300u**
*   `height` = (Y_max − Y_min) + **300u**
*   `z = 1` (fondo). Los nodos quedan automáticamente encima.

Añadir una etiqueta de texto con el nombre exacto del área (ej. `"AREA 0"`, `"AREA 1"`) en la esquina superior izquierda del rectángulo: 20u a la derecha y 20u abajo de su esquina, **sin fondo** (`fill_opacity: 0.0`), color del área, `font_size: 13`.

> ⚠️ **Nota GNS3:** Al hacer clic en el rectángulo, el área seleccionada visualmente puede parecer más grande que el borde del rectángulo. Es comportamiento normal del hitbox de GNS3 — no es un error del tamaño definido.



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
ip address <IP> <máscara>
no shutdown
exit
! Repetir por cada interfaz activa...
```

> ⚠️ **`duplex full` y `speed 100` NO son válidos en c7200 (GNS3):** El modelo c7200 emulado no soporta la negociación manual de duplex/speed en sus adaptadores FastEthernet. Incluir estos comandos causa `% Invalid input` en las interfaces y puede romper la secuencia de inyección. El agente **NO debe incluirlos** — con `ip address` + `no shutdown` es suficiente.

El `end` y `write` finales también los envía el servidor automáticamente al terminar.

> ⚠️ **`reload`, `clear ip ospf process`, `write memory` son comandos de modo PRIVILEGIADO.** `configurar_router_cisco` entra en `configure terminal`, por lo que estos comandos serán rechazados con `% Invalid input`. Para ejecutarlos, usar `ejecutar_comando_router` que opera en modo privilegiado (`Router#`).

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

### A. `generar_backup_comandos` — Reglas Anti-Backup-Incompleto

> ⚠️ **CRÍTICO: El backup DEBE incluir el 100% de los dispositivos de la topología.** Un backup que solo incluye algunos routers o PCs es inútil para replicar la red. El agente DEBE construir el array `devices` con **todos** los nodos: routers, VPCs y switches configurados.

**Checklist antes de llamar a `generar_backup_comandos`:**
1. Enumerar todos los routers (R1, R2, ... Rn) — sin omitir ninguno.
2. Enumerar todos los VPCs (PCa, PCb, PCc, ...) — sin omitir ninguno.
3. Para cada router: incluir **todos** los comandos aplicados: `hostname`, todas las interfaces (`interface FaX/Y`, `ip address`, `ip ospf cost`, `no shutdown`, `exit`), el bloque OSPF/RIP/rutas estáticas completo, y opcionalmente `enable secret` si se configuró seguridad.
4. Para cada VPC: incluir el comando `ip <ip> <gw> <máscara_bits>`.
5. El campo `device_type` es obligatorio: `'router'` o `'vpc'`.
6. Si hay salida de verificación disponible (ej. `show ip ospf neighbor`, `show ip route`), incluirla en `verification_output` del dispositivo correspondiente.

**Estructura esperada por dispositivo:**
```json
{
  "name": "R6",
  "device_type": "router",
  "commands": [
    "hostname R6",
    "interface Fa1/0", "ip address 20.1.1.6 255.255.255.252", "ip ospf cost 4", "no shutdown", "exit",
    "interface Fa2/0", "ip address 20.1.1.22 255.255.255.252", "ip ospf cost 1", "no shutdown", "exit",
    "interface Fa3/0", "ip address 40.4.4.2 255.255.255.252", "ip ospf cost 1", "no shutdown", "exit",
    "router ospf 1",
    "network 20.1.1.4 0.0.0.3 area 0",
    "network 20.1.1.20 0.0.0.3 area 0",
    "network 40.4.4.0 0.0.0.3 area 2",
    "exit"
  ]
}
```

### B. `generar_reporte_excel` — Reglas Anti-Columnas-Vacías

> ⚠️ **CRÍTICO: El Excel detecta columnas OSPF automáticamente** si algún elemento del array tiene `wildcard`, `area_ospf` o `costo_ospf`. Si activas las columnas OSPF, **TODOS** los elementos deben tener esos campos con valor (nunca `null` o `undefined`). Un solo elemento sin valor genera una columna vacía.

**Para WAN links (`wan_links`):**
- Si es topología OSPF: incluir `wildcard` (ej. `"0.0.0.3"`), `area_ospf` (ej. `0` o `1`) y `costo_ospf` (ej. `5`) en **todos** los links WAN sin excepción.
- Si no es OSPF: omitir esos campos completamente en todos los links (no pasar `wildcard: ""`).
- Campo `router1` y `router2`: incluir el nombre del router **y la interfaz** entre paréntesis, ej. `"R1 (Fa1/0)"`.

**Para LAN links (`lan_links`):**
- Si es OSPF: incluir `wildcard` y `area_ospf` en **todos** los links LAN sin excepción.
- Campo `gateway`: incluir nombre del router y la interfaz, ej. `"R1 (Fa0/0)"`.
- Campo `ip_vpcs`: IP asignada al VPCS (ej. `"210.1.1.66"`).

**Para el Resumen (`resumen`):** Incluir al menos estos parámetros:
- Nombre del Proyecto, Protocolo, Número de Routers, Número de VPCs, Áreas OSPF (si aplica), Total de Subredes, Fecha de configuración.

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
*   **OSPF no converge — tabla de rutas vacía a pesar de comandos ✅:** Causa más común: las interfaces no están en estado `up/up` porque `duplex full` / `speed 100` generaron error en c7200 y la interfaz quedó `down`. Verificar con `show ip interface brief`: si hay interfaces `administratively down` o `down`, reconfigurarlas con solo `ip address` + `no shutdown` (sin duplex/speed). Si todas las interfaces están `up/up` pero OSPF no formó adyacencias, usar `ejecutar_comando_router` con `clear ip ospf process` (el router pedirá confirmación `yes` — la herramienta espera el prompt tras el comando).
*   **`duplex full` / `speed 100` con ⚠️ en c7200:** El modelo c7200 emulado no soporta estos comandos en FastEthernet. Genera `% Invalid input`. El agente **NO debe incluirlos** en la secuencia de configuración de routers c7200.
*   **`show ip route` / `show ip ospf neighbor` devuelven solo el prompt vacío (`R1#`):** El router Dynamips tiene el proceso de consola "mudo" por saturación de CPU o errores de Bootflash (`% Crashinfo may not be recovered at bootflash`). Pasos: (1) Esperar 30s y reintentar. (2) Si persiste, usar `ejecutar_comando_router` con `show processes cpu` para confirmar saturación. (3) Último recurso: reiniciar el nodo via GNS3 API con `detener_nodo` + `iniciar_nodo` y esperar el boot completo (60s) antes de reconfigurar.
*   **`reload` con ⚠️ en `configurar_router_cisco`:** `reload` es un comando de modo privilegiado. No puede ejecutarse dentro de `configure terminal`. Usar `ejecutar_comando_router` con el comando `reload` para que se envíe en modo `Router#`.
*   **LSA Tipo 3 no propagados — R1 aprende WANs del Área 2 pero NO las LANs remotas:** Este es el fallo más sutil de OSPF Multi-Area. Síntoma: `show ip route ospf` en R1 muestra rutas `O IA` hacia las WANs del Área 2 (p.ej. `40.4.4.4/30`) pero nunca aparecen las LANs (p.ej. `220.2.2.0/26`). Los pings fallan con `Destination host unreachable`.
    *   **Causa A — network faltante en ABR:** El ABR (R6/R7) necesita un `network` statement que cubra la subred WAN que lo conecta directamente con los routers internos (R8/R9). Si esa subred WAN no está anunciada, el ABR no recibe los LSA de R8/R9 y no puede generar los LSA Tipo 3 hacia el backbone.
    *   **Causa B — network en router equivocado:** Poner `network 220.2.2.0 area 2` en R6/R7 cuando esos routers no tienen interfaces en esa subred es un no-op: IOS acepta el comando pero no anuncia nada porque ninguna interfaz coincide.
    *   **Diagnóstico:** Ejecutar `show ip ospf database` en el ABR sospechoso. Si no hay LSA Tipo 1 de R8/R9 en la base de datos, el ABR no tiene adyacencia con ellos → verificar IPs y `network` de la subred WAN directa entre ABR↔router interno.
    *   **Diagnóstico 2:** Ejecutar `show ip route ospf` en el ABR (R6/R7). Si el ABR no ve la LAN `220.2.2.0/26` en su propia tabla, no puede redistribuirla como LSA Tipo 3.
    *   **Fix:** Asegurar que **cada router anuncie ÚNICAMENTE las subredes de sus propias interfaces** con el `network` correcto. No poner `network` de subredes que no corresponden a interfaces del router.

---
*Proyecto GNS3 AI Architect — Servidor MCP v3.3.0 — Estático / RIPv2 / OSPF Multi-Area — Wildcards automáticos, Output limpio, Topology_Reports forzado, Seguridad opcional.*

