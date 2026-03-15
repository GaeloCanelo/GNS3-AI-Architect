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

## 3. Registro del Agente en Gemini CLI
En lugar de archivos JSON manuales, usaremos el gestor interno de la CLI:
1.  Abre tu terminal (CMD o PowerShell).
2.  Navega hasta tu carpeta: `cd "C:\Ruta\A\Agente_GNS3"`
3.  Registra el agente:
    ```bash
    gemini mcp add agente-gns3 node index.js
    ```
4.  Verifica que aparezca en la lista: `gemini mcp list`
5.  Si aparece pero no responde, fuerza su activación: `gemini mcp enable agente-gns3`

## 4. Uso de la Interfaz Interactiva
Una vez dentro de la interfaz de Gemini (escribiendo `gemini` en la terminal):
*   **Refresco de Herramientas:** Si acabas de registrar el agente y no ves sus herramientas, escribe:
    ```bash
    /mcp refresh
    ```
*   **Evitar Conflictos de Shell:** A veces Gemini intenta usar `curl` (que en Windows falla por alias de PowerShell). Si esto pasa, dile:
    > "No uses la herramienta Shell. Usa exclusivamente las herramientas MCP del agente-gns3."

## 5. Prompt Maestro para Nuevos Usuarios
Copia y pega este prompt para probar todo el sistema de una vez (Asegúrate de tener GNS3 abierto con un proyecto llamado `Prueba_Agente`):

> "Usa tus herramientas MCP para el proyecto 'Prueba_Agente'. 
> 1. Crea una topología con un Router 'c7200' (R1), un 'ethernet_switch' (SW1) y una PC 'vpcs' (PC1).
> 2. Conecta R1 a SW1 y PC1 a SW1.
> 3. Configura la IP 200.1.1.1/26 en la Fa0/0 de R1 y la IP 200.1.1.2/26 con Gateway 200.1.1.1 en PC1.
> 4. Activa RIPv2 en el Router.
> 5. Finalmente, dibuja un rectángulo azul que encierre todo y añade un texto que diga 'Red Automatizada con Éxito'."

## 6. Solución de Problemas Rápidos
*   **¿El Router no se crea?** Asegúrate de tener una plantilla (Template) de nombre `c7200` ya creada en GNS3.
*   **¿Timeout al configurar?** Los routers tardan 1-2 minutos en encender totalmente. Ten paciencia o pide a Gemini que reintente tras un momento.
