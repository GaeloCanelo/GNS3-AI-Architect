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

3.  **Registra el Agente en Gemini CLI:**
    ```bash
    gemini mcp add agente-gns3 node index.js
    ```
    *Esto crea la configuración en `.gemini/settings.json` automáticamente. El archivo `mcp.example.json` se proporciona solo como referencia.*

4.  **Desactiva la contraseña en GNS3:**
    Ve a `Edit -> Preferences -> Server` y desmarca `Protect server with password`.

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
