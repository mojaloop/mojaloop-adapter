import Knex from 'knex'
import axios, { AxiosInstance } from 'axios'
import { Worker, Job } from 'bullmq'
import { createServer, Socket } from 'net'
import { createApp, AdaptorServices } from './adaptor'
import { DefaultIso8583_87TcpRelay } from './relays/default-iso8583-87'
import { KnexAuthorizationsService } from './services/authorizations-service'
import { BullQueueService } from './services/queue-service'
import { MojaloopRequests, Money } from '@mojaloop/sdk-standard-components'
import { quotesRequestHandler } from './handlers/quote-request-handler'
import { transactionRequestResponseHandler } from './handlers/transaction-request-response-handler'
import { quoteResponseHandler } from './handlers/quote-response-handler'
import { partiesResponseHandler } from './handlers/parties-response-handler'
import { PartiesResponseQueueMessage, AuthorizationRequestQueueMessage, TransferRequestQueueMessage, TransferResponseQueueMessage, TransactionRequestResponseQueueMessage, QuoteResponseQueueMessage } from './types/queueMessages'
import { authorizationRequestHandler } from './handlers/authorization-request-handler'
import { transferRequestHandler } from './handlers/transfer-request-handler'
import { transferResponseHandler } from './handlers/transfer-response-handler'
import { Transaction } from './models'
import { Model } from 'objection'
import { LegacyAuthorizationRequest, LegacyFinancialRequest, LegacyReversalRequest } from './types/adaptor-relay-messages'
import { legacyAuthorizationRequestHandler } from './handlers/legacy-authorization-handler'
import { legacyFinancialRequestHandler } from './handlers/legacy-financial-request-handler'
import { legacyReversalHandler } from './handlers/legacy-reversals-handler'
const IsoParser = require('iso_8583')
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
Model.knex(knex)

const redisConnection = { host: REDIS_HOST, port: Number(REDIS_PORT) }
const queueService = new BullQueueService([
  'ErrorResponses',
  'QuoteRequests',
  'QuoteResponses',
  'TransactionRequestResponses',
  'PartiesResponse',
  'AuthorizationRequests',
  'TransferRequests',
  'TransferResponses',
  'LegacyAuthorizationRequests',
  'LegacyFinancialRequests',
  'LegacyReversalRequests',
  'lps1AuthorizationResponses',
  'lps1FinancialResponses',
  'lps1ReversalResponses'], redisConnection)
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
  transactionRequestsEndpoint: TRANSACTION_REQUESTS_URL,
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

const encode = (message: { [k: string]: any }): Buffer => {
  return new IsoParser(message).getBufferMessage()
}

const decode = (data: Buffer): { [k: string]: any } => {
  return new IsoParser().getIsoJSON(data)
}

const start = async (): Promise<void> => {
  let shuttingDown = false
  console.log('LOG_LEVEL:', process.env.LOG_LEVEL)
  console.log('REDIS_HOST:', REDIS_HOST, 'REDIS_PORT:', REDIS_PORT)
  console.log('TRANSACTION_REQUESTS_URL:', TRANSACTION_REQUESTS_URL)

  await knex.migrate.latest()

  const workers = new Map<string, Worker>()
  // TODO: Error handling if worker throws an error
  workers.set('quoteRequests', new Worker('QuoteRequests', async job => {
    await quotesRequestHandler(adaptorServices, job.data.payload, job.data.headers)
  }, { connection: redisConnection }))
  workers.set('quoteResponses', new Worker('QuoteResponses', async (job: Job<QuoteResponseQueueMessage>) => {
    await quoteResponseHandler(adaptorServices, job.data.quoteResponse, job.data.quoteId, job.data.headers)
  }, { connection: redisConnection }))
  workers.set('transactionRequests', new Worker('TransactionRequestResponses', async (job: Job<TransactionRequestResponseQueueMessage>) => {
    await transactionRequestResponseHandler(adaptorServices, job.data.transactionRequestResponse, job.data.headers, job.data.transactionRequestId)
  }, { connection: redisConnection }))
  workers.set('partiesResponses', new Worker('PartiesResponse', async (job: Job<PartiesResponseQueueMessage>) => {
    await partiesResponseHandler(adaptorServices, job.data.partiesResponse, job.data.partyIdValue)
  }, { connection: redisConnection }))
  workers.set('authorizationRequests', new Worker('AuthorizationRequests', async (job: Job<AuthorizationRequestQueueMessage>) => {
    await authorizationRequestHandler(adaptorServices, job.data.transactionRequestId, job.data.headers)
  }, { connection: redisConnection }))
  workers.set('transferRequests', new Worker('TransferRequests', async (job: Job<TransferRequestQueueMessage>) => {
    await transferRequestHandler(adaptorServices, job.data.transferRequest, job.data.headers)
  }, { connection: redisConnection }))
  workers.set('transferResponses', new Worker('TransferResponses', async (job: Job<TransferResponseQueueMessage>) => {
    await transferResponseHandler(adaptorServices, job.data.transferResponse, job.data.headers, job.data.transferId)
  }, { connection: redisConnection }))
  workers.set('legacyAuthorizationRequests', new Worker('LegacyAuthorizationRequests', async (job: Job<LegacyAuthorizationRequest>) => {
    await legacyAuthorizationRequestHandler(adaptorServices, job.data)
  }, { connection: redisConnection }))
  workers.set('legacyFinancialRequests', new Worker('LegacyFinancialRequests', async (job: Job<LegacyFinancialRequest>) => {
    await legacyFinancialRequestHandler(adaptorServices, job.data)
  }, { connection: redisConnection }))
  workers.set('legacyReversalRequests', new Worker('LegacyReversalRequests', async (job: Job<LegacyReversalRequest>) => {
    await legacyReversalHandler(adaptorServices, job.data)
  }, { connection: redisConnection }))

  const adaptor = await createApp(adaptorServices, { port: HTTP_PORT })
  await adaptor.start()
  adaptor.app.logger.info(`Adaptor HTTP server listening on port:${HTTP_PORT}`)
  const sockets: Socket[] = []
  const tcpServer = createServer(async (socket) => {
    Logger.info('Connection received for lps1 relay.')
    sockets.push(socket)
    const relay = new DefaultIso8583_87TcpRelay({ decode, encode, logger: Logger, queueService, socket }, { lpsId: 'lps1', redisConnection })
    await relay.start()

    socket.on('close', async () => {
      await relay.shutdown()
    })
  }).listen(TCP_PORT, () => { Logger.info('lps1 relay listening on port: ' + TCP_PORT) })

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
        tcpServer.close()
        sockets.forEach(sock => { sock.destroy() })
        await adaptor.stop()
        await Promise.all(Array.from(workers.values()).map(worker => worker.close()))
        await queueService.shutdown()
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
