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

### Fase 4: Health Check Nativo (Validación de Conectividad)
> **Prompt:**
> "La topología ha sido configurada y enrutada. Necesito que valides la convergencia de extremo a extremo usando las herramientas nativas del agente:
> 1. Utiliza `verificar_conectividad` desde cada VPC hacia su Gateway y hacia las IPs de las LANs remotas.
> 2. Si un ping falla, realiza un segundo intento (para descartar ARP timeout).
> 3. Si persiste el fallo, entra a la consola del router (`configurar_router_cisco`) para revisar la tabla de rutas con `show ip route` y corrige el enrutamiento antes de reintentar."

### Fase 5: Auditoría, Backup y Documentación
> **Prompt:**
> "La red está operativa y validada. Procede con el cierre técnico del proyecto:
> 1. Utiliza `obtener_nodos_proyecto` y `obtener_enlaces_proyecto` para generar un inventario exacto de la topología actual.
> 2. Ejecuta `exportar_configuraciones` en cada router para extraer el `running-config` final.
> 3. Con toda esta información, genera los reportes `.md` y `.xlsx` en la carpeta `Topology_Reports/` siguiendo nuestros estándares de nomenclatura (`Topology_NombreProyecto_IP`)."

---

## 🚀 Prompt Maestro (End-to-End Nativo)

Use este prompt si desea que el agente realice todo el ciclo de vida de la red de forma puramente autónoma:

> **Prompt Maestro:**
> "Asume el rol de Ingeniero de Redes Senior. Tu misión es orquestar un despliegue completo en GNS3 de forma autónoma:
>
> 1. **Preparación:** Si no hay un proyecto abierto, utiliza `crear_proyecto` para iniciar uno nuevo con el nombre de la topología.
> 2. **Construcción:** Lee la imagen/instrucciones de `Topology_Workspace/`, agrega los dispositivos y conéctalos respetando los puertos exactos. Añade etiquetas visuales con `agregar_decoracion`.
> 3. **Configuración:** Inicia los nodos y configura IPs en Routers y VPCs. (Recuerda el retardo de arranque de los routers Cisco).
> 4. **Enrutamiento:** Implementa el enrutamiento [ESTÁTICO / RIPv2] para garantizar conectividad total.
> 5. **Validación:** Usa `verificar_conectividad` para confirmar el éxito del despliegue (mínimo 100% de éxito en pings críticos).
> 6. **Cierre:** Exporta las configuraciones finales de los routers y genera los reportes de red en `Topology_Reports/`.
>
> Actúa proactivamente, diagnostica fallos en tiempo real y no te detengas hasta que la red sea 'Saludable' y esté documentada."

---

## 🔍 Prompt de Auditoría de Red Existente
Utiliza este prompt cuando ya tengas una red montada y quieras que la IA tome el control:

> **Prompt:**
> "Actúa como Auditor de Redes. Analiza el proyecto GNS3 actual y genera un diagnóstico completo:
> 1. Usa `obtener_nodos_proyecto` y `obtener_enlaces_proyecto` para entender la arquitectura física actual.
> 2. Realiza pruebas de `verificar_conectividad` entre todos los puntos terminales (VPCs) para detectar cuellos de botella o fallos de ruta.
> 3. Extrae las configuraciones de los routers con `exportar_configuraciones` para verificar si hay errores en las sentencias de red o interfaces apagadas.
> 4. Entrégame un resumen ejecutivo con los hallazgos y las correcciones realizadas."

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
