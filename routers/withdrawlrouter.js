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
// Wallet
WithDrawlrouter.post("/deductwallet", withdrawlcontroller.deductWallet);
WithDrawlrouter.get("/earnings/:reffer_id", withdrawlcontroller.getEarnings);

//Wallet Transactions
WithDrawlrouter.get(
  "/getwallettransaction/:reffer_id",
  withdrawlcontroller.getTransactionsByRefferId
);
module.exports = WithDrawlrouter;
