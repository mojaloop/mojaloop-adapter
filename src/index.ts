import express from 'express'
import * as bodyParser from 'body-parser'
const apiRouter = require('./routes/api')
require('dotenv').config()

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
const port = process.env.HTTP_PORT || 8000

// Route Prefixes
app.use('/', apiRouter)

app.listen(port, () => {
  console.log(`server is listening on ${port}`)
})
