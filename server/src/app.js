const pool=require('../DataBase_config/DB_config')
const express = require('express');
const cors = require('cors'); // for incoming react req
const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
// use routes here

//testing DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Connected to database at', res.rows[0].now);
});


module.exports = app;
