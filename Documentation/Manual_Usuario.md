# Manual de Usuario: Automatización Total de GNS3 con Gemini CLI

Esta guía te llevará de la mano para configurar tu entorno y desplegar topologías complejas de forma autónoma.

## 1. Preparación del Entorno (Node.js)
Antes de empezar, asegúrate de que tu carpeta de proyecto esté lista:
1.  Abre una terminal en la carpeta `Agente_GNS3`.
2.  Ejecuta `npm install` para instalar las dependencias del SDK de MCP.
3.  Verifica que tu `package.json` tenga la línea `"type": "module"`.

## 2. Configuración de GNS3 (Paso Crítico)
GNS3 viene protegido por defecto, lo cual bloquea al Agente. **Debes desactivar la contraseña**:
1.  En GNS3, ve a **Edit -> Preferences**.
2.  En la sección **Server -> Main server**, desmarca la casilla:
    *   `[ ] Protect server with password (recommended)`
3.  Haz clic en **Apply** y **OK**. El puerto debe ser el `3080`.

## 3. Registro del Agente MCP (Paso Más Importante ⚠️)
El servidor MCP es el puente entre Gemini y GNS3. Si no está **correctamente registrado**, Gemini no tendrá acceso a las herramientas del agente y aparecerá como **"desconectado"**.

### Opción A — Vía Gemini CLI
> ⚠️ **Debes ejecutar este comando desde la raíz del repositorio clonado.** La CLI registra rutas relativas; si lo ejecutas desde otra ubicación, `node index.js` no encontrará el archivo y el servidor fallará silenciosamente.

1.  Abre tu terminal (CMD o PowerShell).
2.  Navega **dentro** de la carpeta del proyecto:
    ```bash
    cd "C:\Ruta\A\Tu\GNS3-AI-Architect"
    ```
3.  Registra el agente:
    ```bash
    gemini mcp add agente-gns3 -- node index.js
    ```

### Opción B — Manual (Recomendada ✅)
Esta opción es **más confiable** porque especifica el `cwd` (directorio de trabajo) de forma explícita.

1.  Dentro de la carpeta del proyecto, crea la carpeta `.gemini` si no existe:
    ```bash
    mkdir .gemini
    ```
2.  Crea el archivo `.gemini/settings.json` con este contenido:
    ```json
    {
      "mcpServers": {
        "agente-gns3": {
          "command": "node",
          "args": ["index.js"],
          "cwd": "C:\\Ruta\\A\\Tu\\GNS3-AI-Architect"
        }
      }
    }
    ```
    > Reemplaza la ruta de `cwd` con la ruta absoluta real donde clonaste el repositorio.

### Verificación
1.  Verifica que aparezca en la lista: `gemini mcp list`
2.  Si aparece pero no responde, fuerza su activación: `gemini mcp enable agente-gns3`

## 4. Uso de la Interfaz Interactiva
Una vez dentro de la interfaz de Gemini (escribiendo `gemini` en la terminal):
*   **Refresco de Herramientas:** Si acabas de registrar el agente y no ves sus herramientas, escribe:
    ```bash
    /mcp refresh
    ```
*   **Evitar Conflictos de Shell:** A veces Gemini intenta usar `curl` (que en Windows falla por alias de PowerShell). Si esto pasa, dile:
    > "No uses la herramienta Shell. Usa exclusivamente las herramientas MCP del agente-gns3."

## 5. Herramientas de Automatización GNS3

### Gestión de Proyectos y Visibilidad
*   **`crear_proyecto`**: Inicia un entorno nuevo desde cero indicando solo el nombre.
*   **`obtener_nodos_proyecto`**: Te permite ver qué equipos hay en el mapa, sus IDs y su estado (encendido/apagado).
*   **`obtener_enlaces_proyecto`**: Muestra cómo están conectados todos los cables (puerto a puerto).
*   **`limpiar_proyecto`**: Borra de forma segura todos los nodos, enlaces y dibujos.

### Construcción y Diseño
*   **`agregar_dispositivo`**: Coloca un router, VPC o switch en el mapa usando coordenadas X e Y.
*   **`conectar_nodos`**: Tira un cable entre dos equipos especificando los puertos.
*   **`agregar_decoracion`**: Añade etiquetas de texto o fondos de colores (rectángulos/elipses).

### Configuración y Diagnóstico
*   **`configurar_vpc`**: Asigna IP, máscara y gateway a una VPC de forma automática.
*   **`configurar_router_cisco`**: Envía ráfagas de comandos IOS a routers Cisco vía Telnet.
*   **`verificar_conectividad`**: ¡Ping inteligente! Prueba la red desde VPCs o Routers y confirma el éxito (maneja retrasos de ARP).
*   **`exportar_configuraciones`**: Extrae el `running-config` completo de un router para respaldarlo.

## 6. Prompt Maestro para Nuevos Usuarios
Copia y pega este prompt para probar todo el sistema de una vez (Asegúrate de tener GNS3 abierto con un proyecto llamado `Prueba_Agente`):

> "Usa tus herramientas MCP para el proyecto 'Prueba_Agente'. 
> 1. Crea una topología con un Router 'c7200' (R1), un 'ethernet_switch' (SW1) y una PC 'vpcs' (PC1).
> 2. Conecta R1 a SW1 y PC1 a SW1.
> 3. Configura la IP 200.1.1.1/26 en la Fa0/0 de R1 y la IP 200.1.1.2/26 con Gateway 200.1.1.1 en PC1.
> 4. Activa RIPv2 en el Router.
> 5. Finalmente, dibuja un rectángulo azul que encierre todo y añade un texto que diga 'Red Automatizada con Éxito'."

## 7. Solución de Problemas

### ❌ El Servidor MCP aparece como "Desconectado"
**Causa:** El `cwd` (directorio de trabajo) no apunta a la carpeta del proyecto. Gemini CLI ejecuta `node index.js` pero no sabe **dónde** encontrar el archivo.

**Solución:**
1.  Verifica `.gemini/settings.json` y asegúrate de que tenga la propiedad `cwd` con la ruta absoluta correcta.
2.  Si usaste `gemini mcp add` desde una carpeta equivocada, elimina y re-registra:
    ```bash
    gemini mcp remove agente-gns3
    cd "C:\Ruta\A\Tu\GNS3-AI-Architect"
    gemini mcp add agente-gns3 -- node index.js
    ```
3.  Dentro de la sesión de Gemini, ejecuta `/mcp refresh`.

### ❌ ¿El Router no se crea?
Asegúrate de tener una plantilla (Template) de nombre `c7200` ya creada en GNS3.

### ❌ ¿Timeout al configurar un Router?
Los routers tardan 1-2 minutos en encender totalmente. Ten paciencia o pide a Gemini que reintente tras un momento.

