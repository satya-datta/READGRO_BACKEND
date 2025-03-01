const Userrouter = require("express").Router();
const Usercontroller = require("../controller/usercontroller");
const connection = require("../backend");
const multer = require("multer");

const path = require("path");

// Set up file storage for avatar images using multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // specify the folder to store the uploaded files
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const filename = Date.now() + fileExtension; // Unique filename
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

Userrouter.post("/create-user", Usercontroller.createUser);

Userrouter.get("/getallusers", (req, res) => {
  // Query to fetch the required user details along with the wallet amount
  const usersQuery = `
    SELECT 
      u.userId AS userId,
      u.Name AS Name,
      u.GeneratedReferralCode AS GeneratedReferralCode,
      w.balance AS balance
    FROM user u
    LEFT JOIN wallet w ON u.userId = w.user_id
  `;

  connection.query(usersQuery, (err, results) => {
    if (err) {
      console.error("Error fetching users list:", err);
      return res
        .status(500)
        .json({ message: "Error fetching users list", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({
      message: "Users list retrieved successfully",
      users: results.map((user) => ({
        userId: user.userId,
        Name: user.Name,
        generatedReferralCode: user.GeneratedReferralCode,
        balance: user.balance || 0, // Default to 0 if no wallet record exists
      })),
    });
  });
});
Userrouter.post("/userauth", Usercontroller.loginUser);
Userrouter.get("/auth/uservalidate", Usercontroller.validateUserCookie);
Userrouter.post("/userlogout", Usercontroller.logoutUser);

Userrouter.post("/updatepassword/:user_id", Usercontroller.updatePassword);

Userrouter.get("/getuser_details/:user_id", Usercontroller.getUserById);
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

    const avatar = req.file ? req.file.filename : null; // Get the new avatar filename if provided

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
    // Step 1: Get the user's referral code
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

        // Step 2: Find all referred users
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
           LEFT JOIN wallettransactions w ON w.user_id = u.UserId AND w.transaction_type = 'credit'

            WHERE u.refferCode = ?`;

        connection.query(teamQuery, [referralCode], (err, teamMembers) => {
          if (err) {
            console.error("Error fetching team members:", err);
            return res
              .status(500)
              .json({ message: "Database error", error: err });
          }

          res.json({ team: teamMembers });
        });
      }
    );
  } catch (error) {
    console.error("Error fetching team data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = Userrouter;
