import express from 'express'
import xmlparser from 'express-xml-bodyparser'
const PayController = require('../controllers/PayController')

const bustHeaders = (request: any, response: any, next: any) => {
  request.app.isXml = false
  if (request.headers['content-type'] === 'application/xml' || request.headers.accept === 'application/xml') {
    request.app.isXml = true
  }
  next()
}
const xmlOptions = {
  charkey: 'value',
  trim: false,
  explicitRoot: false,
  explicitArray: false,
  normalizeTags: false,
  mergeAttrs: true
}

const router = express.Router()

router.post('/pay', bustHeaders, xmlparser(xmlOptions), PayController.transfer)

module.exports = router
