import { timeoutSignal } from "./timeout.js";

export type McpResult = {
  title: string;
  content: string;
  source: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

const mcpHttpUrl = process.env.MCP_HTTP_URL ?? "http://localhost:5000";

export async function callMcpTool(toolName: string, query: string, limit = 5): Promise<McpResult[]> {
  const response = await fetch(`${mcpHttpUrl}/tools/${toolName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, limit }),
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`MCP tool ${toolName} failed with ${response.status}`);
  }

  const payload = (await response.json()) as { result?: McpResult[] };
  return payload.result ?? [];
}

export function formatContext(results: McpResult[]): string {
  return results
    .map((item, index) => {
      return `[${index + 1}] ${item.title}\nSource: ${item.source}\n${item.content}`;
    })
    .join("\n\n");
}
