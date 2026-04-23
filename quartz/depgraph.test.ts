import { describe, it, expect, beforeEach } from "@jest/globals"

import DepGraph from "./depgraph"

describe("DepGraph", () => {
  let graph: DepGraph<string>

  beforeEach(() => {
    graph = new DepGraph<string>()
  })

  describe("basic node operations", () => {
    it("starts empty", () => {
      expect(graph.nodes).toEqual([])
      expect(graph.edges).toEqual([])
    })

    it("adds and checks nodes", () => {
      graph.addNode("a")
      expect(graph.hasNode("a")).toBe(true)
      expect(graph.hasNode("b")).toBe(false)
    })

    it("does not duplicate nodes on repeated add", () => {
      graph.addNode("a")
      graph.addNode("a")
      expect(graph.nodes).toEqual(["a"])
    })

    it("removes a node and its edges", () => {
      graph.addEdge("a", "b")
      graph.addEdge("b", "c")
      graph.removeNode("b")
      expect(graph.hasNode("b")).toBe(false)
      expect(graph.hasEdge("a", "b")).toBe(false)
      expect(graph.hasEdge("b", "c")).toBe(false)
    })

    it("removeNode is a no-op for non-existent nodes", () => {
      graph.removeNode("nonexistent")
      expect(graph.nodes).toEqual([])
    })

    it("iterates all nodes via forEachNode", () => {
      graph.addNode("a")
      graph.addNode("b")
      const visited: string[] = []
      graph.forEachNode((n) => visited.push(n))
      expect(visited.sort()).toEqual(["a", "b"])
    })
  })

  describe("edge operations", () => {
    it("adds and checks edges", () => {
      graph.addEdge("a", "b")
      expect(graph.hasEdge("a", "b")).toBe(true)
      expect(graph.hasEdge("b", "a")).toBe(false)
    })

    it("removes edges", () => {
      graph.addEdge("a", "b")
      graph.removeEdge("a", "b")
      expect(graph.hasEdge("a", "b")).toBe(false)
    })

    it("removeEdge is a no-op for non-existent nodes", () => {
      graph.removeEdge("x", "y")
      expect(graph.edges).toEqual([])
    })

    it("computes in-degree and out-degree", () => {
      graph.addEdge("a", "b")
      graph.addEdge("a", "c")
      graph.addEdge("d", "b")
      expect(graph.outDegree("a")).toBe(2)
      expect(graph.inDegree("b")).toBe(2)
      expect(graph.outDegree("nonexistent")).toBe(-1)
      expect(graph.inDegree("nonexistent")).toBe(-1)
    })

    it("iterates neighbors", () => {
      graph.addEdge("a", "b")
      graph.addEdge("a", "c")
      graph.addEdge("d", "a")

      const outNeighbors: string[] = []
      graph.forEachOutNeighbor("a", (n) => outNeighbors.push(n))
      expect(outNeighbors.sort()).toEqual(["b", "c"])

      const inNeighbors: string[] = []
      graph.forEachInNeighbor("a", (n) => inNeighbors.push(n))
      expect(inNeighbors).toEqual(["d"])
    })

    it("forEachOutNeighbor is a no-op for missing nodes", () => {
      const visited: string[] = []
      graph.forEachOutNeighbor("missing", (n) => visited.push(n))
      expect(visited).toEqual([])
    })

    it("forEachInNeighbor is a no-op for missing nodes", () => {
      const visited: string[] = []
      graph.forEachInNeighbor("missing", (n) => visited.push(n))
      expect(visited).toEqual([])
    })

    it("iterates all edges via forEachEdge", () => {
      graph.addEdge("a", "b")
      graph.addEdge("b", "c")
      const edges: [string, string][] = []
      graph.forEachEdge(([s, t]) => edges.push([s, t]))
      expect(edges).toEqual([
        ["a", "b"],
        ["b", "c"],
      ])
    })
  })

  describe("serialization", () => {
    it("exports nodes and edges", () => {
      graph.addEdge("a", "b")
      const exported = graph.export() as { nodes: string[]; edges: [string, string][] }
      expect(exported.nodes.sort()).toEqual(["a", "b"])
      expect(exported.edges).toEqual([["a", "b"]])
    })

    it("toString returns JSON", () => {
      graph.addNode("x")
      const str = graph.toString()
      const parsed = JSON.parse(str) as { nodes: string[] }
      expect(parsed.nodes).toEqual(["x"])
    })
  })

  describe("mergeGraph", () => {
    it("merges edges from another graph", () => {
      graph.addEdge("a", "b")
      const other = new DepGraph<string>()
      other.addEdge("b", "c")
      other.addEdge("d", "e")
      graph.mergeGraph(other)

      expect(graph.hasEdge("a", "b")).toBe(true)
      expect(graph.hasEdge("b", "c")).toBe(true)
      expect(graph.hasEdge("d", "e")).toBe(true)
    })
  })

  describe("updateIncomingEdgesForNode", () => {
    it("adds new incoming edges from other graph", () => {
      graph.addEdge("a", "c")
      const other = new DepGraph<string>()
      other.addEdge("b", "c")
      graph.updateIncomingEdgesForNode(other, "c")

      expect(graph.hasEdge("b", "c")).toBe(true)
    })

    it("removes incoming edges absent in other graph", () => {
      graph.addEdge("a", "c")
      graph.addEdge("b", "c")
      const other = new DepGraph<string>()
      other.addEdge("b", "c")
      graph.updateIncomingEdgesForNode(other, "c")

      expect(graph.hasEdge("a", "c")).toBe(false)
      expect(graph.hasEdge("b", "c")).toBe(true)
    })
  })

  describe("removeOrphanNodes", () => {
    it("removes nodes with no edges", () => {
      graph.addNode("orphan")
      graph.addEdge("a", "b")
      const removed = graph.removeOrphanNodes()
      expect(removed).toEqual(new Set(["orphan"]))
      expect(graph.hasNode("orphan")).toBe(false)
      expect(graph.hasNode("a")).toBe(true)
    })

    it("returns empty set when no orphans exist", () => {
      graph.addEdge("a", "b")
      const removed = graph.removeOrphanNodes()
      expect(removed.size).toBe(0)
    })
  })

  describe("getLeafNodes", () => {
    it("returns leaf nodes reachable from start", () => {
      graph.addEdge("a", "b")
      graph.addEdge("b", "c")
      graph.addEdge("b", "d")
      const leaves = graph.getLeafNodes("a")
      expect(leaves).toEqual(new Set(["c", "d"]))
    })

    it("returns the start node if it is a leaf", () => {
      graph.addNode("solo")
      const leaves = graph.getLeafNodes("solo")
      expect(leaves).toEqual(new Set(["solo"]))
    })

    it("handles cycles without infinite looping", () => {
      graph.addEdge("a", "b")
      graph.addEdge("b", "a")
      // Both have outgoing edges so neither is a leaf; should still terminate
      const leaves = graph.getLeafNodes("a")
      expect(leaves.size).toBe(0)
    })

    it("returns empty set for non-existent start node", () => {
      const leaves = graph.getLeafNodes("nonexistent")
      expect(leaves.size).toBe(0)
    })
  })

  describe("getLeafNodeAncestors", () => {
    it("returns ancestors of leaf nodes", () => {
      graph.addEdge("src1", "mid")
      graph.addEdge("src2", "mid")
      graph.addEdge("mid", "leaf")
      const ancestors = graph.getLeafNodeAncestors("src1")
      expect(ancestors).toEqual(new Set(["src1", "src2", "mid"]))
    })

    it("returns empty for isolated leaf", () => {
      graph.addNode("leaf")
      const ancestors = graph.getLeafNodeAncestors("leaf")
      expect(ancestors.size).toBe(0)
    })
  })
})
