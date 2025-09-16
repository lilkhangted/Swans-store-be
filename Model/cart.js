const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 }
});

const cartSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },   
  userId: { type: String, required: true },             
  items: { type: [cartItemSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
