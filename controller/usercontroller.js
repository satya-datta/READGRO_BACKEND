const multer = require("multer");
const connection = require("../backend");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../emailService"); // Import email service
const nodemailer = require("nodemailer");
const saltRounds = 10; // Salt rounds for bcrypt

const JWT_SECRET = "USER AUTHENTICATION";
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

// Function to calculate referral commission
const returnCommissionMethod = (userPackageId, referrerPackageId, callback) => {
  const packageQuery = `
    SELECT package_id, package_price,commission FROM packages WHERE package_id IN (?, ?)
  `;
  connection.query(
    packageQuery,
    [userPackageId, referrerPackageId],
    (err, results) => {
      if (err) {
        console.error("Error fetching package details:", err);
        return callback(err, null);
      }

      if (results.length < 1) {
        console.error("One or both packages not found.");
        return callback(new Error("One or both packages not found."), null);
      }

      // Initialize variables to store commissions
      let userCommission = null;
      let referrerCommission = null;

      // Calculate commissions directly
      results.forEach((pkg) => {
        //  const commission = Math.floor(pkg.package_price - pkg.package_price * 0.2); // Commission = price - 20%, rounded down
        const commission = pkg.commission;
        console.log(userPackageId, "-", referrerPackageId);

        if (pkg.package_id == userPackageId) {
          userCommission = commission;
          console.log(pkg.package_price);
          console.log(userCommission);
        } else if (pkg.package_id == referrerPackageId) {
          referrerCommission = commission;
          console.log(pkg.package_price);
          console.log(referrerCommission);
        }

        if (
          referrerPackageId == pkg.package_id &&
          pkg.package_id == userPackageId
        ) {
          userCommission = commission;
          referrerCommission = commission;
        }
      });

      if (userCommission === null || referrerCommission === null) {
        console.error("Error mapping package IDs to commissions.");
        return callback(
          new Error("Error mapping package IDs to commissions."),
          null
        );
      }

      console.log(userCommission, "-", referrerCommission);

      // Return the lower commission
      return callback(null, Math.min(userCommission, referrerCommission));
    }
  );
};

// Function to generate referral code
function generateReferralCode() {
  const prefix = "RDGW";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }
  return prefix + randomPart;
}

// Function to ensure the generated referral code is unique
function getUniqueReferralCode(callback) {
  const newReferralCode = generateReferralCode();
  const checkQuery = `SELECT * FROM user WHERE GeneratedReferralCode = ?`;
  connection.query(checkQuery, [newReferralCode], (err, result) => {
    if (err) {
      return callback(err, null);
    }
    if (result.length > 0) {
      return getUniqueReferralCode(callback); // Generate a new one recursively
    } else {
      return callback(null, newReferralCode);
    }
  });
}

