const bcrypt = require('bcrypt')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const MongoClient = require('mongodb').MongoClient
// my mongo connection/database
const client = new MongoClient("mongodb://localhost/test-app", { 
  useNewUrlParser: true,
  useUnifiedTopology: true
})
const express = require('express')
const app = express()
const port = 3000

// #hack for not constantly calling to get the DB
let db

app.use(express.json())

// sets up session to use MongoDB client via promise
app.use(session({
  secret: 'keyboard dog',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    maxAge: 86400000
  },
  store: new MongoStore({ clientPromise: connectToMongo() })
}))

app.post('/login', (req, res) => {
  const { username, password } = req.body

  // if user didn't send a username/password
  if (!username || !password) {
    return res.status(400)
  }

  db.collection('users')
    .findOne({ username })
    .then(db => {
      // if user doesn't exist, kick out
      if (!db) return res.status(401).json({err:"invalid user/password"})

      // check if passwords match
      if (bcrypt.compareSync(password, db.password)) {
        // update users session, return status
        req.session.user = db
        return res.json({
          s: "Logged in"
        })
      } else {
        // kick user out, since passwords don't match
        return res.status(401).json({err:"invalid user/password"})
      }
    })
    // in case something breaks
    .catch(err => {
      return res.status(500).json(err)
    })
})

// just shows the contents of the session
app.get('/showSession', (req, res) => {
  res.json(req.session)
})

// if user is logged in and has data, return it, otherwise 403
app.get('/myData', (req, res) => {
  if (req.session && req.session.user && req.session.user.data) {
    return res.json(req.session.user.data)
  } else {
    return res.status(403).json({s:"Not logged in"})
  }
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

// run just once
app.get('/createUsers', (req, res) => {
  db.collection("users").insertMany([
    {
      username: "bill",
      password: bcrypt.hashSync("password", 12),
      data: {
        lorem: "ipsum"
      }
    },
    {
      username: "cindy",
      password: bcrypt.hashSync("1234", 12),
      data: {
        other: "Data is here"
      }
    }
  ]).then(data => {
    console.log(data)

    res.json(data)
  }).catch(err => {
    console.log(`err:`)
    console.log(err)
    res.status(500).json(err)
  })
})

// returns a promise for the session...
//  also using the result to allow other MongoDB connections
function connectToMongo() {
  return new Promise((resolve, reject) => {
    client.connect(err => {
      console.log(err)
      if (err) return reject(err)

      db = client.db("test-app")

      return resolve(client)
    })
  })
}