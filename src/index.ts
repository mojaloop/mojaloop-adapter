import Knex from 'knex'
import axios, { AxiosInstance } from 'axios'
import { createApp, AdaptorServices } from './adaptor'
import { createTcpRelay } from './tcp-relay'
import { KnexAuthorizationsService } from './services/authorizations-service'
import { BullQueueService } from './services/queue-service'
import { MojaloopRequests, Money } from '@mojaloop/sdk-standard-components'
import { Worker, Job } from 'bullmq'
import { quotesRequestHandler } from './handlers/quote-request-handler'
import { transactionRequestResponseHandler } from './handlers/transaction-request-response-handler'
import { partiesResponseHandler } from './handlers/parties-response-handler'
import { PartiesResponseQueueMessage, AuthorizationRequestQueueMessage, TransferRequestQueueMessage, TransferResponseQueueMessage } from 'types/queueMessages'
import { authorizationRequestHandler } from 'handlers/authorization-request-handler'
import { transferRequestHandler } from 'handlers/transfer-request-handler'
import { transferResponseHandler } from 'handlers/transfer-response-handler'
import { Transaction } from './models'
const MojaloopSdk = require('@mojaloop/sdk-standard-components')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

const HTTP_PORT = process.env.HTTP_PORT || 3000
const TCP_PORT = process.env.TCP_PORT || 3001
const REDIS_PORT = process.env.REDIS_PORT || 6379
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
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

const queueService = new BullQueueService(['QuoteRequests', 'TransactionRequests'], { host: REDIS_HOST, port: Number(REDIS_PORT) })

const AuthorizationsClient: AxiosInstance = axios.create({
  baseURL: AUTHORIZATIONS_URL,
  timeout: 3000
})
const authorizationsService = new KnexAuthorizationsService({ knex, client: AuthorizationsClient, logger: Logger })
const mojaClient = new MojaloopRequests({
  logger: Logger,
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
const adaptorServices: AdaptorServices = {
  authorizationsService,
  mojaClient,
  queueService,
  logger: Logger,
  calculateAdaptorFees: async (transaction: Transaction): Promise<Money> => ({ amount: '0', currency: transaction.currency }),
  ilpService: new MojaloopSdk.Ilp({ secret: ILP_SECRET, logger: Logger })
}

// TODO: Error handling if worker throws an error
const QuoteRequests = new Worker('QuoteRequests', async job => {
  await quotesRequestHandler(adaptorServices, job.data.payload, job.data.headers)
})

const TransactionRequests = new Worker('TransactionRequests', async job => {
  await transactionRequestResponseHandler(adaptorServices, job.data.transactionRequestResponse, job.data.headers, job.data.transactionRequestId)
})

const PartiesResponseWorker = new Worker('PartiesResponse', async (job: Job<PartiesResponseQueueMessage>) => {
  await partiesResponseHandler(adaptorServices, job.data.partiesResponse, job.data.partyIdValue)
})

const AuthorizationRequestsWorker = new Worker('AuthorizationRequests', async (job: Job<AuthorizationRequestQueueMessage>) => {
  await authorizationRequestHandler(adaptorServices, job.data.transactionRequestId, job.data.headers)
})

const TransferRequestsWorker = new Worker('TransferRequests', async (job: Job<TransferRequestQueueMessage>) => {
  await transferRequestHandler(adaptorServices, job.data.transferRequest, job.data.headers)
})

const TransferResponseWorker = new Worker('TransferResponses', async (job: Job<TransferResponseQueueMessage>) => {
  await transferResponseHandler(adaptorServices, job.data.transferResponse, job.data.headers, job.data.transferId)
})

const start = async (): Promise<void> => {
  let shuttingDown = false
  console.log('LOG_LEVEL: ', process.env.LOG_LEVEL)

  await knex.migrate.latest()

  const adaptor = await createApp(adaptorServices, { port: HTTP_PORT })

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
