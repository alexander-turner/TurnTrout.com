const scenarios = require("./backstop/scenarios.cjs") // eslint-disable-line

module.exports = {
  // eslint-disable-line no-undef
  id: "backstop_default",
  viewports: [
    {
      label: "phone",
      width: 320,
      height: 480,
    },
    {
      label: "tablet",
      width: 1024,
      height: 768,
    },
    {
      label: "1080p",
      width: 1920,
      height: 1080,
    },
  ],
  scenarios: scenarios,
  onReadyScript: "puppet/onReady.cjs",
  onBeforeScript: "puppet/onBefore.cjs",
  paths: {
    bitmaps_reference: "backstop/backstop_data/bitmaps_reference",
    bitmaps_test: "backstop/backstop_data/bitmaps_test",
    engine_scripts: "backstop/backstop_data/engine_scripts",
    html_report: "backstop/backstop_data/html_report",
    ci_report: "backstop/backstop_data/ci_report",
  },
  report: [],
  engine: "puppeteer",
  engineOptions: {
    args: ["--no-sandbox"],
  },
  asyncCaptureLimit: 5,
  asyncCompareLimit: 50,
  debug: false,
  debugWindow: false,
}
