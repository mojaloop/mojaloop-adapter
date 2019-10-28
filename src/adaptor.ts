import { Server } from 'hapi'
import { TransactionRequestService } from 'services/transaction-request-service'

export type AdaptorConfig = {
  port?: number;
  host?: string;
}

export type AdaptorServices = {
  transactionRequestService: TransactionRequestService;
}

declare module 'hapi' {
  interface ApplicationState {
    transactionRequestService: TransactionRequestService;
  }
}

export function createApp (services: AdaptorServices, config?: AdaptorConfig): Server {

  const adaptor = new Server(config)

  // register services
  adaptor.app.transactionRequestService = services.transactionRequestService

  // register routes

  return adaptor
}
