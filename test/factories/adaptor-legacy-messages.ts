import { Factory } from 'rosie'
import Faker from 'faker'
import { LegacyAuthorizationRequest } from '../../src/types/adaptor-relay-messages'

export const LegacyAuthorizationRequestFactory = Factory.define<LegacyAuthorizationRequest>('LegacyAuthorizationRequestFactory').attrs({
  lpsId: 'lps1',
  lpsKey: 'lps1-001-abc',
  lpsAuthorizationRequestMessageId: '1',
  transactionType: {
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL'
  },
  amount: {
    amount: Faker.random.number().toString(),
    currency: 'USD'
  },
  lpsFee: {
    amount: Faker.random.number().toString(),
    currency: 'USD'
  },
  payer: {
    partyIdType: 'MSISDN',
    partyIdentifier: '12345678'
  },
  payee: {
    partyIdType: 'DEVICE',
    partyIdentifier: '987654321',
    partySubIdOrType: 'abc'
  },
  expiration: () => new Date(Date.now() + 10000).toUTCString()
})
