import { afterEach, describe, expect, it, jest } from "@jest/globals"

import { gitHubClient, ifFound, RATE_LIMIT_RETRIES, THROTTLE } from "../github_client"
import { fakeGitHub, Reply } from "./fakeGitHub"

const URL_PATH = "/repos/o/r"

function sequence(...replies: Reply[]) {
  let call = 0
  return () => replies[Math.min(call++, replies.length - 1)]
}

describe("gitHubClient", () => {
  const savedToken = process.env.GITHUB_TOKEN

  afterEach(() => {
    if (savedToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = savedToken
    jest.restoreAllMocks()
  })

  it("authenticates with GITHUB_TOKEN through the global fetch", async () => {
    process.env.GITHUB_TOKEN = "env-token"
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }))
    await gitHubClient().request(`GET ${URL_PATH}`)
    const [, init] = fetchSpy.mock.calls[0]
    expect(init?.headers).toMatchObject({ authorization: "token env-token" })
  })

  it.each([
    ["a 5xx answer", new Reply(502)],
    ["a 429 answer", new Reply(429)],
  ])("retries %s until it succeeds", async (_name, failure) => {
    const { github, fetch } = fakeGitHub(sequence(failure, failure, new Reply(200, { ok: true })))
    expect((await github.request(`GET ${URL_PATH}`)).data).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each([401, 404])("fails at once on %i", async (status) => {
    const { github, fetch } = fakeGitHub(() => new Reply(status, { message: "nope" }))
    await expect(github.request(`GET ${URL_PATH}`)).rejects.toMatchObject({ status })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  const primaryLimit = new Reply(
    403,
    { message: "API rate limit exceeded" },
    {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "0",
    },
  )
  const secondaryLimit = new Reply(403, { message: "You have exceeded a secondary rate limit" })

  const afterLimits = (limit: Reply, count: number) => {
    const replies = [...Array<Reply>(count).fill(limit), new Reply(200, { ok: true })]
    const { github } = fakeGitHub(sequence(...replies), {
      throttle: { ...THROTTLE, retryAfterBaseValue: 0 },
    })
    return github.request(`GET ${URL_PATH}`)
  }

  it.each([
    ["primary", primaryLimit],
    ["secondary", secondaryLimit],
  ])("waits out %s rate limits up to the retry cap", async (_kind, limit) => {
    expect((await afterLimits(limit, RATE_LIMIT_RETRIES)).data).toEqual({ ok: true })
  })

  it("fails once rate limits outlast the retry cap", async () => {
    await expect(afterLimits(primaryLimit, RATE_LIMIT_RETRIES + 1)).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe("ifFound", () => {
  it.each([404, 422])("returns the answer, or undefined on a %i", async (status) => {
    const { github } = fakeGitHub((url) =>
      url.pathname.endsWith("/missing") ? new Reply(status) : { ok: true },
    )
    expect((await ifFound(github.request("GET /repos/o/r")))?.data).toEqual({ ok: true })
    expect(await ifFound(github.request("GET /repos/o/missing"))).toBeUndefined()
  })

  it("rethrows any other failure", async () => {
    const { github } = fakeGitHub(() => new Reply(401))
    await expect(ifFound(github.request("GET /repos/o/r"))).rejects.toMatchObject({ status: 401 })
  })
})
