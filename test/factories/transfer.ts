import { Factory } from 'rosie'
import Faker from 'faker'
import { Transfer } from '../../src/services/transfers-service'

export const TransferFactory = Factory.define<Transfer>('TransferRequestFactory').attrs({
  amount: () => ({ 
    amount: Faker.random.number().toString(), 
    currency: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3),
  }),
  transactionRequestId: () => Faker.random.uuid(),
  fulfilment: () => Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10),
  id: () => Faker.random.uuid(),
  quoteId: () => Faker.random.uuid(),
  transferState: () => Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10),
})
