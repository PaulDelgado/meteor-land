// server.js
// where your node app starts

// init project
var Promise = require('bluebird');
var rp = require('request-promise');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function formatSlackMsg(url, attachments, type, text) {
  if (type === 'ephemeral') { var response_type = 'ephemeral'; } else { var response_type = 'in_channel'; }
  var slack_message = {
    method: 'POST',
    uri: url,
    headers: {
      'Content-type': 'application/json'
    },
    body: {
      response_type: response_type,
      attachments: attachments
    },
    json: true
  }
  if (text) { slack_message.body.text = text; }
  return slack_message;
};

function setSlackMsgAttachments(fallback, color, title, title_link, text, fields, date) {
  var msg_attachments = [
    {
      "fallback": fallback,
      "color": color,
      //"pretext": "Robinhood returned a response to the query.",
      "author_name": "Robinhood Integration for Slack",
      "author_link": "https://github.com/PaulDelgado/meteor-land",
      "author_icon": "https://cdn.glitch.com/387e0080-9d47-4636-b843-71fdcd8c3c0b%2Frobinhood-icon-16x16.png?1498375921742",
      "title": title,
      "title_link": title_link,
      "text": text,
      "mrkdwn": true,
      "mrkdwn_in": ["text", "pretext"],
      "fields": fields,
      //"image_url": "https://cdn.glitch.com/387e0080-9d47-4636-b843-71fdcd8c3c0b%2Frobinhood-108.jpg?1498375652071",
      //"thumb_url": "https://cdn.glitch.com/387e0080-9d47-4636-b843-71fdcd8c3c0b%2Frobinhood-108.jpg?1498375652071",
      "footer": "Lynyx Dev",
      "footer_icon": "https://cdn.glitch.com/387e0080-9d47-4636-b843-71fdcd8c3c0b%2Flynyx-dev.ico?1498532589111",
      "ts": date
    }
  ];
  return msg_attachments;
};

function setSlackMsgAttachmentsFields(change, percent, bid, ask) {
  var fields = [
    { title: "Change $", value: change, short: true },
    { title: "Change %", value: percent + "%", short: true },
    { title: "Bid", value: bid, short: true },
    { title: "Ask", value: ask, short: true }
  ]
  return fields;
}

