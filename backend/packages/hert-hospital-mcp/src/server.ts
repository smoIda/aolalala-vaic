import Fastify from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { closePool, pool } from "./db.js";
import { isToolName, tools } from "./search.js";

const inputSchema = {
  query: z.string().min(1).describe("Vietnamese user query"),
  type: z
    .enum(["information", "process", "service", "location", "preparation", "faq"])
    .or(z.array(z.enum(["information", "process", "service", "location", "preparation", "faq"])))
    .optional(),
  limit: z.number().int().min(1).max(20).optional(),
};

function registerTools(server: McpServer) {
  server.registerTool(
    "search_knowledge",
    { title: "Search Knowledge", description: "Search all hospital knowledge items", inputSchema },
    async (input) => asMcpText(await tools.search_knowledge(input)),
  );
  server.registerTool(
    "search_faq",
    { title: "Search FAQ", description: "Search internal FAQ documents", inputSchema },
    async (input) => asMcpText(await tools.search_faq(input)),
  );
  server.registerTool(
    "search_department",
    { title: "Search Department", description: "Search department and location data", inputSchema },
    async (input) => asMcpText(await tools.search_department(input)),
  );
  server.registerTool(
    "search_doctor",
    { title: "Search Doctor", description: "Search doctor data when available", inputSchema },
    async (input) => asMcpText(await tools.search_doctor(input)),
  );
  server.registerTool(
    "search_service",
    { title: "Search Service", description: "Search hospital service list and prices", inputSchema },
    async (input) => asMcpText(await tools.search_service(input)),
  );
  server.registerTool(
    "search_price",
    { title: "Search Price", description: "Search service prices", inputSchema },
    async (input) => asMcpText(await tools.search_price(input)),
  );
  server.registerTool(
    "search_policy",
    { title: "Search Policy", description: "Search process, contact, and hospital policy documents", inputSchema },
    async (input) => asMcpText(await tools.search_policy(input)),
  );
  server.registerTool(
    "search_navigation",
    { title: "Search Navigation", description: "Search hospital navigation/location records", inputSchema },
    async (input) => asMcpText(await tools.search_navigation(input)),
  );
  server.registerTool(
    "search_process",
    { title: "Search Process", description: "Search hospital process records", inputSchema },
    async (input) => asMcpText(await tools.search_process(input)),
  );
  server.registerTool(
    "search_preparation",
    { title: "Search Preparation", description: "Search preparation guidance before hospital visits", inputSchema },
    async (input) => asMcpText(await tools.search_preparation(input)),
  );
  server.registerTool(
    "search_ticket_rules",
    { title: "Search Ticket Rules", description: "Search ticket labeling rules", inputSchema },
    async (input) => asMcpText(await tools.search_ticket_rules(input)),
  );
}

function asMcpText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function startStdio() {
  const server = new McpServer({ name: "hert-hospital-mcp", version: "0.1.0" });
  registerTools(server);
  await server.connect(new StdioServerTransport());
  console.error("hert-hospital-mcp running on stdio");
}

async function startHttp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true, service: "hert-hospital-mcp" };
  });

  app.post<{
    Params: { toolName: string };
    Body: { query?: string; type?: "information" | "process" | "service" | "location" | "preparation" | "faq" | Array<"information" | "process" | "service" | "location" | "preparation" | "faq">; limit?: number };
  }>("/tools/:toolName", async (request, reply) => {
    const { toolName } = request.params;
    if (!isToolName(toolName)) {
      return reply.status(404).send({ error: "unknown_tool", toolName });
    }

    const query = request.body?.query ?? "";
    const type = request.body?.type;
    const limit = request.body?.limit;
    const result = await tools[toolName]({ query, type, limit });
    return { tool: toolName, result };
  });

  const port = Number(process.env.MCP_HTTP_PORT ?? 5000);
  await app.listen({ host: "0.0.0.0", port });
}

const mode = process.env.MCP_TRANSPORT ?? "stdio";

(mode === "http" ? startHttp() : startStdio()).catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
