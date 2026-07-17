import { afterEach, describe, expect, it, jest } from "@jest/globals"

import { onRequestPost } from "./approve-baselines"

interface Env {
  GH_DISPATCH_PAT: string
}

const ENV: Env = { GH_DISPATCH_PAT: "ghp_test" }
const VISUAL_PATH = ".github/workflows/visual-testing.yaml"
const MAIN_SHA = "a".repeat(40)
const REPO = "alexander-turner/TurnTrout.com"
const RUNS = (id: string) => `https://api.github.com/repos/${REPO}/actions/runs/${id}`
const PULLS = (n: string) => `https://api.github.com/repos/${REPO}/pulls/${n}`
const REF = `https://api.github.com/repos/${REPO}/git/ref/heads/main`
const DISP = `https://api.github.com/repos/${REPO}/actions/workflows/update-visual-baselines.yaml/dispatches`

const req = (body: unknown, invalid = false): Request =>
  new Request("https://example.com/api/approve-baselines", {
    method: "POST",
    body: invalid ? "{not json" : JSON.stringify(body),
  })

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const empty = (status: number) => new Response(null, { status })
const text = (status: number, t: string) => new Response(t, { status })
const goodRun = (
  over: Partial<{ head_sha: string; head_branch: string | null; path: string }> = {},
) => json(200, { head_sha: MAIN_SHA, head_branch: "main", path: VISUAL_PATH, ...over })

type Route = (url: string, init?: RequestInit) => Response | null

