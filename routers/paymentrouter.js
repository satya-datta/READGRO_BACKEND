const express = require("express");

const paymentcontroller = require("../controller/paymentcontroller");
 // Multer upload instance
const PaymentRouter = express.Router();
PaymentRouter.post("/create-order",paymentcontroller.CreateOrder);
PaymentRouter.post("/order/validate",paymentcontroller.ValidateSignature);
module.exports=PaymentRouter;