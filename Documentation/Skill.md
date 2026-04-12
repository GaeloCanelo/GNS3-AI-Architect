# Skill: Diseñador y Configurador de Redes GNS3 (MCP) — v3.2.0

Este documento describe las directrices, estándares y lecciones aprendidas para que un Agente de IA pueda diseñar, configurar y validar topologías de red en GNS3.

## 1. Herramientas del Servidor MCP

### Gestión de Proyectos
*   `obtener_proyectos`: Identificación de entornos de trabajo. Lista todos los proyectos con nombre e ID.
*   `crear_proyecto`: Crea un nuevo proyecto en GNS3, lo abre automáticamente en la GUI y devuelve el `project_id`.
*   `obtener_nodos_proyecto`: Devuelve el inventario completo de nodos con sus states, IDs y puertos de consola.
*   `obtener_enlaces_proyecto`: Muestra el mapa de conexiones físicas (puerto a puerto) con Link IDs.
*   `limpiar_proyecto`: Borra TODOS los nodos, enlaces y decoraciones de forma segura (Polling Estricto + Destrucción Secuencial).

### Construcción y Diseño
*   `agregar_dispositivo`: Creación de nodos usando plantillas de GNS3. **Devuelve el `node_id` y `console port`** del nodo creado, evitando una consulta adicional.
*   `conectar_nodos`: Interconexión física entre dispositivos especificando adaptadores y puertos. **Devuelve el `link_id`**.
*   `agregar_decoracion`: Etiquetado visual (SVG) de subredes y áreas. Soporta rectángulos, elipses y texto con fondo sólido. **Uso obligatorio** (ver §3).

### Configuración y Diagnóstico
*   `configurar_vpc`: Configuración IP rápida para nodos terminales (VPCS) via Telnet.
*   `configurar_router_cisco`: Envío de ráfagas de comandos IOS via Telnet con **Active Prompt Polling**. Espera activamente al prompt IOS enviando Enter cada 3s, detecta y responde automáticamente al Bootstrap dialog (`no`), y **verifica post-ejecución** que los comandos fueron procesados.
*   `verificar_conectividad`: Ejecuta pings inteligentes con **drain de buffer** previo para evitar falsos negativos por datos residuales.
*   `exportar_configuraciones`: Extrae el `running-config` de un router Cisco. Envía `end` antes de `enable` para salir de cualquier modo config previo.

### Reportes y Backup
*   `generar_reporte_excel`: Genera un archivo Excel profesional con 3 hojas (WAN, LAN, Resumen), colores semánticos por columna, filas zebra y formato **idéntico** al template base `Topology_IP.xlsx`.
*   `generar_backup_comandos`: Genera un archivo Markdown con los comandos ejecutados en cada dispositivo. Los comandos deben ser **IOS/VPCS válidos** para copy-paste directo.

---

## 2. Capacidades Internas del Servidor
*   **Smart Boot Polling:** Polling TCP activo al puerto de consola (hasta 45s para routers, 5s para VPCS).
*   **Active Prompt Polling:** Envía `\r\n` cada 3s durante el boot, detecta Bootstrap dialog y responde `no`. Timeout máximo de 60s.
*   **Verificación Post-Ejecución:** Analiza output capturado y emite 🚨 WARNING si no detecta evidencia de procesamiento.
*   **Buffer Drain:** Descarta buffer residual de la consola Telnet antes de ejecutar pings.

---

## 3. Estándares de Diseño Físico

### Nombres de Dispositivos (CRÍTICO)
**Los nombres de los dispositivos deben respetar EXACTAMENTE los indicados en la imagen o documento proporcionado.** NUNCA añadir sufijos (`_E2`, `_Lab1`), prefijos ni modificaciones a los nombres originales. Si la imagen dice `R1`, el nodo se llama `R1`. Si dice `PC3`, se llama `PC3`.

