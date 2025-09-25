import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { openSync, closeSync } from 'node:fs';
import ProcessTracker from './ProcessTracker.js';
import TtyOutputReader from './TtyOutputReader.js';

/**
 * CommandExecutor handles sending commands to iTerm2 via AppleScript.
 * 
 * This includes special handling for multiline text to prevent AppleScript syntax errors
 * when dealing with newlines in command strings. The approach uses AppleScript string 
 * concatenation with explicit line breaks rather than trying to embed newlines directly
 * in the AppleScript string.
 */

const execPromise = promisify(exec);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class CommandExecutor {
  private _execPromise: typeof execPromise;

  constructor(execPromiseOverride?: typeof execPromise) {
    this._execPromise = execPromiseOverride || execPromise;
  }

  /**
   * Executes a command in the iTerm2 terminal.
   * 
   * This method handles both single-line and multiline commands by:
   * 1. Properly escaping the command string for AppleScript
   * 2. Using different AppleScript approaches based on whether the command contains newlines
   * 3. Waiting for the command to complete execution
   * 4. Retrieving the terminal output after command execution
   * 
   * @param command The command to execute (can contain newlines)
   * @param wait Whether to wait for the command to finish executing (false is useful for TUI applications)
   * @returns A promise that resolves to the terminal output after command execution
   */
  async executeCommand(command: string, wait: boolean): Promise<string> {
    const escapedCommand = this.escapeForAppleScript(command);
    
    try {
      // Check if this is a multiline command (which would have been processed differently)
      if (command.includes('\n')) {
        // For multiline text, we use parentheses around our prepared string expression
        // This allows AppleScript to evaluate the string concatenation expression
        await this._execPromise(`/usr/bin/osascript -e 'tell application "iTerm2" to tell current session of current window to write text (${escapedCommand})'`);
      } else {
        // For single line commands, we can use the standard approach with quoted strings
        await this._execPromise(`/usr/bin/osascript -e 'tell application "iTerm2" to tell current session of current window to write text "${escapedCommand}"'`);
      }
      
      // Wait until iTerm2 reports that command processing is complete
      while (wait && await this.isProcessing()) {
        await sleep(100);
      }
      
      // Get the TTY path and check if it's waiting for user input
      const ttyPath = await this.retrieveTtyPath();
      while (wait && await this.isWaitingForUserInput(ttyPath) === false) {
        await sleep(100);
      }

      // Give a small delay for output to settle
      await sleep(200);
      
      // Retrieve the terminal output after command execution
      const afterCommandBuffer = await TtyOutputReader.retrieveBuffer()
      return afterCommandBuffer
    } catch (error: unknown) {
      throw new Error(`Failed to execute command: ${(error as Error).message}`);
    }
  }

  async isWaitingForUserInput(ttyPath: string): Promise<boolean> {
    let fd;
    try {
      // Open the TTY file descriptor in non-blocking mode
      fd = openSync(ttyPath, 'r');
      const tracker = new ProcessTracker();
      let belowThresholdTime = 0;
      
      while (true) {
        try {
          const activeProcess = await tracker.getActiveProcess(ttyPath);
          
          if (!activeProcess) return true;

          if (activeProcess.metrics.totalCPUPercent < 1) {
            belowThresholdTime += 350;
            if (belowThresholdTime >= 1000) return true;
          } else {
            belowThresholdTime = 0;
          }

        } catch {
          return true;
        }

        await sleep(350);
      }
    } catch (error: unknown) {
      return true;
    } finally {
      if (fd !== undefined) {
        closeSync(fd);
      }
      return true;
    }
  }

  /**
   * Escapes a string for use in an AppleScript command.
   * 
   * This method handles two scenarios:
   * 1. For multiline text (containing newlines), it uses a special AppleScript
   *    string concatenation approach to properly handle line breaks
   * 2. For single-line text, it escapes special characters for AppleScript compatibility
   * 
   * @param str The string to escape
   * @returns A properly escaped string ready for AppleScript execution
   */
  escapeForAppleScript(str: string): string {
    // Check if the string contains newlines
    if (str.includes('\n')) {
      // For multiline text, we need to use a different AppleScript approach
      // that properly handles newlines in AppleScript
      return this.prepareMultilineCommand(str);
    }
    
    // First, escape any backslashes
    str = str.replace(/\\/g, '\\\\');
    
    // Escape double quotes
    str = str.replace(/"/g, '\\"');
    
    // Handle single quotes by breaking out of the quote, escaping the quote, and going back in
    str = str.replace(/'/g, "'\\''");
    
    // Handle control characters only - AppleScript handles Unicode characters natively
    str = str.replace(/[\x00-\x1F\x7F]/g, (char) => {
      return '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
    });
    
    return str;
  }
  
  /**
   * Prepares a multiline string for use in AppleScript.
   * 
   * This method handles multiline text by splitting it into separate lines
   * and creating an AppleScript expression that concatenates these lines
   * with explicit 'return' statements between them. This approach avoids
   * syntax errors that occur when trying to directly include newlines in
   * AppleScript strings.
   * 
   * @param str The multiline string to prepare
   * @returns An AppleScript-compatible string expression that preserves line breaks
   */
  private prepareMultilineCommand(str: string): string {
    // Split the input by newlines and prepare each line separately
    const lines = str.split('\n');
    
    // Create an AppleScript string that concatenates all lines with proper line breaks
    let applescriptString = '"' + this.escapeAppleScriptString(lines[0]) + '"';
    
    for (let i = 1; i < lines.length; i++) {
      // For each subsequent line, use AppleScript's string concatenation with line feed
      // The 'return' keyword in AppleScript adds a newline character
      applescriptString += ' & return & "' + this.escapeAppleScriptString(lines[i]) + '"'; 
    }
    
    return applescriptString;
  }
  
  /**
   * Escapes a single line of text for use in an AppleScript string.
   * 
   * Handles special characters that would otherwise cause syntax errors
   * in AppleScript strings:
   * - Backslashes are doubled to avoid escape sequence interpretation
   * - Double quotes are escaped to avoid prematurely terminating the string
   * - Tabs are replaced with their escape sequence
   * 
   * @param str The string to escape (should not contain newlines)
   * @returns The escaped string
   */
  private escapeAppleScriptString(str: string): string {
    // Escape quotes and backslashes for AppleScript string
    return str
      .replace(/\\/g, '\\\\')  // Double backslashes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/\t/g, '\\t');  // Handle tabs
  }

  private async retrieveTtyPath(): Promise<string> {
    try {
      const { stdout } = await this._execPromise(`/usr/bin/osascript -e 'tell application "iTerm2" to tell current session of current window to get tty'`);
      return stdout.trim();
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve TTY path: ${(error as Error).message}`);
    }
  }

  private async isProcessing(): Promise<boolean> {
    try {
      const { stdout } = await this._execPromise(`/usr/bin/osascript -e 'tell application "iTerm2" to tell current session of current window to get is processing'`);
      return stdout.trim() === 'true';
    } catch (error: unknown) {
      throw new Error(`Failed to check processing status: ${(error as Error).message}`);
    }
  }
}

export default CommandExecutor;