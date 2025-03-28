import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

class SendControlCharacter {
  async send(letter: string): Promise<void> {
    let controlCode: number;
    
    // Handle special cases for telnet escape sequences
    if (letter.toUpperCase() === ']') {
      // ASCII 29 (GS - Group Separator) - the telnet escape character
      controlCode = 29;
    } 
    // Add other special cases here as needed
    else if (letter.toUpperCase() === 'ESCAPE' || letter.toUpperCase() === 'ESC') {
      // ASCII 27 (ESC - Escape)
      controlCode = 27;
    }
    else {
      // Validate input for standard control characters
      letter = letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) {
        throw new Error('Invalid control character letter');
      }
      
      // Convert to standard control code (A=1, B=2, etc.)
      controlCode = letter.charCodeAt(0) - 64;
    }

    // AppleScript to send the control character
    const ascript = `
      tell application "iTerm2"
        tell front window
          tell current session of current tab
            -- Send the control character
            write text (ASCII character ${controlCode})
          end tell
        end tell
      end tell
    `;

    try {
      await execPromise(`osascript -e '${ascript}'`);
    } catch (error: unknown) {
      throw new Error(`Failed to send control character: ${(error as Error).message}`);
    }
  }
}

export default SendControlCharacter;