### Posicionamiento
*   **Margen de Seguridad:** Mantener 200 unidades de distancia entre nodos para evitar solapamientos.
*   **Fidelidad Sensorial (Crítico):** Si el usuario proporciona una imagen base, el Agente DEBE mapear y respetar meticulosamente cada etiqueta (nombres de host, interfaces, IPs, máscaras). No se debe inventar ninguna convención a menos que se solicite específicamente.

### Decoraciones Obligatorias — `agregar_decoracion`
Después de trazar los enlaces, el Agente **DEBE** usar `agregar_decoracion` para etiquetar cada segmento de red visible en el diagrama original. Directrices:

*   **Etiquetas de Subred:** Colocar un texto con el nombre/rango de la subred cerca del segmento correspondiente.
    *   Posición: **100 unidades por encima** del nodo central del segmento (ej. router o switch).
    *   Formato: fondo oscuro (`bg_color: "#2c3e50"`), texto blanco, tamaño legible.
    *   Ejemplo: `"Red 1 — 192.168.1.0/24"` sobre el Switch1.
*   **Etiquetas WAN:** Colocar el rango del enlace punto a punto en el **punto medio** entre los dos routers.
    *   Posición: **80 unidades por encima** de la línea media entre los dos routers.
    *   Ejemplo: `"WAN — 10.0.0.0/30"` entre R1 y R2.
*   **Homogeneidad:** Todas las etiquetas deben usar el **mismo formato visual** (mismo fondo, mismo tamaño de texto, misma altura relativa). No mezclar estilos.

---

## 4. Configuración de Equipos Cisco (IOS)
Reglas críticas para automatización efectiva:

### A. Gestión del Primer Inicio (Bootstrap)
El servidor detecta y responde automáticamente el "System Configuration Dialog" con `no`. El agente **NO necesita** incluir `no` como primer comando.

### B. Secuencia de Comandos Obligatoria
1.  `enable`: Entrar en modo privilegiado (Prompt `#`).
2.  `configure terminal`: Entrar en modo configuración global.
3.  `no ip domain-lookup`: Evita bloqueos por búsqueda de DNS en comandos fallidos.
4.  `enable secret <contraseña>`: **USAR SIEMPRE `enable secret`**, NUNCA `enable password`. `enable secret` cifra la contraseña con MD5.
5.  `service password-encryption`: Cifra todas las contraseñas en texto plano del running-config.
6.  **Estabilización de Enlace:** Forzar `duplex full` y `speed 100` en interfaces FastEthernet para evitar descartes de paquetes.

### C. Verificación de Errores
El servidor captura la salida completa del router y detecta patrones de error de IOS (`% Invalid input`, `% Ambiguous command`). Además, verifica que el output contenga evidencia real de ejecución (`(config)#` o `Building configuration`). Si los comandos fueron enviados durante el arranque del IOS, emite un 🚨 **WARNING** explícito.

---

## 5. Protocolo de Comunicación en Terminal

### Regla de Oro: Velocidad + Visibilidad
La ejecución debe ser **rápida** (llamadas paralelas cuando sea posible) pero el agente debe **anunciar claramente** cada fase de trabajo para que el usuario pueda seguir el progreso en la terminal.

### Formato de Anuncios por Fase
Al iniciar cada grupo de operaciones, el agente debe escribir un encabezado claro en la terminal:

```
📡 Fase 1: Creación de Dispositivos (11 nodos en paralelo)
🔌 Fase 2: Cableado Físico (10 enlaces en paralelo)
🏷️ Fase 3: Decoraciones de Subred
⚙️ Fase 4: Configuración de VPCs (6 PCs en paralelo)
🔧 Fase 5: Configuración de Routers — IPs + Interfaces
🔀 Fase 6: Enrutamiento Estático / Dinámico
🔐 Fase 7: Seguridad (enable secret + service password-encryption)
📡 Fase 8: Verificación de Conectividad (Pings)
📊 Fase 9: Generación de Reportes (Excel + Backup)
```