function calcChange(last_trade_price, previous_close) {
  var change = (last_trade_price - previous_close).toFixed(4);
  var percent = ((change/last_trade_price) * 100).toFixed(2);
  var color = "";
  if (change > 0) { change = "+"+change; percent = "+"+percent; color = "#5cb85c"; } else if (change < 0) { color = "#d9534f"; } else { color = "#999999"; }
  return {
    unit: change,
    percent: percent,
    color: color
  }
};

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// Slack integration endpoint controller
app.post("/", function(req, res, next) {
    console.log("[INCOMING] REQUEST: " + Object.getOwnPropertyNames(req));
    console.log(req.body);
  var incoming = req.body;
  if (incoming.token !== process.env.SLACKINCOMINGTOKEN) {
      //console.log("[INCOMING] REQUEST");
      //console.log(req);
      console.log("[INCOMING] REQUEST: Slack token mismatch! IP: " + req.ip);
    res.status(403).send("Forbidden; request logged.");
  } else {
    res.format({
      json: function() {
        res.status(200).json({ response_type: "ephemeral", text: "Robinhood request received, querying API..." });
      }
    });
      console.log("[INCOMING] REQUEST: Verified Slack request.");
      console.log("[INCOMING] REQUEST.command: " + incoming.command);
    switch (incoming.command) {
      // Robinhood API integration handler
      case "/roho":
          console.log("[ROHO] INCOMING REQUEST: Robinhood handler activated.");
        var ENDPOINT = 'https://api.robinhood.com/';
        var task = incoming.text.split(" ");
          console.log("[ROHO] INCOMING REQUEST.task: " + task);
        switch (task[0]) {
          case "quote":
            // Fetch quote for given symbol
              console.log("[ROHO] INCOMING REQUEST: Handling Quote Task...");
            var symbol = task[1].toUpperCase();
            // Construct API endpoint URL
            var uri = ENDPOINT + task[0] + 's/' + symbol + '/';
              console.log("[ROHO] Quote: Fetching " + uri);
            var options = {
              uri: uri,
              json: true
            };
            // Handle Robinhood API response
            return rp(options)
              .then(function(response) {
                console.log("[ROHO] Quote: Received quote response.");
                console.log(response);
              // Setup object to report performance data relative to previous close
              var change = calcChange(response.last_trade_price, response.previous_close)
                , bid = "$" + response.bid_price + " x " + response.bid_size
                , ask = "$" + response.ask_price + " x " + response.ask_size;
                console.log("[ROHO] Quote: calcChange().change: ");
                console.log(change);
              var fallback = response.symbol + " - Price: $" + response.last_trade_price + " | Change: $" + change.unit + " / " + change.percent + "%"
                , color = change.color
                , title = "Quote: " + response.symbol
                , title_link = uri
                , text = " *Last Price:* $" + response.last_trade_price
                , fields = setSlackMsgAttachmentsFields(change.unit, change.percent, bid, ask)
                , date = Date.parse(response.updated_at) / 1000;
              var attachments = setSlackMsgAttachments(fallback, color, title, title_link, text, fields, date);
                console.log("[ROHO] Quote: OUTGOING RESPONSE.attachments: ");
                console.log(attachments);
              var options = formatSlackMsg(incoming.response_url, attachments);
                console.log("[ROHO] Quote: OUTGOING RESPONSE.options: ");
                console.log(options);
              return rp(options);
            }).catch(function(err) {
                console.error('Error: ' + err.stack);
              var text = 'Robinhood reports no data was found for symbol ' + symbol + '.';
              var attachments = [{}];
              var options = formatSlackMsg(incoming.response_url, attachments, "ephemeral", text);
              return rp(options);
            });
            break;
          case "detail":
            // Fetch detail for given symbol
              console.log("[ROHO] INCOMING REQUEST: Handling Detail Task...");
            break;
          case "fundamentals":
            // Fetch fundamentals for given symbol
              console.log("[ROHO] INCOMING REQUEST: Handling Fundamentals Task...");
            var text = 'The fundamentals task is coming soon, but not yet ready.';
            var attachments = [{}];
            var options = formatSlackMsg(incoming.response_url, attachments, "ephemeral", text);
            return rp(options);
            break;
          default:
            // Catch unrecognized tasks and return error
              console.log("[ROHO] INCOMING REQUEST: Unrecognized task: " + task[0]);
            res.status(404).end();
        }
        break;
      // Another command handler
      case "/y":
        res.status(204).send("Command not yet available.");
        break;
      // Yet another command handler
      case "/z":
        res.status(204).send("Command not yet available.");
        break;
      default:
        // Catch unrecognized commands here
          console.log("[INCOMING] REQUEST: Unrecognized command: " + incoming.command);
        res.status(404).send("Unrecognized command.");
    }
  }
});

app.get("/events", function(request, response) {
  console.log("[EVENTS] Request: " + Object.getOwnPropertyNames(request));
  response.sendStatus(200);
});

app.get("/msg", function (request, response) {
  response.send(msg);
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/msg", function (request, response) {
  var options = {
    method: 'POST',
    uri: 'https://hooks.slack.com/services/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',
    headers: {
      'User-Agent': 'Request-Promise',
      'Content-type': 'application/json'
    },
    body: {
      text: request.query.msg
    },
    json: true
  };
  rp(options)
    .then(function() {
      msg.push(request.query.msg);
      response.sendStatus(200);
    })
    .catch(function(err) {
      console.log("Error: " + err.stack);
      msg.push(err.stack);
      response.sendStatus(500);
    });
});

// Simple in-memory store for now
var msg = [
  ""
];

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
