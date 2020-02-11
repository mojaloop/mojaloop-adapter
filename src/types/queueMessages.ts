import { PartiesTypeIDPutResponse, TransactionRequestsIDPutResponse } from './mojaloop'

export type PartiesResponseQueueMessage = {
  partiesResponse: PartiesTypeIDPutResponse;
  partyIdValue: string;
}
