import express from 'express'
const ConsentController = require('../controllers/ConsentController')

const router = express.Router()

router.post('/consent', ConsentController.processConsent)

module.exports = router
