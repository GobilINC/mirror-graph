import 'reflect-metadata'
import * as bluebird from 'bluebird'
import { program } from 'commander'
import { values } from 'lodash'
import { initORM } from 'orm'
import { init as initErrorHandler, errorHandler } from 'lib/error'
import { initMirror } from 'loaders'
import * as logger from 'lib/logger'
import { validateConfig } from 'config'
import * as commands from './commands'
import { registSyncCommands } from './sync/commands'

bluebird.config({ longStackTraces: true, warnings: { wForgottenReturn: false } })
global.Promise = bluebird as any // eslint-disable-line

async function main(): Promise<void> {
  logger.info('Initialize cli')

  initErrorHandler({ sentryDsn: process.env.SENTRY })

  validateConfig()

  await initORM()

  await initMirror().catch((error) => console.log(error.message))

  // regist commands
  values(commands).forEach((func) => func())
  registSyncCommands()

  program.version('0.0.1').parse(process.argv)
}

if (require.main === module) {
  main().catch(errorHandler)
}