exports.createUser = (req, res, next) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) {
      return res.json({ message: "Error uploading avatar image", error: err });
    }

    const {
      name,
      package_id,
      email,
      phone,
      gender,
      Address,
      Pincode,
      referrerId,
      referralCode,
      password,
    } = req.body;
    const avatar = req.file ? req.file.filename : null;

    if (!name || !package_id || !email || !phone || !Address || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      getUniqueReferralCode((err, generatedReferralCode) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error generating referral code", error: err });
        }

        const userQuery = `
          INSERT INTO user (Name, PackageId, Email, Phone, Avatar, Address, Pincode, Password, GeneratedReferralCode, ReferrerId, reffercode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const userValues = [
          name,
          package_id,
          email,
          phone,
          avatar,
          Address,
          Pincode || null,
          hashedPassword,
          generatedReferralCode,
          referrerId || null,
          referralCode || null,
        ];

        connection.query(userQuery, userValues, (err, result) => {
          if (err) {
            return res.json({ message: "Error creating user", error: err });
          }

          const userId = result.insertId;
          const token = jwt.sign(
            { userId, email, name, package_id, password },
            JWT_SECRET,
            { expiresIn: "5h" }
          );

          res.cookie("UserauthToken", token, {
            httpOnly: true,
            sameSite: "Strict",
            maxAge: 2 * 60 * 60 * 1000,
          });

          const walletQuery = `INSERT INTO wallet (user_id, balance) VALUES (?, ?)`;
          connection.query(walletQuery, [userId, 0.0], (err, walletResult) => {
            if (err) {
              return res
                .status(500)
                .json({ message: "Error creating user wallet", error: err });
            }

            // ✅ Send email after successful signup
            const signupEmailContent = `
              <h2>Welcome to Our Platform, ${name}!</h2>
              <p>You have successfully signed up. Your account is now active.</p>
              <p>Enjoy our services.</p>
            `;
            sendEmail(
              email,
              "You are successfully signed up!",
              signupEmailContent
            );

            if (referralCode) {
              const referrerQuery = `SELECT userid, PackageId, Email FROM user WHERE GeneratedReferralCode = ?`;
              connection.query(
                referrerQuery,
                [referralCode],
                (err, referrerResult) => {
                  if (err || referrerResult.length === 0) {
                    return res.status(201).json({
                      message:
                        "User and wallet created successfully (no referrer found)",
                      userId,
                      walletId: walletResult.insertId,
                      success: true,
                    });
                  }

                  const referrerId = referrerResult[0].userid;
                  const referrerPackageId = referrerResult[0].PackageId;
                  const referrerEmail = referrerResult[0].Email;

                  returnCommissionMethod(
                    package_id,
                    referrerPackageId,
                    (err, referralCommission) => {
                      if (err) {
                        return res.json({
                          message: "Error calculating referral commission",
                          error: err,
                        });
                      }

                      const updateWalletQuery = `UPDATE wallet SET balance = balance + ? WHERE user_id = ?`;
                      connection.query(
                        updateWalletQuery,
                        [referralCommission, referrerId],
                        (err) => {
                          if (err) {
                            return res.status(500).json({
                              message: "Error updating referrer wallet",
                              error: err,
                            });
                          }

                          const fetchWalletIdQuery = `SELECT wallet_id FROM wallet WHERE user_id = ?`;
                          connection.query(
                            fetchWalletIdQuery,
                            [referrerId],
                            (err, walletRows) => {
                              if (err || walletRows.length === 0) {
                                return res.status(500).json({
                                  message: "Error fetching wallet ID",
                                  error: err,
                                });
                              }

                              const referrerWalletId = walletRows[0].wallet_id;

                              const transactionQuery = `
                        INSERT INTO wallettransactions (user_id,reffer_id, wallet_id, amount, transaction_type, description) 
                        VALUES (?,?, ?, ?, ?, ?)
                      `;
                              const transactionValues = [
                                userId,
                                referrerId,
                                referrerWalletId,
                                referralCommission,
                                "credit",
                                `Referral commission for user ${referrerId}`,
                              ];

                              connection.query(
                                transactionQuery,
                                transactionValues,
                                (err) => {
                                  if (err) {
                                    return res.status(500).json({
                                      message:
                                        "Error recording wallet transaction",
                                      error: err,
                                    });
                                  }
                                  console.log(userId);
                                  // ✅ Send email when referral commission is credited
                                  const referralEmailContent = `
                          <h2>Referral Bonus Credited!</h2>
                          <p>Congratulations! You have earned a referral bonus of ₹${referralCommission}.</p>
                          <p>Keep referring and earn more!</p>
                        `;
                                  sendEmail(
                                    referrerEmail,
                                    "Referral Bonus Credited!",
                                    referralEmailContent
                                  );

                                  res.status(201).json({
                                    message:
                                      "User and wallet created successfully with referral bonus",
                                    userId,
                                    walletId: walletResult.insertId,
                                    success: true,
                                  });
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            } else {
              res.status(201).json({
                success: true,
                message: "User and wallet created successfully",
                userId,
                walletId: walletResult.insertId,
              });
            }
          });
        });
      });
    } catch (hashError) {
      res.json({ message: "Error securing password", error: hashError });
    }
  });
};

exports.loginUser = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  // Fetch user from the database
  const userQuery = `SELECT userid, Name, Email, Password,PackageId FROM user WHERE Email = ?`;

  connection.query(userQuery, [email], async (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.userid,
        email: user.Email,
        name: user.Name,
        package_id: user.PackageId,
        password: password,
      },
      JWT_SECRET,
      {
        expiresIn: "5h",
      }
    );

    // Set token as an HTTP-only cookie
    res.cookie("UserauthToken", token, {
      httpOnly: true,
      sameSite: "Strict",
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    // Send response with user_id and user name
    res.status(200).json({
      success: true,
      message: "Login successful",
      user_id: user.userid,
      user_name: user.Name,
    });
  });
};
exports.validateUserCookie = (req, res) => {
  let token = req.cookies.UserauthToken; // Check if token is in cookies
  if (!token) {
    // If no token in cookies, check the Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]; // Extract token after "Bearer "
    }
  }
  console.log("Received token:", token);

  // Check if token exists
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    console.log(decoded);
    if (err) {
      console.error("Token verification failed:", err);
      return res.status(403).json({ message: "Forbidden: Invalid token" });
    }

    // If token verification is successful
    console.log("Token verified successfully:", decoded);
    return res.status(200).json({
      message: "Token verified successfully",
      user: decoded, // { userId, email }
    });
  });
};

exports.logoutUser = (req, res) => {
  // Clear the UserauthToken cookie
  res.clearCookie("UserauthToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure in production
    sameSite: "strict",
  });

  res.status(200).json({ message: "Logout successful" });
};
exports.getUserById = (req, res) => {
  const userId = req.params.user_id; // Assume user ID is provided as a URL parameter

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Query to fetch user details from the user table
  const userQuery = `
    SELECT 
      userid AS userId,
      Name AS name,
      PackageId AS packageId,
      Email AS email,
      Phone AS phone,
      Avatar AS avatar,
      Address AS Address,
      Pincode AS Pincode,
      GeneratedReferralCode AS generatedReferralCode,
      ReferrerId AS referrerId,
      reffercode AS referralCode
    FROM user
    WHERE userid = ?
  `;

  connection.query(userQuery, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching user details:", err);
      return res
        .status(500)
        .json({ message: "Error fetching user details", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userDetails = results[0];

    res.status(200).json({
      message: "User details retrieved successfully",
      user: {
        userId: userDetails.userId,
        name: userDetails.name,
        packageId: userDetails.packageId,
        email: userDetails.email,
        phone: userDetails.phone,

        avatar: userDetails.avatar,
        Address: userDetails.Address,
        Pincode: userDetails.Pincode,
        generatedReferralCode: userDetails.generatedReferralCode,
        referrerId: userDetails.referrerId,
        referralCode: userDetails.referralCode,
      },
    });
  });
};
exports.getUsersList = (req, res) => {
  // Query to fetch the required user details along with the wallet amount
  const usersQuery = `
    SELECT 
      u.userid AS userId,
      u.Name AS Name,
      u.GeneratedReferralCode AS GeneratedReferralCode,
      w.amount AS balance
    FROM user u
    LEFT JOIN wallet w ON u.userid = w.user_id
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
        userName: user.userName,
        generatedReferralCode: user.generatedReferralCode,
        walletAmount: user.walletAmount || 0, // Default to 0 if no wallet record exists
      })),
    });
  });
};

