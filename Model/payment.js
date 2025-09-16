const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  id: String,
  orderId: String,
  paymentMethod: String,
  paymentStatus: String,
  transactionId: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
