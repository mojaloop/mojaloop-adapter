
import express from 'express'
const payRouter = require('./pay')
const consentRouter = require('./consent')

const app = express()

app.use('/', payRouter)
app.use('/', consentRouter)

module.exports = app
