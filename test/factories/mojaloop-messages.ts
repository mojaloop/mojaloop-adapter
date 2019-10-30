import { Factory } from 'rosie'
import Faker from 'faker'
import { PartiesTypeIDPutResponse } from '../../src/types/mojaloop'

export const PartiesPutResponseFactory = Factory.define<PartiesTypeIDPutResponse>('PartiesPutResponseFactory').attrs({
  party: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: Faker.phone.phoneNumberFormat(4),
      fspId: Faker.random.uuid()
    }
  }
})
