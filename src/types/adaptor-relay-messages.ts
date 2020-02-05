import { Money } from './mojaloop'

export type ARTransactionRequest = {
  lpsId: string;
  lpsKey: string;
  lpsAuthorizationRequestMessageId: string;
  payer: {
    partyIdType: 'MSISDN';
    partyIdentifier: string;
  };
  payee: {
    partyIdType: 'DEVICE';
    partyIdentifier: string;
    partySubIdOrType: string;
  };
  amount: Money;
  expiration: string;
  lpsFees?: Money;
  transactionType: {
    scenario: 'WITHDRAWAL' | 'REFUND';
    initiatorType: 'AGENT' | 'DEVICE';
  };
}

export type ARAuthorizationRequest = {
  lpsAuthorizationRequestMessageId: string;
  transferAmount: Money;
  fees: Money;
}

export type ARAuthorizationResponse = {
  lpsId: string;
  lpsKey: string;
  lpsFinancialRequestMessageId: string;
  authenticationInfo?: {
    authenticationType: string;
    authenticationValue: string;
  };
  responseType: 'ENTERED' | 'REJECTED';
}

export type ARTransferResponse = {
  lpsFinancialRequestMessageId: string;
  transferState: string;
}
