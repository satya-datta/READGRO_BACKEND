const Userrouter = require("express").Router();
const Usercontroller = require("../controller/usercontroller");
const connection = require("../backend");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const AWS = require("aws-sdk");
// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, // e.g. 'us-east-1'
});

// Create S3 instance
const s3 = new AWS.S3();

// Configure multer-S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    // acl: "public-read", // optional: allows public access to the uploaded image
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}${ext}`;
      cb(null, filename);
    },
  }),
});
Userrouter.post("/create-user", Usercontroller.createUser);
Userrouter.post("/validate-password", Usercontroller.validatePassword);
Userrouter.get("/getallusers", (req, res) => {
  const query = `
    SELECT 
      u.userId AS userId,
      u.Name AS Name,
      u.GeneratedReferralCode AS GeneratedReferralCode,
      w.balance AS balance,
      COUNT(wr.id) AS withdrawalCount,
      MAX(wr.created_at) AS latestWithdrawal
    FROM user u
    LEFT JOIN wallet w ON u.userId = w.user_id
    LEFT JOIN withdrawal_requests wr ON u.userId = wr.user_id and wr.status="pending"
    GROUP BY u.userId
  `;

  connection.query(query, (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error fetching users", error: err });
    }

    res.status(200).json({
      message: "Users fetched",
      users: results.map((user) => ({
        userId: user.userId,
        Name: user.Name,
        generatedReferralCode: user.GeneratedReferralCode,
        balance: user.balance || 0,
        withdrawalCount: user.withdrawalCount,
        latestWithdrawal: user.latestWithdrawal,
      })),
    });
  });
});

Userrouter.post("/userauth", Usercontroller.loginUser);
Userrouter.get("/auth/uservalidate", Usercontroller.validateUserCookie);
Userrouter.post("/userlogout", Usercontroller.logoutUser);
Userrouter.post("/validate_refferalcode", Usercontroller.validateReferralCode);
Userrouter.post("/updatepassword/:user_id", Usercontroller.updatePassword);

Userrouter.post("/send-userlogin-otp", Usercontroller.sendOtp);
Userrouter.post("/verifyuser-otp", Usercontroller.VerifyOtp);

Userrouter.post("/sendcontact", Usercontroller.sendContactDetails);

Userrouter.get("/getuser_details/:user_id", Usercontroller.getUserById);
Userrouter.get(
  "/getsponseordetails/:reffercode",
  Usercontroller.getSponsorDetailsByReferralCode
);
Userrouter.post("/validate_user", Usercontroller.validateUser);
Userrouter.put("/update_user/:user_id", (req, res, next) => {
  // Handle avatar upload
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error uploading avatar image", error: err });
    }

    const userId = req.params.user_id; // Extract user ID from route params
    const { name, email, phone, gender, address, pincode } = req.body;

    const avatar = req.file ? req.file.location : null; // Get the new avatar filename if provided

    // Validate required fields
    if (!userId || !name || !email || !phone || !address || !pincode) {
      return res.json({ message: "All required fields must be provided" });
    }

    // Prepare query and data for updating user details
    const updateUserQuery = `
        UPDATE user
        SET 
          Name = ?, 
          Email = ?, 
          Phone = ?, 
        
          Address = ?, 
          Pincode = ?, 
          Avatar = COALESCE(?, Avatar)
        WHERE userid = ?
      `;

    const updateUserValues = [
      name,
      email,
      phone,

      address,
      pincode,
      avatar,
      userId,
    ];

    // Execute the update query
    connection.query(updateUserQuery, updateUserValues, (err, result) => {
      if (err) {
        console.error("Error updating user details:", err);
        return res
          .status(500)
          .json({ message: "Error updating user details", error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ message: "User details updated successfully" });
    });
  });
});

Userrouter.put("/upgrade_package", Usercontroller.upgradeUserPackage);
Userrouter.get("/getteam/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);

    connection.query(
      "SELECT GeneratedReferralCode FROM user WHERE UserId = ?",
      [userId],
      (err, userResult) => {
        if (err) {
          console.error("Error fetching referral code:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }

        if (userResult.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const referralCode = userResult[0].GeneratedReferralCode;

        const teamQuery = `
          SELECT 
            u.UserId AS userId, 
            u.Name AS name, 
            u.Email AS email, 
            u.Phone AS phone, 
            u.created_date AS enrollmentDate, 
            p.package_name AS packageName, 
            w.amount AS referralAmount
          FROM user u
          JOIN packages p ON u.PackageId = p.package_id
          LEFT JOIN wallettransactions w 
            ON w.user_id = u.UserId 
            AND w.transaction_type = 'credit' 
            AND w.reffer_id = ?
          WHERE u.refferCode = ?
        `;

        connection.query(
          teamQuery,
          [userId, referralCode],
          (err, teamMembers) => {
            if (err) {
              console.error("Error fetching team members:", err);
              return res
                .status(500)
                .json({ message: "Database error", error: err });
            }

            res.json({ team: teamMembers });
          }
        );
      }
    );
  } catch (error) {
    console.error("Error fetching team data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = Userrouter;
