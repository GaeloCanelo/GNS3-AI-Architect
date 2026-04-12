# Skill: Diseñador y Configurador de Redes GNS3 (MCP) — v3.1.0

Este documento describe las directrices, estándares y lecciones aprendidas para que un Agente de IA pueda diseñar, configurar y validar topologías de red en GNS3.

## 1. Herramientas del Servidor MCP

### Gestión de Proyectos
*   `obtener_proyectos`: Identificación de entornos de trabajo. Lista todos los proyectos con nombre e ID.
*   `crear_proyecto`: Crea un nuevo proyecto en GNS3 y devuelve el `project_id` generado.
*   `obtener_nodos_proyecto`: Devuelve el inventario completo de nodos con sus states, IDs y puertos de consola.
*   `obtener_enlaces_proyecto`: Muestra el mapa de conexiones físicas (puerto a puerto) con Link IDs.
*   `limpiar_proyecto`: Borra TODOS los nodos, enlaces y decoraciones de forma segura (Polling Estricto + Destrucción Secuencial).

### Construcción y Diseño
*   `agregar_dispositivo`: Creación de nodos usando plantillas de GNS3. **Devuelve el `node_id` y `console port`** del nodo creado, evitando una consulta adicional.
*   `conectar_nodos`: Interconexión física entre dispositivos especificando adaptadores y puertos. **Devuelve el `link_id`**.
*   `agregar_decoracion`: Etiquetado visual (SVG) de subredes y áreas. Soporta rectángulos, elipses y texto con fondo sólido.

### Configuración y Diagnóstico
*   `configurar_vpc`: Configuración IP rápida para nodos terminales (VPCS) via Telnet.
*   `configurar_router_cisco`: Envío de ráfagas de comandos IOS via Telnet con **Active Prompt Polling** (v3.1.0). Espera activamente al prompt IOS enviando Enter cada 3s, detecta y responde automáticamente al Bootstrap dialog (`no`), y **verifica post-ejecución** que los comandos fueron procesados.
*   `verificar_conectividad`: Ejecuta pings inteligentes con **drain de buffer** previo (v3.1.0) para evitar falsos negativos por datos residuales.
*   `exportar_configuraciones`: Extrae el `running-config` de un router Cisco. Envía `end` antes de `enable` para salir de cualquier modo config previo.

### Reportes y Backup (Nuevo en v3.1.0)
*   `generar_reporte_excel`: Genera un archivo Excel profesional con 3 hojas (WAN, LAN, Resumen), merges, colores y formato idéntico al template base `Topology_IP.xlsx`.
*   `generar_backup_comandos`: Genera un archivo Markdown con los comandos ejecutados en cada dispositivo, organizado por secciones. Permite re-configuración manual por copy-paste directo en consola.

---

## 2. Capacidades de Diagnóstico y Respaldo (v3.0.0+)
*   **Diagnóstico de Red:** Utiliza `verificar_conectividad` para confirmar que los cambios realizados son efectivos. Si un ping falla inicialmente, considera el retardo de ARP y realiza una segunda prueba antes de reportar un error.
*   **Respaldo y Documentación:** Tras configurar una red, utiliza `exportar_configuraciones` para extraer los `running-config` de los routers. Esto permite proveer un reporte técnico completo y facilita la replicación de la topología.
*   **Gestión de Topologías:** Antes de realizar cambios, utiliza `obtener_nodos_proyecto` y `obtener_enlaces_proyecto` para entender el estado actual de la red y evitar conflictos de direccionamiento o puertos.
*   **Creación Autónoma:** Si el usuario solicita un entorno nuevo, utiliza `crear_proyecto` para establecer el ID de proyecto antes de proceder con el despliegue de nodos.
*   **Smart Boot Polling:** El servidor realiza polling TCP activo al puerto de consola de los nodos al encenderlos, esperando hasta 45 segundos para routers Cisco.
*   **Active Prompt Polling (v3.1.0):** Después del boot polling TCP, `configurar_router_cisco` envía `\r\n` cada 3 segundos (como presionar Enter repetidamente) mientras monitorea el buffer. Detecta automáticamente el prompt IOS o el Bootstrap dialog y responde `no`. Timeout máximo de 60s. Esto elimina el problema de envío prematuro de comandos durante la descompresión de imagen IOS.
*   **Verificación Post-Ejecución (v3.1.0):** `configurar_router_cisco` analiza el output capturado y emite un WARNING si no detecta evidencia de que los comandos fueron procesados por IOS.
*   **Buffer Drain (v3.1.0):** `verificar_conectividad` descarta automáticamente el buffer residual de la consola Telnet antes de ejecutar el ping, evitando falsos negativos.

---

## 3. Estándares de Diseño Físico
*   **Margen de Seguridad:** Mantener 200 unidades de distancia entre nodos para evitar solapamientos.
*   **Etiquetado SVG:** Usar fondos oscuros (`bg_color: "#2c3e50"`) y texto blanco para legibilidad. El servidor soporta texto con fondo sólido.
*   **Fidelidad Sensorial (Crítico):** Si el usuario proporciona una imagen base para el diseño, el Agente DEBE mapear y respetar meticulosamente cada etiqueta mostrada en esa gráfica (nombres de host, números de interfaces, direcciones IP, mascaras). No se debe inventar ninguna convención ni dirección a menos que se solicite específicamente que se rediseñe o no haya imagen disponible.

