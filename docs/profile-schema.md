# Profile schema

A profile tells `devtools-qa-runner` how to find elements in Chrome DevTools accessibility snapshots, which scenarios to run, and how to classify quality findings.

## Top-level fields

```json
{
  "name": "my-app",
  "description": "Human readable description",
  "selectors": {},
  "quality": {},
  "scenarios": []
}
```

## Selectors

Selectors match nodes from `chrome-devtools take_snapshot` output.

```json
{
  "role": "textbox",
  "nameIncludes": "Ask anything",
  "excludeNameIncludes": ["Search"]
}
```

Supported selector fields:

- `role`: exact accessibility role match.
- `nameIncludes`: substring match on the accessibility name.
- `excludeNameIncludes`: reject nodes whose name contains any listed string.

Required selectors for chatbot-style profiles:

```json
{
  "chatInput": { "role": "textbox", "nameIncludes": "..." }
}
```

`answerDoneText` is optional. When set, `question` scenarios wait for an extra occurrence of this text to confirm the answer finished; when omitted, they wait only for the submitted text to appear.

Consent selectors:

```json
{
  "consentAgreeButton": { "role": "button", "nameIncludes": "Agree" },
  "consentLabelInput": { "role": "textbox", "excludeNameIncludes": ["Ask"] }
}
```

`consentAgreeButton` is **required** when any `consent` scenario is present (validation fails otherwise). `consentLabelInput` is optional and only used when a consent scenario carries a `label`.

> A selector must include at least one positive matcher (`role` or `nameIncludes`); an exclude-only selector matches nothing.

## Common scenario fields

These apply to every scenario type:

- `type` (required): one of the scenario types below.
- `name`: label used for artifacts and report entries (defaults to `type`).
- `viewport`: emulate a device viewport before the scenario runs. Format `"<width>x<height>x<devicePixelRatio>[,mobile][,touch][,landscape]"`, e.g. `"390x844x2,mobile,touch"`. Validated at load time; a malformed value is rejected.
- `timeoutMs`: per-scenario override for the wait budget (falls back to the global `--timeout`; `consent` uses a fixed 10s).

## Scenarios

### `consent`

Finds the consent button, optionally fills a label input, clicks agree, then waits for `selectors.chatInput`.

```json
{
  "type": "consent",
  "name": "consent-flow",
  "label": "qa-user"
}
```

### `question`

Fills `selectors.chatInput`, presses Enter, then waits for the submitted text to appear. If `selectors.answerDoneText` is set, it additionally waits for one more occurrence of that marker (used to detect that the answer finished streaming). When `answerDoneText` is omitted, the scenario waits only for the submitted text — it does not hang.

```json
{
  "type": "question",
  "name": "basic-question",
  "text": "How do I reset my password?",
  "viewport": "390x844x2,mobile,touch"
}
```

### `empty-input`

Attempts to submit empty/blank input and asserts no new answer was produced. Two oracles run: if `selectors.answerDoneText` is set, the count of that marker must not increase (catches an app that echoes blank input by reusing nodes); and the accessibility tree must not grow by more than `maxNodeDelta` nodes.

`maxNodeDelta` (default `2`, must be an integer) is the number of additional accessibility nodes tolerated after submitting blank input — raise it if the UI legitimately shows an aria-live validation hint on empty submit.

```json
{
  "type": "empty-input",
  "name": "empty-input-guard",
  "text": "   ",
  "waitMs": 500,
  "maxNodeDelta": 2
}
```

### `fill`

Takes a snapshot, finds `target`, fills it with `value`, and optionally presses `submitKey`. Set `screenshot: true` to capture an after-screenshot (default: off for `fill`).

```json
{
  "type": "fill",
  "name": "fill-search",
  "target": { "role": "textbox", "nameIncludes": "Search" },
  "value": "hello world",
  "submitKey": "Enter",
  "screenshot": true
}
```

### `click`

Takes a snapshot, finds `target`, and clicks it. Captures an after-screenshot unless `screenshot: false`.

```json
{
  "type": "click",
  "name": "open-menu",
  "target": { "role": "button", "nameIncludes": "Menu" }
}
```

### `press-key`

Presses a key or key combination.

```json
{
  "type": "press-key",
  "name": "submit",
  "key": "Enter"
}
```

### `wait-for-text`

Polls snapshots until text appears.

```json
{
  "type": "wait-for-text",
  "name": "wait-results",
  "text": "Results",
  "timeoutMs": 10000
}
```

### `screenshot`

Captures a screenshot artifact. `fileName` overrides the artifact base name (defaults to the scenario `name`).

```json
{
  "type": "screenshot",
  "name": "after-submit",
  "fileName": "home-hero"
}
```

> Screenshot defaults differ by scenario: `click`, `wait-for-text`, and the chatbot scenarios capture an after-screenshot unless `screenshot: false`; `fill` captures one only when `screenshot: true`.

### `assert-js`

Runs a JavaScript function in the page and fails unless the returned value is truthy. If the function returns an object with a `pass` field, `pass` controls the assertion and the full object is stored as evidence.

```json
{
  "type": "assert-js",
  "name": "no-horizontal-overflow",
  "script": "() => ({ pass: document.documentElement.scrollWidth <= window.innerWidth, details: { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth } })"
}
```

Use this for DOM/layout checks such as responsive overflow, element bounding boxes, and section membership.

### `assert-no-console-errors`

Fails the scenario if DevTools reports console messages of type `error`. Use `ignoreTextIncludes` for known noisy messages.

```json
{
  "type": "assert-no-console-errors",
  "name": "no-console-errors",
  "ignoreTextIncludes": ["Failed to load resource"]
}
```

### `assert-no-http-errors`

Fails the scenario if DevTools reports HTTP 4xx/5xx responses **or transport-layer failures** (`net::ERR_*` such as connection-refused / DNS failure / blocked). Use `ignoreFavicon404`, `ignoreUrlIncludes`, or `failOn4xx: false` to tune strictness. `failOn4xx: false` relaxes only numeric 4xx — transport failures are always reported.

```json
{
  "type": "assert-no-http-errors",
  "name": "no-http-errors",
  "ignoreFavicon404": true,
  "ignoreUrlIncludes": ["/analytics"],
  "failOn4xx": true
}
```

## Quality rules

```json
{
  "ignoreSeo": true,
  "ignoreFavicon404": true,
  "ignoreUrlIncludes": ["/healthcheck"],
  "ignoreConsoleTextIncludes": ["known benign console text"],
  "lighthouseFailBelow": 0.8,
  "lighthouseWarnBelow": 0.9
}
```

Current quality checks:

- Console `error` and `assert` messages become warnings unless their text includes an `ignoreConsoleTextIncludes` entry.
- HTTP requests whose URL includes any `ignoreUrlIncludes` entry are skipped.
- HTTP 5xx responses and transport-layer failures (`net::ERR_*`) become failures.
- HTTP 4xx responses become warnings unless an ignored favicon 404 (matched by URL pathname, so query strings/cache-busters are still ignored).
- In-flight (`pending`) requests are not treated as failures.
- Lighthouse scores below thresholds become warnings/failures.
