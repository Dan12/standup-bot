const pg = require('pg');
const url = require('url');

const standupTableName = 'standups';
const conversationTableName = 'conversations';


const params = url.parse(process.env.DATABASE_URL);
const auth = params.auth ? params.auth.split(':') : ['',''];

const config = {
  user: auth[0],
  password: auth[1],
  host: params.hostname,
  port: params.port,
  database: params.pathname.split('/')[1],
  ssl: auth[1] != ''
};

const pool = new pg.Pool(config);

pool.on('error', function (err, client) {
  console.error('[server]: idle client error', err.message, err.stack);
});

var createStandup = function(callback) {
  pool.query('INSERT INTO ' + standupTableName + '(created_at) VALUES(now()) RETURNING id', callback);
}

var addToStandup = function(standupId, userName, conversation, callback) {
  pool.query('INSERT INTO ' + conversationTableName + '(standup_id, user_name, conversation) VALUES($1, $2, $3)', [standupId, userName, conversation], callback);
}

var removeStandup = function(id) {
  pool.query('DELETE FROM ' + standupTableName + ' WHERE id=$1', [id], (err, res) => {
    if(err)
      console.log(err);
  });
}

var createStandupTable = function(callback) {
  pool.query('CREATE TABLE ' + standupTableName + '(id SERIAL UNIQUE, created_at TIMESTAMP)', callback);
}

var createConversationTable = function(callback) {
  pool.query('CREATE TABLE ' + conversationTableName + '(id SERIAL UNIQUE, standup_id INTEGER REFERENCES ' + standupTableName + ' (id) ON DELETE CASCADE, user_name TEXT, conversation TEXT)', callback);
}

var getAllStandups = function(callback) {
  pool.query('SELECT * FROM ' + standupTableName, (err, standupResults) => {
    if(err)
      console.log(err);
    pool.query('SELECT * FROM ' + conversationTableName, (err, conversationResults) => {
      callback(err, {standupResults: standupResults, conversationResults: conversationResults});
    })
  });
}

var init = function() {
  initTable(standupTableName, createStandupTable, (err, res) => {
    if(err)
      console.log(err);
    else {
      initTable(conversationTableName, createConversationTable, (err, res) => {
        if(err)
          console.log(err);
      });
    }
  });
}

var initTable = function(tableName, createFunc, callback) {
  pool.query("select * from information_schema.tables where table_schema='public' and table_name='" + tableName + "'", (err, res) => {
    if(err) {
      console.log(err)
    } else if(res.rows.length == 0) {
      createFunc(callback);
    } else {
      console.log('[server]: ' + tableName + ' table exists');
      callback();
    }
  });
}

var cleanTables = function(callback) {
  pool.query("drop table " + conversationTableName, (err, res) => {
    if(err)
      console.log(err);

    pool.query("drop table " + standupTableName, (err, res) => {
      if(err)
        console.log(err);

      callback();
    });
  });
}

module.exports = {
  init: init,
  getAllStandups: getAllStandups,
  createStandup: createStandup,
  addToStandup: addToStandup,
  removeStandup: removeStandup,
  cleanTables: cleanTables
}
