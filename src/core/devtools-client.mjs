import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseJsonOutput } from './utils.mjs';

const execFileAsync = promisify(execFile);

// chrome-devtools returns each result as a single JSON.stringify(structuredContent)
// line on stdout. A take_snapshot of a large a11y tree, or list_network_requests /
// list_console_messages with preserved history on a real app, easily exceeds Node's
// default 1 MiB stdout ceiling and would otherwise crash the run with
// ERR_CHILD_PROCESS_STDIO_MAXBUFFER. Give it generous headroom.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export class DevToolsClient {
  constructor({ timeoutMs, cwd = process.cwd(), report }) {
    this.timeoutMs = timeoutMs;
    this.cwd = cwd;
    this.report = report;
  }

  async run(name, cliArgs) {
    const started = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync('npx', ['chrome-devtools', ...cliArgs, '--output-format=json'], {
        cwd: this.cwd,
        timeout: Math.max(this.timeoutMs, 60000),
        maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          ...process.env,
          CI: '1',
          CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
          CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1',
        },
      });
      const parsed = parseJsonOutput(stdout);
      this.report.commands.push({ name, status: 'pass', durationMs: Date.now() - started, stderr: stderr.trim() || null });
      return parsed;
    } catch (err) {
      this.report.commands.push({
        name,
        status: 'fail',
        durationMs: Date.now() - started,
        error: err.message,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
      });
      throw err;
    }
  }

  async stop() {
    await execFileAsync('npx', ['chrome-devtools', 'stop'], { timeout: 10000 }).catch(() => {});
  }
}
