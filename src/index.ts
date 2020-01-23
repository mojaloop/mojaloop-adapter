import Knex from 'knex'
import axios, { AxiosInstance } from 'axios'
import { createApp } from './adaptor'
import { KnexTransactionsService } from './services/transactions-service'
import { createTcpRelay } from './tcp-relay'
import { KnexIsoMessageService } from './services/iso-message-service'
import { KnexQuotesService } from './services/quotes-service'
import { KnexTransfersService } from './services/transfers-service'
import { KnexAuthorizationsService } from './services/authorizations-service'
import { MojaloopRequests } from '@mojaloop/sdk-standard-components'

const HTTP_PORT = process.env.HTTP_PORT || 3000
const TCP_PORT = process.env.TCP_PORT || 3001
const ADAPTOR_FSP_ID = process.env.ADAPTOR_FSP_ID || 'adaptor'
const TRANSACTION_REQUESTS_URL = process.env.TRANSACTION_REQUESTS_URL || 'http://transaction-requests.local'
const QUOTE_REQUESTS_URL = process.env.QUOTE_REQUESTS_URL || 'http://quote-requests.local'
const TRANSFERS_URL = process.env.TRANSFERS_URL || 'http://transfers.local'
const AUTHORIZATIONS_URL = process.env.AUTHORIZATIONS_URL || 'http://authorizations.local'
const ACCOUNT_LOOKUP_URL = process.env.ACCOUNT_LOOKUP_URL || 'http://account-lookup-service.local'
const QUOTE_EXPIRATION_WINDOW = process.env.QUOTE_EXPIRATION_WINDOW || 10000
const ILP_SECRET = process.env.ILP_SECRET || 'secret'
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
    filename: ':memory:',
    supportBigNumbers: true
  },
  useNullAsDefault: true
})
const logger = require('@mojaloop/central-services-logger')

const transacationRequestClient = axios.create({
  baseURL: TRANSACTION_REQUESTS_URL,
  timeout: 3000
})
const transactionRequestService = new KnexTransactionsService({ knex, client: transacationRequestClient, logger })
const isoMessagesService = new KnexIsoMessageService(knex)

const quotesService = new KnexQuotesService({ knex, ilpSecret: ILP_SECRET, logger, expirationWindow: Number(QUOTE_EXPIRATION_WINDOW) })

const transfersService = new KnexTransfersService({ knex, ilpSecret: ILP_SECRET, logger })

const AuthorizationsClient: AxiosInstance = axios.create({
  baseURL: AUTHORIZATIONS_URL,
  timeout: 3000
})
const authorizationsService = new KnexAuthorizationsService({ knex, client: AuthorizationsClient, logger })
const MojaClient = new MojaloopRequests({
  logger: console,
  dfspId: ADAPTOR_FSP_ID,
  quotesEndpoint: QUOTE_REQUESTS_URL,
  alsEndpoint: ACCOUNT_LOOKUP_URL,
  transfersEndpoint: TRANSFERS_URL,
  jwsSign: false,
  tls: { outbound: { mutualTLS: { enabled: false } } },
  wso2Auth: {
    getToken: () => null
  },
  jwsSigningKey: 'string',
  peerEndpoint: 'string'
})

const start = async (): Promise<void> => {
  let shuttingDown = false
  console.log('LOG_LEVEL: ', process.env.LOG_LEVEL)

  await knex.migrate.latest()

  const adaptor = await createApp({ transactionsService: transactionRequestService, isoMessagesService, quotesService, authorizationsService, MojaClient, transfersService }, { port: HTTP_PORT })

  await adaptor.start()
  adaptor.app.logger.info(`Adaptor HTTP server listening on port:${HTTP_PORT}`)

  const relay = createTcpRelay('postillion', adaptor)
  relay.listen(TCP_PORT, () => { adaptor.app.logger.info(`Postillion TCP Relay server listening on port:${TCP_PORT}`) })

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
        await adaptor.stop()
        relay.close()
        knex.destroy()
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
