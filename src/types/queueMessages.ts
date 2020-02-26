import { PartiesTypeIDPutResponse, TransfersIDPutResponse, TransfersPostRequest, TransactionRequestsIDPutResponse, QuotesIDPutResponse } from './mojaloop'

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
