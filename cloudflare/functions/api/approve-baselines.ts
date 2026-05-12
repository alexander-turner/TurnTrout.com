// Cloudflare Pages Function: POST /api/approve-baselines.
//
// Dispatches update-visual-baselines.yaml using `env.GH_DISPATCH_PAT`
// (CF Pages preview-env secret).
// Before dispatching, the function rejects stale galleries:
//   * Run must be from `.github/workflows/visual-testing.yaml`.
//   * PR runs:   PR must be `open` (rejects merged/closed PRs).
//   * Main runs: head_branch must be `main` AND head_sha must match
//                main's current HEAD (rejects stale main commits).
// Source ships only with diff-gallery branches — visual-testing.yaml
// copies this file into <public-dir>/functions/api/ before deploy.

interface Env {
  GH_DISPATCH_PAT: string
}

const REPO = "alexander-turner/TurnTrout.com"

interface FunctionContext<E> {
  request: Request
  env: E
}

const GH = "https://api.github.com"
const VISUAL_PATH = ".github/workflows/visual-testing.yaml"
const DISPATCH = "update-visual-baselines.yaml"

const jres = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const ghFetch = (env: Env, path: string, init: RequestInit = {}) =>
  fetch(`${GH}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GH_DISPATCH_PAT}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "turntrout-approve-baselines",
      ...(init.headers as Record<string, string> | undefined),
    },
  })

async function ghJson<T>(env: Env, path: string): Promise<T> {
  const res = await ghFetch(env, path)
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

function asNumStr(v: unknown): string | null {
  if (typeof v === "string" && /^\d+$/.test(v)) return v
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return String(v)
  return null
}

export async function onRequestPost(ctx: FunctionContext<Env>): Promise<Response> {
  const { request, env } = ctx
  if (!env.GH_DISPATCH_PAT) {
    return jres(500, { error: "Server misconfigured: GH_DISPATCH_PAT missing" })
  }

  let body: { runId?: unknown; prNumber?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jres(400, { error: "Invalid JSON body" })
  }

  const runId = asNumStr(body.runId)
  if (runId === null) {
    return jres(400, { error: "Field `runId` must be a numeric string" })
  }
  let prNumber: string | undefined
  if (body.prNumber !== undefined && body.prNumber !== null && body.prNumber !== "") {
    const n = asNumStr(body.prNumber)
    if (n === null) {
      return jres(400, {
        error: "Field `prNumber` must be a numeric string or omitted",
      })
    }
    prNumber = n
  }

  let run: { head_sha: string; head_branch: string | null; path: string }
  try {
    run = await ghJson(env, `/repos/${REPO}/actions/runs/${runId}`)
  } catch (err) {
    return jres(502, {
      error: `Failed to fetch run ${runId}: ${(err as Error).message}`,
    })
  }
  if (run.path !== VISUAL_PATH) {
    return jres(409, { error: `Run ${runId} is from ${run.path}, not ${VISUAL_PATH}` })
  }

  if (prNumber) {
    let pr: { state: string; merged: boolean }
    try {
      pr = await ghJson(env, `/repos/${REPO}/pulls/${prNumber}`)
    } catch (err) {
      return jres(502, {
        error: `Failed to fetch PR ${prNumber}: ${(err as Error).message}`,
      })
    }
    if (pr.state !== "open") {
      return jres(409, {
        error:
          `PR #${prNumber} is ${pr.merged ? "merged" : "closed"}; ` +
          "refusing to approve baselines from a stale gallery",
      })
    }
  } else {
    if (run.head_branch !== "main") {
      return jres(409, {
        error: `Run ran on '${run.head_branch ?? "<unknown>"}', not 'main'`,
      })
    }
    let ref: { object: { sha: string } }
    try {
      ref = await ghJson(env, `/repos/${REPO}/git/ref/heads/main`)
    } catch (err) {
      return jres(502, {
        error: `Failed to fetch main HEAD: ${(err as Error).message}`,
      })
    }
    if (ref.object.sha !== run.head_sha) {
      return jres(409, {
        error:
          `Run is on ${run.head_sha.slice(0, 8)} but main is now ` +
          `${ref.object.sha.slice(0, 8)}; approve the latest run instead`,
      })
    }
  }

  const inputs: Record<string, string> = { run_id: runId }
  if (prNumber) inputs.pr_number = prNumber
  const dispatch = await ghFetch(env, `/repos/${REPO}/actions/workflows/${DISPATCH}/dispatches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs }),
  })
  if (dispatch.status !== 204) {
    return jres(502, {
      error: `Dispatch failed (${dispatch.status}): ${(await dispatch.text()).slice(0, 200)}`,
    })
  }
  return jres(200, { ok: true, message: "Dispatched update-visual-baselines.yaml" })
}
