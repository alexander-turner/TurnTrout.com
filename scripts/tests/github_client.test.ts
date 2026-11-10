import { describe, expect, it, jest } from "@jest/globals"

import { gitHubClient, ifFound } from "../github_client"
import { fakeGitHub, Reply } from "./fakeGitHub"

describe("gitHubClient", () => {
  it("authenticates with GITHUB_TOKEN through the global fetch", async () => {
    const saved = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = "env-token"
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(""))
    await gitHubClient().request("GET /repos/o/r")
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ authorization: "token env-token" })
    fetchSpy.mockRestore()
    process.env.GITHUB_TOKEN = saved
  })

  it.each([502, 429, 403])("retries a %i until it succeeds", async (status) => {
    let calls = 0
    const { github } = fakeGitHub(() => (++calls < 3 ? new Reply(status) : { ok: true }))
    expect((await github.request("GET /repos/o/r")).data).toEqual({ ok: true })
    expect(calls).toBe(3)
  })

  it.each([401, 404])("fails at once on a %i", async (status) => {
    const { github, fetch } = fakeGitHub(() => new Reply(status))
    await expect(github.request("GET /repos/o/r")).rejects.toMatchObject({ status })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe("ifFound", () => {
  it.each([404, 422])("returns undefined on a %i", async (status) => {
    const { github } = fakeGitHub(() => new Reply(status))
    expect(await ifFound(github.request("GET /repos/o/r"))).toBeUndefined()
  })

  it("returns the answer, and rethrows any other failure", async () => {
    const { github } = fakeGitHub(({ pathname }) => (pathname === "/x" ? new Reply(401) : {}))
    expect((await ifFound(github.request("GET /repos/o/r")))?.status).toBe(200)
    await expect(ifFound(github.request("GET /x"))).rejects.toMatchObject({ status: 401 })
  })
})
