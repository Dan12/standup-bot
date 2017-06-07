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


var curStandup = undefined;

var addToStandup = function(userId, responses) {
  curStandup[userId] = responses;
}

var finishedStandup = function(bot) {
  bot.api.users.list({}, function(err,response) {
    if(err) {
      console.log(err);
    } else {
      var namedStandup = {};
      console.log(response['members'])
      for(var idx in response['members']) {
        user = response['members'][idx];
        if(curStandup[user['id']]) {
          namedStandup[user['real_name']] = curStandup[user['id']];
        }
      }

      db.addStandup(JSON.stringify(namedStandup));
      curStandup = undefined;
    }
  });
}


// friendly reminder that he is there
controller.hears(['hi', 'hello'], ['direct_mention', 'ambient', 'direct_message'], function (bot, message) {
  bot.reply(message, "Hello there, <@" + message.user + ">.");
});

// start a standup
controller.hears(['start standup', 'start a standup', 'standup'], ['direct_mention', 'ambient'], function (bot, message) {
  bot.reply(message, "Alright! Let's get started.");

  bot.api.channels.info({"channel": message['channel']}, function(err,response) {
    if(err) {
      console.log(err);
    } else {
      if(curStandup === undefined) {
        curStandup = {};
        users = response['channel']['members']
        removeUser(users, bot['identity']['id']);

        startIndividualStandup(bot, message, users);
      } else {
        bot.reply(message, 'There is already a standup in progress.');
      }
    }
  });
});

controller.hears('.*', ['ambient'], function (bot, message) {
  console.log(message);
});

var removeUser = function(users, userId) {
  for(var idx in users) {
    if(users[idx] == userId) {
      users.splice(idx, 1);
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

var printUsers = function(users) {
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

var startIndividualStandup = function(bot, message, users) {
  bot.startConversation(message, function(err, conversation) {
    if(err) {
      console.log(err);
    } else {
      standupConversation(users, message.user, conversation, bot, message);
    }
  });
}

var standupConversation = function(users, userId, conversation, bot, message) {
  conversation.say("<@" + userId +">, you're up.");

  removeUser(users, userId);

  conversation.addQuestion('What did you do yesterday?', function(response, convo) {

    convo.next();

  },{key: 'y', multiple: false},'default');

  conversation.addQuestion('What do you plan on doing today?', function(response, convo) {

    convo.next();

  },{key: 't', multiple: false},'default');

  conversation.addQuestion('Is there anything blocking you?', function(response, convo) {
    if(users.length == 0) {
      convo.say("Everyone has gone. Thank you all.");
      finishedStandup(bot);
    } else {
      convo.gotoThread('next_person');
    }

    convo.next();

  },{key: 'b', multiple: false},'default');

  conversation.addQuestion(
    'Say `done` if you are done.\nWho would you like to go next?\n' + printUsers(users) + (users.length == 1 ? ' has ' : ' have ') + 'not gone yet.',
    function(response, convo) {

    var responses = conversation.getResponses();
    for(var key in responses) {
      if(key != 'b' && key != 't' && key != 'y') {
        delete responses[key];
        break;
      }
    }

    addToStandup(userId, responses);

    if(response.text == 'done') {
      convo.say('Standup completed. Thank you.');
      finishedStandup(bot);
    } else {
      nextUserId = extractUserId(response.text);

      var inUsers = false;
      for(var idx in users) {
        if(users[idx] == nextUserId) {
          inUsers = true;
          break;
        }
      }

      if(inUsers) {
        message.user = nextUserId;
        startIndividualStandup(bot, message, users);
      } else {
        convo.say("That person has already gone");
        convo.repeat();
      }
    }

    convo.next();

  },{},'next_person');
}
