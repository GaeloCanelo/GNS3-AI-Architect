# 🚀 GNS3 AI Architect: NetAutomation via MCP

**GNS3 AI Architect** es un agente de automatización de redes de última generación que integra la potencia multimodal de **Gemini** con el entorno de simulación **GNS3**. Utilizando el **Model Context Protocol (MCP)**, este agente es capaz de transformar diseños visuales (imágenes/PDFs) en infraestructuras de red reales, configuradas y operativas en cuestión de segundos.

---

## ✨ Características Principales

*   **🎨 Diseño Topológico Autónomo:** Genera nodos y enlaces físicos en GNS3 a partir de diagramas visuales o descripciones en lenguaje natural respetando el etiquetado IP estricto.
*   **⚡ Zero-Touch Provisioning (ZTP):** Configuración automática de direccionamiento IP en VPCs y Routers Cisco (IOS) con **Active Prompt Polling** — espera inteligente al boot de IOS enviando Enter cada 3s y detectando el Bootstrap dialog automáticamente.
*   **🛣️ Enrutamiento Dinámico Inteligente:** Implementación automática de protocolos de enrutamiento estático robusto y dinámico (RIPv2).
*   **🏷️ Documentación Visual Dinámica:** Generación de etiquetas y decoraciones SVG en el lienzo de GNS3 para una topología profesional y legible.
*   **🏥 Health Check End-to-End:** Auditorías automáticas descubriendo hosts encendidos, realizando Pings P2P y confirmando la convergencia total.
*   **🛡️ Autocuración y Estabilidad (Anti-Crashes):** Lógica de Polling Estricto Dinámico para interactuar con Dynamips, anti-race conditions en Telnet, y detección de errores IOS.
*   **🔍 Diagnóstico Inteligente:** Captura completa de la salida del router con verificación post-ejecución que advierte si los comandos no fueron procesados.
*   **📊 Reportes Profesionales (v3.1.0):** Generación automática de Excel con 3 hojas profesionales (WAN/LAN/Resumen) y backup de comandos por dispositivo.

---

## 📂 Arquitectura del Repositorio

Para mantener un flujo de trabajo profesional y auditable, este repositorio exige y autogestiona la siguiente estructura base:

```text
GNS3-AI-Architect/
├── Documentation/        # Manuales de Arquitectura, Usuario y "Skills" del Agente
├── Topology_Workspace/   # Directorio DEDICADO para arrastrar Imágenes/PDFs a analizar
├── scripts_temporales/   # Scripts volátiles generados por la IA (Borrado Automático)
├── Topology_Reports/     # Reportes auto-generados POST-Despliegue (.xlsx / .md)
├── GEMINI.md             # Auto-contexto para Gemini CLI (instrucciones del proyecto)
├── index.js              # El núcleo del Servidor MCP / GNS3 (v3.2.1)
├── health_check.js       # Auditoría de conectividad End-to-End independiente
├── run_mcp_tool.js       # Cliente de Terminal para pruebas manuales de herramientas MCP
└── mcp.example.json      # Template de configuración MCP (ejemplo para referencia)
```

---

## 🛠️ Requisitos Previos

*   [GNS3](https://www.gns3.com/) instalado y funcionando (Puerto 3080).
*   [Node.js](https://nodejs.org/) (v18 o superior).
*   **Gemini CLI** configurado en tu sistema (*Si no lo tienes, puedes instalarlo usando: `npm install -g @google/gemini`*).

---

## 🚀 Instalación y Configuración Rápida

1.  **Clona este repositorio:**
    ```bash
    git clone https://github.com/GaeloCanelo/GNS3-AI-Architect.git
    cd GNS3-AI-Architect
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Registra el Servidor MCP (elige UNA opción):**

    #### Opción A — Vía Gemini CLI (desde la carpeta del proyecto)
    > ⚠️ **IMPORTANTE:** Debes ejecutar este comando **desde la raíz del repositorio clonado**. La CLI registra rutas relativas, por lo que si lo ejecutas desde otra ubicación, el servidor no encontrará `index.js` y aparecerá como **desconectado**.

    ```bash
    # Asegúrate de estar dentro de la carpeta del proyecto
    cd "C:\Ruta\A\Tu\GNS3-AI-Architect"

    gemini mcp add agente-gns3 -- node index.js
    ```

    #### Opción B — Manual (Recomendada ✅)
    > Esta opción es **más confiable** entre máquinas distintas porque permite especificar el `cwd` (directorio de trabajo) de forma explícita, evitando el error de servidor desconectado.

    Crea o edita el archivo `.gemini/settings.json` **dentro de la carpeta del proyecto**:
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
    > Reemplaza `C:\\Ruta\\A\\Tu\\GNS3-AI-Architect` con la ruta absoluta real donde clonaste el repositorio. Usa `\\` como separador de rutas en Windows.

4.  **Verifica que el servidor MCP esté activo:**
    ```bash
    gemini mcp list
    ```
    Deberías ver `agente-gns3` en la lista. Si aparece pero no responde:
    ```bash
    gemini mcp enable agente-gns3
    ```

5.  **Desactiva la contraseña en GNS3:**
    Ve a `Edit -> Preferences -> Server` y desmarca `Protect server with password`.

---

## 🔧 Solución de Problemas

### ❌ El Servidor MCP aparece como "Desconectado"
**Causa más común:** El `cwd` (directorio de trabajo) no apunta a la carpeta del proyecto. Cuando Gemini CLI lanza `node index.js`, necesita saber **dónde** ejecutarlo.

**Solución:**
1.  Verifica el contenido de `.gemini/settings.json`:
    ```bash
    cat .gemini/settings.json
    ```
2.  Asegúrate de que la ruta en `cwd` sea **absoluta** y apunte a la carpeta donde está `index.js`:
    ```json
    "cwd": "C:\\Users\\TuUsuario\\Desktop\\GNS3-AI-Architect"
    ```
3.  Si usaste `gemini mcp add` sin estar dentro de la carpeta correcta, **borra** la entrada y regístrala de nuevo:
    ```bash
    gemini mcp remove agente-gns3
    cd "C:\Ruta\A\Tu\GNS3-AI-Architect"
    gemini mcp add agente-gns3 -- node index.js
    ```
4.  Dentro de la sesión interactiva de Gemini, refresca las herramientas:
    ```bash
    /mcp refresh
    ```

### ❌ El Router no se crea
Asegúrate de tener una plantilla (Template) de nombre `c7200` ya creada en GNS3.

### ❌ Timeout al configurar un Router
Los routers c7200 tardan 1-2 minutos en arrancar completamente. El agente maneja esto automáticamente con Active Prompt Polling. Si persiste, pide a Gemini que reintente tras un momento.

---

## 📖 Documentación

Para guías detalladas, consulta nuestra carpeta de documentación:
*   [Manual de Usuario](./Documentation/Manual_Usuario.md): Guía paso a paso de la A a la Z.
*   [Manual Técnico](./Documentation/Manual_Tecnico.md): Detalles de arquitectura y lógica interna.
*   [Skill Mastery](./Documentation/Skill.md): Reglas de oro para el diseño y configuración.
*   [Prompts Compatibles](./Documentation/Prompts.md): Hoja de trucos con instrucciones estandarizadas para Antigravity, Gemini CLI y Claude.

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar el soporte de protocolos o añadir nuevas plantillas de dispositivos, siéntete libre de abrir un *Issue* o enviar un *Pull Request*.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

---
*Desarrollado con ❤️ para la automatización de redes y la administración de servicios en red.*
