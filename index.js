import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import net from "net";

const GNS3_BASE_URL = "http://127.0.0.1:3080/v2";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const server = new Server(
  { name: "gns3-topology-agent", version: "2.9.0" },
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
        description: "Agrega un dispositivo usando plantillas.",
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
        description: "Conecta dos dispositivos.",
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
        description: "Envía una lista de comandos de configuración a un Router Cisco via Telnet.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string" },
            node_id: { type: "string" },
            commands: { type: "array", items: { type: "string" } }
          },
          required: ["project_id", "node_id", "commands"]
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
      return { content: [{ type: "text", text: `Dispositivo ${args.name} creado.` }] };
    }

    else if (name === "conectar_nodos") {
      const ad1 = args.adapter1 !== undefined ? args.adapter1 : 0;
      const pt1 = args.port1 !== undefined ? args.port1 : 0;
      const ad2 = args.adapter2 !== undefined ? args.adapter2 : 0;
      const pt2 = args.port2 !== undefined ? args.port2 : 0;
      await fetchGNS3(`/projects/${args.project_id}/links`, 'POST', {
        nodes: [{ node_id: args.node1_id, adapter_number: ad1, port_number: pt1 },
        { node_id: args.node2_id, adapter_number: ad2, port_number: pt2 }]
      });
      return { content: [{ type: "text", text: "Enlace creado." }] };
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

      // 1. Enviar señal de apagado a todos los nodos
      for (const node of nodes) {
        if (node.status === "started" || node.status === "suspended") {
          try { await fetchGNS3(`/projects/${args.project_id}/nodes/${node.node_id}/stop`, 'POST'); } catch (e) { }
        }
      }

      // 2. Hacer polling crítico hasta que Dynamips confirme el apagado total (Max 30s)
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

      // Delay adicional de seguridad tras el apagado
      await sleep(2000);

      // 3. Destrucción Secuencial Lenta
      const links = await fetchGNS3(`/projects/${args.project_id}/links`);
      for (const link of links) { await deleteSafe(`/projects/${args.project_id}/links/${link.link_id}`); await sleep(500); }

      for (const node of nodes) { await deleteSafe(`/projects/${args.project_id}/nodes/${node.node_id}`); await sleep(1000); }

      const drawings = await fetchGNS3(`/projects/${args.project_id}/drawings`);
      for (const drawing of drawings) { await deleteSafe(`/projects/${args.project_id}/drawings/${drawing.drawing_id}`); await sleep(500); }

      return { content: [{ type: "text", text: "Proyecto limpiado con seguridad extrema (Polling Strict)." }] };
    }

    else if (name === "configurar_vpc") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      if (node.status === "stopped") {
        await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}/start`, 'POST');
        await sleep(2000);
      }

      const consolePort = node.console;
      const host = "127.0.0.1";

      const configResult = await new Promise((resolve, reject) => {
        const socket = net.createConnection(consolePort, host, () => {
          // VPCs a veces necesitan un Enter inicial para despertar la consola
          socket.write('\r\n');
          setTimeout(() => {
            socket.write(`ip ${args.ip} ${args.gateway} ${args.mask_bits}\r\n`);
            setTimeout(() => {
              socket.write('save\r\n');
              setTimeout(() => {
                socket.end();
                resolve(`Configuración enviada a ${node.name}: IP ${args.ip}/${args.mask_bits} GW ${args.gateway}`);
              }, 1000);
            }, 1000);
          }, 1000);
        });

        socket.on('error', (err) => reject(new Error(`Error de consola Telnet: ${err.message}`)));
        setTimeout(() => { socket.destroy(); reject(new Error("Timeout conectando a la consola.")); }, 5000);
      });

      return { content: [{ type: "text", text: configResult }] };
    }

    else if (name === "configurar_router_cisco") {
      const node = await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}`);
      if (node.status === "stopped") {
        await fetchGNS3(`/projects/${args.project_id}/nodes/${args.node_id}/start`, 'POST');
        await sleep(5000); // Routers tardan más en iniciar
      }

      const consolePort = node.console;
      const host = "127.0.0.1";

      const configResult = await new Promise((resolve, reject) => {
        const socket = net.createConnection(consolePort, host, () => {
          socket.write('\r\n');
          let step = 0;
          const sendNext = () => {
            if (step < args.commands.length) {
              socket.write(`${args.commands[step]}\r\n`);
              step++;
              setTimeout(sendNext, 800); // Pausa entre comandos para estabilidad
            } else {
              socket.write('end\r\nwrite\r\n');
              setTimeout(() => { socket.end(); resolve(`Comandos enviados a ${node.name} exitosamente.`); }, 2000);
            }
          };
          setTimeout(sendNext, 2000); // Esperar a que la consola esté lista
        });

        socket.on('error', (err) => reject(new Error(`Error consola Router: ${err.message}`)));
        setTimeout(() => { socket.destroy(); reject(new Error("Timeout conectando al Router.")); }, 20000);
      });

      return { content: [{ type: "text", text: configResult }] };
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