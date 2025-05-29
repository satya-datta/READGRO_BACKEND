const express = require("express");

const paymentcontroller = require("../controller/paymentcontroller");
// Multer upload instance
const PaymentRouter = express.Router();
PaymentRouter.post("/create-order", paymentcontroller.CreateOrder);
PaymentRouter.post("/order/validate", paymentcontroller.ValidateSignature);
PaymentRouter.get("/getpayment", (req, res) => {
  const query = "SELECT * FROM payments ORDER BY payment_time DESC";

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching payment records:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    res.status(200).json({
      message: "Payments fetched successfully",
      data: results,
    });
  });
});
module.exports = PaymentRouter;
