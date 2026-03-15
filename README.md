# 🚀 GNS3 AI Architect: NetAutomation via MCP

**GNS3 AI Architect** es un agente de automatización de redes de última generación que integra la potencia multimodal de **Gemini** con el entorno de simulación **GNS3**. Utilizando el **Model Context Protocol (MCP)**, este agente es capaz de transformar diseños visuales (imágenes/PDFs) en infraestructuras de red reales, configuradas y operativas en cuestión de segundos.

---

## ✨ Características Principales

*   **🎨 Diseño Topológico Autónomo:** Genera nodos y enlaces físicos en GNS3 a partir de diagramas visuales o descripciones en lenguaje natural.
*   **⚡ Zero-Touch Provisioning (ZTP):** Configuración automática de direccionamiento IP en VPCs y Routers Cisco (IOS).
*   **🛣️ Enrutamiento Dinámico Inteligente:** Implementación automática de protocolos de enrutamiento (RIPv2, con capacidad de expansión a OSPF/EIGRP).
*   **🏷️ Documentación Visual Dinámica:** Generación de etiquetas y decoraciones SVG en el lienzo de GNS3 para una topología profesional y legible.
*   **🛠️ Autocuración (Self-Healing):** Capacidad de detectar y resolver errores comunes de configuración (diálogos iniciales de Cisco, Duplex Mismatch, etc.).

---

## 🛠️ Requisitos Previos

*   [GNS3](https://www.gns3.com/) instalado y funcionando (Puerto 3080).
*   [Node.js](https://nodejs.org/) (v18 o superior).
*   [Gemini CLI](https://github.com/google/gemini-cli) configurado en tu sistema.

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

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar el soporte de protocolos o añadir nuevas plantillas de dispositivos, siéntete libre de abrir un *Issue* o enviar un *Pull Request*.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

---
*Desarrollado con ❤️ para la automatización de redes y la administración de servicios en red.*
