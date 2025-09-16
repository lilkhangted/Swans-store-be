import Cart from '../Model/cart.js';

async function generateCartId() {
  const lastCart = await Cart.findOne().sort({ createdAt: -1 });
  if (!lastCart || !lastCart.id) return "CT00001";

  const lastNumber = parseInt(lastCart.id.slice(2)); // lấy phần số
  const newNumber = lastNumber + 1;
  return "CT" + newNumber.toString().padStart(5, "0");
}

exports.addToCart = async (req, res) => {
  const { userId, productId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // tạo mới
      const newId = await generateCartId();
      cart = new Cart({
        id: newId,
        userId,
        items: [{ productId, quantity }],
        updatedAt: new Date()
      });
    } else {
      // cập nhật giỏ cũ
      const item = cart.items.find(i => i.productId === productId);
      if (item) {
        item.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
      cart.updatedAt = new Date();
    }

    await cart.save();
    res.status(200).json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
};
