# 🤖 Guía de Prompts para Agentes GNS3 (MCP)

Este documento contiene plantillas de **Prompts Recomendados** (Instrucciones) diseñados para maximizar la eficiencia y precisión de diferentes Agentes de IA (Gemini CLI, Google Antigravity, Claude, etc.) al interactuar con el Servidor MCP de GNS3.

Copie y pegue estos prompts según la fase de despliegue que necesite, o utilice el "Prompt Maestro" para despliegues End-to-End.

---

## 🎯 Prompts Específicos por Fase

Utiliza estos prompts si prefieres tener control absoluto y avanzar paso a paso:

### Fase 1: Diseño Físico y Etiquetado
> **Prompt:**
> "Actúa como un Arquitecto de Redes. Basándote en la imagen/PDF de la topología proporcionada en la carpeta `Topology_Workspace`, utiliza el servidor MCP para diseñar la jerarquía física en el proyecto GNS3 actual.
> 1. Agrega todos los dispositivos (Routers, Switches, VPCS) manteniendo sus nombres exactos.
> 2. Conecta todas las interfaces físicas respetando estrictamente los puertos indicados en la imagen (e.g. Fa1/1 con Fa0/0).
> 3. Añade decoraciones SVG para delimitar visualmente las subredes y coloca etiquetas de texto con las IPs/Máscaras de las Lans y Enlaces WAN. No configures lógica todavía, solo diseño físico."

### Fase 2: Configuración Inicial (IPs e Interfaces)
> **Prompt:**
> "El diseño físico de la red ya está en GNS3. Ahora, procede con la fase de Bootstrap (Zero-Touch Provisioning):
> 1. Inicia todos los nodos si están apagados.
> 2. Una vez encendidos, usa Telnet para configurar el direccionamiento IP de cada interfaz en los Routers según las etiquetas del mapa. Recuerda ejecutar `no shut` y establecer `duplex full` / `speed 100` en las interfaces.
> 3. Configura las direcciones locales, máscaras y gateways predeterminados en todos los VPCS correspondientes."

### Fase 3: Enrutamiento Inteligente (Estático o RIPv2)
> **Prompt:**
> *(Elige Estático o Dinámico según tu necesidad)*
>
> **Para Estático:** "Ahora requiero convergencia End-to-End. Accede por Telnet a los routers e inyecta las rutas estáticas necesarias para que todas las LANs periféricas se alcancen mutuamente. Recuerda que la ruta de regreso también debe existir para que los paquetes regresen al origen."
>
> **Para Dinámico (RIPv2):** "Configura enrutamiento dinámico RIP versión 2 en todos los routers de la topología. Recuerda inyectar el comando `no auto-summary` dada nuestra arquitectura VLSM y declara correctamente los identificadores de red (`network X.X.X.X`) que cada router conoce directamente."

### Fase 4: Health Check (Ping y Validación)
> **Prompt:**
> "La topología ha sido configurada y enrutada. Necesito que audites la convergencia P2P.
> 1. Llama al script automatizado `health_check.js` y envíame los resultados de las pruebas cruzadas de Ping.
> 2. Si alguna prueba falla (Timeouts continuos), realiza troubleshooting ingresando a la consola del Router correspondiente para verificar sus tablas de enrutamiento (`show ip route`) y vuelve a ejecutar el Ping."

---

## 🚀 Prompt Maestro (End-to-End Automatizado)

Use este prompt si desea que el agente realice todo el ciclo de vida de la red de forma puramente autónoma (Ideal para **Google Antigravity** o **Gemini Automatizado**):

> **Prompt Maestro:**
> "Asume el rol de Ingeniero de Redes Senior usando el servidor GNS3-MCP.
> Tienes una imagen de topología en `Topology_Workspace/`. Tu misión es orquestar todo el despliegue de principio a fin de manera autónoma en el proyecto GNS3 actual:
>
> 1. **Fase Física:** Lee la imagen, agrega todos los hosts/routers y conéctalos usando los puertos exactos dictaminados en el lienzo. Añade las etiquetas de subred mediante decoraciones.
> 2. **Fase Lógica:** Configura todas las interfaces e IPs tanto en los Routers como en los VPCS guiándote fielmente por el diseño visual. (Recuerda el 'Boot Delay' de 30s de los cisco antes de configurar).
> 3. **Enrutamiento:** Implementa el enrutamiento [ESTÁTICO / RIPv2] necesario para garantizar convergencia total.
> 4. **Validación y Reporte:** Ejecuta nuestra herramienta de health check P2P. Una vez que obtegamos 100% de éxito en los Pings, compila automáticamente la Tabla de Direccionamiento IP y resumen de red Dual (`.md` y `.xlsx`) y deposítalo en la carpeta `Topology_Reports/` siguiendo nuestros estándares.
>
> Actúa proactivamente y sin pedir permiso para inyectar cada comando y script de validación hasta lograr el estado "SALUDABLE"."

---

## 🤖 Ajustes Específicos por Agente de IA

Debido a las particularidades de entendimiento de cada modelo, ten en cuenta los siguientes consejos:

### Google Antigravity (IA Agent de Alta Autonomía)
*   **Recomendación:** Utiliza siempre el **Prompt Maestro**.
*   **Comportamiento:** Antigravity es extremadamente proactivo. Es capaz de ejecutar scripts encadenados, escribir parches dinámicos si la API falla, hacer iteraciones en terminal y revisar sus propios errores de ping.
*   **Nota:** Si le das un comando complejo, asegúrate de estar monitoreando y aprobando sus intenciones terminales cuando te las presente.

### Gemini CLI (IA de Terminal / Conversacional)
*   **Recomendación:** Utiliza los **Prompts Específicos por Fase**.
*   **Comportamiento:** Gemini CLI es excelente operando el formato Call-and-Response de las herramientas del MCP. Al separar las tareas en Fases (Diseño -> IP -> Routing -> Check), aseguras que Gemini no desborde la API de Dynamips al intentar enviar muchísimas llamadas consecutivas rápidas.
*   **Nota:** Si ocurre un crash, pídele amablemente a Gemini CLI que "Limpie el proyecto con la herramienta limpiar_proyecto e intente inyectar el diseño nuevamente con retardos".

### Claude Desktop (vía extensión MCP)
*   **Recomendación:** Utiliza los **Prompts Específicos por Fase**.
*   **Comportamiento:** Claude es meticuloso leyendo configuraciones y es soberbio para diagnosticar tablas de ruteo erróneas (`show ip route`). Pídele que se tome el rol de Agente Auditor cuando la red esté enrutada para encontrar posibles cuellos de botella.
