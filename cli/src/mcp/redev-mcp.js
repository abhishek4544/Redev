#!/usr/bin/env node
/**
 * Redev MCP server (stdio).
 *
 * Exposes tools that let Claude Code:
 *   1. Read the currently pending element+prompt from a running `npx redev` backend
 *   2. Apply the resulting edit and notify the browser to reload
 *   3. Report an error back to the user
 *
 * Talks to the local Redev backend over HTTP (defaults to http://localhost:5050,
 * override with REDEV_HTTP_URL).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const REDEV_URL = process.env.REDEV_HTTP_URL || 'http://localhost:5050';

async function callBackend(pathname, init = {}) {
  const url = `${REDEV_URL}${pathname}`;
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}: ${text}`);
    return body;
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(
        `Redev backend not running at ${REDEV_URL}. Run \`npx redev\` in your project first.`,
      );
    }
    throw err;
  }
}

const server = new Server(
  { name: 'redev', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

const tools = [
  {
    name: 'get_pending_request',
    description:
      'Fetch the currently pending click-to-edit request from Redev. Returns null if the user has not submitted a request from the browser panel. Call this when the user asks about redev, or before applying a change.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'apply_change',
    description:
      'Mark the pending Redev request as complete. Pass a one-line summary of what changed and the list of files edited. This clears the pending state and triggers the browser to reload.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One-line human summary of the edit.' },
        files_edited: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths of files that were modified.',
        },
      },
      required: ['summary', 'files_edited'],
    },
  },
  {
    name: 'report_error',
    description:
      'Report that the pending Redev request could not be completed (ambiguous, out of scope, etc.). Clears the pending state and shows the message in the browser panel.',
    inputSchema: {
      type: 'object',
      properties: {
        error: { type: 'string', description: 'Explanation shown to the user.' },
      },
      required: ['error'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    if (name === 'get_pending_request') {
      const data = await callBackend('/mcp/pending');
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
    if (name === 'apply_change') {
      const data = await callBackend('/mcp/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          summary: String(args.summary || ''),
          files_edited: Array.isArray(args.files_edited) ? args.files_edited.map(String) : [],
        }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'report_error') {
      const data = await callBackend('/mcp/error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: String(args.error || 'unspecified error') }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: err.message }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