exports.updateUser = (req, res, next) => {
  // Handle avatar upload
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error uploading avatar image", error: err });
    }

    const userId = req.params.user_id; // Extract user ID from route params
    const {
      name,
      package_id,
      email,
      phone,
      gender,
      Address,
      Pincode,
      generatedReferralCode,
      referrerId,
      referralCode,
    } = req.body;

    const avatar = req.file ? req.file.filename : null; // Get the new avatar filename if provided

    // Validate required fields
    if (!userId || !name || !package_id || !email || !phone || !gender) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Prepare query and data for updating user details
    const updateUserQuery = `
      UPDATE user
      SET 
        Name = ?, 
        PackageId = ?, 
        Email = ?, 
        Phone = ?, 
        Gender = ?, 
        Avatar = COALESCE(?, Avatar), 
        Address = ?, 
        Pincode = ?, 
        GeneratedReferralCode = ?, 
        ReferrerId = ?, 
        reffercode = ?
      WHERE userid = ?
    `;

    const updateUserValues = [
      name,
      package_id,
      email,
      phone,
      gender,
      avatar,
      Address || null,
      Pincode || null,
      generatedReferralCode || null,
      referrerId || null,
      referralCode || null,
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

      // Handle referral code logic if provided
      if (referralCode) {
        const referrerQuery = `
          SELECT userid, PackageId FROM user WHERE GeneratedReferralCode = ?
        `;

        connection.query(
          referrerQuery,
          [referralCode],
          (err, referrerResult) => {
            if (err) {
              console.error("Error finding referrer:", err);
              return res.status(500).json({
                message: "Error processing referral code",
                error: err,
              });
            }

            if (referrerResult.length > 0) {
              const referrerId = referrerResult[0].userid;
              const referrerPackageId = referrerResult[0].PackageId;
              console.log(
                "Referrer Found:",
                referrerId,
                "-",
                referrerPackageId
              );

              returnCommissionMethod(
                package_id,
                referrerPackageId,
                (err, referralCommission) => {
                  if (err) {
                    return res.status(500).json({
                      message: "Error calculating referral commission",
                      error: err,
                    });
                  }
                  console.log("Referral Commission:", referralCommission);

                  // Update referrer's wallet
                  const updateWalletQuery = `
                UPDATE wallet SET balance = balance + ? WHERE user_id = ?
              `;
                  connection.query(
                    updateWalletQuery,
                    [referralCommission, referrerId],
                    (err) => {
                      if (err) {
                        console.error("Error updating referrer wallet:", err);
                        return res.status(500).json({
                          message: "Error updating referrer wallet",
                          error: err,
                        });
                      }

                      // Record wallet transaction
                      const transactionQuery = `
                  INSERT INTO wallettransactions (user_id, wallet_id, amount, transaction_type, description)
                  VALUES (?, (SELECT wallet_id FROM wallet WHERE user_id = ?), ?, ?, ?)
                `;
                      const transactionValues = [
                        referrerId,
                        referrerId,
                        referralCommission,
                        "credit",
                        `Referral commission for user ${userId}`,
                      ];

                      connection.query(
                        transactionQuery,
                        transactionValues,
                        (err) => {
                          if (err) {
                            console.error(
                              "Error recording wallet transaction:",
                              err
                            );
                            return res.status(500).json({
                              message: "Error recording wallet transaction",
                              error: err,
                            });
                          }

                          return res.status(200).json({
                            message:
                              "User details updated successfully with referral bonus applied",
                          });
                        }
                      );
                    }
                  );
                }
              );
            } else {
              return res.status(200).json({
                message:
                  "User details updated successfully (no referrer found)",
              });
            }
          }
        );
      } else {
        res.status(200).json({ message: "User details updated successfully" });
      }
    });
  });
};

