// forked from: https://github.com/BeepBoopHQ/starter-node-bot/blob/master/index.js

const Botkit = require('botkit');
const db = require('../db/db');

const token = process.env.SLACK_TOKEN

const controller = Botkit.slackbot({
  // reconnect to Slack RTM when connection goes bad
  retry: Infinity,
  debug: false
})

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
  console.log('Starting in single-team mode')
  controller.spawn({
    token: token,
    retry: Infinity
  }).startRTM(function (err, bot, payload) {
    if (err) {
      throw new Error(err)
    }

    console.log('Connected to Slack RTM')
  })
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
  console.log('Starting in Beep Boop multi-team mode')
  require('beepboop-botkit').start(controller, { debug: true })
}

var inStandup = false;

// friendly reminder that he is there
controller.hears(['hi', 'hello'], ['direct_mention', 'ambient', 'direct_message'], function (bot, message) {
  bot.reply(message, "Hello there, <@" + message.user + ">.");
});

// start a standup
controller.hears(['start standup', 'start a standup', 'standup'], ['direct_mention', 'ambient'], function (bot, message) {
  bot.reply(message, "Alright! Let's get started.");

  if(!inStandup) {
    inStandup = true;
  } else {
    bot.reply(message, 'There is already a standup in progress.');
  }

  bot.api.channels.info({"channel": message['channel']}, function(err,response) {
    if(err) {
      console.log(err);
    } else {
      channel_users = response['channel']['members']
      bot.api.users.list({}, function(err,response) {
        if(err) {
          console.log(err);
        } else {
          // create a map from user id to user name
          var userIdToName = {};
          for(var idx in response['members']) {
            user = response['members'][idx];
            if(user['real_name'] == '') {
              userIdToName[user['id']] = user['name'];
            } else {
              userIdToName[user['id']] = user['real_name'];
            }

          }

          // only copy over users in the channel from userIdToName
          users = {};
          for(var idx in channel_users) {
            users[channel_users[idx]] = userIdToName[channel_users[idx]];
          }

          // remove this bot from user list
          removeUser(users, bot['identity']['id']);

          db.createStandup((err, res) => {
            if(err) {
              console.log(err);
              bot.reply(message, 'Sorry, there was a database error.');
            } else {
              startIndividualStandup(bot, message, users, res.rows[0].id);
            }
          });
        }
      });
    }
  });
});


// TODO remove
controller.hears('clean', ['ambient'], function(bot, message) {
  db.cleanTables(() => {
    process.exit();
  });
});

controller.hears('.*', ['ambient'], function (bot, message) {
  console.log(message);
});

var removeUser = function(users, userId) {
  for(var id in users) {
    if(id == userId) {
      delete users[id];
      break;
    }
  }
}

var extractUserId = function(user_mention) {
  var idx = user_mention.indexOf('<@');
  return user_mention.substring(idx+2, user_mention.indexOf('>', idx))
}

var referenceUserId = function(userId) {
  return '<@' + userId + '>';
}

var printUsers = function(userMap) {
  var users = [];
  for(var userId in userMap) {
    users.push(userId);
  }

  var ret = '';
  if(users.length == 1) {
    ret = referenceUserId(users[0]);
  } else if (users.length == 2) {
    ret = referenceUserId(users[0]) + ' and ' + referenceUserId(users[1]);
  } else {
    for(var i = 0; i < users.length-1; i++) {
      ret += referenceUserId(users[0]) + ',';
    }
    ret += ' and ' + referenceUserId(users[users.length - 1]);
  }

  return ret;
}

var addToStandup = function(standupId, userName, responses) {
  db.addToStandup(standupId, userName, responses, (err, res) => {
    if(err)
      console.log(err);
  });
}

var finishedStandup = function(bot) {
  inStandup = false;
}

var startIndividualStandup = function(bot, message, users, standupId) {
  bot.startConversation(message, function(err, conversation) {
    if(err) {
      console.log(err);
    } else {
      standupConversation(users, message.user, conversation, bot, message, standupId);
    }
  });
}

var noTextResponse = function(response) {
  if(response.text == '' && response.attachments && response.attachments.length > 0) {
    response.text = '[attachment]: ' + response.attachments[0].title;
  }
}

var standupConversation = function(users, userId, conversation, bot, message, standupId) {
  conversation.say("<@" + userId +">, you're up.");

  var userName = users[userId];
  removeUser(users, userId);

  conversation.addQuestion('What did you do yesterday?', function(response, convo) {
    noTextResponse(response);
    convo.next();

  },{key: 'y', multiple: false},'default');

  conversation.addQuestion('What do you plan on doing today?', function(response, convo) {
    noTextResponse(response);
    convo.next();

  },{key: 't', multiple: false},'default');

  conversation.addQuestion('Is there anything blocking you?', function(response, convo) {
    noTextResponse(response);
    convo.next();

  },{key: 'b', multiple: false},'default');

  conversation.addQuestion('How are you feeling today?', function(response, convo) {
    noTextResponse(response);

    // check if any keys left
    var finished = true;
    for(var id in users) {
      finished = false;
      break;
    }

    if(finished) {
      convo.say("Everyone has gone.\nStandup Completed.\nThank you all.");
      // add last user's response
      var responses = conversation.getResponses();
      addToStandup(standupId, userName, responses);
      finishedStandup(bot);
    } else {
      convo.gotoThread('next_person');
    }

    convo.next();

  },{key: 'f', multiple: false},'default');

  conversation.addQuestion(
    'Say `done` if you are done.\nWho would you like to go next?\n' + printUsers(users) + (users.length == 1 ? ' has ' : ' have ') + 'not gone yet.',
    function(response, convo) {

    var responses = conversation.getResponses();
    for(var key in responses) {
      if(key.startsWith('Say `done` if you are done.')) {
        delete responses[key];
        break;
      }
    }

    addToStandup(standupId, userName, responses);

    if(response.text == 'done') {
      convo.say('Standup completed. Thank you.');
      finishedStandup(bot);
    } else {
      nextUserId = extractUserId(response.text);

      var inUsers = false;
      for(var id in users) {
        if(id == nextUserId) {
          inUsers = true;
          break;
        }
      }

      if(inUsers) {
        message.user = nextUserId;
        startIndividualStandup(bot, message, users, standupId);
      } else {
        convo.say("That person has already gone");
        convo.repeat();
      }
    }

    convo.next();

  },{},'next_person');
}
