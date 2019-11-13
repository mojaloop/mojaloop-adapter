import { createApp } from '../../src/adaptor'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Parties API', function () {

  const services = AdaptorServicesFactory.build({
    transactionRequestService: {
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockImplementation((id: string, request: { [k: string]: any }) => {
        return { id, payer: { fspId: request.payer.fspId } }
      }),
      sendToMojaHub: jest.fn().mockResolvedValue(undefined)
    }
  })

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  test('updates the fspId of the payer in the transaction request', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    expect(services.transactionRequestService.update).toHaveBeenCalledWith('123', { payer: { fspId: putPartiesResponse.party.partyIdInfo.fspId } })
  })

  test('makes a transaction request to the Moja switch', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    expect(services.transactionRequestService.sendToMojaHub).toHaveBeenCalledWith({ id: '123', payer: { fspId: putPartiesResponse.party.partyIdInfo.fspId } })
  })
})
