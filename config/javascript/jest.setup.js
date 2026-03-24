// Polyfill setImmediate for Jest test environment
// Winston's Console transport requires setImmediate which is not available in jsdom
if (typeof setImmediate === "undefined") {
  globalThis.setImmediate = (callback, ...args) => {
    return setTimeout(() => {
      callback(...args) // skipcq: JS-0255
    }, 0)
  }
  globalThis.clearImmediate = (id) => {
    clearTimeout(id)
  }
}

// Shim RegExp.escape for jsdom test environment
// Native in Node 24+ (V8 13.6), but jsdom doesn't expose it
if (typeof RegExp.escape !== "function") {
  RegExp.escape = (str) => str.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&")
}

// Patch jsdom's addEventListener to accept Node's native AbortSignal.
// jest-fixed-jsdom replaces AbortController/AbortSignal with Node natives,
// but jsdom 20's addEventListener still validates against its own AbortSignal class.
// Limitation: signal.reason and native abort ordering guarantees are not preserved.
if (typeof EventTarget !== "undefined") {
  const origAddEventListener = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (options && typeof options === "object" && options.signal) {
      const { signal, ...rest } = options
      if (signal.aborted) return
      origAddEventListener.call(this, type, listener, rest)
      signal.addEventListener("abort", () => {
        this.removeEventListener(type, listener)
      })
    } else {
      origAddEventListener.call(this, type, listener, options)
    }
  }
}
