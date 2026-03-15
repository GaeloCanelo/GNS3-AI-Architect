# Skill: Diseñador y Configurador de Redes GNS3 (MCP)

Este documento describe las directrices, estándares y lecciones aprendidas para que un Agente de IA pueda diseñar, configurar y validar topologías de red en GNS3.

## 1. Herramientas del Servidor MCP
*   `obtener_proyectos`: Identificación de entornos de trabajo.
*   `agregar_dispositivo` / `conectar_nodos`: Construcción de la infraestructura física.
*   `agregar_decoracion`: Etiquetado visual (SVG) de subredes y áreas.
*   `configurar_vpc`: Configuración IP rápida para nodos terminales (VPCS).
*   `configurar_router_cisco`: Envío de ráfagas de comandos para equipos IOS.

---

## 2. Estándares de Diseño Físico
*   **Margen de Seguridad:** Mantener 200 unidades de distancia entre nodos para evitar solapamientos.
*   **Etiquetado SVG:** Usar fondos oscuros (`bg_color: "#2c3e50"`) y texto blanco para legibilidad.

---

## 3. Configuración de Equipos Cisco (IOS)
Reglas críticas para automatización efectiva:

### A. Gestión del Primer Inicio (Bootstrap)
Los routers nuevos inician en el "System Configuration Dialog". Se DEBE enviar el comando `no` inmediatamente para acceder al prompt.

### B. Secuencia de Comandos Obligatoria
1.  `enable`: Entrar en modo privilegiado (Prompt `#`).
2.  `configure terminal`: Entrar en modo configuración global.
3.  `no ip domain-lookup`: Evita bloqueos por búsqueda de DNS en comandos fallidos.
4.  **Estabilización de Enlace:** Forzar `duplex full` y `speed 100` en interfaces FastEthernet para evitar descartes de paquetes.

---

## 4. Enrutamiento Dinámico (RIP v2)
Para redes VLSM (máscaras variables como /30 y /26):
```cisco
router rip
 version 2
 no auto-summary
 network [RED_PRINCIPAL]
```

---

## 5. Resolución de Problemas (Troubleshooting)
*   **Convergencia:** RIPv2 puede tardar hasta 60 segundos en propagar rutas en topologías de más de 3 saltos.
*   **Trace de Ruta:** Si el ping falla, usar `trace` en VPCS. Si el paquete llega al Gateway destino pero no responde, el problema es la **ruta de regreso** o la configuración de la PC destino.
*   **Capa Física:** Errores de "duplex mismatch" en los logs del router indican que el enlace es inestable. Resetear la interfaz con `shut` / `no shut`.

---
*Proyecto reconstruido y validado exitosamente tras un crash de sistema. Conectividad PC1 <-> PC2 confirmada.*
