const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT;
const uri = process.env.MONGODB_URI;

let db;

app.use(cors({
  origin: ['https://swanstore.vercel.app', 'http://localhost:3000', /\.vercel\.app$/ ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToDatabase() {
  await client.connect();
  db = client.db("database");
  console.log("Connected successfully!");
}



connectToDatabase().then(() => {
    app.use((req, res, next) => {
      req.db = db;
      next();
    });
    const routes = require('./Routes/routes')(db);
    app.use('/api', routes);

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch(err => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await client.close();
  console.log("Connection closed.");
  process.exit();
});
