# 🤖 Guía de Prompts para el Agente GNS3 (MCP)

Este documento contiene **Prompts optimizados** para diferentes Agentes de IA al interactuar con el Servidor MCP de GNS3. Incluye instrucciones de contexto, manejo de imágenes, y prompts especializados por fase.

---

## 📖 Paso Previo Obligatorio: Contexto del Agente

**Antes de cualquier prompt**, el Agente debe leer la Skill del proyecto:

> **Prompt de Inicialización (SIEMPRE primero):**
> "Lee el archivo `Documentation/Skill.md` completo. Este archivo contiene TODAS las directrices, estándares de diseño, secuencias de comandos obligatorias, protocolo de comunicación, y reglas de reportes que debes seguir. No hagas NADA hasta haberlo leído y comprendido."

> [!IMPORTANT]
> En Gemini CLI, esto se hace automáticamente si colocas las instrucciones en un archivo `GEMINI.md` en la raíz del proyecto (ver §6 abajo). Si usas otro agente, el primer prompt de cada sesión debe incluir la lectura de la Skill.

---

## 📷 Manejo de Imágenes y PDFs de Topologías

### Cómo referenciar archivos multimedia
El usuario coloca sus imágenes/PDFs de referencia en la carpeta `Topology_Workspace/`.

**En Gemini CLI** — usar `@` para referenciar la imagen directamente:
```
@Topology_Workspace/Examen.jpeg Analiza esta topología y despliégala en GNS3
```

**Si Gemini no interpreta bien la imagen:**
1.  Pedir al usuario que la comprima o convierta a PNG si es muy grande (>5MB).
2.  Si los textos son ilegibles, pedir al usuario que los dicte manualmente:
    > "No puedo leer claramente las IPs del enlace R1-R2 en la imagen. ¿Podrías indicarme las direcciones IP y la máscara de esa subred WAN?"
3.  Usar `read_file` como alternativa si `@` no funciona.

### Protocolo de Lectura de Imágenes
Cuando el agente reciba una imagen de topología, **DEBE** seguir este flujo:

```
1. Leer imagen → 2. Extraer datos → 3. Mostrar resumen al usuario → 4. Esperar confirmación → 5. Ejecutar
```

**Ejemplo de resumen (Fase 0):**
```
📋 Lectura de Topología — Examen.jpeg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Dispositivos (11): R1, R2, R3, SW1, SW2, PC1, PC2, PC3, PC4, PC5, PC6
📌 Redes LAN:
   • Red 1: 192.168.1.0/24 → R1 (Fa0/0 = .1), PC1 (.10), PC2 (.20) vía SW1
   • Red 2: 192.168.2.0/24 → R2 (Fa0/0 = .1), PC3 (.30)
   • Red 3: 192.168.3.0/24 → R3 (Fa0/0 = .1), PC4 (.40)
   • Red 4: 192.168.4.0/24 → R3 (Fa1/0 = .1), PC5 (.50), PC6 (.60) vía SW2
📌 Redes WAN:
   • R1 (Fa1/0 = .1) ↔ R2 (Fa1/0 = .2): 10.0.0.0/30
   • R2 (Fa1/1 = .5) ↔ R3 (Fa1/1 = .6): 10.0.0.4/30
📌 Enrutamiento: Estático
📌 Seguridad: enable secret Ramirez
📌 Especial: Ruta por defecto en R2

¿Es correcto? Procedo al despliegue.
```

---

## 🎯 Prompts Específicos por Fase

### Fase 1: Diseño Físico y Etiquetado
> **Prompt:**
> "Basándote en la imagen de topología en `Topology_Workspace/`, usa las herramientas MCP para:
> 1. Crear un proyecto GNS3 con el nombre indicado.
> 2. Agregar todos los dispositivos con sus nombres **EXACTOS** (no añadas sufijos).
> 3. Conectar interfaces respetando los puertos del diagrama.
> 4. Colocar decoraciones/etiquetas para TODAS las subredes y notas visibles en la imagen.
> No configures lógica todavía."

### Fase 2: Configuración IP + Interfaces
> **Prompt:**
> "El diseño físico está listo. Configura:
> 1. IPs de VPCs con `configurar_vpc` (en paralelo para velocidad).
> 2. IPs de Routers con `configurar_router_cisco`. Usa `enable secret`, `service password-encryption`, `no ip domain-lookup`, `duplex full`, `speed 100`, `no shut`.
> 3. Anuncia cada dispositivo en el log de terminal."

### Fase 3: Enrutamiento
> **Prompt (Estático):** "Inyecta rutas estáticas en todos los routers. Recuerda incluir la ruta de regreso en cada uno y la ruta por defecto si aplica."
>
> **Prompt (RIPv2):** "Configura RIPv2 con `no auto-summary` en todos los routers. Declara correctamente los `network` que cada router conoce directamente."

### Fase 4: Validación
> **Prompt:**
> "Valida la conectividad:
> 1. Ping desde cada VPC hacia su gateway y hacia IPs de LANs remotas.
> 2. Si falla el primer ping, reintenta (ARP timeout).
> 3. Si persiste, ejecuta `show ip route` en el router para diagnosticar."

