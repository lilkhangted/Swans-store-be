const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

// Chuỗi kết nối từ .env
const uri = process.env.MONGODB_URI;
let db;

app.use(cors());
app.use(express.json());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Kết nối MongoDB
async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db("database");
    console.log("Connected to MongoDB Atlas successfully!");
    await db.command({ ping: 1 });
    console.log("Pinged your deployment. Server is running!");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
}

connectToDatabase().catch(console.dir);

// Middleware để parse JSON


// API để lấy tất cả sản phẩm
app.get('/api/products', async (req, res) => {
  try {
    const collection = db.collection('products');
    const products = await collection.find({}).toArray();
    res.json(products);
  } catch (err) {
    res.status(500).send("Error fetching products: " + err.message);
  }
});

// API để thêm sản phẩm mới (tùy chọn)
app.post('/api/products', async (req, res) => {
  try {
    const collection = db.collection('products');
    const newProduct = req.body;
    const result = await collection.insertOne(newProduct);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).send("Error adding product: " + err.message);
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Đóng kết nối khi process kết thúc
process.on('SIGINT', async () => {
  await client.close();
  process.exit();
});