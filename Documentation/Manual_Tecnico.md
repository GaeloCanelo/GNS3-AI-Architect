# Manual Técnico: Agente de Automatización GNS3 (MCP)

Este manual detalla la arquitectura técnica y la lógica del servidor de Protocolo de Contexto de Modelo (MCP) diseñado para controlar GNS3 mediante IA.

## 1. Arquitectura del Sistema
El sistema opera como un puente entre la capacidad multimodal de Gemini y la infraestructura de red de GNS3:
*   **Gemini CLI:** Interfaz de usuario y motor de razonamiento (analiza imágenes/PDFs).
*   **MCP Server (Node.js):** Actúa como traductor, convirtiendo las intenciones de la IA en llamadas a la API de GNS3 o sesiones Telnet.
*   **GNS3 API (Port 3080):** Utilizada para la creación de nodos y gestión de enlaces físicos.
*   **Telnet (Ports 5000+):** Utilizada para la configuración lógica interna de los dispositivos (IOS/VPCS).

## 2. Componentes del Servidor (`index.js`)
El servidor implementa las siguientes herramientas críticas:

### Gestión de Infraestructura (HTTP REST)
*   `agregar_dispositivo`: Realiza un "fuzzy search" en las plantillas de GNS3 (Templates). Si el usuario pide un "c7200", el servidor busca la plantilla más cercana que contenga "c7200" y extrae automáticamente el `compute_id`, `symbol` y la imagen IOS asociada.
*   `conectar_nodos`: Gestiona los puertos y adaptadores para crear enlaces físicos.
*   `agregar_decoracion`: Genera elementos SVG dinámicos para etiquetas de red y áreas visuales.

### Gestión de Configuración (TCP/Telnet)
*   **Bypass de Cisco IOS:** El servidor detecta automáticamente el "System Configuration Dialog" (Bootstrap) y envía un `no` para acceder al prompt `Router>`.
*   **Secuencia de Privilegios:** Implementa el envío de `enable` y `conf t` antes de cualquier ráfaga de comandos. Esto es indispensable para comandos como `ip address` y `router rip`.
*   **Inyección de Comandos:** Maneja retardos (800ms - 1000ms) entre líneas para asegurar la estabilidad del búfer de la consola.

## 3. Limitaciones en Entornos Windows (PowerShell)
Es fundamental que el Agente Gemini utilice únicamente las herramientas MCP:
*   **Conflicto de Curl:** En Windows, `curl` es un alias de `Invoke-WebRequest` en PowerShell. Esto causa que Gemini intente usar sintaxis de Linux en un entorno Windows si decide usar la herramienta nativa `Shell`. 
*   **Solución:** El Agente debe ser instruido (mediante el archivo de Skill o el prompt inicial) para usar exclusivamente las funciones del servidor MCP de Node.js, el cual maneja las peticiones HTTP de forma compatible con cualquier sistema operativo.

## 4. Dependencias Técnicas
*   `@modelcontextprotocol/sdk`: Framework para la comunicación con Gemini.
*   `net`: Módulo nativo de Node.js para comunicaciones TCP (Telnet).
*   `fetch`: Para interactuar con la API REST de GNS3 de forma asíncrona.
