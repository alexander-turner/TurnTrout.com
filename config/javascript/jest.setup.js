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
