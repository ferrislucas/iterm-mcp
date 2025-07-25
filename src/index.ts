#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import CommandExecutor from "./CommandExecutor.js";
import TtyOutputReader from "./TtyOutputReader.js";
import SendControlCharacter from "./SendControlCharacter.js";

const server = new Server(
  {
    name: "iterm-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "write_to_terminal",
        description: "Writes text to the active iTerm terminal - often used to run a command in the terminal",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command to run or text to write to the terminal"
            },
            wait: {
              type: "boolean",
              description: "Whether to wait for the command to finish executing (useful for TUI applications)"
            },
          },
          required: ["command"]
        }
      },
      {
        name: "read_terminal_output",
        description: "Reads the output from the active iTerm terminal",
        inputSchema: {
          type: "object",
          properties: {
            linesOfOutput: {
              type: "integer",
              description: "The number of lines of output to read."
            },
          },
          required: ["linesOfOutput"]
        }
      },
      {
        name: "send_control_character",
        description: "Sends a control character to the active iTerm terminal (e.g., Control-C, or special sequences like ']' for telnet escape)",
        inputSchema: {
          type: "object",
          properties: {
            letter: {
              type: "string",
              description: "The letter corresponding to the control character (e.g., 'C' for Control-C, ']' for telnet escape)"
            },
          },
          required: ["letter"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "write_to_terminal": {
      let executor = new CommandExecutor();
      const command = String(request.params.arguments?.command);
      const wait = Boolean(request.params.arguments?.wait);
      const beforeCommandBuffer = await TtyOutputReader.retrieveBuffer();
      const beforeCommandBufferLines = beforeCommandBuffer.split("\n").length;
      
      await executor.executeCommand(command, wait);
      
      const afterCommandBuffer = await TtyOutputReader.retrieveBuffer();
      const afterCommandBufferLines = afterCommandBuffer.split("\n").length;
      const outputLines = afterCommandBufferLines - beforeCommandBufferLines

      return {
        content: [{
          type: "text",
          text: `${outputLines} lines were output after sending the command to the terminal. Read the last ${outputLines} lines of terminal contents to orient yourself. Never assume that the command was executed or that it was successful.`
        }]
      };
    }
    case "read_terminal_output": {
      const linesOfOutput = Number(request.params.arguments?.linesOfOutput) || 25
      const output = await TtyOutputReader.call(linesOfOutput)

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    }
    case "send_control_character": {
      const ttyControl = new SendControlCharacter();
      const letter = String(request.params.arguments?.letter);
      await ttyControl.send(letter);
      
      return {
        content: [{
          type: "text",
          text: `Sent control character: Control-${letter.toUpperCase()}`
        }]
      };
    }
    default:
      throw new Error("Unknown tool");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
