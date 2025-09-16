const express = require('express');
const Cart = require('../Model/cart.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

module.exports = (db) => {
  // ========== Middleware xác thực ==========
  const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid token' });
      req.user = user;
      next();
    });
  };

  const authorizeRole = (role) => {
    return (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({ message: 'Access denied' });
      }
      next();
    };
  };

  // ========== ROUTES ==========

  router.get('/ping', (req, res) => {
    res.send('pong');
  });

  // -------- LOGIN --------
  router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await db.collection('users').findOne({ email });
    if (!user) user = await db.collection('admins').findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      userId: user.id,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in: ' + err.message });
  }
});

  // -------- REGISTER --------
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

  router.post('/register', async (req, res) => {
    try {
      const { name, email, password, phone, address, dob, subscribe } = req.body;
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
      await db.collection('users').insertOne(newUser);
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

  // -------- ADMIN / USER --------
  router.get('/admin', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json({ message: 'Welcome to the admin area', user: req.user });
  });
  router.get('/admin/:id', async (req, res) => {
    try {
      const admin = await db.collection('admins').findOne({ id: req.params.id });
      if (!admin) {
        return res.status(404).json({ message: 'Không tìm thấy admin' });
      }

      res.json({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        img: admin.img || null
      });
    } catch (err) {
      console.error('Lỗi lấy admin:', err);
      res.status(500).json({ message: 'Lỗi server: ' + err.message });
    }
  });

  router.get('/user', authenticateToken, authorizeRole('user'), (req, res) => {
    res.json({ message: 'Welcome to the user area', user: req.user });
  });

  // -------- CART --------
  router.get('/cart/:userId', async (req, res) => {
    try {
      const cart = await db.collection('carts').findOne({ userId: req.params.userId });
      if (!cart) return res.json({ userId: req.params.userId, items: [] });
      res.json(cart);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching cart: ' + err.message });
    }
  });

  router.post('/carts', authenticateToken, async (req, res) => {
    try {
      const { userId, productId, quantity, color } = req.body;

      const cartsCollection = db.collection('carts');

      // Kiểm tra user đã có giỏ chưa
      let cart = await cartsCollection.findOne({ userId });

      if (!cart) {
        // Lấy giỏ cuối cùng để tạo id mới (CT00001, CT00002,...)
        const lastCart = await cartsCollection
          .find({})
          .sort({ id: -1 })
          .limit(1)
          .toArray();

        let newCartId = 'CT00001';
        if (lastCart.length > 0 && lastCart[0].id) {
          const lastNumber = parseInt(lastCart[0].id.replace('CT', ''), 10);
          const nextNumber = lastNumber + 1;
          newCartId = 'CT' + nextNumber.toString().padStart(5, '0');
        }

        // Tạo giỏ mới
        await cartsCollection.insertOne({
          id: newCartId,
          userId,
          items: [{ productId, quantity, color }],
          updatedAt: new Date()
        });
      } else {
        // Nếu đã có giỏ thì thêm/cộng số lượng
        const existingItemIndex = cart.items.findIndex(
          (i) => i.productId === productId && i.color === color
        );

        if (existingItemIndex !== -1) {
          cart.items[existingItemIndex].quantity += quantity;
        } else {
          cart.items.push({ productId, quantity, color });
        }

        await cartsCollection.updateOne(
          { userId },
          { $set: { items: cart.items, updatedAt: new Date() } }
        );
      }

      res.json({ message: "Thêm vào giỏ hàng thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  });



  router.put('/cart/update', async (req, res) => {
    try {
      const { userId, productId, quantity } = req.body;

      const cart = await db.collection('carts').findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const item = cart.items.find(i => i.productId === productId);
      if (!item) return res.status(404).json({ message: "Product not in cart" });

      item.quantity = quantity;
      cart.updatedAt = new Date();

      await db.collection('carts').updateOne(
        { userId },
        { $set: { items: cart.items, updatedAt: cart.updatedAt } }
      );

      res.json({ message: "Cart updated successfully", cart });
    } catch (err) {
      res.status(500).json({ message: "Error updating cart: " + err.message });
    }
  });

  router.delete('/cart/remove', async (req, res) => {
    try {
      const { userId, productId } = req.body;

      const cart = await db.collection('carts').findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const newItems = cart.items.filter(i => i.productId !== productId);

      await db.collection('carts').updateOne(
        { userId },
        { $set: { items: newItems, updatedAt: new Date() } }
      );

      res.json({ message: "Product removed from cart successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error removing from cart: " + err.message });
    }
  });

  // -------- PAYMENTS --------
  router.get('/payments', async (req, res) => {
    try {
      const payments = await db.collection('payments').find({}).toArray();
      res.json(payments);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching payments: ' + err.message });
    }
  });

  // -------- PRODUCTS --------
  router.get('/products', async (req, res) => {
    try {
      const products = await db.collection('products').find({}).toArray();
      res.json(products);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching products: ' + err.message });
    }
  });

  router.get('/products/:id', async (req, res) => {
    try {
      const product = await db.collection('products').findOne({ id: req.params.id });
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching product: ' + err.message });
    }
  });

  router.post('/products', async (req, res) => {
    try {
      const newProduct = req.body;
      const result = await db.collection('products').insertOne(newProduct);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ message: 'Error adding product: ' + err.message });
    }
  });

  // -------- USERS --------
  router.get('/users/:id', async (req, res) => {
    try {
        const user = await req.db.collection('users').findOne({ id: req.params.id }, { projection: { password: 0 } });
        if (!user) 
        {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user: ' + err.message });
    }
    });

  router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        delete updateData.password;

        const result = await db.collection('users').findOneAndUpdate(
        { id },
        { $set: updateData },
        { returnDocument: 'after' }
        );

        if (!result) {
        return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Cập nhật thành công', user: result.value });
        } catch (err) {
            res.status(500).json({ message: 'Lỗi khi cập nhật: ' + err.message });
        }
    });


  return router;
};