exports.validateUser = async (req, res) => {
  const { email, phone } = req.body;

  try {
    const query = `SELECT Email, phone FROM user WHERE Email = ? OR phone = ?`;
    connection.query(query, [email, phone], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ verified: false, message: "Server error" });
      }

      if (results.length > 0) {
        let message = "";
        const existingUser = results[0];

        if (existingUser.Email === email && existingUser.phone === phone) {
          message = "Email and phone number already registered.";
        } else if (existingUser.Email === email) {
          message = "Email already registered.";
        } else if (existingUser.phone === phone) {
          message = "Phone number already registered.";
        }

        return res.json({ verified: false, message });
      }

      return res.json({ verified: true });
    });
  } catch (error) {
    console.error("Error validating user:", error);
    res.status(500).json({ verified: false, message: "Internal server error" });
  }
};
exports.upgradeUserPackage = (req, res) => {
  // const userId = req.params.user_id;
  const { userId, package_id } = req.body;

  if (!userId || !package_id) {
    return res
      .status(400)
      .json({ message: "User ID and new package ID are required" });
  }

  const updatePackageQuery = `
      UPDATE user SET PackageId = ? WHERE UserId = ?
  `;

  connection.query(updatePackageQuery, [package_id, userId], (err, result) => {
    if (err) {
      console.error("Error upgrading user package:", err);
      return res
        .status(500)
        .json({ message: "Error upgrading user package", error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User package upgraded successfully" });
  });
};

exports.updatePassword = async (req, res) => {
  const { user_id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "New password is required" });
  }

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password in the database
    const updateQuery = "UPDATE user SET Password = ? WHERE userid = ?";
    connection.query(updateQuery, [hashedPassword, user_id], (err, result) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error updating password", error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Password updated successfully" });
    });
  } catch (error) {
    res.status(500).json({ message: "Error securing password", error });
  }
};

// const Use = process.env.ADMIN_EMAIL;

// 📌 Nodemailer Setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // or 587
  secure: true, // true for port 465, false for port 587
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail ID
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Bypass certificate validation (NOT recommended for production)
  },
});

console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS);
// 📌 Simulated Database for OTPs
const otpStore = {};

// 📌 Step 1: Send OTP to Admin's Email
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  // Check if the user exists in the database
  const userQuery = "SELECT userId FROM user WHERE Email = ?";
  connection.query(userQuery, [email], async (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found. Please register." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;
    console.log("OTP sent:", otp);
    console.log("Email:", email);

    try {
      await transporter.sendMail({
        from: `"Admin OTP" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP for Login Into READGRO",
        html: `<p>Your OTP for processing credentials: <strong>${otp}</strong></p>`,
      });

      res.json({ success: true, message: "OTP sent to email" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "OTP email failed", error });
    }
  });
};

exports.VerifyOtp = (req, res) => {
  const { email, otp } = req.body;

  // Check if OTP exists for the provided email
  if (!otpStore[email]) {
    return res
      .status(400)
      .json({ success: false, message: "OTP not found. Request a new OTP." });
  }

  // Verify OTP
  if (otp !== otpStore[email]) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // Remove OTP after successful verification
  delete otpStore[email];

  // Fetch user details from the database
  const userQuery = `SELECT userid, Name, Email, PackageId FROM user WHERE Email = ?`;

  connection.query(userQuery, [email], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = results[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.userid,
        email: user.Email,
        name: user.Name,
        package_id: user.PackageId,
      },
      JWT_SECRET,
      { expiresIn: "5h" }
    );

    // Set token as an HTTP-only cookie
    res.cookie("UserauthToken", token, {
      httpOnly: true,
      sameSite: "Strict",
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
    });

    // Send response with user_id, name, and token
    res.status(200).json({
      success: true,
      message: "OTP verified successfully. User authenticated.",
      token,
      user_id: user.userid,
      user_name: user.Name,
    });
  });
};
