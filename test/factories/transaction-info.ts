import { Factory } from 'rosie'
import Faker from 'faker'
import { TransactionState } from '../../src/models'

type TransactionFeeInfo = {
  transactionRequestId: string;
  type: string;
  amount: string;
  currency: string;
}

type QuoteInfo = {
  id: string;
  transactionId?: string;
  amount: string;
  amountCurrency: string;
  feeAmount: string;
  feeCurrency: string;
  commissionAmount?: string;
  commissionCurrency?: string;
  transferAmount: string;
  transferAmountCurrency: string;
  ilpPacket: string;
  condition: string;
  expiration: string;
}

type TransferInfo = {
  transactionRequestId: string;
  quoteId?: string;
  fulfillment: string;
  state: string;
  amount: string;
  currency: string;
}
export type TransactionInfo = {
  transactionRequestId: string;
  lpsId: string;
  lpsKey: string;
  transactionId?: string;
  amount: string;
  currency: string;
  scenario: string;
  initiatorType: string;
  initiator: string;
  expiration: string;
  state: string;
  previousState?: string;
  authenticationType: string;
  payer: {
    type: 'payer';
    identifierType: string;
    identifierValue: string;
    fspId?: string;
    subIdOrType?: string;
  };
  payee: {
    type: 'payee';
    identifierType: string;
    identifierValue: string;
    fspId?: string;
    subIdOrType?: string;
  };
  fees?: TransactionFeeInfo[];
  quote?: QuoteInfo;
  transfer?: TransferInfo;
}

export const TransactionInfoFactory = Factory.define<TransactionInfo>('TransactionInfoFactory').attrs({
  transactionRequestId: () => Faker.random.uuid(),
  initiator: 'PAYEE',
  initiatorType: 'DEVICE',
  scenario: 'WITHDRAWAL',
  authenticationType: 'OTP',
  amount: () => Faker.random.number().toString(),
  currency: 'USD',
  lpsId: 'lps1',
  lpsKey: 'lps1-001-abc',
  payee: {
    type: 'payee',
    identifierType: 'DEVICE',
    identifierValue: '1234',
    subIdOrType: 'abcd',
    fspId: 'adaptor'
  },
  payer: {
    type: 'payer',
    identifierType: 'MSISDN',
    identifierValue: '987654321'
  },
  state: TransactionState.transactionReceived,
  expiration: () => new Date(Date.now() + 10000).toUTCString()
})
