# 🚀 GNS3 AI Architect: NetAutomation via MCP

**GNS3 AI Architect** es un agente de automatización de redes de última generación que integra la potencia multimodal de **Gemini** con el entorno de simulación **GNS3**. Utilizando el **Model Context Protocol (MCP)**, este agente es capaz de transformar diseños visuales (imágenes/PDFs) en infraestructuras de red reales, configuradas y operativas en cuestión de segundos.

---

## ✨ Características Principales

*   **🎨 Diseño Topológico Autónomo:** Genera nodos y enlaces físicos en GNS3 a partir de diagramas visuales o descripciones en lenguaje natural respetando el etiquetado IP estricto.
*   **⚡ Zero-Touch Provisioning (ZTP):** Configuración automática de direccionamiento IP en VPCs y Routers Cisco (IOS).
*   **🛣️ Enrutamiento Dinámico Inteligente:** Implementación automática de protocolos de enrutamiento estático robusto y dinámico (RIPv2).
*   **🏷️ Documentación Visual Dinámica:** Generación de etiquetas y decoraciones SVG en el lienzo de GNS3 para una topología profesional y legible.
*   **🏥 Health Check End-to-End:** El Agente posee la capacidad de ejecutar auditorías automáticas descubriendo hosts encendidos, realizando Pings P2P paralelos y confirmando la convergencia total.
*   **🛡️ Autocuración y Estabilidad (Anti-Crashes):** Lógica integrada de "Polling Estricto Dinámico" para interactuar suavemente con Dynamips evitando corrupciones del servidor GNS3 durante limpiezas.

---

## 📂 Arquitectura del Repositorio

Para mantener un flujo de trabajo profesional y auditable, este repositorio exige y autogestiona la siguiente estructura base:

```text
GNS3-AI-Architect/
├── Documentation/        # Manuales de Arquitectura, Usuario y "Skills" del Agente
├── Topology_Workspace/   # Directorio DEDICADO para arrastrar Imágenes/PDFs a analizar
├── scripts_temporales/   # Scripts volátiles generados por la IA (Borrado Automático)
├── Topology_Reports/     # Reportes auto-generados POST-Despliegue (.xlsx / .md)
├── index.js              # El núcleo del Servidor MCP / GNS3
└── run_mcp_tool.js       # Cliente de Terminal para Simulaciones y Health Checks
```

---

## 🛠️ Requisitos Previos

*   [GNS3](https://www.gns3.com/) instalado y funcionando (Puerto 3080).
*   [Node.js](https://nodejs.org/) (v18 o superior).
*   **Gemini CLI** configurado en tu sistema.

---

## 🚀 Instalación y Configuración Rápida

1.  **Clona este repositorio:**
    ```bash
    git clone https://github.com/TU_USUARIO/GNS3-AI-Architect.git
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
