import { Factory } from 'rosie'
import { AdaptorServices } from '../../src/adaptor'

export const AdaptorServicesFactory = Factory.define<AdaptorServices>('AdaptorServicesFactory').attrs({
  accountLookupService: {
    requestFspIdFromMsisdn: jest.fn().mockResolvedValue(undefined)
  },
  isoMessagesService: {
    create: jest.fn()
  },
  transactionRequestService: {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    sendToMojaHub: jest.fn().mockResolvedValue(undefined)
  }
})
