const pool=require('../DataBase_config/DB_config')
const express = require('express');
const app = express();

// Middlewares
app.use(express.json());

// use routes here

//testing DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Connected to database at', res.rows[0].now);
});


module.exports = app;
