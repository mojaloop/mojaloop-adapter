import { PartiesTypeIDPutResponse } from './mojaloop'

export type PartiesResponseQueueMessage = {
  partiesResponse: PartiesTypeIDPutResponse;
  partyIdValue: string;
}

export type AuthorizationRequestQueueMessage = {
  transactionRequestId: string;
  headers: { [k: string]: any };
}
