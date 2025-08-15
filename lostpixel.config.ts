import { CustomProjectConfig } from "lost-pixel"

export const config: CustomProjectConfig = {
  customShots: {
    currentShotsPath: "./lost-pixel",
  },
  lostPixelProjectId: process.env.LOST_PIXEL_PROJECT_ID,
  apiKey: process.env.LOST_PIXEL_API_KEY,
  threshold: 0,
}
