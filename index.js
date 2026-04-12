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
  { name: "gns3-topology-agent", version: "3.2.0" },
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
        description: "Genera un reporte Excel profesional con el plan de direccionamiento IP. Crea 3 hojas: WAN (entre routers), LAN (routers a PCs) y Resumen de Red, con formato idéntico al template base.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: { type: "string", description: "Nombre del proyecto para el título" },
            wan_subtitle: { type: "string", description: "Subtítulo de la sección WAN, ej: 'ENLACES WAN (Entre Routers) — Máscara /30 (255.255.255.252)'" },
            wan_links: {
              type: "array", description: "Enlaces WAN punto a punto",
              items: { type: "object", properties: {
                subred: { type: "string" }, ip_red: { type: "string" }, mascara: { type: "string" },
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
            output_path: { type: "string", description: "Ruta completa del archivo de salida (.xlsx)" }
          },
          required: ["project_name", "wan_links", "lan_links", "resumen", "output_path"]
        }
      },
      {
        name: "generar_backup_comandos",
        description: "Genera un archivo Markdown de backup con los comandos de configuración ejecutados en cada dispositivo. Permite re-configuración manual por copy-paste.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: { type: "string", description: "Nombre del proyecto" },
            devices: {
              type: "array",
              items: { type: "object", properties: {
                name: { type: "string", description: "Nombre del dispositivo (R1, PC1, etc.)" },
                device_type: { type: "string", description: "Tipo: router, vpc, switch" },
                commands: { type: "array", items: { type: "string" }, description: "Comandos ejecutados en orden" }
              }, required: ["name", "commands"]}
            },
            output_path: { type: "string", description: "Ruta completa del archivo de salida (.md)" }
          },
          required: ["project_name", "devices", "output_path"]
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

      const configResult = await new Promise((resolve, reject) => {
        let settled = false;
        let output = "";
        let step = 0;

        const socket = net.createConnection(consolePort, host, () => {
          socket.write('\r\n');
        });

        const promptPattern = /[>#]\s*$/;
        const bootstrapPattern = /Would you like to enter the initial configuration dialog/i;
        let sendScheduled = false;
        let initialWaitDone = false;
        let bootstrapAnswered = false;
        let enterInterval = null;

        // BUG-1: Active Prompt Polling — enviar Enter cada 3s como se haría manualmente
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
          if (step < args.commands.length) {
            socket.write(`${args.commands[step]}\r\n`);
            step++;
            sendScheduled = true;
            setTimeout(() => { if (sendScheduled && !settled) trySendNext(); }, 600);
          } else {
            // Todos los comandos enviados, cerrar sesión
            socket.write('end\r\nwrite\r\n');
            setTimeout(() => {
              if (!settled) {
                settled = true;
                cleanupInterval();
                socket.end();
                const iosErrors = output.match(/% .+/g) || [];
                let result = `Comandos enviados a ${node.name} exitosamente.`;
                if (iosErrors.length > 0) {
                  result += `\n⚠️ Advertencias IOS detectadas:\n${iosErrors.join('\n')}`;
                }
                // BUG-2: Verificar que los comandos realmente se procesaron
                const configPromptSeen = /\(config[^)]*\)#/.test(output) || output.includes('Building configuration');
                if (!configPromptSeen) {
                  result += '\n🚨 ADVERTENCIA: No se detectó evidencia de que los comandos hayan sido procesados por IOS. El router podría haber estado arrancando durante el envío.';
                }
                result += `\n--- Output del Router ---\n${output.slice(-2000)}`;
                resolve(result);
              }
            }, 2000);
          }
        };

        socket.on('data', (data) => {
          output += data.toString();
          if (!initialWaitDone) {
            // BUG-1: Detectar Bootstrap dialog y responder automáticamente
            if (!bootstrapAnswered && bootstrapPattern.test(output)) {
              bootstrapAnswered = true;
              socket.write('no\r\n');
            }
            // Esperar a ver un prompt real antes de enviar comandos
            if (promptPattern.test(output)) {
              initialWaitDone = true;
              cleanupInterval();
              trySendNext();
            }
          } else if (sendScheduled && promptPattern.test(data.toString())) {
            trySendNext();
          }
        });

        // BUG-1: Fallback extendido a 60s (antes era 3s) para routers c7200
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
        // Timeout total extendido a 90s para contemplar boot + configuración
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
      };
      const A = 'Arial';
      const ctr = { horizontal: 'center', vertical: 'middle', wrapText: true };
      const bdr = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      const mkFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

      // ══════════ HOJA 1: WAN ══════════
      const wsWAN = workbook.addWorksheet('WAN - Entre Routers');
      // R1: Título
      wsWAN.mergeCells('A1:H1');
      Object.assign(wsWAN.getCell('A1'), { value: titulo, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 14 }, fill: mkFill(COLORS.titleBg), alignment: ctr });
      // R2: Subtítulo WAN (azul medio)
      wsWAN.mergeCells('A2:H2');
      Object.assign(wsWAN.getCell('A2'), { value: `\ud83d\udd17  ${args.wan_subtitle || 'ENLACES WAN (Entre Routers)'}`, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.wanSubBg), alignment: ctr });
      // R3: Vacía (separador visual como en el template)
      // R4: Headers (azul oscuro)
      const wanHeaders = ['Subred', 'IP de Red', 'M\u00e1scara', 'Router 1\n(Interfaz)', 'IP Router 1', 'Router 2\n(Interfaz)', 'IP Router 2', 'Broadcast'];
      wanHeaders.forEach((h, i) => {
        const c = wsWAN.getRow(4).getCell(i + 1);
        Object.assign(c, { value: h, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 10 }, fill: mkFill(COLORS.titleBg), alignment: ctr, border: bdr });
      });
      // R5+: Datos con colores semánticos por columna
      (args.wan_links || []).forEach((link, i) => {
        const row = wsWAN.getRow(5 + i);
        const zebra = i % 2 === 0 ? COLORS.zebraA : COLORS.zebraB;
        const vals = [link.subred, link.ip_red, link.mascara, link.router1, link.ip_router1, link.router2, link.ip_router2, link.broadcast];
        vals.forEach((v, j) => {
          const c = row.getCell(j + 1);
          let font, fill;
          if (j === 0)      { font = { name: A, bold: true, color: { argb: COLORS.subred }, size: 10 }; fill = mkFill(zebra); }
          else if (j === 1) { font = { name: A, bold: true, color: { argb: COLORS.ipRed }, size: 10 }; fill = mkFill(COLORS.ipRedBg); }
          else if (j === 4 || j === 6) { font = { name: A, bold: true, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(COLORS.ipWanBg); }
          else if (j === 7) { font = { name: A, bold: true, color: { argb: COLORS.broadcast }, size: 10 }; fill = mkFill(COLORS.broadcastBg); }
          else              { font = { name: A, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(zebra); }
          Object.assign(c, { value: v, font, fill, alignment: ctr, border: bdr });
        });
      });
      wsWAN.columns = [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }];

      // ══════════ HOJA 2: LAN ══════════
      const wsLAN = workbook.addWorksheet('LAN - Routers a PCs');
      // R1: Título
      wsLAN.mergeCells('A1:G1');
      Object.assign(wsLAN.getCell('A1'), { value: titulo, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 14 }, fill: mkFill(COLORS.titleBg), alignment: ctr });
      // R2: Subtítulo LAN (verde)
      wsLAN.mergeCells('A2:G2');
      Object.assign(wsLAN.getCell('A2'), { value: `\ud83d\udda5\ufe0f  ${args.lan_subtitle || 'ENLACES LAN (Routers a PCs)'}`, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 11 }, fill: mkFill(COLORS.lanSubBg), alignment: ctr });
      // R3: Vacía
      // R4: Headers (verde)
      const lanHeaders = ['Subred', 'IP de Red', 'M\u00e1scara', 'Gateway / Router\n(Interfaz)', 'IP Gateway', 'IP VPCS', 'Broadcast'];
      lanHeaders.forEach((h, i) => {
        const c = wsLAN.getRow(4).getCell(i + 1);
        Object.assign(c, { value: h, font: { name: A, bold: true, color: { argb: COLORS.white }, size: 10 }, fill: mkFill(COLORS.lanSubBg), alignment: ctr, border: bdr });
      });
      // R5+: Datos con colores semánticos LAN
      (args.lan_links || []).forEach((link, i) => {
        const row = wsLAN.getRow(5 + i);
        const zebra = i % 2 === 0 ? COLORS.lanDataBg : COLORS.zebraB;
        const vals = [link.subred, link.ip_red, link.mascara, link.gateway, link.ip_gateway, link.ip_vpcs, link.broadcast];
        vals.forEach((v, j) => {
          const c = row.getCell(j + 1);
          let font, fill;
          if (j === 0)      { font = { name: A, bold: true, color: { argb: COLORS.ipLanText }, size: 10 }; fill = mkFill(zebra); }
          else if (j === 1) { font = { name: A, bold: true, color: { argb: COLORS.ipRed }, size: 10 }; fill = mkFill(COLORS.ipRedBg); }
          else if (j === 4 || j === 5) { font = { name: A, bold: true, color: { argb: COLORS.ipLanText }, size: 10 }; fill = mkFill(COLORS.ipLanBg); }
          else if (j === 6) { font = { name: A, bold: true, color: { argb: COLORS.broadcast }, size: 10 }; fill = mkFill(COLORS.broadcastBg); }
          else              { font = { name: A, color: { argb: COLORS.dataText }, size: 10 }; fill = mkFill(zebra); }
          Object.assign(c, { value: v, font, fill, alignment: ctr, border: bdr });
        });
      });
      wsLAN.columns = [{ width: 18 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 14 }];

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

      // Escribir archivo
      const outputDir = path.dirname(args.output_path);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      await workbook.xlsx.writeFile(args.output_path);

      return { content: [{ type: "text", text: `Reporte Excel generado: ${args.output_path}\nHojas: WAN - Entre Routers, LAN - Routers a PCs, Resumen de Red` }] };
    }

    // ─── Generador de Backup de Comandos (v3.2.0) ───
    else if (name === "generar_backup_comandos") {
      let content = `# \ud83d\udcbe Backup de Comandos \u2014 ${args.project_name}\n`;
      content += `> Generado autom\u00e1ticamente por GNS3 Topology Agent v3.2.0\n`;
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
      }

      const outputDir = path.dirname(args.output_path);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(args.output_path, content, 'utf-8');

      return { content: [{ type: "text", text: `Backup de comandos generado: ${args.output_path}\nDispositivos: ${args.devices.map(d => d.name).join(', ')}` }] };
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