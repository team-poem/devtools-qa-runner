import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseJsonOutput } from '../core/utils.mjs';
import { BrowserEngine } from './browser-engine.mjs';

const execFileAsync = promisify(execFile);

export class ChromeDevtoolsCliEngine extends BrowserEngine {
  constructor({ timeoutMs, cwd = process.cwd(), report = { commands: [] } }) {
    super();
    this.timeoutMs = timeoutMs;
    this.cwd = cwd;
    this.report = report;
  }

  async run(name, cliArgs) {
    return this.runTool(name, cliArgs);
  }

  async runTool(name, cliArgs) {
    const started = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync('npx', ['chrome-devtools', ...cliArgs, '--output-format=json'], {
        cwd: this.cwd,
        timeout: Math.max(this.timeoutMs, 60000),
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

  async newPage(url, { timeoutMs = this.timeoutMs } = {}) {
    return this.runTool('new_page', ['new_page', url, '--timeout', String(timeoutMs)]);
  }

  async emulate(viewport, { name = 'emulate' } = {}) {
    return this.runTool(name, ['emulate', '--viewport', viewport]);
  }

  async takeSnapshot({ name = 'snapshot' } = {}) {
    return this.runTool(name, ['take_snapshot']);
  }

  async takeScreenshot(filePath, { name = 'screenshot', fullPage = true } = {}) {
    const args = ['take_screenshot', '--filePath', filePath];
    if (fullPage) args.push('--fullPage');
    return this.runTool(name, args);
  }

  async click(nodeId, { name = 'click' } = {}) {
    return this.runTool(name, ['click', nodeId]);
  }

  async fill(nodeId, value, { name = 'fill' } = {}) {
    return this.runTool(name, ['fill', nodeId, value]);
  }

  async pressKey(key, { name = 'press-key' } = {}) {
    return this.runTool(name, ['press_key', key]);
  }

  async evaluateScript(script, { name = 'evaluate_script' } = {}) {
    return this.runTool(name, ['evaluate_script', script]);
  }

  async listConsoleMessages({ name = 'list_console_messages', includePreservedMessages = true } = {}) {
    const args = ['list_console_messages'];
    if (includePreservedMessages) args.push('--includePreservedMessages');
    return this.runTool(name, args);
  }

  async listNetworkRequests({ name = 'list_network_requests', includePreservedRequests = true } = {}) {
    const args = ['list_network_requests'];
    if (includePreservedRequests) args.push('--includePreservedRequests');
    return this.runTool(name, args);
  }

  async lighthouseAudit({ outputDirPath, mode = 'snapshot', device = 'desktop', name = 'lighthouse_audit' }) {
    return this.runTool(name, ['lighthouse_audit', '--mode', mode, '--device', device, '--outputDirPath', outputDirPath]);
  }

  async stop() {
    await execFileAsync('npx', ['chrome-devtools', 'stop'], { timeout: 10000 }).catch(() => {});
  }
}
