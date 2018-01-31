const express = require('express');
const path = require('path');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const fs = require('fs');

const { Database } = require('./Database.js');
const randomstring = require("randomstring");

const app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.text({ type: 'text/plain' }))  // parse a plain body into a string

require('dotenv').config()
const PORT = process.env.PORT || 3001;
console.log(`setting app port to ${PORT}`);
app.set("port", PORT);

const db = new Database();

// enable logging
// more options: https://github.com/expressjs/morgan
// app.use(morgan('combined'))
app.use(morgan('tiny'));

// Express only serves static assets in production
if (process.env.NODE_ENV === "production") {
  console.log('production environment, serving client/build files...');
  app.use(express.static("client/build"));
}

app.post("/save", (req, res) => {
  const stateString = req.body;
  console.log(`POST to /save: ${stateString}`);
  validateStateString(stateString);

  // captures 'localhost:port' for testing ease
  const host = req.headers.host;

  // 6 alphanumeric chars = (10+26+26)^6 = 62^6 = 56.8 billion combinations
  // at 280,610 entries, there'll be a 50% of a collision
  // https://www.wolframalpha.com/input/?i=solve+1-e%5E(-n%5E2%2F(2d))%3D.5,++d+%3D+(10%2B26%2B26)%5E6+over+the+reals
  // "solve 1-e^(-n^2/(2d))=.5, d = (10+26+26)^6 over the reals"
  db.addRow(
    {link_id: randomstring.generate(6), state: stateString},
    (obj) => {
      // return the link
      res.send(`${host}/saved/${obj.link_id}`);
    });  
});

app.get("/saved/*", (req, res) => {
  const key = req.params[0];
  console.log(`GET to /saved: ${key}`);
  validateLinkID(key);

  function serveAlteredHTML(row) {
    if (row) {
      let html = fs.readFileSync(__dirname + '/client/build/' + 'index.html', 'utf8');
      var $ = cheerio.load(html);
      $('head').prepend(`<script>window.SERVER_DATA = ${row.state};</script>`);
      res.send($.html());
    }
    else {
      res.status(404).send('no row found!');
    }
  }

  db.query(key, serveAlteredHTML);
});

app.use((req, res, next) => {
  res.status(404).send("Sorry, can't find what you're looking for! (404 error)");
})

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`); // eslint-disable-line no-console
});

// quick and dirty validation of stateString
function validateStateString(stateString) {
  let valid = false;
  if (typeof stateString === 'string') {
    valid = [ 'people', 'dishes', 'orders', 'tax', 'tip' ]
      .map(str => stateString.indexOf(str) > -1)
      .reduce((a,b)=>(a && b), true);
  }
  if (!valid) {
    throw new Error(`stateString is invalid: ${stateString}`);
  }
}

// quick and dirty validation of linkID
function validateLinkID(linkID) {
  let valid = false;
  const alphanumeric = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (linkID.length === 6) {
    valid = linkID.split('')
      .map(letter => alphanumeric.indexOf(letter) > -1)
      .reduce((a,b)=>(a && b), true);
  }
  if (!valid) {
    throw new Error(`linkID is invalid: ${linkID}`);
  }
}

// app.get("/api/", (req, res) => {
//   const param = req.query.q;

//   if (!param) {
//     res.json({
//       error: "Missing required parameter `q`"
//     });
//     return;
//   }
//   res.json({'yourQParamWas': param})
// });
