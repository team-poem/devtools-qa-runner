/**
 * BrowserEngine contract for devtools-qa-runner.
 *
 * A BrowserEngine hides the concrete browser automation backend from the QA
 * runner. Implementations may call the chrome-devtools CLI, talk to an MCP
 * server directly, drive Playwright, or embed browser control in a desktop app.
 *
 * Required methods used by the current core/scenario plugins:
 * - newPage(url, options)
 * - emulate(viewport)
 * - takeSnapshot()
 * - takeScreenshot(filePath, options)
 * - click(nodeId)
 * - fill(nodeId, value)
 * - pressKey(key)
 * - evaluateScript(script) — optional for DOM/layout assertion scenarios
 * - listConsoleMessages(options)
 * - listNetworkRequests(options)
 * - lighthouseAudit(options)
 * - stop()
 *
 * Implementations should record command/evidence details in the report they are
 * given, but the runner only depends on the methods above.
 */
export class BrowserEngine {
  constructor() {
    if (new.target === BrowserEngine) {
      throw new TypeError('BrowserEngine is an interface and cannot be instantiated directly');
    }
  }
}
