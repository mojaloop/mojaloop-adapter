import express from 'express'
import * as bodyParser from 'body-parser'
import axios from 'axios'

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
const port = 8000

app.post('/pay', async (req, res) => {
  // console.log(req.body.FIToFICstmrCdtTrf)
  try {
    const transactionRequestId = req.body.FIToFICstmrCdtTrf.GrpHdr.MsgId
    const partyIdentifier = req.body.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.CtctDtls.MobNb
    console.log('data', transactionRequestId, partyIdentifier)
    const lookupRequest = {
      payee: {
        partyIdType: 'MSISDN',
        partyIdentifier: partyIdentifier
      },
      transactionRequestId: transactionRequestId
    }
    const lookupResponse = await axios.post('http://pisp-thirdparty-scheme-adapter-outbound:7006/thirdpartyTransaction/partyLookup', lookupRequest)
    if (lookupResponse.status !== 200 || lookupResponse.data.currentState !== 'partyLookupSuccess') {
      throw new Error('Party lookup error')
    }

    const initiateURI = `http://pisp-thirdparty-scheme-adapter-outbound:7006/thirdpartyTransaction/${transactionRequestId}/initiate`
    const initiateRequest = {
      sourceAccountId: 'dfspa.alice.1234',
      consentId: '8e34f91d-d078-4077-8263-2c047876fcf6',
      payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '+44 1234 5678',
          fspId: 'dfspb'
        }
      },
      payer: {
        personalInfo: {
          complexName: {
            firstName: 'Alice',
            lastName: 'K'
          }
        },
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '+44 8765 4321',
          fspId: 'dfspa'
        }
      },
      amountType: 'SEND',
      amount: {
        amount: '100',
        currency: 'USD'
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      expiration: '2020-07-15T22:17:28.985-01:00'
    }

    const initiateresponse = await axios.post(initiateURI, initiateRequest)

    if (initiateresponse.status !== 200 || initiateresponse.data.currentState !== 'authorizationReceived') {
      throw new Error('Initial transation error')
    }

    const approveURI = `http://pisp-thirdparty-scheme-adapter-outbound:7006/thirdpartyTransaction/${transactionRequestId}/approve`
    const approveRequest = {
      authorizationResponse: {
        authenticationInfo: {
          authentication: 'U2F',
          authenticationValue: {
            pinValue: 'xxxxxxxxxxx',
            counter: '1'
          }
        },
        responseType: 'ENTERED'
      }
    }
    const approveResponse = await axios.post(approveURI, approveRequest)

    if (approveResponse.status !== 200 || approveResponse.data.currentState !== 'transactionStatusReceived' || approveResponse.data.transactionStatus.transactionRequestState !== 'ACCEPTED') {
      throw new Error('Approve request error')
    }

    // console.log('after', lookupResponse.data)
    return res.send(lookupResponse.data)
  } catch (error) {
    console.log('error', error)
    console.log('data', error.data)
    return res.send(error.message)
  }
})

app.get('/hello', async (req, res) => {
  console.log('hello')
  try {
    const lookupResponse = await axios.get('http://pisp-thirdparty-scheme-adapter-outbound:7006/hello')
    console.log(lookupResponse.data)
    return res.send(lookupResponse.data)
  } catch (error) {
    console.log('error', error)
    console.log('data', error.data)
    return res.send(error.message)
  }
})

app.listen(port, () => {
  console.log(`server is listening on ${port}`)
})
