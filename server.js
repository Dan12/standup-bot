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

  db.getRecentStandups((err, result) => {
    if (err) {
      console.error('[server]:' + err);
      response.send("Database Error");
    }
    else {
      var standupMap = {};
      var standups = [];
      for(var idx in result.standupResults.rows) {
        var row = result.standupResults.rows[idx];
        standupMap[row.id] = {created_at: row.created_at, conversations: []}
        standups.push({
          id: row.id
        });
      }

      for(var idx in result.conversationResults.rows) {
        var row = result.conversationResults.rows[idx];
        standupMap[row.standup_id].conversations.push({
          userName: row.user_name,
          conversation: JSON.parse(row.conversation)
        });
      }

      for(var id in standupMap) {
        for(var idx in standups) {
          if(id == standups[idx].id) {
            standups[idx] = Object.assign(standups[idx], standupMap[id]);
            break;
          }
        }
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
