import { Factory } from 'rosie'
import Faker from 'faker'
import { TransactionRequest } from '../../src/services/transactions-service'

export const TransactionRequestFactory = Factory.define<TransactionRequest>('TransactionRequestFactory').attrs({
  transactionRequestId: () => Faker.random.uuid(),
  transactionType: {
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL'
  },
  authenticationType: 'OTP',
  amount: {
    amount: Faker.random.number().toString(),
    currency: 'USD'
  },
  lpsFee: {
    amount: Faker.random.number().toString(),
    currency: 'USD'
  },
  lpsId: 'postillion',
  lpsKey: 'postillion:aef-123',
  payee: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '12345678'
    }
  },
  payer: {
    partyIdType: 'MSISDN',
    partyIdentifier: '987654321'
  },
  expiration: () => new Date(Date.now() + 10000).toUTCString()
})