### Fase 5: Reportes y Cierre
> **Prompt:**
> "La red funciona. Genera el cierre técnico:
> 1. `generar_reporte_excel` con las 3 hojas (WAN, LAN, Resumen).
> 2. `generar_backup_comandos` con comandos IOS reales (incluir PCs y sección de verificación).
> 3. Los archivos deben ir en `Topology_Reports/` con nombres que hereden el proyecto."

---

## 🚀 Prompt Maestro (End-to-End Autónomo)

> **Prompt Maestro:**
> "Asume el rol de Ingeniero de Redes Senior. Lee primero el archivo `Documentation/Skill.md` completo.
>
> Tu misión es desplegar la topología que aparece en `@Topology_Workspace/[nombre_archivo]` de forma completamente autónoma:
>
> 1. **Lectura:** Analiza la imagen, extrae TODOS los datos y muéstrame un resumen para validar.
> 2. **Construcción:** Crea el proyecto, agrega dispositivos con sus nombres EXACTOS, conecta interfaces, y coloca las decoraciones/etiquetas tal cual aparecen en la imagen.
> 3. **Configuración:** Configura IPs en Routers y VPCs. Usa `enable secret`, `service password-encryption`.
> 4. **Enrutamiento:** Implementa [ESTÁTICO / RIPv2] según indique la imagen.
> 5. **Validación:** Pings End-to-End. Si falla, diagnostica y corrige.
> 6. **Cierre:** Genera el reporte Excel y el backup de comandos en `Topology_Reports/`.
>
> Sigue el protocolo de fases del Skill.md. Anuncia cada fase. No te detengas hasta que la red sea saludable y documentada."

---

## 🔍 Prompt de Auditoría de Red Existente

> **Prompt:**
> "Actúa como Auditor de Redes. Analiza el proyecto GNS3 actual:
> 1. Usa `obtener_nodos_proyecto` y `obtener_enlaces_proyecto` para entender la arquitectura.
> 2. Ejecuta `verificar_conectividad` entre todos los endpoints.
> 3. Extrae `running-config` de cada router con `exportar_configuraciones`.
> 4. Entrégame un resumen ejecutivo con hallazgos y correcciones."

---

## 📝 Configuración de GEMINI.md (Auto-Contexto)

Para que Gemini CLI cargue automáticamente las instrucciones, crea un archivo `GEMINI.md` en la raíz del proyecto con el siguiente contenido:

```markdown
# Instrucciones del Proyecto GNS3 AI Architect

Eres un Ingeniero de Redes Senior que opera topologías en GNS3 a través de herramientas MCP.

## Lectura Obligatoria
Antes de ejecutar cualquier acción, LEE COMPLETO el archivo `Documentation/Skill.md`. Contiene:
- Protocolo de lectura de imágenes/PDFs de topologías
- Estándares de diseño, nombres, y decoraciones
- Secuencia de comandos IOS obligatoria
- Protocolo de comunicación en terminal
- Reglas de reportes y backup

## Archivos de Referencia
- `Topology_Workspace/`: Carpeta donde el usuario coloca imágenes y PDFs de topologías
- `Topology_Reports/Topology_IP.xlsx`: Template base para reportes Excel
- `Documentation/Prompts.md`: Prompts recomendados por fase

## Reglas Core
1. Los nombres de dispositivos deben ser EXACTOS a los de la imagen (nunca sufijos)
2. Las decoraciones y etiquetas deben replicar EXACTAMENTE las de la imagen original
3. Usar `enable secret` (NUNCA `enable password`) + `service password-encryption`
4. Anunciar fases de trabajo con emojis para legibilidad en terminal
5. Los backups deben contener comandos IOS reales para copy-paste
```

Este archivo se carga **automáticamente** en cada sesión de Gemini CLI dentro del directorio del proyecto.

---

## 🤖 Ajustes Específicos por Agente de IA

### Gemini CLI (Recomendado)
*   **Setup:** Crear `GEMINI.md` en la raíz (ver §6 arriba). Usar `@` para imágenes.
*   **Prompts:** El Prompt Maestro funciona bien. Las fases se ejecutan rápido gracias al MCP.
*   **Imágenes:** Si `@archivo.jpeg` no funciona, probar con la ruta completa `@Topology_Workspace/archivo.jpeg` o pedir al usuario que describa los datos manualmente.
*   **Crash recovery:** "Limpia el proyecto con `limpiar_proyecto` e intenta de nuevo."

### Google Antigravity
*   **Recomendación:** Prompt Maestro. Antigravity es proactivo y capaz de iteraciones complejas.
*   **Nota:** Monitorear las acciones de terminal cuando las presente para aprobación.

### Claude Desktop (vía MCP)
*   **Recomendación:** Prompts por Fase. Claude es meticuloso para auditoría de `show ip route`.
*   **Nota:** Excelente para diagnosticar tablas de ruteo erróneas.
