import { Server } from 'hapi'
import { TransactionRequestService } from './services/transaction-request-service'
import * as TransactionRequestController from './controllers/transaction-requests-controller'
import * as PartiesController from './controllers/parties-controller'
import swagger from './interface/swagger.json'
import { AccountLookUpService } from 'services/account-lookup-service'
import { IsoMessagingClient } from 'services/iso-messaging-client'
const CentralLogger = require('@mojaloop/central-services-logger')

export type AdaptorConfig = {
  port?: number | string;
  host?: string;
}

export type AdaptorServices = {
  transactionRequestService: TransactionRequestService;
  accountLookupService: AccountLookUpService;
  logger?: Logger;
}

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string) => void;
}

declare module 'hapi' {
  interface ApplicationState {
    transactionRequestService: TransactionRequestService;
    accountLookupService: AccountLookUpService;
    logger: Logger;
    isoMessagingClient?: IsoMessagingClient;
  }
}

export async function createApp (services: AdaptorServices, config?: AdaptorConfig): Promise<Server> {

  const adaptor = new Server(config)

  // register services
  adaptor.app.transactionRequestService = services.transactionRequestService
  adaptor.app.accountLookupService = services.accountLookupService
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
        transactionRequests: {
          post: TransactionRequestController.create
        },
        parties: {
          '{Type}': {
            '{ID}': {
              put: PartiesController.update
            }
          }
        }
      }
    }
  })

  return adaptor
}
