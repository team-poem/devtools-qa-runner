# devtools-qa-runner

Profile-driven QA runner powered by Chrome DevTools for Agents CLI.

This directory is structured so it can later be extracted into a standalone GitHub repository named `devtools-qa-runner`.

## What it does

- Drives Chrome through `chrome-devtools` CLI from `chrome-devtools-mcp`.
- Uses accessibility snapshots to find elements by role/name.
- Runs profile-defined QA scenarios.
- Collects screenshots, snapshots, console messages, network requests, and Lighthouse snapshot audit.
- Emits a Markdown report and a JSON evidence bundle.

## Run inside this repository

```bash
npm run qa:devtools-runner -- \
  --url https://example.com \
  --profile qa/devtools-qa-runner/profiles/lms-chatbot.json \
  --timeout 120000
```

Convenience alias for the bundled LMS chatbot profile:

```bash
npm run qa:chatbot:devtools-profile -- \
  --url https://example.com \
  --timeout 120000
```

## Future standalone usage

After extraction to its own repo/package:

```bash
npm install
npm run check
npm test
node src/cli.mjs \
  --url https://example.com \
  --profile examples/simple-chat.profile.json \
  --timeout 120000
```

If published later, the bin name is planned as:

```bash
npx devtools-qa-runner \
  --url https://example.com \
  --profile examples/simple-chat.profile.json \
  --timeout 120000
```

## Profile

Profiles define selectors, quality rules, and scenarios. See:

- `profiles/lms-chatbot.json`
- `examples/simple-chat.profile.json`
- `examples/generic-page.profile.json`
- `docs/profile-schema.md`
- `docs/github-actions.md`

Supported scenario types in this prototype:

- Chatbot-oriented: `consent`, `question`, `empty-input`
- Generic primitives: `click`, `fill`, `press-key`, `wait-for-text`, `screenshot`, `assert-no-console-errors`, `assert-no-http-errors`

## Private package architecture

This package is intentionally kept private while the reusable runner shape stabilizes. It is not limited to the LMS chatbot: LMS-specific behavior should live in profiles or scenario plugins, while the core stays generic.

Current extension seams:

- `BrowserEngine`: backend adapter contract for browser automation. The default `ChromeDevtoolsCliEngine` wraps the experimental `chrome-devtools` CLI from `chrome-devtools-mcp`; future engines can talk to MCP directly, use Playwright, or embed browser control in a desktop app.
- `ScenarioPlugin`: registry-based scenario extension point. Built-in chatbot and generic scenario plugins register their scenario `type` handlers through `createDefaultScenarioRegistry()`.
- `runQa()`: reusable core exported from `src/index.mjs` for CLI, CI, and future app integrations.

Minimal programmatic usage:

```js
import { createDefaultScenarioRegistry, runQa } from './src/index.mjs';

await runQa({
  url: 'https://example.com',
  profile,
  profilePath,
  outDir: 'reports/example',
  timeoutMs: 120000,
  scenarioRegistry: createDefaultScenarioRegistry([myScenarioPlugin]),
  // Optional for custom backends:
  // engineFactory: ({ timeoutMs, report }) => new MyBrowserEngine({ timeoutMs, report }),
});
```

Keep the CLI stable while refactoring internals around these seams.

## Development checks

Inside this monorepo:

```bash
npm --prefix qa/devtools-qa-runner run check
npm --prefix qa/devtools-qa-runner test
npm --prefix qa/devtools-qa-runner run pack:dry
```

After extraction into a standalone repo:

```bash
npm run check
npm test
npm run pack:dry
```

## Output

```txt
reports/devtools-qa-runner/<profile-name>/latest/
├── qa-report.md
├── devtools-qa-runner.json
├── screenshots/
├── snapshots/
└── lighthouse/
```

## Source layout

```txt
src/
├── cli.mjs
├── core/
│   ├── args.mjs
│   ├── artifacts.mjs
│   ├── devtools-client.mjs
│   ├── profile.mjs
│   ├── quality.mjs
│   ├── reporter.mjs
│   ├── runner.mjs
│   ├── snapshot.mjs
│   └── utils.mjs
└── scenarios/
    └── chatbot.mjs
```

## Adversarial QA judge

정해진 답이 없는 변측성·예상 못한 질문(범위 밖·미수록·거짓 전제·모호·오타변형·소셜)을
캡처한 뒤, 환각/폴백/태도를 채점한다. 캡처(러너)와 채점(judge)이 분리되어 있어,
한 번 캡처해두면 루브릭만 바꿔 몇 번이고 재채점할 수 있다.

1. **캡처**: `npm run qa:adversarial`  → `reports/faq-adversarial/answers.jsonl` (케이스당 1줄)
2. **규칙만 채점**: `npm run qa:adversarial:judge`
3. **LLM 루브릭까지**: `node qa/devtools-qa-runner/judge/cli.mjs --report reports/faq-adversarial --llm`
   - 심판 모델: `JUDGE_MODEL`(기본 `OLLAMA_MODEL` → `gemma3:4b`), `OLLAMA_HOST`(기본 `http://localhost:11434`).
   - CI 종료 코드: 규칙 FAIL>0 또는 LLM fail>`--max-llm-fail`(기본 0) 이면 1.

판정은 2단계다. **규칙 게이트**(`judge/rules.mjs`)가 객관적 결함만 hard-fail하고
(R1 blob/CDN 출처, R2 모델·메타데이터 누출, R3 페르소나 위반, R4 빈 답변), 통과분만
**LLM 루브릭**(`judge/rubric.mjs`)이 grounding/fallback/register/persona 4차원으로 채점한다.
`register` 차원은 환각(너무 느슨)과 과잉 거절(너무 빡빡)을 양쪽 다 감점한다.

> 주의: R2 누출 정규식은 `임베딩`·`벡터`·`학습 데이터`·`chroma` 등을 잡으므로,
> 데이터과학 강의 내용처럼 이 용어가 정상적으로 등장하는 프로필에 재사용하면 오탐할 수 있다.
> adversarial 프로필 전용으로 설계됐다.

## Extraction plan

1. Keep this package under `qa/devtools-qa-runner` until stable.
2. Add more profile examples and scenario types.
3. Add tests for profile validation and snapshot matching.
4. Add npm `bin` entry in the standalone package.
5. Move to standalone repo `devtools-qa-runner`.
