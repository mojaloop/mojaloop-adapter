import { Factory } from 'rosie'
import Faker from 'faker'
import { PartiesTypeIDPutResponse, QuotesPostRequest } from '../../src/types/mojaloop'

export const PartiesPutResponseFactory = Factory.define<PartiesTypeIDPutResponse>('PartiesPutResponseFactory').attrs({
  party: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: Faker.phone.phoneNumberFormat(4),
      fspId: Faker.random.uuid()
    }
  }
})

export const QuotesPostRequestFactory = Factory.define<QuotesPostRequest>('QuotesPostRequestFactory').attrs({
  amount: {
    amount: Faker.random.number().toString(),
    currency: 'USD'
  },
  amountType: 'RECEIVE',
  payee: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '12345678'
    }
  },
  payer: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '987654321'
    }
  },
  quoteId: () => Faker.random.uuid(),
  transactionId: () => Faker.random.uuid(),
  transactionType: {
    initiator: 'PAYEE',
    initiatorType: '',
    scenario: ''
  },
  expiration: () => new Date(Date.now() + 10000).toUTCString()
})
