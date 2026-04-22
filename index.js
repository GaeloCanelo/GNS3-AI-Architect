import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import net from "net";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

const GNS3_BASE_URL = "http://127.0.0.1:3080/v2";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Utilidad: Esperar a que el puerto Telnet del nodo esté listo ───
// Intenta conectar TCP al puerto de consola del nodo reiteradamente.
// Retorna true cuando la conexión es aceptada, false si agota reintentos.
async function waitForConsole(port, host = "127.0.0.1", maxWaitMs = 45000) {
  const interval = 2000;
  const maxAttempts = Math.ceil(maxWaitMs / interval);
  for (let i = 0; i < maxAttempts; i++) {
    const isOpen = await new Promise((resolve) => {
      const sock = net.createConnection(port, host, () => {
        sock.end();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(1500, () => { sock.destroy(); resolve(false); });
    });
    if (isOpen) return true;
    await sleep(interval);
  }
  return false;
}

const server = new Server(
  { name: "gns3-topology-agent", version: "3.3.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "obtener_proyectos",
        description: "Obtiene la lista de todos los proyectos.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "agregar_dispositivo",
        description: "Agrega un dispositivo usando plantillas. Devuelve el node_id y puerto de consola del nodo creado.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            name: { type: "string" },
            device_type: { type: "string" },
            x: { type: "number" },
            y: { type: "number" }
          },
          required: ["project_id", "name", "device_type", "x", "y"]
        }
      },
      {
        name: "conectar_nodos",
        description: "Conecta dos dispositivos. Devuelve el link_id del enlace creado.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node1_id: { type: "string" },
            adapter1: { type: "number" },
            port1: { type: "number" },
            node2_id: { type: "string" },
            adapter2: { type: "number" },
            port2: { type: "number" }
          },
          required: ["project_id", "node1_id", "adapter1", "port1", "node2_id", "adapter2", "port2"]
        }
      },
      {
        name: "agregar_decoracion",
        description: "Dibuja un rectángulo, elipse o texto compatible con GNS3.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            shape_type: { type: "string", enum: ["rectangle", "ellipse", "text"] },
            content: { type: "string" },
            color: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            font_size: { type: "number" },
            fill_opacity: { type: "number" },
            bg_color: { type: "string" },
            z: { type: "number" }
          },
          required: ["project_id", "shape_type", "x", "y"]
        }
      },
      {
        name: "limpiar_proyecto",
        description: "Borra TODOS los nodos, enlaces y decoraciones del proyecto de forma segura.",
        inputSchema: {
          type: "object",
          properties: { project_id: { type: "string" } },
          required: ["project_id"]
        }
      },
      {
        name: "configurar_vpc",
        description: "Configura la IP, máscara y gateway de una VPC mediante comandos de consola.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" },
            ip: { type: "string" },
            mask_bits: { type: "number" },
            gateway: { type: "string" }
          },
          required: ["project_id", "node_id", "ip", "mask_bits", "gateway"]
        }
      },
      {
        name: "configurar_router_cisco",
        description: "Envía una lista de comandos de configuración a un Router Cisco via Telnet. Captura y devuelve la salida completa del router, incluyendo errores de IOS si los hay.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" },
            commands: { type: "array", items: { type: "string" } }
          },
          required: ["project_id", "node_id", "commands"]
        }
      },
      {
        name: "crear_proyecto",
        description: "Crea un nuevo proyecto en GNS3.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nombre del nuevo proyecto" }
          },
          required: ["name"]
        }
      },
      {
        name: "obtener_nodos_proyecto",
        description: "Obtiene la lista detallada de todos los nodos en un proyecto.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "obtener_enlaces_proyecto",
        description: "Obtiene la lista de todos los enlaces (conexiones) en un proyecto.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "verificar_conectividad",
        description: "Ejecuta un ping desde un nodo (VPC o Router) para validar la conexión.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" },
            destination_ip: { type: "string" },
            count: { type: "number", description: "Número de pings a enviar (default 5)" }
          },
          required: ["project_id", "node_id", "destination_ip"]
        }
      },
      {
        name: "exportar_configuraciones",
        description: "Extrae el 'running-config' de un Router Cisco. Entra automáticamente en modo enable.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" }
          },
          required: ["project_id", "node_id"]
        }
      },
      {
        name: "generar_reporte_excel",
        description: "Genera un reporte Excel profesional con el plan de direccionamiento IP. Crea 3 hojas: WAN (entre routers), LAN (routers a PCs) y Resumen de Red, con formato idéntico al template base. Para OSPF, acepta campos opcionales de wildcard, costo y área que agregan columnas extra respetando el mismo estilo visual.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: { type: "string", description: "Nombre del proyecto para el título" },
            wan_subtitle: { type: "string", description: "Subtítulo de la sección WAN, ej: 'ENLACES WAN (Entre Routers) — Máscara /30 (255.255.255.252)'" },
            wan_links: {
              type: "array", description: "Enlaces WAN punto a punto",
              items: { type: "object", properties: {
                subred: { type: "string" }, ip_red: { type: "string" }, mascara: { type: "string" },
                wildcard: { type: "string", description: "Opcional OSPF: Wildcard de la subred (ej: 0.0.0.3)" },
                area_ospf: { type: "string", description: "Opcional OSPF: Área a la que pertenece (ej: Área 0)" },
                costo_ospf: { type: "string", description: "Opcional OSPF: Costo del enlace (ej: 6)" },
                router1: { type: "string", description: "Ej: R1 (Fa0/0)" }, ip_router1: { type: "string" },
                router2: { type: "string", description: "Ej: R2 (Fa1/0)" }, ip_router2: { type: "string" },
                broadcast: { type: "string" }
              }}
            },
            lan_subtitle: { type: "string", description: "Subtítulo de la sección LAN" },
            lan_links: {
              type: "array", description: "Enlaces LAN (router a PCs)",
              items: { type: "object", properties: {
                subred: { type: "string" }, ip_red: { type: "string" }, mascara: { type: "string" },
                wildcard: { type: "string", description: "Opcional OSPF: Wildcard de la subred (ej: 0.0.0.63)" },
                area_ospf: { type: "string", description: "Opcional OSPF: Área a la que pertenece (ej: Área 1)" },
                gateway: { type: "string", description: "Ej: R1 (Fa2/0)" }, ip_gateway: { type: "string" },
                ip_vpcs: { type: "string", description: "Ej: PC1 → 200.1.1.2" }, broadcast: { type: "string" }
              }}
            },
            resumen: {
              type: "array", description: "Filas del resumen general",
              items: { type: "object", properties: {
                parametro: { type: "string" }, detalle: { type: "string" }
              }}
            },
            output_path: { type: "string", description: "Ruta del archivo de salida (.xlsx). Se fuerza a Topology_Reports/ si no está en esa carpeta." }
          },
          required: ["project_name", "wan_links", "lan_links", "resumen", "output_path"]
        }
      },

      {
        name: "generar_backup_comandos",
        description: "Genera un archivo Markdown de backup con los comandos de configuración ejecutados en cada dispositivo. Permite re-configuración manual por copy-paste. Siempre guarda en Topology_Reports/.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: { type: "string", description: "Nombre del proyecto" },
            devices: {
              type: "array",
              items: { type: "object", properties: {
                name: { type: "string", description: "Nombre del dispositivo (R1, PC1, etc.)" },
                device_type: { type: "string", description: "Tipo: router, vpc, switch" },
                commands: { type: "array", items: { type: "string" }, description: "Comandos IOS/VPCS exactos ejecutados en orden" },
                verification_output: { type: "string", description: "Opcional: output de show ip route / show ip ospf neighbor / ping para incluir en sección de verificación" }
              }, required: ["name", "commands"]}
            },
            output_path: { type: "string", description: "Ruta del archivo de salida (.md). Se fuerza a Topology_Reports/ si no está en esa carpeta." }
          },
          required: ["project_name", "devices", "output_path"]
        }
      },
      {
        name: "calcular_ospf",
        description: "Calcula Wildcards OSPF, valida áreas y genera el bloque 'network' IOS listo para copiar. Reporta un resumen de áreas y vecinos ABR al agente para mostrar al usuario ANTES de configurar.",
        inputSchema: {
          type: "object",
          properties: {
            routers: {
              type: "array",
              description: "Lista de routers con sus redes a anunciar en OSPF",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nombre del router (R1, R2...)" },
                  networks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ip_red: { type: "string", description: "IP de la red (ej: 192.168.1.0)" },
                        cidr: { type: "number", description: "Prefijo CIDR (ej: 26 para /26)" },
                        area: { type: "number", description: "Área OSPF (0=backbone, 1, 2...)" },
                        costo: { type: "number", description: "Costo OSPF opcional (ip ospf cost N)" },
                        descripcion: { type: "string", description: "Etiqueta descriptiva (LAN-PCa, WAN-R1-R3...)" }
                      },
                      required: ["ip_red", "cidr", "area"]
                    }
                  }
                },
                required: ["name", "networks"]
              }
            }
          },
          required: ["routers"]
        }
      },
      {
        name: "ejecutar_comando_router",
        description: "Envía UN SOLO comando de verificación/consulta a un router Cisco y devuelve el output LIMPIO (sin banner de boot, sin texto basura). Muestra el prompt del router en cada paso. Ideal para: show ip route, show ip ospf neighbor, show ip interface brief, traceroute, show running-config.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" },
            command: { type: "string", description: "Comando de consulta a ejecutar (show ip route, traceroute X.X.X.X, etc.)" }
          },
          required: ["project_id", "node_id", "command"]
        }
      },
      {
        name: "generar_traceroute_md",
        description: "Genera un archivo Markdown de trazado de rutas con formato estructurado. Incluye: dispositivo origen, destino, output real de consola del traceroute, y observaciones técnicas. Solo usar si el usuario lo solicita explícitamente. Siempre guarda en Topology_Reports/.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: { type: "string" },
            trazados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  origen: { type: "string", description: "Nombre del dispositivo origen (PCa, R1...)" },
                  area_origen: { type: "string", description: "Área OSPF del origen (Área 1, Área 0...)" },
                  destino: { type: "string", description: "Nombre del dispositivo destino (PCd, R9...)" },
                  area_destino: { type: "string", description: "Área OSPF del destino" },
                  ip_destino: { type: "string" },
                  output_consola: { type: "string", description: "Output real copiado de la consola del traceroute" },
                  observaciones: { type: "string", description: "Observaciones técnicas del trazado" }
                },
                required: ["origen", "destino", "ip_destino", "output_consola"]
              }
            },
            output_path: { type: "string", description: "Ruta del archivo .md. Se fuerza a Topology_Reports/." }
          },
          required: ["project_name", "trazados", "output_path"]
        }
      },
      {
        name: "validar_ruta_archivo",
        description: "Valida y corrige una ruta de archivo para que siempre esté dentro de Topology_Reports/. Si la ruta proporcionada apunta a otro directorio (raíz, backup/, etc.), la redirige automáticamente. Usar antes de escribir cualquier reporte.",
        inputSchema: {
          type: "object",
          properties: {
            output_path: { type: "string", description: "Ruta de archivo propuesta" },
            project_name: { type: "string", description: "Nombre del proyecto para construir la ruta correcta si fuera necesario" }
          },
          required: ["output_path", "project_name"]
        }
      }
    ]
  };
});

