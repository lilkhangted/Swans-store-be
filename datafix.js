// datafix.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function removeDistrictField() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("database");
    const users = db.collection("users");

    const result = await users.updateMany(
      {},
      { $set: { role: "user" } }
    );

    console.log(`Đã cập nhật ${result.modifiedCount} users (bỏ district).`);
  } catch (err) {
    console.error("Lỗi khi update:", err);
  } finally {
    await client.close();
  }
}

removeDistrictField();