---

## 4. Configuración de Equipos Cisco (IOS)
Reglas críticas para automatización efectiva:

### A. Gestión del Primer Inicio (Bootstrap)
Los routers nuevos inician en el "System Configuration Dialog". A partir de v3.1.0, **el servidor detecta y responde automáticamente** este diálogo con `no`. El agente **NO necesita** incluir `no` como primer comando ya que el Active Prompt Polling lo maneja internamente.

### B. Secuencia de Comandos Obligatoria
1.  `enable`: Entrar en modo privilegiado (Prompt `#`).
2.  `configure terminal`: Entrar en modo configuración global.
3.  `no ip domain-lookup`: Evita bloqueos por búsqueda de DNS en comandos fallidos.
4.  **Estabilización de Enlace:** Forzar `duplex full` y `speed 100` en interfaces FastEthernet para evitar descartes de paquetes.

### C. Verificación de Errores (Mejorado en v3.1.0)
El servidor captura la salida completa del router y detecta patrones de error de IOS como `% Invalid input`, `% Ambiguous command`. Además, verifica que el output contenga evidencia real de ejecución (prompt `(config)#` o `Building configuration`). Si los comandos fueron enviados durante el arranque del IOS, emite un 🚨 **WARNING** explícito.

---

## 5. Enrutamiento: Estático vs Dinámico (RIP v2)
*   **RIPv2:** Útil para laboratorios rápidos. Se debe usar `no auto-summary` para VLSM.
*   **Enrutamiento Estático (Recomendado):** Para topologías finales con subnets complejas (/30, /27, /26), el enrutamiento estático ha demostrado mayor estabilidad en el entorno GNS3 automatizado.
    *   Ejemplo: `ip route 10.10.10.128 255.255.255.224 10.10.10.98`

---

## 6. Protocolo Post-Despliegue y Reportes (`Topology_Reports/`)
Una vez que el Agente despliega una topología y la valida como puramente funcional (ej. tras un Health Check End-to-End exitoso), es OBLIGATORIO generar y almacenar dos reportes detallados en la carpeta `Topology_Reports/`.

### Reglas Estrictas de Generación:
1.  **Herramienta MCP Oficial:** Utilizar siempre `generar_reporte_excel` del MCP Server para generar el `.xlsx`. Esta herramienta replica exactamente la estructura del template base (3 hojas, merges, emojis, colores).
2.  **Backup de Comandos:** Utilizar `generar_backup_comandos` para generar un `.md` con los comandos ejecutados en cada dispositivo, permitiendo re-configuración manual.
3.  **Convención de Nombres (Crítico):** Los archivos deben heredar obligatoriamente el nombre del proyecto GNS3 activo. Por ejemplo, si el proyecto se llama `Prueba_Agente`, los reportes deben llamarse `Topology_Prueba_Agente_IP.xlsx` y `Backup_Comandos_Prueba_Agente.md`. No uses nombres genéricos.
4.  **Fidelidad al Molde (Template):** La tabla de direccionamiento generada mediante `generar_reporte_excel` replica automáticamente el diseño del archivo ejemplo `Topology_IP.xlsx`: 3 hojas separadas (WAN, LAN, Resumen), celdas mergeadas, encabezados con color, emojis de sección.
5.  **Contenido Mandatorio:**
    *   Tablas de Direccionamiento IP completas (Interfaces, Direcciones IP, Máscaras de Subred en decimal, Gateways).
    *   Resumen de Red / Segmentación de Subredes LAN y Enlaces WAN P2P.

---

## 7. Resolución de Problemas (Troubleshooting)
*   **Convergencia:** RIPv2 puede tardar hasta 60 segundos. Si usas estático, la convergencia es inmediata.
*   **ARP Drop Inicial:** Al ejecutar comprobaciones de conectividad (Ping) sobre subredes completamente nuevas, el *primer paquete PING fallará sistemáticamente (Timeout)* debido al proceso de resolución ARP de los gateways y mac tables. Siempre se debe proveer un repintado/segunda prueba antes de determinar una falla de configuración.
*   **Reset Total:** Si la topología se corrompe, usa `limpiar_proyecto` desde el MCP o el script `full_reset.js` para limpiar interfaces y rutas antes de reconfigurar.
*   **Trace de Ruta:** Si el paquete llega al Gateway destino pero no responde, el problema es la **ruta de regreso**.
*   **Capa Física:** Errores de "duplex mismatch" en los logs del router indican que el enlace es inestable. Resetear la interfaz con `shut` / `no shut` o forzar `duplex full`.
*   **Errores IOS Silenciosos:** Si `configurar_router_cisco` reporta advertencias de IOS (`% Invalid`), revisa la sintaxis del comando o verifica que la interfaz/protocolo existen en el modelo de router utilizado.

---
*Proyecto GNS3 AI Architect — Servidor MCP v3.1.0 — Active Prompt Polling, Buffer Drain, Reportes Excel profesionales y Backup de comandos.*
