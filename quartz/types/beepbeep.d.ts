declare module "beepbeep" {
  /**
   * Make a console beep sound
   * @param count - Number of beeps (default: 1)
   * @param interval - Interval between beeps in milliseconds (default: 0)
   * @returns void
   */
  function beep(count?: number, interval?: number): void
  function beep(intervals: number[]): void

  export default beep
}
