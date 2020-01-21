import { Server } from 'hapi'
import { TransactionsService } from './services/transactions-service'
import * as Iso8583TransactionRequestController from './controllers/iso8583-transaction-requests-controller'
import * as TransactionRequestsController from './controllers/transaction-requests-controller'
import * as QuotesController from './controllers/quotes-controller'
import * as PartiesController from './controllers/parties-controller'
import swagger from './interface/swagger.json'
import { IsoMessagingClient } from './services/iso-messaging-client'
import { IsoMessageService } from './services/iso-message-service'
import { QuotesService } from './services/quotes-service'
import { AuthorizationsService } from './services/authorizations-service'
import * as AuthorizationController from './controllers/authorizations-controller'
import { TransfersService } from './services/transfers-service'
import * as TransfersController from './controllers/transfers-controller'
import { MojaloopRequests } from '@mojaloop/sdk-standard-components'
import { QueueService } from './services/queue-service'
const CentralLogger = require('@mojaloop/central-services-logger')

export type AdaptorConfig = {
  port?: number | string;
  host?: string;
}

export type AdaptorServices = {
  transactionsService: TransactionsService;
  isoMessagesService: IsoMessageService;
  quotesService: QuotesService;
  authorizationsService: AuthorizationsService;
  MojaClient: MojaloopRequests;
  logger?: Logger;
  transfersService: TransfersService;
  queueService: QueueService;
}

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string) => void;
}

declare module 'hapi' {
  interface ApplicationState {
    transactionsService: TransactionsService;
    isoMessagesService: IsoMessageService;
    quotesService: QuotesService;
    authorizationsService: AuthorizationsService;
    MojaClient: MojaloopRequests;
    logger: Logger;
    isoMessagingClients: Map<string, IsoMessagingClient>;
    transfersService: TransfersService;
    queueService: QueueService;
  }
}

export async function createApp (services: AdaptorServices, config?: AdaptorConfig): Promise<Server> {

  const adaptor = new Server(config)

  // register services
  adaptor.app.transactionsService = services.transactionsService
  adaptor.app.isoMessagesService = services.isoMessagesService
  adaptor.app.quotesService = services.quotesService
  adaptor.app.authorizationsService = services.authorizationsService
  adaptor.app.MojaClient = services.MojaClient
  adaptor.app.isoMessagingClients = new Map()
  adaptor.app.transfersService = services.transfersService
  adaptor.app.queueService = services.queueService
  if (!services.logger) {
    adaptor.app.logger = CentralLogger
  }

  await adaptor.register({
    plugin: require('hapi-openapi'),
    options: {
      api: swagger,
      handlers: {
        health: {
          get: () => ({ status: 'ok' })
        },
        iso8583: {
          transactionRequests: {
            post: Iso8583TransactionRequestController.create
          },
          authorizations: {
            '{ID}': {
              put: AuthorizationController.update
            }
          },
          transfers: {
            '{ID}': {
              put: () => 'dummy handler'
            }
          }
        },
        transactionRequests: {
          '{ID}': {
            put: TransactionRequestsController.update
          }
        },
        authorizations: {
          '{ID}': {
            get: AuthorizationController.show
          }
        },
        parties: {
          '{Type}': {
            '{ID}': {
              put: PartiesController.update
            }
          }
        },
        quotes: {
          post: QuotesController.create,
          '{ID}': {
            put: () => 'dummy handler'
          }
        },
        transfers: {
          post: TransfersController.create,
          '{ID}': {
            put: TransfersController.update
          }
        }
      }
    }
  })

  return adaptor
}
