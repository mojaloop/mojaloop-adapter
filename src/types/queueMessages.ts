import { PartiesTypeIDPutResponse, TransfersIDPutResponse, TransfersPostRequest, TransactionRequestsIDPutResponse, QuotesIDPutResponse, ErrorInformation } from './mojaloop'

export type PartiesResponseQueueMessage = {
  partiesResponse: PartiesTypeIDPutResponse;
  partyIdValue: string;
}

export type AuthorizationRequestQueueMessage = {
  transactionRequestId: string;
  headers: { [k: string]: any };
}

export type TransferResponseQueueMessage = {
  transferId: string;
  transferResponse: TransfersIDPutResponse;
  headers: { [k: string]: any };
}

export type TransferRequestQueueMessage = {
  transferRequest: TransfersPostRequest;
  headers: { [k: string]: any };
}

export type TransactionRequestResponseQueueMessage = {
  transactionRequestResponse: TransactionRequestsIDPutResponse;
  transactionRequestId: string;
  headers: { [k: string]: any };
}

export type QuoteResponseQueueMessage = {
  quoteId: string;
  quoteResponse: QuotesIDPutResponse;
  headers: { [k: string]: any };
}

export enum MojaloopError {
  quote,
  transfer,
  parties,
  transactionRequest,
  authorization
}

export type MojaloopErrorQueueMessage = {
  type: MojaloopError;
  typeId: string;
  errorInformation: ErrorInformation;
}
