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
import * as TransactionRequestErrorsController from './controllers/transaction-request-errors-controller'
import * as AuthorizationErrorsController from './controllers/authorization-errors-controller'
import * as QuoteErrorsController from './controllers/quote-errors-controller'
import * as TransferErrorsController from './controllers/transfer-errors-controller'

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
            put: TransactionRequestsController.update,
            error: {
              put: TransactionRequestErrorsController.create
            }
          }
        },
        authorizations: {
          '{ID}': {
            get: AuthorizationController.show,
            error: {
              put: AuthorizationErrorsController.create
            }
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
            put: () => 'dummy handler',
            error: {
              put: QuoteErrorsController.create
            }
          }
        },
        transfers: {
          post: TransfersController.create,
          '{ID}': {
            put: TransfersController.update,
            error: {
              put: TransferErrorsController.create
            }
          }
        }
      }
    }
  })

  return adaptor
}
