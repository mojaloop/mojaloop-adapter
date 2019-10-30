import { createApp } from 'adaptor'
import Knex from 'knex'
import { KnexTransactionRequestService } from 'services/transaction-request-service'
import { AccountLookupService } from 'services/account-lookup-service'
import axios, { AxiosInstance } from 'axios'
const PORT = process.env.PORT || 3000
const ML_API_ADAPTOR_URL = process.env.ML_API_ADAPTOR_URL || 'http://localhost:3001'
const KNEX_CLIENT = process.env.KNEX_CLIENT || 'sqlite3'
const knex = KNEX_CLIENT === 'mysql' ? Knex({
  client: 'mysql',
  connection: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  }
}) : Knex({
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  }
})

const transcationRequestClient = axios.create({
  baseURL: ML_API_ADAPTOR_URL,
  timeout: 3000
})
const transactionRequestService = new KnexTransactionRequestService(knex, transcationRequestClient)
const accountLookupClient: AxiosInstance = axios.create({
  baseURL: ML_API_ADAPTOR_URL,
  timeout: 3000
})
const accountLookupService = new AccountLookupService(accountLookupClient)

const start = async (): Promise<void> => {
  let shuttingDown = false

  const server = createApp({ transactionRequestService, accountLookupService, logger: console }, { port: PORT })

  await server.start()

  console.log(`Server listening on port:${PORT}`)

  process.on(
    'SIGINT',
    async (): Promise<void> => {
      try {
        if (shuttingDown) {
          console.warn(
            'received second SIGINT during graceful shutdown, exiting forcefully.'
          )
          process.exit(1)
        }

        shuttingDown = true

        // Graceful shutdown
        await server.stop()
        console.log('completed graceful shutdown.')
      } catch (err) {
        const errInfo =
          err && typeof err === 'object' && err.stack ? err.stack : err
        console.error('error while shutting down. error=%s', errInfo)
        process.exit(1)
      }
    }
  )
}

start()
