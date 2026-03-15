# Skill: Diseñador y Configurador de Redes GNS3 (MCP)

Este documento describe las directrices, estándares y lecciones aprendidas para que un Agente de IA pueda diseñar, configurar y validar topologías de red en GNS3.

## 1. Herramientas del Servidor MCP
*   `obtener_proyectos`: Identificación de entornos de trabajo.
*   `agregar_dispositivo` / `conectar_nodos`: Construcción de la infraestructura física.
*   `agregar_decoracion`: Etiquetado visual (SVG) de subredes y áreas.
*   `configurar_vpc`: Configuración IP rápida para nodos terminales (VPCS).
*   `configurar_router_cisco`: Envío de ráfagas de comandos para equipos IOS.

---

## 2. Estándares de Diseño Físico
*   **Margen de Seguridad:** Mantener 200 unidades de distancia entre nodos para evitar solapamientos.
*   **Etiquetado SVG:** Usar fondos oscuros (`bg_color: "#2c3e50"`) y texto blanco para legibilidad. El servidor soporta texto con fondo sólido.
*   **Fidelidad Sensorial (Crítico):** Si el usuario proporciona una imagen base para el diseño, el Agente DEBE mapear y respetar meticulosamente cada etiqueta mostrada en esa gráfica (nombres de host, números de interfaces, direcciones IP, mascaras). No se debe inventar ninguna convención ni dirección a menos que se solicite específicamente que se rediseñe o no haya imagen disponible.

---

## 3. Configuración de Equipos Cisco (IOS)
Reglas críticas para automatización efectiva:

### A. Gestión del Primer Inicio (Bootstrap)
Los routers nuevos inician en el "System Configuration Dialog". Si el router es nuevo o se ha reseteado, se DEBE enviar el comando `no` antes de la ráfaga de configuración para acceder al prompt real. *Nota: El servidor MCP actual no detecta esto automáticamente, debe ser parte de la ráfaga de comandos enviada.*

### B. Secuencia de Comandos Obligatoria
1.  `enable`: Entrar en modo privilegiado (Prompt `#`).
2.  `configure terminal`: Entrar en modo configuración global.
3.  `no ip domain-lookup`: Evita bloqueos por búsqueda de DNS en comandos fallidos.
4.  **Estabilización de Enlace:** Forzar `duplex full` y `speed 100` en interfaces FastEthernet para evitar descartes de paquetes.

---

## 4. Enrutamiento: Estático vs Dinámico (RIP v2)
*   **RIPv2:** Útil para laboratorios rápidos. Se debe usar `no auto-summary` para VLSM.
*   **Enrutamiento Estático (Recomendado):** Para topologías finales con subnets complejas (/30, /27, /26), el enrutamiento estático ha demostrado mayor estabilidad en el entorno GNS3 automatizado.
    *   Ejemplo: `ip route 10.10.10.128 255.255.255.224 10.10.10.98`

---

## 5. Protocolo Post-Despliegue y Reportes (`Topology_Reports/`)
Una vez que el Agente despliega una topología y la valida como puramente funcional (ej. tras un Health Check End-to-End exitoso), es OBLIGATORIO generar y almacenar dos reportes detallados en la carpeta `Topology_Reports/`.

### Reglas Estrictas de Generación:
1.  **Formato Dual:** Se DEBEN generar siempre ambos archivos de forma paralela: un `.xlsx` (mediante scripts) y un `.md`.
2.  **Convención de Nombres (Crítico):** Los archivos deben heredar obligatoriamente el nombre del proyecto GNS3 activo. Por ejemplo, si el proyecto se llama `Prueba_Agente`, los reportes deben llamarse `Topology_Prueba_Agente_IP.xlsx` y `Topology_Prueba_Agente_IP.md`. No uses nombres genéricos.
3.  **Fidelidad al Molde (Template):** La tabla de direccionamiento y el desglose generado en el documento Excel **debe imitar exactamente las columnas, diseño y estilo visual** del archivo ejemplo `Topology_IP.xlsx` proporcionado por el usuario previamente. No omitas propiedades.
4.  **Contenido Mandatorio:**
    *   Tablas de Direccionamiento IP completas (Interfaces, Direcciones IP, Máscaras de Subred en decimal, Gateways).
    *   Resumen de Red / Segmentación de Subredes LAN y Enlaces WAN P2P.

---

## 6. Resolución de Problemas (Troubleshooting)
*   **Convergencia:** RIPv2 puede tardar hasta 60 segundos. Si usas estático, la convergencia es inmediata.
*   **ARP Drop Incial:** Al ejecutar comprobaciones de conectividad (Ping) sobre subredes completamente nuevas, el *primer paquete PING fallará sistemáticamente (Timeout)* debido al proceso de resolución ARP de los gateways y mac tables. Siempre se debe proveer un repintado/segunda prueba antes de determinar una falla de configuración.
*   **Reset Total:** Si la topología se corrompe, usa el script `full_reset.js` para limpiar interfaces y rutas antes de reconfigurar.
*   **Trace de Ruta:** Si el paquete llega al Gateway destino pero no responde, el problema es la **ruta de regreso**.
*   **Capa Física:** Errores de "duplex mismatch" en los logs del router indican que el enlace es inestable. Resetear la interfaz con `shut` / `no shut` o forzar `duplex full`.

---
*Proyecto WAN_VLSM reconstruido y validado exitosamente tras un crash de sistema. Conectividad Total confirmada.*
