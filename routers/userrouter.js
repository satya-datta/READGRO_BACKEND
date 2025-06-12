const Userrouter = require("express").Router();
const Usercontroller = require("../controller/usercontroller");
const connection = require("../backend");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const { uploadBufferToCloudinary } = require("../controller/cloudinaryupload");
// Configure AWS

const storage = multer.memoryStorage();
const upload = multer({ storage });
Userrouter.post("/create-user", Usercontroller.createUser);
Userrouter.post("/validate-password", Usercontroller.validatePassword);
Userrouter.get("/getallusers", (req, res) => {
  const query = `
    SELECT 
      u.userId AS userId,
      u.Name AS Name,
      u.Phone As Phone,
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
        Phone: user.Phone,
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

Userrouter.get("/getuserbyemail/:email", Usercontroller.getUserByEmail);
Userrouter.get("/getuser_details/:user_id", Usercontroller.getUserById);
Userrouter.get(
  "/getsponseordetails/:reffercode",
  Usercontroller.getSponsorDetailsByReferralCode
);
Userrouter.post("/validate_user", Usercontroller.validateUser);
Userrouter.put(
  "/update_user/:user_id",
  upload.single("avatar"),
  async (req, res) => {
    const userId = req.params.user_id;
    const { name, email, phone, gender, address, pincode } = req.body;

    let avatarUrl = null;

    if (req.file) {
      try {
        // Use streamifier to stream file buffer to Cloudinary
        const streamUpload = (buffer) => {
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "avatars" },
              (error, result) => {
                if (result) {
                  resolve(result);
                } else {
                  reject(error);
                }
              }
            );
            streamifier.createReadStream(buffer).pipe(stream);
          });
        };

        const result = await streamUpload(req.file.buffer);
        avatarUrl = result.secure_url;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({
          message: "Failed to upload avatar to Cloudinary",
          error: err.message || err,
        });
      }
    }

    // Validate required fields
    if (!userId || !name || !email || !phone || !address || !pincode) {
      return res.json({ message: "All required fields must be provided" });
    }

    // Update query
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
      avatarUrl,
      userId,
    ];

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
  }
);
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
