import { PartiesTypeIDPutResponse, TransfersIDPutResponse, TransfersPostRequest } from './mojaloop'

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
