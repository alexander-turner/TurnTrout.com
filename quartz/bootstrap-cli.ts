#!/usr/bin/env tsx
import process from "node:process"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

// @ts-expect-error Importing from a JS file, no types
import { CommonArgv, BuildArgv, CreateArgv, SyncArgv } from "./cli/args.js"
// @ts-expect-error Importing from a JS file, no types
import { version } from "./cli/constants.js"
import { handleBuild } from "./cli/handlers"

// Define type for command handlers
type CommandHandler = (
  argv: typeof CommonArgv | typeof BuildArgv | typeof CreateArgv | typeof SyncArgv,
) => Promise<void>

// Create and configure yargs
await yargs(hideBin(process.argv))
  .scriptName("quartz")
  .version(version)
  .usage("$0 <cmd> [args]")
  .command("build", "Build Quartz into a bundle of static HTML files", BuildArgv, (async (argv) => {
    await handleBuild(argv)
  }) as CommandHandler)
  .showHelpOnFail(false)
  .help()
  .strict()
  .demandCommand().argv