let lastInit: RequestInit | undefined
function mockFetch(route: Route): void {
  lastInit = undefined
  const fn = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url
    if (url === DISP) lastInit = init
    const res = route(url, init)
    if (res === null) {
      return Promise.reject(new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`))
    }
    return Promise.resolve(res)
  })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch
}

const errOf = async (r: Response) => ((await r.json()) as { error: string }).error

afterEach(() => {
  jest.restoreAllMocks()
})

describe("approve-baselines", () => {
  it("returns 500 when PAT is missing", async () => {
    const res = await onRequestPost({ request: req({}), env: { GH_DISPATCH_PAT: "" } })
    expect(res.status).toBe(500)
    expect(await errOf(res)).toMatch(/misconfigured/i)
  })

  it("returns 400 on invalid JSON body", async () => {
    const res = await onRequestPost({ request: req(null, true), env: ENV })
    expect(res.status).toBe(400)
    expect(await errOf(res)).toMatch(/invalid json/i)
  })

  it.each([
    ["missing runId", {}, /runId/i],
    ["non-numeric runId string", { runId: "abc" }, /runId/i],
    ["negative runId number", { runId: -1 }, /runId/i],
    ["non-integer runId number", { runId: 1.5 }, /runId/i],
    ["boolean runId", { runId: true }, /runId/i],
    ["non-numeric prNumber", { runId: "1", prNumber: "abc" }, /prNumber/i],
    ["boolean prNumber", { runId: "1", prNumber: true }, /prNumber/i],
  ])("returns 400 when %s", async (_, body, pattern) => {
    const res = await onRequestPost({ request: req(body), env: ENV })
    expect(res.status).toBe(400)
    expect(await errOf(res)).toMatch(pattern)
  })

  it.each([
    ["numeric runId", { runId: 42 }],
    ["prNumber=null", { runId: "42", prNumber: null }],
    ["prNumber=empty", { runId: "42", prNumber: "" }],
    ["prNumber=undefined", { runId: "42", prNumber: undefined }],
  ])("accepts %s as a main run", async (_, body) => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun()
        : url === REF
          ? json(200, { object: { sha: MAIN_SHA } })
          : url === DISP
            ? empty(204)
            : null,
    )
    const res = await onRequestPost({ request: req(body), env: ENV })
    expect(res.status).toBe(200)
  })

  it("returns 502 when the run fetch fails", async () => {
    mockFetch((url) => (url === RUNS("42") ? text(404, "Not Found") : null))
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(502)
    expect(await errOf(res)).toMatch(/Failed to fetch run 42.*404/i)
  })

  it("returns 409 when the run is from a different workflow", async () => {
    mockFetch((url) =>
      url === RUNS("42") ? goodRun({ path: ".github/workflows/deploy.yaml" }) : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(409)
    expect(await errOf(res)).toMatch(/visual-testing\.yaml/i)
  })

  it("returns 502 when the PR fetch fails", async () => {
    mockFetch((url) =>
      url === RUNS("42") ? goodRun() : url === PULLS("7") ? text(500, "boom") : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42", prNumber: "7" }), env: ENV })
    expect(res.status).toBe(502)
    expect(await errOf(res)).toMatch(/Failed to fetch PR 7/)
  })

  it.each<[string, { merged: boolean; head: { sha: string } }, RegExp]>([
    [
      "closed without merging",
      { merged: false, head: { sha: MAIN_SHA } },
      /closed without merging/,
    ],
    [
      "merged from a different head than the run",
      { merged: true, head: { sha: "c".repeat(40) } },
      /merged from cccccccc but this run is on aaaaaaaa/,
    ],
  ])("returns 409 when the PR is %s", async (_, pr, pat) => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun()
        : url === PULLS("7")
          ? json(200, { state: "closed", ...pr })
          : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42", prNumber: "7" }), env: ENV })
    expect(res.status).toBe(409)
    const errMsg = await errOf(res)
    expect(errMsg).toMatch(pat)
    expect(errMsg).toMatch(/stale gallery/)
  })

  it.each<[string, Record<string, unknown>]>([
    ["open", { state: "open", merged: false }],
    [
      "merged from the run's head commit",
      { state: "closed", merged: true, head: { sha: MAIN_SHA } },
    ],
  ])("dispatches with pr_number when the PR is %s", async (_, pr) => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun()
        : url === PULLS("7")
          ? json(200, pr)
          : url === DISP
            ? empty(204)
            : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42", prNumber: "7" }), env: ENV })
    expect(res.status).toBe(200)
    expect(JSON.parse(lastInit?.body as string)).toEqual({
      ref: "main",
      inputs: { run_id: "42", pr_number: "7" },
    })
  })

  it.each<[string, Partial<{ head_branch: string | null; head_sha: string }>, RegExp]>([
    ["head_branch is not main", { head_branch: "feature-x" }, /feature-x.*main/],
    ["head_branch is null", { head_branch: null }, /<unknown>/],
    ["head_sha is stale", { head_sha: "b".repeat(40) }, /approve the latest run instead/],
  ])("returns 409 when %s", async (_, over, pat) => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun(over)
        : url === REF
          ? json(200, { object: { sha: MAIN_SHA } })
          : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(409)
    expect(await errOf(res)).toMatch(pat)
  })

  it("returns 502 when fetching main HEAD fails", async () => {
    mockFetch((url) => (url === RUNS("42") ? goodRun() : url === REF ? text(500, "boom") : null))
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(502)
    expect(await errOf(res)).toMatch(/main HEAD/)
  })

  it("dispatches on matching main HEAD + sends correct body & headers", async () => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun()
        : url === REF
          ? json(200, { object: { sha: MAIN_SHA } })
          : url === DISP
            ? empty(204)
            : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(200)
    expect(JSON.parse(lastInit?.body as string)).toEqual({
      ref: "main",
      inputs: { run_id: "42" },
    })
    const headers = lastInit?.headers as Record<string, string>
    expect(headers.authorization).toBe("Bearer ghp_test")
    expect(headers["x-github-api-version"]).toBe("2022-11-28")
    expect(headers["content-type"]).toBe("application/json")
    expect(headers.accept).toBe("application/vnd.github+json")
    expect(headers["user-agent"]).toBe("turntrout-approve-baselines")
  })

  it("returns 502 when dispatch returns non-204", async () => {
    mockFetch((url) =>
      url === RUNS("42")
        ? goodRun()
        : url === REF
          ? json(200, { object: { sha: MAIN_SHA } })
          : url === DISP
            ? text(422, "Invalid inputs")
            : null,
    )
    const res = await onRequestPost({ request: req({ runId: "42" }), env: ENV })
    expect(res.status).toBe(502)
    expect(await errOf(res)).toMatch(/Dispatch failed.*422/)
  })
})