async function fetchGNS3(endpoint, method = 'GET', body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${GNS3_BASE_URL}${endpoint}`, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GNS3 HTTP ${res.status}: ${errorText}`);
  }
  if (res.status === 204) return {};
  const contentType = res.headers.get("content-type");
  return contentType && contentType.includes("application/json") ? res.json() : {};
}

// ─── Utilidad: Asegurar que un nodo esté encendido con smart polling ───
async function ensureNodeStarted(projectId, node) {
  if (node.status === "stopped") {
    await fetchGNS3(`/projects/${projectId}/nodes/${node.node_id}/start`, 'POST');
    // Smart boot polling: esperar a que la consola Telnet acepte conexión
    const isVpcs = node.node_type === "vpcs";
    const maxWait = isVpcs ? 5000 : 45000; // VPCs arrancan rápido, routers tardan mucho
    const ready = await waitForConsole(node.console, "127.0.0.1", maxWait);
    if (!ready) {
      throw new Error(`Timeout esperando que la consola de ${node.name} (puerto ${node.console}) esté lista tras ${maxWait / 1000}s.`);
    }
    // Delay adicional post-consola para que IOS complete el POST
    if (!isVpcs) await sleep(3000);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "obtener_proyectos") {
      const data = await fetchGNS3('/projects');
      const proyectos = data.map(p => `Nombre: ${p.name}, ID: ${p.project_id}`).join('\n');
      return { content: [{ type: "text", text: `Proyectos actuales:\n${proyectos}` }] };
    }

    else if (name === "agregar_dispositivo") {
      const templates = await fetchGNS3('/templates');
      const tmpl = templates.find(t => t.name.toLowerCase().includes(args.device_type.toLowerCase()));
      if (!tmpl) throw new Error(`No se encontró la plantilla "${args.device_type}".`);

      const body = {
        name: args.name, x: args.x, y: args.y,
        node_type: tmpl.template_type, compute_id: tmpl.compute_id || "local", template_id: tmpl.template_id,
        symbol: tmpl.symbol, properties: {}
      };

      if (tmpl.template_type === "dynamips") {
        body.properties = {
          platform: tmpl.platform, image: tmpl.image, nvram: tmpl.nvram, ram: tmpl.ram,
          slot0: tmpl.slot0 || "C7200-IO-FE", slot1: "PA-2FE-TX", slot2: "PA-2FE-TX", slot3: "PA-2FE-TX"
        };
      }

      const data = await fetchGNS3(`/projects/${args.project_id}/nodes`, 'POST', body);
      // B6: Devolver node_id y console port para evitar llamadas extra
      return { content: [{ type: "text", text: `Dispositivo ${args.name} creado. ID: ${data.node_id}, Console: ${data.console}, Tipo: ${data.node_type}` }] };
    }

    else if (name === "conectar_nodos") {
      const ad1 = args.adapter1 !== undefined ? args.adapter1 : 0;
      const pt1 = args.port1 !== undefined ? args.port1 : 0;
      const ad2 = args.adapter2 !== undefined ? args.adapter2 : 0;
      const pt2 = args.port2 !== undefined ? args.port2 : 0;
      const data = await fetchGNS3(`/projects/${args.project_id}/links`, 'POST', {
        nodes: [{ node_id: args.node1_id, adapter_number: ad1, port_number: pt1 },
        { node_id: args.node2_id, adapter_number: ad2, port_number: pt2 }]
      });
      // B7: Devolver link_id
      return { content: [{ type: "text", text: `Enlace creado. Link ID: ${data.link_id}` }] };
    }

    else if (name === "agregar_decoracion") {
      let svgContent = "";
      const fontSize = args.font_size || 12;
      const colorTexto = args.color || "#FFFFFF";
      const z = args.z || 3;

      if (args.shape_type === "rectangle") {
        const w = args.width || 100;
        const h = args.height || 100;
        svgContent = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${args.color}" fill-opacity="${args.fill_opacity || 1.0}" rx="3" ry="3"/></svg>`;
      } else if (args.shape_type === "text") {
        // Ajuste de precisión para centrar el texto sobre el fondo
        const textWidth = args.content.length * (fontSize * 0.62) + 10;
        const textHeight = fontSize * 1.3;
        let bg = "";
        if (args.bg_color) {
          bg = `<rect width="${textWidth}" height="${textHeight}" fill="${args.bg_color}" fill-opacity="1.0" rx="3" ry="3" />`;
        }
        // Ajustamos y="fontSize * 0.9" para compensar el desfase vertical observado
        svgContent = `<svg width="${textWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">${bg}<text x="${textWidth / 2}" y="${fontSize * 0.9}" fill="${colorTexto}" font-family="Arial" font-size="${fontSize}" font-weight="bold" text-anchor="middle">${args.content}</text></svg>`;
      }

      await fetchGNS3(`/projects/${args.project_id}/drawings`, 'POST', {
        x: args.x, y: args.y, z: z, svg: svgContent
      });
      return { content: [{ type: "text", text: `Decoración ${args.shape_type} agregada.` }] };
    }

    else if (name === "limpiar_proyecto") {
      const deleteSafe = async (url) => { try { await fetchGNS3(url, 'DELETE'); } catch (e) { if (!e.message.includes("404")) throw e; } };

      const nodes = await fetchGNS3(`/projects/${args.project_id}/nodes`);

      // 1. Enviar señales de apagado EN PARALELO (esto es seguro, solo son señales)
      const stopPromises = nodes
        .filter(node => node.status === "started" || node.status === "suspended")
        .map(node =>
          fetchGNS3(`/projects/${args.project_id}/nodes/${node.node_id}/stop`, 'POST').catch(() => { })
        );
      await Promise.all(stopPromises);

      // 2. Polling estricto hasta confirmar apagado total (Max 30s)
      let allStopped = false;
      let retries = 0;
      while (!allStopped && retries < 15) {
        allStopped = true;
        const currentNodes = await fetchGNS3(`/projects/${args.project_id}/nodes`);
        for (const n of currentNodes) {
          if (n.status !== "stopped") allStopped = false;
        }
        if (!allStopped) await sleep(2000);
        retries++;
      }

      // Delay de seguridad post-apagado
      await sleep(2000);

      // 3. Destrucción Secuencial CONSERVADORA (mantener delays para estabilidad de Dynamips)
      const links = await fetchGNS3(`/projects/${args.project_id}/links`);
      for (const link of links) { await deleteSafe(`/projects/${args.project_id}/links/${link.link_id}`); await sleep(500); }

      // NOTA: Se mantiene el delay de 1000ms por nodo para evitar crashes de GNS3/Dynamips
      for (const node of nodes) { await deleteSafe(`/projects/${args.project_id}/nodes/${node.node_id}`); await sleep(1000); }

      const drawings = await fetchGNS3(`/projects/${args.project_id}/drawings`);
      for (const drawing of drawings) { await deleteSafe(`/projects/${args.project_id}/drawings/${drawing.drawing_id}`); await sleep(500); }

      return { content: [{ type: "text", text: "Proyecto limpiado con seguridad (Polling Strict + Destrucción Secuencial)." }] };
    }

    else if (name === "configurar_vpc") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      await ensureNodeStarted(args.project_id, node);

      const consolePort = node.console;
      const host = "127.0.0.1";

      const configResult = await new Promise((resolve, reject) => {
        let settled = false;
        const socket = net.createConnection(consolePort, host, () => {
          // VPCs a veces necesitan un Enter inicial para despertar la consola
          socket.write('\r\n');
          setTimeout(() => {
            if (settled) return;
            socket.write(`ip ${args.ip} ${args.gateway} ${args.mask_bits}\r\n`);
            setTimeout(() => {
              if (settled) return;
              socket.write('save\r\n');
              setTimeout(() => {
                if (settled) return;
                settled = true;
                socket.end();
                resolve(`Configuración enviada a ${node.name}: IP ${args.ip}/${args.mask_bits} GW ${args.gateway}`);
              }, 1000);
            }, 1000);
          }, 1000);
        });

        socket.on('error', (err) => {
          if (!settled) { settled = true; reject(new Error(`Error de consola Telnet: ${err.message}`)); }
        });
        const timeoutHandle = setTimeout(() => {
          if (!settled) { settled = true; socket.destroy(); reject(new Error("Timeout conectando a la consola VPC.")); }
        }, 8000);
        // Limpiar timeout si termina normalmente
        socket.on('close', () => clearTimeout(timeoutHandle));
      });

      return { content: [{ type: "text", text: configResult }] };
    }

    else if (name === "configurar_router_cisco") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      await ensureNodeStarted(args.project_id, node);

      const consolePort = node.console;
      const host = "127.0.0.1";

      // Secuencia de arranque: enable → configure terminal → logging synchronous → comandos del agente
      // El bloque de logging se envía DENTRO de configure terminal para que sea válido
      const bootstrapCmds = ['enable', 'configure terminal', 'line con 0', 'logging synchronous', 'exec-timeout 0 0', 'exit'];
      const allCommands = [...bootstrapCmds, ...args.commands];
      // Los primeros 6 comandos son de arranque y se excluyen del resumen visible al usuario
      const BOOTSTRAP_COUNT = bootstrapCmds.length;

      const configResult = await new Promise((resolve, reject) => {
        let settled = false;
        let output = "";
        let step = 0;

        const socket = net.createConnection(consolePort, host, () => {
          socket.write('\r\n');
        });

        const promptPattern = /[>#]\s*$/;
        // Detectar tanto el diálogo de configuración inicial como preguntas yes/no interactivas
        const bootstrapPattern = /Would you like to enter the initial configuration dialog/i;
        const yesNoPattern = /\[yes\/no\]|\[confirm\]|Please answer 'yes' or 'no'/i;
        let sendScheduled = false;
        let initialWaitDone = false;
        let enterInterval = null;

        // Active Prompt Polling — enviar Enter cada 3s para despertar routers lentos
        enterInterval = setInterval(() => {
          if (!settled && !initialWaitDone) {
            socket.write('\r\n');
          }
        }, 3000);

        const cleanupInterval = () => {
          if (enterInterval) { clearInterval(enterInterval); enterInterval = null; }
        };

        const trySendNext = () => {
          if (settled) return;
          sendScheduled = false;
          if (step < allCommands.length) {
            const cmd = allCommands[step];
            socket.write(`${cmd}\r\n`);
            step++;
            sendScheduled = true;
            setTimeout(() => { if (sendScheduled && !settled) trySendNext(); }, 600);
          } else {
            // Todos los comandos enviados; cerrar sesión limpiamente
            socket.write('end\r\nwrite\r\n');
            setTimeout(() => {
              if (!settled) {
                settled = true;
                cleanupInterval();
                socket.end();

                // ── Filtrar output: quitar banner de boot, mostrar solo la parte de configuración ──
                const firstPromptIdx = output.search(/[\w.-]+[>#]/);
                const configOutput = firstPromptIdx >= 0 ? output.slice(firstPromptIdx) : output;

                // Detectar errores IOS reales (excluir mensajes informativos de sistema)
                const iosErrors = (configOutput.match(/% .+/g) || [])
                  .filter(e => !e.includes('SYS-') && !e.includes('Please answer'));

                // Construir resumen de comandos — omitir los de arranque del log visible
                let cmdSummary = `\n🔧 Configurando ${node.name}...\n`;
                allCommands.slice(BOOTSTRAP_COUNT).forEach(cmd => {
                  // Un comando tiene error si aparece un % inmediatamente después de él en el output
                  const cmdIdx = configOutput.lastIndexOf(cmd);
                  const snippet = cmdIdx >= 0 ? configOutput.slice(cmdIdx, cmdIdx + 200) : '';
                  const hasError = /% .+/.test(snippet);
                  cmdSummary += `  ${node.name}(config)# ${cmd}${hasError ? '  ⚠️' : '  ✅'}\n`;
                });
                cmdSummary += `  ${node.name}# write  ✅\n`;

                let result = cmdSummary;
                if (iosErrors.length > 0) {
                  result += `\n🚨 Errores IOS detectados:\n${iosErrors.map(e => `  ${e}`).join('\n')}\n`;
                }

                // Verificar que los comandos de configuración realmente se procesaron
                const configPromptSeen = /\(config[^)]*\)#/.test(configOutput) || configOutput.includes('Building configuration');
                if (!configPromptSeen) {
                  result += '\n🚨 ADVERTENCIA: No se detectó evidencia de que los comandos hayan sido procesados por IOS.';
                }

                resolve(result);
              }
            }, 2000);
          }
        };

        socket.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;

          if (!initialWaitDone) {
            // Responder al diálogo de configuración inicial
            if (bootstrapPattern.test(output)) {
              socket.write('no\r\n');
            }
            // Responder a cualquier pregunta yes/no o [confirm] durante el boot
            if (yesNoPattern.test(chunk)) {
              socket.write('no\r\n');
            }
            // Avanzar cuando detectamos un prompt real (> o #)
            if (promptPattern.test(chunk)) {
              initialWaitDone = true;
              cleanupInterval();
              trySendNext();
            }
          } else if (sendScheduled && promptPattern.test(chunk)) {
            trySendNext();
          }
        });

        // Fallback extendido a 60s para routers c7200 lentos
        setTimeout(() => {
          if (!initialWaitDone && !settled) {
            initialWaitDone = true;
            cleanupInterval();
            trySendNext();
          }
        }, 60000);

        socket.on('error', (err) => {
          cleanupInterval();
          if (!settled) { settled = true; reject(new Error(`Error consola Router: ${err.message}`)); }
        });

        const timeoutHandle = setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanupInterval();
            socket.destroy();
            reject(new Error(`Timeout (90s) configurando ${node.name}. Output parcial:\n${output.slice(-500)}`));
          }
        }, 90000);
        socket.on('close', () => { clearTimeout(timeoutHandle); cleanupInterval(); });
      });

      return { content: [{ type: "text", text: configResult }] };
    }


    else if (name === "crear_proyecto") {
      const data = await fetchGNS3('/projects', 'POST', { name: args.name });
      // BUG-6: Abrir el proyecto automáticamente en GNS3 GUI
      try { await fetchGNS3(`/projects/${data.project_id}/open`, 'POST'); } catch (e) { /* ya abierto */ }
      return { content: [{ type: "text", text: `Proyecto "${args.name}" creado y abierto. ID: ${data.project_id}` }] };
    }

    else if (name === "obtener_nodos_proyecto") {
      const nodes = await fetchGNS3(`/projects/${args.project_id}/nodes`);
      const info = nodes.map(n => `- ${n.name} (ID: ${n.node_id}, Tipo: ${n.node_type}, Estado: ${n.status}, Console: ${n.console})`).join('\n');
      return { content: [{ type: "text", text: `Nodos en el proyecto:\n${info}` }] };
    }

    else if (name === "obtener_enlaces_proyecto") {
      const links = await fetchGNS3(`/projects/${args.project_id}/links`);
      const nodes = await fetchGNS3(`/projects/${args.project_id}/nodes`);
      const nodeMap = Object.fromEntries(nodes.map(n => [n.node_id, n.name]));
      const info = links.map(l => {
        const n1 = nodeMap[l.nodes[0].node_id] || "Desconocido";
        const n2 = nodeMap[l.nodes[1].node_id] || "Desconocido";
        return `- ${n1} [Adapter ${l.nodes[0].adapter_number}, Port ${l.nodes[0].port_number}] <---> ${n2} [Adapter ${l.nodes[1].adapter_number}, Port ${l.nodes[1].port_number}] (Link ID: ${l.link_id})`;
      }).join('\n');
      return { content: [{ type: "text", text: `Enlaces en el proyecto:\n${info}` }] };
    }

    else if (name === "verificar_conectividad") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      if (node.status !== "started") throw new Error("El nodo debe estar encendido para hacer ping.");

      const consolePort = node.console;
      const count = args.count || 5;

      const pingResult = await new Promise((resolve, reject) => {
        let settled = false;
        let drainDone = false;
        const socket = net.createConnection(consolePort, "127.0.0.1", () => {
          // BUG-3: Enviar Enter para despertar la consola
          socket.write('\r\n');
        });

        let output = "";
        socket.on('data', (data) => {
          if (!drainDone) return; // BUG-3: Descartar buffer residual
          output += data.toString();
          if (output.includes("Success rate") || output.includes("packets received") || output.includes("timeout")) {
            if (!settled) {
              settled = true;
              setTimeout(() => { socket.end(); resolve(output); }, 2000);
            }
          }
        });

        // BUG-3: Tras 800ms de drain, enviar el ping real
        setTimeout(() => {
          if (settled) return;
          drainDone = true;
          output = "";
          const cmd = node.node_type === "vpcs" ? `ping ${args.destination_ip} -c ${count}\r\n` : `ping ${args.destination_ip} repeat ${count}\r\n`;
          socket.write(cmd);
        }, 800);

        socket.on('error', (err) => {
          if (!settled) { settled = true; reject(new Error(`Error Telnet Ping: ${err.message}`)); }
        });
        const timeoutHandle = setTimeout(() => {
          if (!settled) { settled = true; socket.destroy(); resolve(output || "Timeout esperando respuesta del ping."); }
        }, 15000 + (count * 2000));
        socket.on('close', () => clearTimeout(timeoutHandle));
      });

      // BUG-5: Detección mejorada de éxito ICMP
      const ciscoSuccess = pingResult.match(/Success rate is (\d+) percent/);
      const vpcsReceived = pingResult.match(/(\d+)\s+packets?\s+received/i);
      const exclamations = (pingResult.match(/!/g) || []).length;
      const icmpReplies = (pingResult.match(/bytes from/g) || []).length;

      let success = false;
      if (ciscoSuccess) {
        success = parseInt(ciscoSuccess[1]) > 0;
      } else if (vpcsReceived) {
        success = parseInt(vpcsReceived[1]) > 0;
      } else if (exclamations >= 1) {
        success = true;
      } else if (icmpReplies >= 1) {
        success = true;
      }
      const status = success ? "EXITO" : "FALLO";

      return { content: [{ type: "text", text: `Resultado del Ping (${status}):\n${pingResult}` }] };
    }

    else if (name === "exportar_configuraciones") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      if (node.status !== "started") throw new Error("El nodo debe estar encendido para exportar su configuración.");

      const configResult = await new Promise((resolve, reject) => {
        let settled = false;
        let output = "";

        const socket = net.createConnection(node.console, "127.0.0.1", () => {
          // BUG-4: Enviar 'end' primero para salir de cualquier modo config/subconfig
          socket.write('\r\nend\r\n');
          setTimeout(() => {
            if (settled) return;
            socket.write('enable\r\n');
            setTimeout(() => {
              if (settled) return;
              socket.write('terminal length 0\r\n');
              setTimeout(() => {
                if (settled) return;
                socket.write('show running-config\r\n');
              }, 1000);
            }, 1500);
          }, 1000);
        });

        socket.on('data', (data) => {
          output += data.toString();
          if (/\r?\nend\r?\n/.test(output) && output.split('\n').length > 10) {
            if (!settled) {
              settled = true;
              setTimeout(() => { socket.end(); resolve(output); }, 2000);
            }
          }
        });

        socket.on('error', (err) => {
          if (!settled) { settled = true; reject(new Error(`Error Export: ${err.message}`)); }
        });
        const timeoutHandle = setTimeout(() => {
          if (!settled) { settled = true; socket.destroy(); resolve(output || "Timeout: No se pudo capturar la configuración."); }
        }, 20000);
        socket.on('close', () => clearTimeout(timeoutHandle));
      });

      return { content: [{ type: "text", text: `Configuración de ${node.name}:\n${configResult}` }] };
    }

    // ─── Generador de Reporte Excel Profesional (v3.2.0 — Formato fidedigno al template) ───
    else if (name === "generar_reporte_excel") {
      const workbook = new ExcelJS.Workbook();
      const titulo = `PLAN DE DIRECCIONAMIENTO IP — ${args.project_name.toUpperCase()}`;

      // ── Paleta de colores EXACTA del template Topology_IP.xlsx ──
      const COLORS = {
        titleBg: '001F3864',       // Azul oscuro (título y headers WAN)
        wanSubBg: '002E75B6',      // Azul medio (subtítulo WAN)
        lanSubBg: '002E7D32',      // Verde (subtítulo y headers LAN)
        white: '00FFFFFF',
        zebraA: '00F5F7FA',        // Gris claro (filas impares)
        zebraB: '00FFFFFF',        // Blanco (filas pares)
        subred: '001F3864',        // Azul oscuro (texto col Subred)
        ipRed: '00E65100',         // Naranja (texto col IP de Red)
        ipRedBg: '00FFF3E0',       // Naranja claro (fondo col IP de Red)
        ipWanBg: '00D6E4F0',      // Azul claro (fondo cols IP Router WAN)
        ipLanBg: '00D4EDDA',      // Verde claro (fondo cols IP Gateway/VPCS LAN)
        ipLanText: '002E7D32',    // Verde (texto IP LAN)
        broadcast: '00C62828',     // Rojo (texto col Broadcast)
        broadcastBg: '00FFEBEE',   // Rosa claro (fondo col Broadcast)
        dataText: '001A1A2E',      // Gris oscuro (texto datos genéricos)
        resParamText: '001F3864',  // Azul oscuro (texto parámetros Resumen)
        lanDataBg: '00F1F8F1',    // Verde muy claro (fondo datos LAN)
        ospfBg: '00EAF0FB',         // Azul OSPF claro (fondo columnas OSPF)
        ospfText: '001A5276',        // Azul OSPF oscuro (texto columnas OSPF)
        ospfHeader: '001A5276',      // Azul OSPF header
      };
      const A = 'Arial';
      const ctr = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const bdr = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      const mkFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

      // ══════════ HOJA 1: WAN ══════════
      const wsWAN = workbook.addWorksheet('WAN - Entre Routers');

      // Detectar si hay campos OSPF opcionales en los datos WAN
      const hasOspfWan = (args.wan_links || []).some(l => l.wildcard || l.area_ospf || l.costo_ospf);
      // Columnas base: Subred, IP Red, Máscara, [Wildcard, Área, Costo si OSPF], Router1, IP R1, Router2, IP R2, Broadcast
      const wanColCount = hasOspfWan ? 11 : 8;
      const wanMergeEnd = String.fromCharCode(64 + wanColCount); // A=65

      // R1: Título
      wsWAN.mergeCells(`A1:${wanMergeEnd}1`);
      Object.assign(wsWAN.getCell('A1'), { value: titulo, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 14 }, fill: mkFill(COLORS.titleBg), alignment: ctr });
      // R2: Subtítulo WAN
      wsWAN.mergeCells(`A2:${wanMergeEnd}2`);
      Object.assign(wsWAN.getCell('A2'), { value: `\ud83d\udd17  ${args.wan_subtitle || 'ENLACES WAN (Entre Routers)'}`, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.wanSubBg), alignment: ctr });
      // R4: Headers
      const wanHeaders = hasOspfWan
        ? ['Subred', 'IP de Red', 'Máscara', 'Wildcard', 'Área OSPF', 'Costo', 'Router 1\n(Interfaz)', 'IP Router 1', 'Router 2\n(Interfaz)', 'IP Router 2', 'Broadcast']
        : ['Subred', 'IP de Red', 'Máscara', 'Router 1\n(Interfaz)', 'IP Router 1', 'Router 2\n(Interfaz)', 'IP Router 2', 'Broadcast'];
      wanHeaders.forEach((h, i) => {
        const c = wsWAN.getRow(4).getCell(i + 1);
        const isOspfCol = hasOspfWan && i >= 3 && i <= 5;
        const headerFill = isOspfCol ? COLORS.ospfHeader : COLORS.titleBg;
        Object.assign(c, { value: h, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 10 }, fill: mkFill(headerFill), alignment: ctr, border: bdr });
      });
      // R5+: Datos
      (args.wan_links || []).forEach((link, i) => {
        const row = wsWAN.getRow(5 + i);
        const zebra = i % 2 === 0 ? COLORS.zebraA : COLORS.zebraB;
        const vals = hasOspfWan
          ? [link.subred, link.ip_red, link.mascara, link.wildcard || '', link.area_ospf || '', link.costo_ospf || '', link.router1, link.ip_router1, link.router2, link.ip_router2, link.broadcast]
          : [link.subred, link.ip_red, link.mascara, link.router1, link.ip_router1, link.router2, link.ip_router2, link.broadcast];
        const ipR1Idx = hasOspfWan ? 7 : 4;
        const ipR2Idx = hasOspfWan ? 9 : 6;
        const bcIdx   = hasOspfWan ? 10 : 7;
        vals.forEach((v, j) => {
          const c = row.getCell(j + 1);
          let font, fill;
          if (j === 0)               { font = { name: A, bold: true, color: { argb: COLORS.subred }, size: 10 }; fill = mkFill(zebra); }
          else if (j === 1)          { font = { name: A, bold: true, color: { argb: COLORS.ipRed }, size: 10 }; fill = mkFill(COLORS.ipRedBg); }
          else if (j === ipR1Idx || j === ipR2Idx) { font = { name: A, bold: true, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(COLORS.ipWanBg); }
          else if (j === bcIdx)      { font = { name: A, bold: true, color: { argb: COLORS.broadcast }, size: 10 }; fill = mkFill(COLORS.broadcastBg); }
          else if (hasOspfWan && j >= 3 && j <= 5) { font = { name: A, bold: true, color: { argb: COLORS.ospfText }, size: 10 }; fill = mkFill(COLORS.ospfBg); }
          else                       { font = { name: A, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(zebra); }
          Object.assign(c, { value: v, font, fill, alignment: ctr, border: bdr });
        });
      });
      const wanColWidths = hasOspfWan
        ? [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }]
        : [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }];
      wsWAN.columns = wanColWidths;

      // ══════════ HOJA 2: LAN ══════════
      const wsLAN = workbook.addWorksheet('LAN - Routers a PCs');

      // Detectar si hay campos OSPF opcionales en los datos LAN
      const hasOspfLan = (args.lan_links || []).some(l => l.wildcard || l.area_ospf);
      const lanColCount = hasOspfLan ? 9 : 7;
      const lanMergeEnd = String.fromCharCode(64 + lanColCount);

      // R1: Título
      wsLAN.mergeCells(`A1:${lanMergeEnd}1`);
      Object.assign(wsLAN.getCell('A1'), { value: titulo, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 14 }, fill: mkFill(COLORS.titleBg), alignment: ctr });
      // R2: Subtítulo LAN
      wsLAN.mergeCells(`A2:${lanMergeEnd}2`);
      Object.assign(wsLAN.getCell('A2'), { value: `\ud83d\udda5\ufe0f  ${args.lan_subtitle || 'ENLACES LAN (Routers a PCs)'}`, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.lanSubBg), alignment: ctr });
      // R4: Headers
      const lanHeaders = hasOspfLan
        ? ['Subred', 'IP de Red', 'Máscara', 'Wildcard', 'Área OSPF', 'Gateway / Router\n(Interfaz)', 'IP Gateway', 'IP VPCS', 'Broadcast']
        : ['Subred', 'IP de Red', 'Máscara', 'Gateway / Router\n(Interfaz)', 'IP Gateway', 'IP VPCS', 'Broadcast'];
      lanHeaders.forEach((h, i) => {
        const c = wsLAN.getRow(4).getCell(i + 1);
        const isOspfCol = hasOspfLan && (i === 3 || i === 4);
        const headerFill = isOspfCol ? COLORS.ospfHeader : COLORS.lanSubBg;
        Object.assign(c, { value: h, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 10 }, fill: mkFill(headerFill), alignment: ctr, border: bdr });
      });
      // R5+: Datos
      (args.lan_links || []).forEach((link, i) => {
        const row = wsLAN.getRow(5 + i);
        const zebra = i % 2 === 0 ? COLORS.lanDataBg : COLORS.zebraB;
        const vals = hasOspfLan
          ? [link.subred, link.ip_red, link.mascara, link.wildcard || '', link.area_ospf || '', link.gateway, link.ip_gateway, link.ip_vpcs, link.broadcast]
          : [link.subred, link.ip_red, link.mascara, link.gateway, link.ip_gateway, link.ip_vpcs, link.broadcast];
        const gwIpIdx  = hasOspfLan ? 6 : 4;
        const vpcsIdx  = hasOspfLan ? 7 : 5;
        const bcIdx    = hasOspfLan ? 8 : 6;
        vals.forEach((v, j) => {
          const c = row.getCell(j + 1);
          let font, fill;
          if (j === 0)                           { font = { name: A, bold: true, color: { argb: COLORS.ipLanText }, size: 10 }; fill = mkFill(zebra); }
          else if (j === 1)                      { font = { name: A, bold: true, color: { argb: COLORS.ipRed }, size: 10 }; fill = mkFill(COLORS.ipRedBg); }
          else if (j === gwIpIdx || j === vpcsIdx) { font = { name: A, bold: true, color: { argb: COLORS.ipLanText }, size: 10 }; fill = mkFill(COLORS.ipLanBg); }
          else if (j === bcIdx)                  { font = { name: A, bold: true, color: { argb: COLORS.broadcast }, size: 10 }; fill = mkFill(COLORS.broadcastBg); }
          else if (hasOspfLan && (j === 3 || j === 4)) { font = { name: A, bold: true, color: { argb: COLORS.ospfText }, size: 10 }; fill = mkFill(COLORS.ospfBg); }
          else                                   { font = { name: A, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(zebra); }
          Object.assign(c, { value: v, font, fill, alignment: ctr, border: bdr });
        });
      });
      const lanColWidths = hasOspfLan
        ? [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 14 }]
        : [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 14 }];
      wsLAN.columns = lanColWidths;

      // ══════════ HOJA 3: RESUMEN ══════════
      const wsRes = workbook.addWorksheet('Resumen de Red');
      // R1: Título
      wsRes.mergeCells('A1:D1');
      Object.assign(wsRes.getCell('A1'), { value: 'RESUMEN GENERAL DE LA TOPOLOG\u00cdA', font: { name: A, bold: true, color: { argb: COLORS.white }, size: 14 }, fill: mkFill(COLORS.titleBg), alignment: ctr });
      // R2: Vacía
      // R3: Headers
      Object.assign(wsRes.getCell('A3'), { value: 'Par\u00e1metro', font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.titleBg), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: bdr });
      wsRes.mergeCells('B3:D3');
      Object.assign(wsRes.getCell('B3'), { value: 'Detalle', font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.titleBg), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: bdr });
      // R4+: Datos con zebra y colores del template
      (args.resumen || []).forEach((item, i) => {
        const rn = 4 + i;
        const zebra = i % 2 === 0 ? COLORS.zebraA : COLORS.zebraB;
        Object.assign(wsRes.getCell(`A${rn}`), {
          value: item.parametro,
          font: { name: A, bold: true, color: { argb: COLORS.resParamText }, size: 10 },
          fill: mkFill(zebra),
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: bdr
        });
        wsRes.mergeCells(`B${rn}:D${rn}`);
        Object.assign(wsRes.getCell(`B${rn}`), {
          value: item.detalle,
          font: { name: A, color: { argb: COLORS.dataText }, size: 10 },
          fill: mkFill(zebra),
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: bdr
        });
      });
      wsRes.columns = [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 22 }];

      // Escribir archivo — forzar Topology_Reports/ + manejo EBUSY
      const REPORTS_DIR_XL = path.resolve('Topology_Reports');
      let xlPath = args.output_path;
      if (!xlPath.includes('Topology_Reports')) {
        const fname = path.basename(xlPath) || `Reporte_${args.project_name}.xlsx`;
        xlPath = path.join(REPORTS_DIR_XL, fname);
      }
      if (!fs.existsSync(REPORTS_DIR_XL)) fs.mkdirSync(REPORTS_DIR_XL, { recursive: true });
      try {
        await workbook.xlsx.writeFile(xlPath);
      } catch (ebusy) {
        if (ebusy.code === 'EBUSY') {
          // El archivo está abierto en Excel — guardar como _v2
          const ext = path.extname(xlPath);
          const base = xlPath.slice(0, -ext.length);
          xlPath = `${base}_v2${ext}`;
          await workbook.xlsx.writeFile(xlPath);
        } else { throw ebusy; }
      }

      return { content: [{ type: "text", text: `Reporte Excel generado: ${xlPath}\nHojas: WAN - Entre Routers, LAN - Routers a PCs, Resumen de Red${hasOspfWan || hasOspfLan ? '\n✅ Columnas OSPF incluidas (Wildcard, Área, Costo)' : ''}` }] };
    }

    // ─── Generador de Backup de Comandos (v3.3.0) ───
    else if (name === "generar_backup_comandos") {
      // Forzar Topology_Reports/
      const REPORTS_DIR = path.resolve('Topology_Reports');
      let outPath = args.output_path;
      if (!outPath.includes('Topology_Reports')) {
        const fname = path.basename(outPath) || `Backup_Comandos_${args.project_name}.md`;
        outPath = path.join(REPORTS_DIR, fname);
      }

      let content = `# \ud83d\udcbe Backup de Comandos \u2014 ${args.project_name}\n`;
      content += `> Generado autom\u00e1ticamente por GNS3 Topology Agent v3.3.0\n`;
      content += `> Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}\n\n`;
      content += `---\n\n`;
      content += `> **Instrucciones:** Copie y pegue los comandos de cada secci\u00f3n directamente en la consola del dispositivo correspondiente en GNS3. Los comandos est\u00e1n en el orden exacto de ejecuci\u00f3n.\n\n`;

      for (const device of args.devices) {
        const icon = device.device_type === 'router' ? '\ud83d\udce1' : device.device_type === 'vpc' ? '\ud83d\udcbb' : '\ud83d\udd27';
        content += `## ${icon} ${device.name}${device.device_type ? ` (${device.device_type})` : ''}\n`;
        content += '```\n';
        for (const cmd of device.commands) {
          content += cmd + '\n';
        }
        content += '```\n\n';

        // Sección de verificación si el agente la proporciona
        if (device.verification_output) {
          content += `### \ud83d\udd0d Verificaci\u00f3n Post-Configuraci\u00f3n — ${device.name}\n`;
          content += '```\n';
          content += device.verification_output + '\n';
          content += '```\n\n';
        }
      }

      if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
      fs.writeFileSync(outPath, content, 'utf-8');

      return { content: [{ type: "text", text: `Backup de comandos generado: ${outPath}\nDispositivos: ${args.devices.map(d => d.name).join(', ')}` }] };
    }

    // ─── Calculadora OSPF: Wildcards + Áreas + Bloques IOS ───
    else if (name === "calcular_ospf") {
      // Función para calcular wildcard desde CIDR
      const cidrToWildcard = (cidr) => {
        const mask = ~(0xFFFFFFFF << (32 - cidr)) >>> 0;
        return [(mask >>> 24) & 0xFF, (mask >>> 16) & 0xFF, (mask >>> 8) & 0xFF, mask & 0xFF].join('.');
      };

      let report = `\ud83d\udcca **C\u00e1lculo OSPF — Resumen de \u00c1reas y Wildcards**\n`;
      report += `${'═'.repeat(55)}\n\n`;

      const areaMap = {}; // Para agrupar redes por área

      for (const router of args.routers) {
        report += `\ud83d\udce1 **${router.name}**\n`;
        report += `${'─'.repeat(40)}\n`;
        report += `  enable\n  configure terminal\n  router ospf 1\n`;

        for (const net of router.networks) {
          const wildcard = cidrToWildcard(net.cidr);
          const iosCmd = `  network ${net.ip_red} ${wildcard} area ${net.area}`;
          report += `${iosCmd}${net.descripcion ? `    ← ${net.descripcion}` : ''}\n`;

          if (net.costo) {
            report += `  ! Costo en interfaz correspondiente: ip ospf cost ${net.costo}\n`;
          }

          // Agrupar para el resumen de áreas
          const areaKey = `Área ${net.area}`;
          if (!areaMap[areaKey]) areaMap[areaKey] = [];
          areaMap[areaKey].push({ router: router.name, red: `${net.ip_red}/${net.cidr}`, wildcard, descripcion: net.descripcion });
        }
        report += `  exit\n  exit\n  write\n\n`;
      }

      // Resumen por áreas
      report += `\n\ud83c\udf10 **Resumen por \u00c1rea OSPF**\n`;
      report += `${'═'.repeat(55)}\n`;
      for (const [area, redes] of Object.entries(areaMap).sort()) {
        const isBackbone = area === 'Área 0';
        report += `\n${isBackbone ? '\ud83d\udc9b' : '\ud83d\udfe2'} **${area}${isBackbone ? ' (Backbone)' : ''}**\n`;
        for (const r of redes) {
          report += `  • ${r.router}: ${r.red} (wildcard: ${r.wildcard})${r.descripcion ? ` — ${r.descripcion}` : ''}\n`;
        }
        // Detectar ABRs (routers que aparecen en más de un área)
      }

      // Detectar ABRs
      const routerAreas = {};
      for (const router of args.routers) {
        routerAreas[router.name] = [...new Set(router.networks.map(n => n.area))];
      }
      const abrs = Object.entries(routerAreas).filter(([, areas]) => areas.length > 1);
      if (abrs.length > 0) {
        report += `\n\ud83d\udd17 **ABRs detectados** (conectados a m\u00faltiples \u00e1reas):\n`;
        for (const [name, areas] of abrs) {
          report += `  • ${name}: \u00c1reas ${areas.map(a => a).join(' ↔ ')}\n`;
        }
      }

      report += `\n\u2714\ufe0f Revisa el plan arr\u00edba. Si es correcto, procedo a configurar los routers.`;

      return { content: [{ type: "text", text: report }] };
    }

    // ─── Ejecutar Comando de Verificación (Output limpio con prompts visibles) ───
    else if (name === "ejecutar_comando_router") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      if (node.status !== "started") throw new Error("El nodo debe estar encendido.");

      const queryResult = await new Promise((resolve, reject) => {
        let settled = false;
        let drainDone = false;
        let output = "";

        const socket = net.createConnection(node.console, "127.0.0.1", () => {
          socket.write('\r\n');
        });

        socket.on('data', (data) => {
          if (!drainDone) return; // Descartar buffer residual
          output += data.toString();
          // Terminar cuando vemos el prompt final con # (indica que el comando completó)
          const lines = output.split('\n');
          const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || '';
          if (/[>#]\s*$/.test(lastLine) && output.length > 10) {
            if (!settled) {
              settled = true;
              setTimeout(() => { socket.end(); resolve(output); }, 500);
            }
          }
        });

        // Drain 800ms, luego enviar enable + comando
        setTimeout(() => {
          if (settled) return;
          drainDone = true;
          output = "";
          // Subir a privilegiado y ejecutar comando
          socket.write(`enable\r\n`);
          setTimeout(() => {
            if (settled) return;
            socket.write(`terminal length 0\r\n`);
            setTimeout(() => {
              if (settled) return;
              socket.write(`${args.command}\r\n`);
            }, 600);
          }, 600);
        }, 800);

        socket.on('error', (err) => {
          if (!settled) { settled = true; reject(new Error(`Error Telnet: ${err.message}`)); }
        });
        const timeoutHandle = setTimeout(() => {
          if (!settled) { settled = true; socket.destroy(); resolve(output || "Timeout esperando respuesta."); }
        }, 20000);
        socket.on('close', () => clearTimeout(timeoutHandle));
      });

      // Limpiar el output: quitar líneas de banner, quedarse desde el primer prompt
      const lines = queryResult.split('\n');
      const firstPromptIdx = lines.findIndex(l => /[>#]/.test(l));
      const cleanLines = firstPromptIdx >= 0 ? lines.slice(firstPromptIdx) : lines;
      const cleanOutput = cleanLines.join('\n').trim();

      // Header informativo
      const header = `\ud83d\udce1 ${node.name}# ${args.command} \u2192 `;
      const lineCount = cleanLines.filter(l => l.trim().length > 0).length;
      const summary = lineCount > 3 ? `\u2705 ${lineCount - 2} l\u00edneas de resultado` : '\u2705 OK';

      return { content: [{ type: "text", text: `${header}${summary}\n\n\`\`\`\n${cleanOutput}\n\`\`\`` }] };
    }

    // ─── Generador de Markdown de Traceroute ───
    else if (name === "generar_traceroute_md") {
      // Forzar Topology_Reports/
      const REPORTS_DIR = path.resolve('Topology_Reports');
      let outPath = args.output_path;
      if (!outPath.includes('Topology_Reports')) {
        const fname = path.basename(outPath) || `Trace_Rutas_${args.project_name}.md`;
        outPath = path.join(REPORTS_DIR, fname);
      }

      const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
      let content = `# \ud83d\udce1 Reporte de Trazado de Rutas \u2014 Proyecto: ${args.project_name}\n`;
      content += `Fecha: ${fecha}\n\n---\n\n`;

      args.trazados.forEach((t, i) => {
        const origenLabel = t.area_origen ? `${t.origen} (${t.area_origen})` : t.origen;
        const destinoLabel = t.area_destino ? `${t.destino} (${t.area_destino})` : t.destino;
        content += `## ${i + 1}. Trazado: ${origenLabel} \u2192 ${destinoLabel}\n`;
        content += `**Destino IP:** \`${t.ip_destino}\`\n\n`;
        content += `### Output de Consola\n`;
        content += `\`\`\`\n${t.output_consola}\n\`\`\`\n\n`;
        if (t.observaciones) {
          content += `### \ud83d\udd0d Observaciones T\u00e9cnicas\n${t.observaciones}\n\n`;
        }
        content += `---\n\n`;
      });

      if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
      fs.writeFileSync(outPath, content, 'utf-8');

      return { content: [{ type: "text", text: `Reporte de Traceroute generado: ${outPath}\nTrazados: ${args.trazados.length}` }] };
    }

    // ─── Validador de Ruta de Archivo ───
    else if (name === "validar_ruta_archivo") {
      const REPORTS_DIR = path.resolve('Topology_Reports');
      let outPath = args.output_path;
      let corrected = false;

      if (!outPath.includes('Topology_Reports')) {
        const fname = path.basename(outPath) || `Reporte_${args.project_name}`;
        outPath = path.join(REPORTS_DIR, fname);
        corrected = true;
      }

      const msg = corrected
        ? `\u26a0\ufe0f Ruta corregida autom\u00e1ticamente.\nRuta original: ${args.output_path}\nRuta correcta: ${outPath}`
        : `\u2705 Ruta v\u00e1lida: ${outPath}`;

      return { content: [{ type: "text", text: msg }] };
    }

    throw new Error(`Herramienta desconocida: ${name}`);
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);