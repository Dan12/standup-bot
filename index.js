// forked from: https://github.com/BeepBoopHQ/starter-node-bot/blob/master/index.js

const Botkit = require('botkit');

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

controller.hears(['hi', 'hello'], ['direct_mention', 'ambient', 'direct_message'], function (bot, message) {
  console.log("message");
  bot.reply(message, "Hello there, <@" + message.user + ">.");
});

controller.hears(['start standup', 'start a standup', 'standup'], ['direct_mention', 'ambient'], function (bot, message) {
  bot.reply(message, "Alright! Let's get started.");

  bot.api.users.list({},function(err,response) {
    if(err) {
      console.log(err);
    } else {
      standupConversation(response, message.user, bot, message);
    }
  });
});

var extractUserId = function(user_mention) {
  var idx = user_mention.indexOf('<@');
  return user_mention.substring(idx+2, user_mention.indexOf('>', idx))
}

var standupConversation = function(users, user, bot, message) {
  // start a conversation to handle this response.
  bot.startConversation(message, function(err, conversation) {
    conversation.say("<@" + user +">, you're up.");

    conversation.addQuestion('What did you do yesterday?', function(response, conversation) {

      conversation.next();

    },{},'default');

    conversation.addQuestion('What do you plan on doing today?', function(response, conversation) {

      conversation.next();

    },{},'default');

    conversation.addQuestion('Is there anything blocking you?', function(response, conversation) {

      console.log(users);
      conversation.next();

    },{},'default');

    conversation.addQuestion('Who would you like to go next?', function(response, conversation) {

      console.log(extractUserId(response.text));
      // standupConversation(extractUserId(response.text));
      conversation.next();

    },{},'default');
  });
}
