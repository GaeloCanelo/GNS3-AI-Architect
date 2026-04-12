# Manual Técnico: Agente de Automatización GNS3 (MCP) — v3.0.0

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
*   **`crear_proyecto`**: Envía un `POST` a `/projects`. Es la única herramienta que no requiere un `project_id` previo, ya que lo genera.
*   **`obtener_nodos_proyecto` / `obtener_enlaces_proyecto`**: Consultan el estado actual del mapa. Se usa un `nodeMap` interno para traducir los IDs a nombres legibles en el reporte de enlaces. Incluye información de adapters y puertos de consola.
*   `agregar_dispositivo`: Realiza un "fuzzy search" en las plantillas de GNS3 (Templates). Si el usuario pide un "c7200", el servidor busca la plantilla más cercana que contenga "c7200" y extrae automáticamente el `compute_id`, `symbol` y la imagen IOS asociada. **Devuelve el `node_id` y puerto de consola** como parte de la respuesta, eliminando la necesidad de consultas adicionales.
*   `conectar_nodos`: Gestiona los puertos y adaptadores para crear enlaces físicos. Soporta el mapeo estricto de parámetros `adapter` y `port` para interconectar interfaces avanzadas (ej. `Fa1/1`). **Devuelve el `link_id`**.
*   `limpiar_proyecto`: Elimina todos los nodos de forma segura. Envía señales de apagado en paralelo, luego implementa un **Polling Estricto Dinámico** (hasta 30s) comprobando reiteradamente contra la API que todos los nodos pasaron al estado `stopped` antes de inicializar la destrucción secuencial conservadora (1s entre nodos) para evitar el colapso del hipervisor (Dynamips).
*   `agregar_decoracion`: Genera elementos SVG dinámicos para etiquetas de red y áreas visuales.

### Gestión de Configuración y Diagnóstico (TCP/Telnet)
*   **`configurar_router_cisco` (Prompt-Driven)**: Utiliza detección de prompt del router (`>` o `#`) para enviar comandos tan pronto como el dispositivo esté listo, con un fallback de 600ms si el prompt no se detecta. **Captura la salida completa del router** y detecta automáticamente errores de IOS (`% Invalid`, `% Ambiguous`, `% Incomplete`) incluyéndolos como advertencias en la respuesta.
*   **`verificar_conectividad` (Ping Inteligente)**: Diferencia entre nodos `vpcs` y otros (Routers). Envía el comando de ping adecuado según el tipo de nodo. Utiliza regex robusta para analizar los resultados: detecta `Success rate is X percent` (Cisco IOS), `N packets received` (VPCS) y patrones de exclamación (`!!!!`).
*   **`exportar_configuraciones` (Backup)**: Establece conexión Telnet, **entra automáticamente en modo `enable`**, ejecuta `terminal length 0` para deshabilitar la paginación en IOS, captura la salida completa del `show running-config` con detección precisa del marcador `\nend\n` y la devuelve como texto.
*   **Smart Boot Polling:** Cuando un nodo necesita ser encendido, el servidor realiza polling TCP activo al puerto de consola (hasta 45s para routers, 5s para VPCS) en lugar de esperas fijas. Solo procede cuando la consola realmente acepta conexión.
*   **Gestión del Bootstrap:** El servidor **NO** detecta automáticamente el "System Configuration Dialog" (Bootstrap) de IOS. Es responsabilidad del agente IA incluir el comando `no` como primer elemento de la ráfaga si el router es nuevo o se ha reseteado.
*   **Anti-Race Conditions:** Todas las funciones Telnet utilizan un flag `settled` y `clearTimeout` para prevenir doble resolución de Promises y errores `UnhandledRejection`.

## 3. Componente de Health Check (`health_check.js`)
Script independiente que ejecuta auditorías de conectividad End-to-End:
*   Descubre automáticamente todas las VPCS encendidas con IP asignada.
*   Realiza pruebas de ping cruzadas entre todos los pares de VPCS.
*   Genera un resumen con estado SALUDABLE/DEGRADADO.
*   Requiere `project_id` como argumento. Si no se proporciona, lista los proyectos disponibles.
*   **Uso:** `node health_check.js <project_id>`

## 4. Limitaciones en Entornos Windows (PowerShell)
Es fundamental que el Agente Gemini utilice únicamente las herramientas MCP:
*   **Conflicto de Curl:** En Windows, `curl` es un alias de `Invoke-WebRequest` en PowerShell. Esto causa que Gemini intente usar sintaxis de Linux en un entorno Windows si decide usar la herramienta nativa `Shell`. 
*   **Solución:** El Agente debe ser instruido (mediante el archivo de Skill o el prompt inicial) para usar exclusivamente las funciones del servidor MCP de Node.js, el cual maneja las peticiones HTTP de forma compatible con cualquier sistema operativo.

## 5. Dependencias Técnicas
*   `@modelcontextprotocol/sdk`: Framework para la comunicación con Gemini.
*   `net`: Módulo nativo de Node.js para comunicaciones TCP (Telnet).
*   `fetch`: Para interactuar con la API REST de GNS3 de forma asíncrona.

## 6. Estructura del Repositorio
Para mantener el directorio limpio y organizado, se han designado carpetas específicas para el flujo de trabajo del Agente:
*   `scripts_temporales/`: Directorio donde el Agente guardará cualquier script desechable de prueba (ej. `test_wan.js`) y `.js` temporales para configuraciones que no pertenezcan al servidor MCP principal. Todo el contenido está excluido en el `.gitignore`.
*   `Topology_Workspace/`: Espacio de trabajo dedicado para almacenar y recopilar Archivos Multimedia, Imágenes de Topologías y PDFs que el usuario provea como referencia o contexto para nuevos despliegues.

## 7. Changelog
| Versión | Cambios |
|---------|---------|
| v2.9.0  | Herramientas de diagnóstico y respaldo: `verificar_conectividad`, `exportar_configuraciones` |
| v3.0.0  | Anti-race conditions en Telnet, prompt-driven delays, captura de output con detección de errores IOS, smart boot polling, `enable` automático en exports, regex robusta para pings, devolución de IDs en respuestas |
