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

// Polyfill RegExp.escape for Node < 24 (native in V8 13.6+)
if (typeof RegExp.escape !== "function") {
  RegExp.escape = (str) => str.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
}

// Patch jsdom's addEventListener to accept Node's native AbortSignal.
// jest-fixed-jsdom replaces AbortController/AbortSignal with Node natives,
// but jsdom 20's addEventListener still validates against its own AbortSignal class.
if (typeof EventTarget !== "undefined") {
  const origAddEventListener = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (options && typeof options === "object" && options.signal) {
      // Strip the signal option to avoid jsdom's type check, then
      // manually abort when the signal fires
      const { signal, ...rest } = options
      origAddEventListener.call(this, type, listener, rest)
      if (!signal.aborted) {
        signal.addEventListener("abort", () => {
          this.removeEventListener(type, listener)
        })
      }
    } else {
      origAddEventListener.call(this, type, listener, options)
    }
  }
}
