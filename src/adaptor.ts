import { Server } from 'hapi'
import { TransactionRequestService } from './services/transaction-request-service'
import * as TransactionRequestController from './controllers/transaction-requests-controller'
import { AccountLookUpService } from 'services/account-lookup-service'
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
  }
}

export function createApp (services: AdaptorServices, config?: AdaptorConfig): Server {

  const adaptor = new Server(config)

  // register services
  adaptor.app.transactionRequestService = services.transactionRequestService
  adaptor.app.accountLookupService = services.accountLookupService
  if (!services.logger) {
    adaptor.app.logger = CentralLogger
  }

  // register routes
  adaptor.route({
    method: 'POST',
    path: '/transactionRequests',
    handler: TransactionRequestController.create
  })

  adaptor.initialize()

  return adaptor
}
