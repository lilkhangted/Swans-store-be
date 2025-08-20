require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("database");
    const usersCollection = db.collection("users");
    const newUsers = [
      {
        id: "U000003",
        name: "Nguyen Van B",
        email: "user1@example.com",
        password: "123456",   // sẽ hash ở dưới
        role: "user",
        phone: "0901123456",
        address: {
          street: "123 Lê Lợi",
          city: "Hồ Chí Minh",
          district: "Quận 1",
          country: "VN",
          postalCode: "700000"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "U000004",
        name: "Tran Thi C",
        email: "admin1@example.com",
        password: "admin123",
        role: "admin",
        phone: "0912345678",
        address: {
          street: "456 Hai Bà Trưng",
          city: "Hà Nội",
          district: "Hoàn Kiếm",
          country: "VN",
          postalCode: "100000"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (let newUser of newUsers) {
      const exists = await usersCollection.findOne({ email: newUser.email });
      if (!exists) {
        const hashedPassword = await bcrypt.hash(newUser.password, 10);
        newUser.password = hashedPassword;

        await usersCollection.insertOne(newUser);
        console.log(`✔ Inserted new user: ${newUser.email}`);
      } else {
        console.log(`ℹ User already exists: ${newUser.email}`);
      }
    }

    console.log("✅ Seeding completed!");
  } catch (err) {
    console.error("❌ Error in seed:", err);
  } finally {
    await client.close();
  }
}
run();
