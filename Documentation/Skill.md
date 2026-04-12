# Skill: Diseñador y Configurador de Redes GNS3 (MCP) — v3.2.1

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
    *   Decoraciones, etiquetas, notas y rótulos visibles en el diagrama
    *   Requisitos especiales (seguridad, ruta por defecto, etc.)
2.  **Replicar, no interpretar.** La topología en GNS3 debe ser una **copia exacta** del diagrama proporcionado. No se debe:
    *   Inventar nombres de subredes que no aparezcan en la imagen
    *   Cambiar asignaciones de interfaces
    *   Omitir dispositivos o conexiones
    *   Asumir IPs o máscaras no especificadas (preguntar al usuario si faltan datos)
3.  **Confirmar la lectura.** Antes de proceder a crear dispositivos, el agente debe mostrar al usuario un **resumen estructurado** de lo que interpretó de la imagen para validación:

```
📋 Lectura de Topología — [nombre del archivo]
Dispositivos: R1, R2, R3, SW1, SW2, PC1-PC6 (11 nodos)
Redes LAN: 192.168.1.0/24, 192.168.2.0/24, ...
Redes WAN: 10.0.0.0/30, 10.0.0.4/30
Enrutamiento: Estático
Seguridad: enable secret [apellido]
¿Es correcto? Procedo al despliegue.
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
*   `obtener_nodos_proyecto`: Inventario completo de nodos (states, IDs, consola).
*   `obtener_enlaces_proyecto`: Mapa de conexiones físicas (puerto a puerto, Link IDs).
*   `limpiar_proyecto`: Borra TODOS los nodos, enlaces y decoraciones de forma segura.

### Construcción y Diseño
*   `agregar_dispositivo`: Creación de nodos. Devuelve `node_id` y `console port`.
*   `conectar_nodos`: Interconexión física (adaptadores + puertos). Devuelve `link_id`.
*   `agregar_decoracion`: Etiquetado visual (SVG). **Uso obligatorio** (ver §4).

### Configuración y Diagnóstico
*   `configurar_vpc`: Configuración IP para VPCS via Telnet.
*   `configurar_router_cisco`: Comandos IOS via Telnet con **Active Prompt Polling** + verificación post-ejecución.
*   `verificar_conectividad`: Pings con **drain de buffer** previo.
*   `exportar_configuraciones`: Extrae `running-config`. Envía `end` antes de `enable`.

### Reportes y Backup
*   `generar_reporte_excel`: Excel profesional (3 hojas, colores semánticos, formato idéntico a `Topology_IP.xlsx`).
*   `generar_backup_comandos`: Markdown con comandos IOS/VPCS válidos para copy-paste directo.

---

## 3. Capacidades Internas del Servidor
*   **Smart Boot Polling:** Polling TCP activo (45s routers, 5s VPCS).
*   **Active Prompt Polling:** Envía `\r\n` cada 3s durante boot, detecta Bootstrap dialog → `no`. Timeout 60s.
*   **Verificación Post-Ejecución:** Emite 🚨 WARNING si no detecta evidencia de procesamiento.
*   **Buffer Drain:** Descarta buffer residual antes de ejecutar pings.

---

## 4. Estándares de Diseño Físico

### Nombres de Dispositivos (CRÍTICO)
**Los nombres DEBEN ser EXACTAMENTE los de la imagen/documento proporcionado.** NUNCA añadir sufijos (`_E2`, `_Lab1`), prefijos ni modificaciones. Si dice `R1` → `R1`. Si dice `PC3` → `PC3`.

### Posicionamiento
*   **Margen:** 200 unidades de distancia mínima entre nodos.
*   **Distribución:** Respetar la disposición espacial de la imagen original (si R1 está arriba-izquierda, colocarlo arriba-izquierda en GNS3).

### Decoraciones y Etiquetas — `agregar_decoracion` (OBLIGATORIO)
Después de trazar los enlaces, el agente **DEBE** replicar con `agregar_decoracion` **TODAS** las etiquetas, notas y rótulos visibles en el diagrama original. Esto incluye:

*   **Nombres de redes/subredes:** `"Red 1"`, `"LAN Ventas"`, `"WAN R1-R2"`, etc.
*   **Rangos IP / Máscaras:** `"192.168.1.0/24"`, `"10.0.0.0/30"`, etc.
*   **Cualquier texto informativo** que aparezca en la imagen (nombres de áreas, notas de seguridad, etc.)

#### Directrices de Formato (Homogeneidad)
| Tipo de Etiqueta | Posición | Formato |
|---|---|---|
| **Nombre de red LAN** | 100 unidades **encima** del switch o router gateway del segmento | `bg_color: "#2c3e50"`, texto blanco |
| **Rango IP LAN** | Junto o debajo del nombre de red (mismo nodo de referencia, +30 unidades abajo) | `bg_color: "#2c3e50"`, texto blanco |
| **Enlace WAN** | Punto medio entre los dos routers, 80 unidades **encima** de la línea media | `bg_color: "#1a5276"`, texto blanco |
| **Notas especiales** | Cerca del dispositivo relevante, 120 unidades debajo | `bg_color: "#7d3c98"`, texto blanco |

#### Reglas de Consistencia
*   **TODAS** las etiquetas deben usar el **mismo tamaño de fuente** (no mezclar tamaños).
*   **TODAS** usan fondo oscuro con texto blanco para máxima legibilidad.
*   Si la imagen muestra una etiqueta, debe aparecer en GNS3. Si no la muestra, no la inventes (excepto rangos de IP que son técnicamente necesarios).

---

## 5. Configuración de Equipos Cisco (IOS)

### A. Gestión del Primer Inicio (Bootstrap)
El servidor detecta y responde automáticamente el "System Configuration Dialog" con `no`. El agente **NO** necesita incluir `no` como primer comando.

### B. Secuencia de Comandos Obligatoria
1.  `enable`
2.  `configure terminal`
3.  `no ip domain-lookup`
4.  `enable secret <contraseña>` — **SIEMPRE `enable secret`**, NUNCA `enable password`.
5.  `service password-encryption`
6.  Configuración de interfaces con `ip address`, `no shut`, `duplex full`, `speed 100`

### C. Verificación de Errores
El servidor detecta `% Invalid input`, `% Ambiguous command` y verifica evidencia de ejecución (`(config)#`, `Building configuration`). Emite 🚨 WARNING si los comandos no fueron procesados.

