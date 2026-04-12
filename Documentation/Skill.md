# Skill: Diseñador y Configurador de Redes GNS3 (MCP) — v3.0.0

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
*   `configurar_router_cisco`: Envío de ráfagas de comandos IOS via Telnet. **Captura y devuelve la salida completa del router**, incluyendo detección de errores IOS (`% Invalid`, `% Ambiguous`).
*   `verificar_conectividad`: Ejecuta pings inteligentes desde VPCs o Routers, diferenciando automáticamente la sintaxis según el tipo de nodo.
*   `exportar_configuraciones`: Extrae el `running-config` de un router Cisco. Entra automáticamente en modo `enable`.

---

## 2. Capacidades de Diagnóstico y Respaldo (v3.0.0+)
*   **Diagnóstico de Red:** Utiliza `verificar_conectividad` para confirmar que los cambios realizados son efectivos. Si un ping falla inicialmente, considera el retardo de ARP y realiza una segunda prueba antes de reportar un error.
*   **Respaldo y Documentación:** Tras configurar una red, utiliza `exportar_configuraciones` para extraer los `running-config` de los routers. Esto permite proveer un reporte técnico completo y facilita la replicación de la topología.
*   **Gestión de Topologías:** Antes de realizar cambios, utiliza `obtener_nodos_proyecto` y `obtener_enlaces_proyecto` para entender el estado actual de la red y evitar conflictos de direccionamiento o puertos.
*   **Creación Autónoma:** Si el usuario solicita un entorno nuevo, utiliza `crear_proyecto` para establecer el ID de proyecto antes de proceder con el despliegue de nodos.
*   **Smart Boot Polling:** El servidor realiza polling TCP activo al puerto de consola de los nodos al encenderlos, esperando hasta 45 segundos para routers Cisco. Solo procede cuando la consola está realmente lista.

---

## 3. Estándares de Diseño Físico
*   **Margen de Seguridad:** Mantener 200 unidades de distancia entre nodos para evitar solapamientos.
*   **Etiquetado SVG:** Usar fondos oscuros (`bg_color: "#2c3e50"`) y texto blanco para legibilidad. El servidor soporta texto con fondo sólido.
*   **Fidelidad Sensorial (Crítico):** Si el usuario proporciona una imagen base para el diseño, el Agente DEBE mapear y respetar meticulosamente cada etiqueta mostrada en esa gráfica (nombres de host, números de interfaces, direcciones IP, mascaras). No se debe inventar ninguna convención ni dirección a menos que se solicite específicamente que se rediseñe o no haya imagen disponible.

---

## 4. Configuración de Equipos Cisco (IOS)
Reglas críticas para automatización efectiva:

### A. Gestión del Primer Inicio (Bootstrap)
Los routers nuevos inician en el "System Configuration Dialog". Se DEBE enviar el comando `no` antes de la ráfaga de configuración para acceder al prompt real. **El agente debe incluir `no` como primer comando** en la ráfaga de `configurar_router_cisco` cuando el router es nuevo o se ha reseteado.

### B. Secuencia de Comandos Obligatoria
1.  `enable`: Entrar en modo privilegiado (Prompt `#`).
2.  `configure terminal`: Entrar en modo configuración global.
3.  `no ip domain-lookup`: Evita bloqueos por búsqueda de DNS en comandos fallidos.
4.  **Estabilización de Enlace:** Forzar `duplex full` y `speed 100` en interfaces FastEthernet para evitar descartes de paquetes.

### C. Verificación de Errores (Nuevo en v3.0.0)
El servidor ahora captura la salida completa del router y detecta patrones de error de IOS como `% Invalid input`, `% Ambiguous command`. Si se detectan errores, se incluyen como advertencias en la respuesta. **Siempre revisa la salida del router** para confirmar que los comandos fueron aceptados.

---

## 5. Enrutamiento: Estático vs Dinámico (RIP v2)
*   **RIPv2:** Útil para laboratorios rápidos. Se debe usar `no auto-summary` para VLSM.
*   **Enrutamiento Estático (Recomendado):** Para topologías finales con subnets complejas (/30, /27, /26), el enrutamiento estático ha demostrado mayor estabilidad en el entorno GNS3 automatizado.
    *   Ejemplo: `ip route 10.10.10.128 255.255.255.224 10.10.10.98`

---

## 6. Protocolo Post-Despliegue y Reportes (`Topology_Reports/`)
Una vez que el Agente despliega una topología y la valida como puramente funcional (ej. tras un Health Check End-to-End exitoso), es OBLIGATORIO generar y almacenar dos reportes detallados en la carpeta `Topology_Reports/`.

### Reglas Estrictas de Generación:
1.  **Formato Dual:** Se DEBEN generar siempre ambos archivos de forma paralela: un `.xlsx` (mediante scripts) y un `.md`.
2.  **Convención de Nombres (Crítico):** Los archivos deben heredar obligatoriamente el nombre del proyecto GNS3 activo. Por ejemplo, si el proyecto se llama `Prueba_Agente`, los reportes deben llamarse `Topology_Prueba_Agente_IP.xlsx` y `Topology_Prueba_Agente_IP.md`. No uses nombres genéricos.
3.  **Fidelidad al Molde (Template):** La tabla de direccionamiento y el desglose generado en el documento Excel **debe imitar exactamente las columnas, diseño y estilo visual** del archivo ejemplo `Topology_IP.xlsx` proporcionado por el usuario previamente. No omitas propiedades.
4.  **Contenido Mandatorio:**
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
*Proyecto GNS3 AI Architect — Servidor MCP v3.0.0 — Confiabilidad y eficiencia mejoradas.*
