const Razorpay = require("razorpay");
require("dotenv").config();
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

 exports.CreateOrder=async (req, res) => {
  try {
    const { amount, currency } = req.body;
    console.log(amount,currency);
    const options = {
      amount: amount * 100, // Amount in paise (₹1 = 100 paise)
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1, // Auto capture
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.ValidateSignature=async (req, res) => {
  try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return res.status(400).json({ success: false, message: "Invalid Payment Details" });
      }

      // Create expected signature using HMAC SHA256
      const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(razorpay_order_id + "|" + razorpay_payment_id)
          .digest("hex");

      if (generatedSignature === razorpay_signature) {
          res.json({ success: true, message: "Payment Verified Successfully" });
      } else {
          res.status(400).json({ success: false, message: "Invalid Signature! Payment verification failed." });
      }
  } catch (error) {
      console.error("Payment validation error:", error);
      res.status(500).json({ success: false, message: "Payment verification error", error });
  }
};
