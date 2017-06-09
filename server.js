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
db.init();

app.get('/', (request, response) => {

  db.getAllStandups((err, result) => {
    if (err) {
      console.error('[server]:' + err);
      response.send("Database Error");
    }
    else {
      var standups = {};
      for(var idx in result.standupResults.rows) {
        var row = result.standupResults.rows[idx];
        standups[row.id] = {created_at: row.created_at, conversations: []}
      }

      for(var idx in result.conversationResults.rows) {
        var row = result.conversationResults.rows[idx];
        standups[row.standup_id].conversations.push({
          userName: row.user_name,
          conversation: JSON.parse(row.conversation)
        });
        console.log(row.conversation);
      }

      response.render('index', {standups: standups} );
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
