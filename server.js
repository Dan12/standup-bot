const express = require('express')
const bodyParser = require('body-parser')

let bot = require('./bot')

let app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => { res.send('<h1>Home Page</h1>') })

app.listen(process.env.PORT, (err) => {
  if (err) throw err

  console.log(`[server]: Started Express Server on port: ${process.env.PORT}`);
});
