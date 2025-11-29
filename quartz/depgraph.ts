export default class DepGraph<T> {
  // node: incoming and outgoing edges
  _graph = new Map<T, { incoming: Set<T>; outgoing: Set<T> }>()

  constructor() {
    this._graph = new Map()
  }

  /**
   * Exports the graph to a plain object.
   * @returns An object with nodes and edges.
   */
  export(): object {
    return {
      nodes: this.nodes,
      edges: this.edges,
    }
  }

  /**
   * Converts the graph to its string representation.
   */
  toString(): string {
    return JSON.stringify(this.export(), null, 2)
  }

  // BASIC GRAPH OPERATIONS

  get nodes(): T[] {
    return Array.from(this._graph.keys())
  }

  /**
   * Retrieves all edges in the graph.
   */
  get edges(): [T, T][] {
    const edges: [T, T][] = []
    this.forEachEdge((edge) => edges.push(edge))
    return edges
  }

  /**
   * Checks if a node exists in the graph.
   */
  hasNode(node: T): boolean {
    return this._graph.has(node)
  }

  /**
   * Adds a node to the graph.
   */
  addNode(node: T): void {
    if (!this._graph.has(node)) {
      this._graph.set(node, { incoming: new Set(), outgoing: new Set() })
    }
  }

  /**
   * Removes a node and all of its associated edges from the graph.
   */
  removeNode(node: T): void {
    if (this._graph.has(node)) {
      // first remove all edges so other nodes don't have references to this node
      for (const target of this._graph.get(node)?.outgoing ?? []) {
        this.removeEdge(node, target)
      }
      for (const source of this._graph.get(node)?.incoming ?? []) {
        this.removeEdge(source, node)
      }
      this._graph.delete(node)
    }
  }

  /**
   * Executes a callback for each node in the graph.
   */
  forEachNode(callback: (node: T) => void): void {
    for (const node of this._graph.keys()) {
      callback(node)
    }
  }

  /**
   * Checks if an edge exists between two nodes.
   */
  hasEdge(from: T, to: T): boolean {
    return Boolean(this._graph.get(from)?.outgoing.has(to))
  }

  /**
   * Adds a directed edge between two nodes.
   */
  addEdge(from: T, to: T): void {
    this.addNode(from)
    this.addNode(to)

    this._graph.get(from)?.outgoing.add(to)
    this._graph.get(to)?.incoming.add(from)
  }

  /**
   * Removes an edge between two nodes.
   */
  removeEdge(from: T, to: T): void {
    if (this._graph.has(from) && this._graph.has(to)) {
      this._graph.get(from)?.outgoing.delete(to)
      this._graph.get(to)?.incoming.delete(from)
    }
  }

  /**
   * Gets the number of outgoing edges from a node.
   * @returns The out-degree of the node, or -1 if the node does not exist.
   */
  outDegree(node: T): number {
    return this.hasNode(node) ? (this._graph.get(node)?.outgoing.size ?? -1) : -1
  }

  /**
   * Gets the number of incoming edges to a node.
   * @returns The in-degree of the node, or -1 if the node does not exist.
   */
  inDegree(node: T): number {
    return this.hasNode(node) ? (this._graph.get(node)?.incoming.size ?? -1) : -1
  }

  /**
   * Executes a callback for each outgoing neighbor of a node.
   */
  forEachOutNeighbor(node: T, callback: (neighbor: T) => void): void {
    this._graph.get(node)?.outgoing.forEach(callback)
  }

  /**
   * Executes a callback for each incoming neighbor of a node.
   */
  forEachInNeighbor(node: T, callback: (neighbor: T) => void): void {
    this._graph.get(node)?.incoming.forEach(callback)
  }

  /**
   * Executes a callback for each edge in the graph.
   */
  forEachEdge(callback: (edge: [T, T]) => void): void {
    for (const [source, { outgoing }] of this._graph.entries()) {
      for (const target of outgoing) {
        // skipcq: JS-0255
        callback([source, target])
      }
    }
  }

  // DEPENDENCY ALGORITHMS

  /**
   * Merges all nodes and edges from another graph into the current graph.
   */
  mergeGraph(other: DepGraph<T>): void {
    other.forEachEdge(([source, target]) => {
      this.addNode(source)
      this.addNode(target)
      this.addEdge(source, target)
    })
  }

  /**
   * Updates the incoming edges for a specific node based on another graph.
   */
  updateIncomingEdgesForNode(other: DepGraph<T>, node: T): void {
    this.addNode(node)

    // Add edge if it is present in other
    other.forEachInNeighbor(node, (neighbor) => {
      this.addEdge(neighbor, node)
    })

    // For node provided, remove incoming edge if it is absent in other
    this.forEachEdge(([source, target]) => {
      if (target === node && !other.hasEdge(source, target)) {
        this.removeEdge(source, target)
      }
    })
  }

  /**
   * Removes all nodes that have no incoming or outgoing edges.
   * @returns A set of the removed orphan nodes.
   */
  removeOrphanNodes(): Set<T> {
    const orphanNodes = new Set<T>()

    this.forEachNode((node) => {
      if (this.inDegree(node) === 0 && this.outDegree(node) === 0) {
        orphanNodes.add(node)
      }
    })

    orphanNodes.forEach((node) => {
      this.removeNode(node)
    })

    return orphanNodes
  }

  /**
   * Gets all leaf nodes reachable from a given node.
   * @param node The starting node.
   * @returns A set of leaf nodes.
   */
  getLeafNodes(node: T): Set<T> {
    const stack: T[] = [node]
    const visited = new Set<T>()
    const leafNodes = new Set<T>()

    // DFS
    while (stack.length > 0) {
      const node = stack.pop()
      if (!node) {
        continue
      }

      // If the node is already visited, skip it
      if (visited.has(node)) {
        continue
      }
      visited.add(node)

      // Check if the node is a leaf node (i.e. destination path)
      if (this.outDegree(node) === 0) {
        leafNodes.add(node)
      }

      // Add all unvisited neighbors to the stack
      this.forEachOutNeighbor(node, (neighbor) => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      })
    }

    return leafNodes
  }

  /**
   * Gets all ancestors of the leaf nodes that are reachable from a given node.
   * @param node The starting node.
   * @returns A set of ancestor nodes.
   */
  getLeafNodeAncestors(node: T): Set<T> {
    const leafNodes = this.getLeafNodes(node)
    const visited = new Set<T>()
    const upstreamNodes = new Set<T>()

    // Backwards DFS for each leaf node
    leafNodes.forEach((leafNode) => {
      const stack: T[] = [leafNode]

      while (stack.length > 0) {
        const node = stack.pop()
        if (!node) {
          continue
        }

        if (visited.has(node)) {
          continue
        }
        visited.add(node)
        // Add node if it's not a leaf node (i.e. destination path)
        // Assumes destination file cannot depend on another destination file
        if (this.outDegree(node) !== 0) {
          upstreamNodes.add(node)
        }

        // Add all unvisited parents to the stack
        this.forEachInNeighbor(node, (parentNode) => {
          if (!visited.has(parentNode)) {
            stack.push(parentNode)
          }
        })
      }
    })

    return upstreamNodes
  }
}
