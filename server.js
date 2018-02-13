var express = require("express");
var exphbs = require("express-handlebars");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var cheerio = require("cheerio");
var request = require("request");
var logger = require("morgan");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 8080;

// Initialize Express
var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
// Connect to the Mongo DB
// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "ds121268.mlab.com:21268/heroku_gcplfnw8";
// Connect to the Mongo DB
mongoose.Promise = Promise;
if(process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
  });
} else {
  mongoose.connect("mongodb://localhost/sessionDB", {
        });
}
  
  // Routes
  // ======
  
  //GET requests to render Handlebars pages
  app.get("/", function(req, res) {
    db.Article.find({"saved": false}, function(error, data) {
      var hbsObject = {
        article: data
      };
      // console.log(hbsObject);
      res.render("home", hbsObject);
    });
  });
  
  app.get("/saved", function(req, res) {
    db.Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
      var hbsObject = {
        article: articles
      };
      res.render("saved", hbsObject);
    });
  });
  
  // A GET request to scrape the echojs website
  app.get("/scrape", function(req, res) {
    // First, we grab the body of the html with request
    request("https://www.nytimes.com/", function(error, response, html) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      var $ = cheerio.load(html);
      // Now, we grab every h2 within an article tag, and do the following:
      $("article.story").each(function(i, element) {
  
        // Save an empty result object
        var result = {};
        console.log("__________________________________________________________")
        // console.log($(this));
  
        // Add the title and summary of every link, and save them as properties of the result object
        result.title = $(this).children("h2").text();
        result.byline = $(this).children("p.byline").text();
        result.date = $(this).children(".byline").children("time.timestamp").attr("datetime");
        result.time = $(this).children("p.byline").children("time").data("eastern-timestamp");
        result.link = $(this).children("h2").children("a").attr("href");
        
        // console.log($(this).children("p .byline"));
        console.log($(this).children("h2").text());
        // Using our Article model, create a new entry
        // This effectively passes the result object to the entry (and the title and link)
        // console.log(result);
        var entry = new db.Article(result);
        
        // Now, save that entry to the db
        entry.save(function(err, doc) {
          // Log any errors
          if (err) {
            // console.log(err);
          }
          // Or log the doc
          else {
            // console.log(doc);
          }
        });
  
      });
          res.send("Scrape Complete");
  
    });
    // Tell the browser that we finished scraping the text
  });
  
  // This will get the articles we scraped from the mongoDB
  app.get("/articles", function(req, res) {
    // Grab every doc in the Articles array
    db.Article.find({}, function(error, doc) {
      // Log any errors
      if (error) {
        // console.log(error);
      }
      // Or send the doc to the browser as a json object
      else {
        res.json(doc);
      }
    });
  });

  
  // Save an article
  app.post("/articles/save/:id", function(req, res) {
        // Use the article id to find and update its saved boolean
        db.Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
        // Execute the above query
        .exec(function(err, doc) {
          // Log any errors
          if (err) {
            // console.log(err);
          }
          else {
            // Or send the document to the browser
            res.send(doc);
          }
        });
  });
  
  // Delete an article
  app.post("/articles/delete/:id", function(req, res) {
        // Use the article id to find and update its saved boolean
        db.Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
        // Execute the above query
        .exec(function(err, doc) {
          // Log any errors
          if (err) {
            // console.log(err);
          }
          else {
            // Or send the document to the browser
            res.send(doc);
          }
        });
  });
  
  
  // Create a new note
  app.post("/notes/save/:id", function(req, res) {
    // Create a new note and pass the req.body to the entry
    var newNote = new Note({
      body: req.body.text,
      article: req.params.id
    });
    // console.log(req.body)
    // And save the new note the db
    newNote.save(function(error, note) {
      // Log any errors
      if (error) {
        // console.log(error);
      }
      // Otherwise
      else {
        // Use the article id to find and update it's notes
        db.Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
        // Execute the above query
        .exec(function(err) {
          // Log any errors
          if (err) {
            // console.log(err);
            res.send(err);
          }
          else {
            // Or send the note to the browser
            res.send(note);
          }
        });
      }
    });
  });
  
  // Delete a note
  app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
    // Use the note id to find and delete it
    Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
      // Log any errors
      if (err) {
        // console.log(err);
        res.send(err);
      }
      else {
        db.Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
         // Execute the above query
          .exec(function(err) {
            // Log any errors
            if (err) {
              // console.log(err);
              res.send(err);
            }
            else {
              // Or send the note to the browser
              res.send("Note Deleted");
            }
          });
      }
    });
  });
  
  // Listen on port
  app.listen(PORT, function() {
    console.log("App running on port " + PORT);
  });
  