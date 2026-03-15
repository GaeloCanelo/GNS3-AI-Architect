import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["index.js"]
  });
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  
  const toolName = process.argv[2] || "obtener_proyectos";
  const argsStr = process.argv[3] || "{}";
  const args = JSON.parse(argsStr);
  
  const result = await client.callTool({ name: toolName, arguments: args });
  console.log(result.content[0].text);
  process.exit(0);
}

main().catch(err => {
  console.error("Error executing MCP tool:", err);
  process.exit(1);
});
