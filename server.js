const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/db');

// require bot file to run and start up the slack bot
let bot = require('./bot/bot');

let app = express();

// parsing middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// static files
app.use(express.static('public'))

// view engine pug
app.set('view engine', 'pug');

// check if table is created
db.initTable();

app.get('/', (request, response) => {

  db.getAllStandups((err, result) => {
    if (err) {
      console.error('[server]:' + err);
      response.send("Database Error");
    }
    else {
      response.render('index', {results: result.rows} );
    }
  });
});

app.get('/standups/remove/:id', (request, response) => {
  db.removeStandup(request.params.id);
  response.redirect('/');
});

app.listen(process.env.PORT, (err) => {
  if (err) throw err

  console.log(`[server]: Started Express Server on port: ${process.env.PORT}`);
});
