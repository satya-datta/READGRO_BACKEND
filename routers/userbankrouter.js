const UserBankrouter=require("express").Router();
const UserBankcontroller=require("../controller/userbankcontroller");

UserBankrouter.post('/insert_bank_detials', UserBankcontroller.insertUserBankDetails);
UserBankrouter.get('/getuser_bank_details/:user_id', UserBankcontroller.getUserBankDetails);
UserBankrouter.put('/updateuser_bank_details/:user_id', UserBankcontroller.updateUserBankDetails);


module.exports=UserBankrouter;