*   Las fases de **infraestructura** (1-4) se ejecutan en **paralelo** para máxima velocidad.
*   Las fases de **configuración de routers** (5-7) pueden ser paralelas pero el agente debe reportar el resultado de cada router brevemente.
*   **NUNCA sacrificar velocidad** por legibilidad. El objetivo es que el log sea escaneable, no que sea lento.

---

## 6. Enrutamiento: Estático vs Dinámico (RIP v2)
*   **RIPv2:** Útil para laboratorios rápidos. Se debe usar `no auto-summary` para VLSM.
*   **Enrutamiento Estático (Recomendado):** Para topologías finales con subnets complejas (/30, /27, /26), el enrutamiento estático ha demostrado mayor estabilidad en el entorno GNS3 automatizado.
    *   Ejemplo: `ip route 10.10.10.128 255.255.255.224 10.10.10.98`

---

## 7. Protocolo Post-Despliegue y Reportes (`Topology_Reports/`)
Una vez que el Agente despliega una topología y la valida como funcional (ej. tras un Health Check End-to-End exitoso), es OBLIGATORIO generar y almacenar reportes en la carpeta `Topology_Reports/`.

### Reglas Estrictas de Generación:
1.  **Reporte Excel:** Utilizar siempre `generar_reporte_excel` del MCP Server. Replica automáticamente el diseño del template `Topology_IP.xlsx` (3 hojas, colores semánticos por columna, filas zebra, emojis).
2.  **Backup de Comandos (CRÍTICO):** Utilizar `generar_backup_comandos`. El contenido debe ser:
    *   **Comandos IOS/VPCS exactos** y válidos para copy-paste directo en consola. NO descripciones resumidas.
    *   Incluir **TODOS los dispositivos**: Routers Y PCs/VPCS.
    *   Para routers: incluir la secuencia completa (`enable`, `conf t`, `hostname`, `enable secret`, `service password-encryption`, `interface`, `ip address`, `no shut`, `ip route`, `end`, `write`).
    *   Para VPCs: incluir el comando `ip <IP> <máscara> <gateway>`.
    *   **Sección de Verificación:** Al final del backup, añadir una sección con los comandos de comprobación ejecutados:
        *   `show ip route` — Tabla de enrutamiento
        *   `show ip interface brief` — Estado de interfaces
        *   `show running-config | include secret` — Verificación de seguridad
        *   Pings entre subredes (resultados resumidos)
3.  **Convención de Nombres (Crítico):** Los archivos deben heredar el nombre del proyecto GNS3 activo. Ej: proyecto `Examen_Estatico` → `Topology_Examen_Estatico_IP.xlsx` y `Backup_Comandos_Examen_Estatico.md`.
4.  **Contenido Mandatorio del Excel:**
    *   Tablas de Direccionamiento IP completas (Interfaces, Direcciones IP, Máscaras de Subred en decimal, Gateways).
    *   Resumen de Red / Segmentación de Subredes LAN y Enlaces WAN P2P.

---

## 8. Resolución de Problemas (Troubleshooting)
*   **Convergencia:** RIPv2 puede tardar hasta 60 segundos. Si usas estático, la convergencia es inmediata.
*   **ARP Drop Inicial:** El primer paquete PING fallará sistemáticamente (Timeout) por resolución ARP. Siempre se debe proveer una segunda prueba antes de determinar una falla.
*   **Reset Total:** Si la topología se corrompe, usa `limpiar_proyecto` desde el MCP.
*   **Trace de Ruta:** Si el paquete llega al Gateway destino pero no responde, el problema es la **ruta de regreso**.
*   **Capa Física:** Errores de "duplex mismatch" → resetear interfaz con `shut` / `no shut` o forzar `duplex full`.
*   **Errores IOS Silenciosos:** Si `configurar_router_cisco` reporta `% Invalid`, revisa la sintaxis o verifica que la interfaz/protocolo existen en el modelo de router.

---
*Proyecto GNS3 AI Architect — Servidor MCP v3.2.0 — Formato Excel fidedigno, Backup copy-paste real, Decoraciones obligatorias, Comunicación por fases.*
