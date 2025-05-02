//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { grade, EvalFunction } from "mcp-evals";

const write_to_terminalEval: EvalFunction = {
    name: 'Write to Terminal Tool Evaluation',
    description: 'Evaluates the functionality of writing text to the active iTerm terminal',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please write the command 'echo \"Hello World\"' to the terminal");
        return JSON.parse(result);
    }
};

const read_terminal_output: EvalFunction = {
    name: "read_terminal_output",
    description: "Evaluates the ability to read output from the active iTerm terminal",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please read the last 5 lines of output from the active iTerm terminal.");
        return JSON.parse(result);
    }
};

const send_control_characterEval: EvalFunction = {
    name: "send_control_character Tool Evaluation",
    description: "Evaluates sending a control character to iTerm",
    run: async () => {
        const result = await grade(openai("gpt-4"), "Please send a Control-C to the active iTerm session using the letter 'C'.");
        return JSON.parse(result);
    }
};

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: [write_to_terminalEval, read_terminal_output, send_control_characterEval]
};
  
export default config;
  
export const evals = [write_to_terminalEval, read_terminal_output, send_control_characterEval];