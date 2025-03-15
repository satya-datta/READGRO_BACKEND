const WithDrawlrouter = require("express").Router();
const withdrawlcontroller = require("../controller/withdrawlrequestcontroller");
const connection = require("../backend");
WithDrawlrouter.post(
  "/withdrawlrequests/:user_id",
  withdrawlcontroller.CreateWR
);
WithDrawlrouter.get(
  "/getwithdrawlrequests/:user_id",
  withdrawlcontroller.getWithdrawalRequests
);
WithDrawlrouter.get(
  "/getwallet/:user_id",
  withdrawlcontroller.getWalletDetails
);
// Wallet    C:\Users\lenovo\Downloads\ReadGro_MAIN\READGRO\backend\routers\withdrawlrouter.js
WithDrawlrouter.post("/deductwallet", withdrawlcontroller.deductWallet);

WithDrawlrouter.get("/earnings/:reffer_id", withdrawlcontroller.getEarnings);
WithDrawlrouter.get("/payments", withdrawlcontroller.getRazorpayPayments);
WithDrawlrouter.get("/getpayouts", withdrawlcontroller.getPayouts);
//Wallet Transactions

WithDrawlrouter.get(
  "/getwallettransaction/:reffer_id",
  withdrawlcontroller.getTransactionsByRefferId
);
module.exports = WithDrawlrouter;

//Verify OTP and sending otp for pyment
WithDrawlrouter.post("/send-otp", withdrawlcontroller.sendOtp);

WithDrawlrouter.post("/process-payout", withdrawlcontroller.ProcessPayout);
