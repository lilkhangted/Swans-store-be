const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String },
  city: { type: String },
  country: { type: String },
  postalCode: { type: String }
}, { _id: false });

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },            // "U00008"
  name: { type: String, required: true },                         // "Nguyen Xuan Vi"
  email: { type: String, required: true, unique: true },          // "vevi2456@gmail.com"
  password: { type: String, required: true },                     // hashed password
  phone: { type: String },                                        // "0364217621"
  address: addressSchema,                                         // embedded object
  dob: { type: Date },                                             // "2004-07-21"
  subscriber: { type: Boolean, default: false },
  role: { type: String, default: 'user', enum: ['user','admin'] },
  img: { type: String },                                           // avatar url
}, { timestamps: true });                                          // createdAt & updatedAt

module.exports = mongoose.model('User', userSchema);
