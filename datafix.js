// datafix.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function fix() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("database");
    const collection = db.collection("admins");

    // Lấy tất cả admin
    const admins = await collection.find({}).toArray();

    for (const admin of admins) {
      // Nếu chưa có trường id thì thêm vào
      if (!admin.id) {
        await collection.updateOne(
          { _id: admin._id },
          { $set: { id: "AD0001" } }
        );
        console.log(`Đã thêm id cho admin ${admin._id}`);
      }
    }

    console.log('✅ Đã thêm trường id vào tất cả admin chưa có');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await client.close();
  }
}

fix();
