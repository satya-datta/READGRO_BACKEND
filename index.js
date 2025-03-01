const express = require('express');
var connection=require("./backend");
const adminRouter=require("./routers/adminrouter");
const cookieParser = require("cookie-parser");
const PaymentRouter = require("./routers/paymentrouter")
 const PackageRouter=require("./routers/packagerouter");
const Userrouter=require("./routers/userrouter");
const  UserBankrouter=require('./routers/userbankrouter');
const WithDrawlrouter=require('./routers/withdrawlrouter');
const port =  5000;
const app = express();
const cors = require('cors');
const path = require("path");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cookieParser());
// Allow CORS for specific origin
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"], // Allow multiple origins

  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers (including Authorization for JWT)
  credentials: true
}));
app.use(express.json());
 app.use('/', adminRouter);
 app.use('/',PackageRouter);
  app.use('/',Userrouter);
  app.use('/',UserBankrouter);
  app.use('/',WithDrawlrouter);
app.use("/",PaymentRouter);
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: "http://localhost:3000", // Replace with your frontend URL
      credentials: true, // Allow credentials (cookies)
    })
  );
  app.use((req, res, next) => {
    console.log("Cookies middleware:", req.cookies); // Log parsed cookies
    next();
  });
  
app.listen(port,'0.0.0.0', () => {
  console.log(`API working on port ${port}`);
  connection.connect(function (err) {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      return;
    }
    console.log('Connected to MySQL successfully!');
  });
  
});
