import { Server } from 'hapi'
import { TransactionsService } from './services/transactions-service'
import * as Iso8583TransactionRequestController from './controllers/iso8583-transaction-requests-controller'
import * as TransactionRequestsController from './controllers/transaction-requests-controller'
import * as QuotesController from './controllers/quotes-controller'
import * as PartiesController from './controllers/parties-controller'
import swagger from './interface/swagger.json'
import { AccountLookUpService } from './services/account-lookup-service'
import { IsoMessagingClient } from './services/iso-messaging-client'
import { IsoMessageService } from './services/iso-message-service'
import { QuotesService } from './services/quotes-service'
import * as AuthorizationController from './controllers/authorizations-controller'
import { TransfersService } from 'services/transfers-service'
import * as TransfersController from './controllers/transfers-controller'
const CentralLogger = require('@mojaloop/central-services-logger')

export type AdaptorConfig = {
  port?: number | string;
  host?: string;
}

export type AdaptorServices = {
  transactionsService: TransactionsService;
  accountLookupService: AccountLookUpService;
  isoMessagesService: IsoMessageService;
  quotesService: QuotesService;
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
    accountLookupService: AccountLookUpService;
    isoMessagesService: IsoMessageService;
    quotesService: QuotesService;
    logger: Logger;
    isoMessagingClients: Map<string, IsoMessagingClient>;
    transfersService: TransfersService;
  }
}

export async function createApp (services: AdaptorServices, config?: AdaptorConfig): Promise<Server> {

  const adaptor = new Server(config)

  // register services
  adaptor.app.transactionsService = services.transactionsService
  adaptor.app.accountLookupService = services.accountLookupService
  adaptor.app.isoMessagesService = services.isoMessagesService
  adaptor.app.quotesService = services.quotesService
  adaptor.app.isoMessagingClients = new Map()
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
              put: () => 'dummy handler'
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
            put: () => 'dummy handler'
          }
        }
      }
    }
  })

  return adaptor
}
