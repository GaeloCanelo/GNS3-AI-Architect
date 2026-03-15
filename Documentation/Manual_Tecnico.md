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
*   `conectar_nodos`: Gestiona los puertos y adaptadores para crear enlaces físicos. Soporta el mapeo estricto de parámetros `adapter` y `port` para interconectar interfaces avanzadas (ej. `Fa1/1`).
*   `limpiar_proyecto`: Elimina todos los nodos de forma segura. Implementa un **Polling Estricto Dinámico** (hasta 30s) comprobando reiteradamente contra la API que todos los nodos pasaron al estado `stopped` antes de inicializar la destrucción lenta y evitar el colapso del hipervisor (Dynamips).
*   `agregar_decoracion`: Genera elementos SVG dinámicos para etiquetas de red y áreas visuales.

### Gestión de Configuración (TCP/Telnet)
*   **Bypass de Cisco IOS y Retrases de Arranque:** Los routers (C7200) experimentan un retraso severo por POST (Power-On Self-Test) al iniciar en GNS3 de entre 30 a 40 segundos, por lo cual es imperativo programar demoras antes de enviar comandos por primera vez. El servidor detecta automáticamente el "System Configuration Dialog" (Bootstrap) y envía un `no` para acceder al prompt `Router>`.
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

## 5. Estructura del Repositorio
Para mantener el directorio limpio y organizado, se han designado carpetas específicas para el flujo de trabajo del Agente:
*   `scripts_temporales/`: Directorio donde el Agente guardará cualquier script desechable de prueba (ej. `test_wan.js`) y `.js` temporales para configuraciones que no pertenezcan al servidor MCP principal. Todo el contenido está excluido en el `.gitignore`.
*   `Topology_Workspace/`: Espacio de trabajo dedicado para almacenar y recopilar Archivos Multimedia, Imágenes de Topologías y PDFs que el usuario provea como referencia o contexto para nuevos despliegues.
