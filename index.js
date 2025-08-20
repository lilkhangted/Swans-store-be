const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT;

// Chuỗi kết nối từ .env
const uri = process.env.MONGODB_URI;
let db;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // cho request từ server
    if (
      origin === 'http://localhost:3000' ||
      origin === 'https://swanstore.vercel.app' ||
      /\.vercel\.app$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());


app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

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

// Middleware để xác thực token

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Middleware kiểm tra vai trò
const authorizeRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Kết nối đến MongoDB và khởi động server
connectToDatabase()
  .then(() => {
    app.get('/api/ping', (req, res) => {
      res.send('pong');
    });

    // API đăng nhập
    app.post('/api/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        let user = await db.collection('users').findOne({ email });
        if (!user) user = await db.collection('admins').findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRATION || '1h' });
        res.json({ message: 'Login successful', token, role: user.role });
      } catch (err) {
        res.status(500).json({ message: 'Error logging in: ' + err.message });
      }
    });

    // API đăng ký
    async function getNextUserId(db) {
      const users = await db.collection('users')
        .find({ id: { $regex: /^U\d+$/ } })
        .sort({ id: 1 }) 
        .toArray();

      let expected = 1;
      let paddingLength = 5;

      for (const user of users) {
        const numPart = parseInt(user.id.slice(1));
        if (numPart !== expected) {
          return "U" + expected.toString().padStart(paddingLength, "0");
        }
        expected++;
        if (user.id.slice(1).length > paddingLength) {
          paddingLength = user.id.slice(1).length;
        }
      }
      return "U" + expected.toString().padStart(paddingLength, "0");
    }

    app.post('/api/register', async (req, res) => {
      try {
        const { name, email, password, phone, address, dob, subscribe} = req.body;
        const emailCheck = await db.collection('users').findOne({ email });
        if (emailCheck) {
          return res.status(400).json({ message: 'Email đã tồn tại' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newId = await getNextUserId(db);
        const newUser = {
          id: newId,
          name,
          email,
          password: hashedPassword,
          phone,
          address,
          dob,
          subscribe,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const result = await db.collection('users').insertOne(newUser);
        const token = jwt.sign({ id: newUser.id, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION || '1h' }
      );

      res.status(201).json({
        message: 'Đăng ký thành công',
        token,
        role: 'user',
        id: newUser.id
      });
    } catch (err) {
      res.status(500).json({ message: 'Error registering user: ' + err.message });
    }
  });

    // Admin route
    app.get('/api/admin', authenticateToken, authorizeRole('admin'), async (req, res) => {
      res.json({ message: 'Welcome to the admin area', user: req.user });
    });

    // User route
    app.get('/api/user', authenticateToken, authorizeRole('user'), async (req, res) => {
      res.json({ message: 'Welcome to the user area', user: req.user });
    });

    // API để lấy tất cả sản phẩm
    app.get('/api/products', async (req, res) => {
      try {
        const collection = db.collection('products');
        const products = await collection.find({}).toArray();
        res.json(products);
      } catch (err) {
        res.status(500).json({ message: 'Error fetching products: ' + err.message }); // Sử dụng JSON thay vì send
      }
    });

    // API để thêm sản phẩm mới
    app.post('/api/products', async (req, res) => {
      try {
        const collection = db.collection('products');
        const newProduct = req.body;
        const result = await collection.insertOne(newProduct);
        res.status(201).json(result);
      } catch (err) {
        res.status(500).json({ message: 'Error adding product: ' + err.message }); // Sử dụng JSON
      }
    });

    // Khởi động server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Server failed to start due to database connection error:", err);
    process.exit(1);
  });

// Đóng kết nối khi process kết thúc
process.on('SIGINT', async () => {
  await client.close();
  console.log("Connection closed.");
  process.exit();
});