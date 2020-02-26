import { Server } from 'hapi'
import * as TransactionRequestsController from './controllers/transaction-requests-controller'
import * as QuotesController from './controllers/quotes-controller'
import * as PartiesController from './controllers/parties-controller'
import swagger from './interface/swagger.json'
import { AuthorizationsService } from './services/authorizations-service'
import * as AuthorizationController from './controllers/authorizations-controller'
import * as TransfersController from './controllers/transfers-controller'
import { MojaloopRequests } from '@mojaloop/sdk-standard-components'
import { QueueService } from './services/queue-service'
import * as TransactionRequestErrorsController from './controllers/transaction-request-errors-controller'
import * as AuthorizationErrorsController from './controllers/authorization-errors-controller'
import * as QuoteErrorsController from './controllers/quote-errors-controller'
import * as TransferErrorsController from './controllers/transfer-errors-controller'
import { Transaction } from './models'
import { Money } from './types/mojaloop'
import { IlpService } from './services/ilp-service'

const CentralLogger = require('@mojaloop/central-services-logger')

export type AdaptorConfig = {
  port?: number | string;
  host?: string;
}

export type AdaptorServices = {
  authorizationsService: AuthorizationsService;
  mojaClient: MojaloopRequests;
  logger: Logger;
  queueService: QueueService;
  calculateAdaptorFees: (transaction: Transaction) => Promise<Money>;
  ilpService: IlpService;
}

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string) => void;
}

declare module 'hapi' {
  interface ApplicationState {
    authorizationsService: AuthorizationsService;
    mojaClient: MojaloopRequests;
    logger: Logger;
    queueService: QueueService;
    calculateAdaptorFees: (transaction: Transaction) => Promise<Money>;
    ilpService: IlpService;
  }
}

export async function createApp (services: AdaptorServices, config?: AdaptorConfig): Promise<Server> {

  const adaptor = new Server(config)

  // register services
  adaptor.app.authorizationsService = services.authorizationsService
  adaptor.app.mojaClient = services.mojaClient
  adaptor.app.queueService = services.queueService
  adaptor.app.logger = services.logger

  await adaptor.register({
    plugin: require('hapi-openapi'),
    options: {
      api: swagger,
      handlers: {
        health: {
          get: () => ({ status: 'ok' })
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
            put: QuotesController.update,
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
