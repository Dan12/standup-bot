const pg = require('pg');

const tableName = 'standups';

var makeDBQuery = function(query, callback) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if(err) {
      done();
      callback(err, []);
    } else {
      client.query(query, function(err, result) {
        done();
        callback(err, result);
      });
    }
  });
}

var makeDBValueQuery = function(query, values, callback) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if(err) {
      done();
      callback(err, []);
    } else {
      client.query(query, values, function(err, result) {
        done();
        callback(err, result);
      });
    }
  });
}

var addStandup = function(data) {
  makeDBValueQuery('INSERT INTO ' + tableName + '(standup) VALUES($1)', [data], (err, res) => {
    if(err)
      console.log(err);
  });
}

var removeStandup = function(id) {
  makeDBValueQuery('DELETE FROM ' + tableName + ' WHERE id=$1', [id], (err, res) => {
    if(err)
      console.log(err);
  });
}

var createTable = function(callback) {
  makeDBQuery('CREATE TABLE ' + tableName.toUpperCase() + '(id SERIAL UNIQUE, standup TEXT)', callback);
}

var getAllStandups = function(callback) {
  makeDBQuery('SELECT * FROM ' + tableName, callback);
}

var initTable = function() {
  makeDBQuery("select * from information_schema.tables where table_schema='public' and table_name='" + tableName + "'", (err, res) => {
    if(err) {
      console.log(err)
    } else if(res.rows.length == 0) {
      createTable((err, res) => {
        if(err)
          console.log(err);
      });
    } else {
      console.log('[server]: table exists');
    }
  });
}

module.exports = {
  initTable: initTable,
  getAllStandups: getAllStandups,
  createTable: createTable,
  addStandup: addStandup,
  removeStandup: removeStandup
}