---

## 6. Protocolo de Comunicación en Terminal

### Regla de Oro: Velocidad + Visibilidad
Ejecución **rápida** (paralela cuando sea posible) con **anuncios claros** de cada fase:

```
📋 Fase 0: Lectura y validación de topología
📡 Fase 1: Creación de Dispositivos (X nodos en paralelo)
🔌 Fase 2: Cableado Físico (Y enlaces en paralelo)
🏷️ Fase 3: Decoraciones y Etiquetas de Subred
⚙️ Fase 4: Configuración de VPCs (Z PCs en paralelo)
🔧 Fase 5: Configuración de Routers — IPs + Interfaces
🔀 Fase 6: Enrutamiento Estático / Dinámico
🔐 Fase 7: Seguridad (enable secret + service password-encryption)
📡 Fase 8: Verificación de Conectividad (Pings)
📊 Fase 9: Generación de Reportes (Excel + Backup)
```

*   Fases de infraestructura (1-4): en **paralelo**.
*   Fases de configuración (5-7): paralelas, con reporte breve de cada router.
*   **NUNCA sacrificar velocidad** por legibilidad.

---

## 7. Enrutamiento: Estático vs Dinámico (RIP v2)
*   **RIPv2:** Usar `no auto-summary` para VLSM.
*   **Estático (Recomendado):** Mayor estabilidad en GNS3 automatizado.
    *   Ejemplo: `ip route 10.10.10.128 255.255.255.224 10.10.10.98`

---

## 8. Protocolo Post-Despliegue y Reportes (`Topology_Reports/`)
Tras validar la topología (Health Check exitoso), es **OBLIGATORIO** generar:

### Reglas Estrictas:
1.  **Reporte Excel** (`generar_reporte_excel`): Replica el formato del template `Topology_IP.xlsx` (3 hojas, colores semánticos, filas zebra).
2.  **Backup de Comandos** (`generar_backup_comandos`):
    *   Comandos **IOS/VPCS exactos** para copy-paste. NO descripciones.
    *   Incluir **TODOS** los dispositivos: Routers Y PCs/VPCS.
    *   Para routers: secuencia completa (`enable`, `conf t`, `hostname`, `enable secret`, `service password-encryption`, interfaces, rutas, `end`, `write`).
    *   Para VPCs: `ip <IP> <máscara> <gateway>`.
    *   **Sección de Verificación:** Incluir al final:
        *   `show ip route`
        *   `show ip interface brief`
        *   `show running-config | include secret`
        *   Pings entre subredes (resultados resumidos)
3.  **Nombres:** Heredar del proyecto GNS3. Ej: `Examen_Estatico` → `Topology_Examen_Estatico_IP.xlsx`, `Backup_Comandos_Examen_Estatico.md`.

---

## 9. Resolución de Problemas (Troubleshooting)
*   **Convergencia:** RIPv2 ~60s. Estático = inmediato.
*   **ARP Drop:** Primer ping falla. Siempre hacer 2da prueba.
*   **Reset:** Usar `limpiar_proyecto` si la topología se corrompe.
*   **Ruta de regreso:** Si llega al gateway pero no responde, falta la ruta de vuelta.
*   **Duplex mismatch:** `shut` / `no shut` o forzar `duplex full`.
*   **`% Invalid`:** Revisar sintaxis o verificar que interfaz/protocolo existen.

---
*Proyecto GNS3 AI Architect — Servidor MCP v3.2.1 — Lectura fidedigna de topologías, Decoraciones obligatorias, Formato Excel idéntico al template, Backup copy-paste real.*
