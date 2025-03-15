// const connection = require("../backend");
// // Insert User Bank Details
// exports.insertUserBankDetails = (req, res, next) => {
//     const {
//       user_id,
//       account_holder_name,
//       ifsc_code,
//       account_number,
//       bank_name,
//       upi_id,
//     } = req.body;

//     // Validation checks
//     if (
//       !user_id ||
//       !account_holder_name ||
//       !ifsc_code ||
//       !account_number ||
//       !bank_name ||
//       !upi_id
//     ) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // SQL query to insert data into the table
//     const query =
//       "INSERT INTO user_bank_details (user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id) VALUES (?, ?, ?, ?, ?, ?)";

//     connection.query(
//       query,
//       [user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id],
//       (err, result) => {
//         if (err) {
//           console.error("Error inserting user bank details:", err);
//           return res.status(500).json({
//             message: "An error occurred while inserting user bank details",
//             error: err,
//           });
//         }

//         res.status(201).json({
//           message: "User bank details inserted successfully",
//           ubdid: result.insertId, // Returns the ID of the newly created record
//         });
//       }
//     );
//   };
const crypto = require("crypto");
const axios = require("axios");
const connection = require("../backend"); // Your MySQL connection
require("dotenv").config();
const connection2 = require("../connection2");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "SECRETKEY"; // Must be 32 bytes
const IV_LENGTH = 16; // AES block size

// Function to Encrypt Data
const encrypt = (text) => {
  const iv = crypto.randomBytes(16); // Generate a 16-byte IV
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted; // Ensure IV is stored properly
};

const decrypt = (text) => {
  let textParts = text.split(":");
  let ivHex = textParts.shift(); // Extract IV as hex string
  let iv = Buffer.from(ivHex, "hex"); // Convert IV to Buffer
  let encryptedText = Buffer.from(textParts.join(":"), "hex"); // Convert ciphertext to Buffer

  console.log("IV (hex):", ivHex);
  console.log("IV Length:", iv.length);
  console.log("Encrypted Text:", encryptedText.toString("hex"));

  if (iv.length !== 16) {
    throw new Error(`Invalid IV length: ${iv.length}. Expected 16 bytes.`);
  }

  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

exports.insertUserBankDetails = async (req, res, next) => {
  const {
    user_id,
    account_holder_name,
    ifsc_code,
    account_number,
    bank_name,
    upi_id,
  } = req.body;

  // Validation checks
  if (
    !user_id ||
    !account_holder_name ||
    !ifsc_code ||
    !account_number ||
    !bank_name ||
    !upi_id
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  console.log(account_number);
  try {
    // ✅ Step 1: Insert Bank Details in MySQL
    const encryptedAccountNumber = encrypt(account_number);
    const encryptedUpiId = encrypt(upi_id);
    const query = `
      INSERT INTO user_bank_details 
      (user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection2.execute(query, [
      user_id,
      account_holder_name,
      ifsc_code,
      encryptedAccountNumber,
      bank_name,
      encryptedUpiId,
    ]);

    const ubdid = result.insertId; // Get inserted bank details ID
    console.log("Inserted Bank ID:", ubdid);

    // ✅ Step 2: Create Contact in RazorpayX
    const contactResponse = await axios.post(
      "https://api.razorpay.com/v1/contacts",
      {
        name: account_holder_name,
        email: `user${user_id}@example.com`, // Dummy email
        contact: "9999999999", // Dummy phone number
        type: "customer",
      },
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    const contact_id = contactResponse.data.id; // Razorpay Contact ID

    // ✅ Step 3: Create Fund Account in RazorpayX
    const fundAccountResponse = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: contact_id,
        account_type: "bank_account",
        bank_account: {
          name: account_holder_name,
          ifsc: ifsc_code,
          account_number: account_number,
        },
      },
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    const fund_account_id = fundAccountResponse.data.id; // Razorpay Fund Account ID

    // ✅ Step 4: Update MySQL with Contact & Fund Account IDs
    const updateQuery = `
      UPDATE user_bank_details 
      SET contact_id = ?, fund_account_id = ?  
      WHERE ubdid = ?
    `;

    await connection2.execute(updateQuery, [
      contact_id,
      fund_account_id,
      ubdid,
    ]);

    res.status(201).json({
      message: "User bank details added & RazorpayX setup completed",
      ubdid: ubdid,
      contact_id: contact_id,
      fund_account_id: fund_account_id,
    });
  } catch (error) {
    console.error(
      "Error in RazorpayX setup:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Error setting up RazorpayX for user",
      error: error.response?.data || error.message,
    });
  }
};

// Retrieve User Bank Details
exports.getUserBankDetails = (req, res, next) => {
  const user_id = req.params.user_id;

  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const query = "SELECT * FROM user_bank_details WHERE user_id = ?";

  connection.query(query, [user_id], (err, results) => {
    if (err) {
      console.error("Error retrieving user bank details:", err);
      return res.status(500).json({
        message: "An error occurred while retrieving user bank details",
        error: err,
      });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No bank details found for this user" });
    }

    // Decrypt each bank detail safely
    results.forEach((row) => {
      try {
        row.account_number = decrypt(row.account_number) || "Decryption Error";
      } catch (error) {
        console.error("Account number decryption failed:", error.message);
        row.account_number = "Decryption Error";
      }

      try {
        row.upi_id = decrypt(row.upi_id) || "Decryption Error";
      } catch (error) {
        console.error("UPI ID decryption failed:", error.message);
        row.upi_id = "Decryption Error";
      }
    });

    res.status(200).json({
      message: "User bank details retrieved successfully",
      bank_details: results,
    });
  });
};

// Update User Bank Details
exports.updateUserBankDetails = (req, res, next) => {
  const user_id = req.params.user_id;
  const { account_holder_name, ifsc_code, account_number, bank_name, upi_id } =
    req.body;

  // Validation check
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Encrypt sensitive fields
  const encryptedAccountNumber = encrypt(account_number);
  const encryptedUpiId = encrypt(upi_id);

  // SQL query to update user bank details
  const query = `
      UPDATE user_bank_details 
      SET 
        account_holder_name = ?, 
        ifsc_code = ?, 
        account_number = ?, 
        bank_name = ?, 
        upi_id = ?
      WHERE user_id = ?
    `;

  connection.query(
    query,
    [
      account_holder_name,
      ifsc_code,
      encryptedAccountNumber,
      bank_name,
      encryptedUpiId,
      user_id,
    ],
    (err, result) => {
      if (err) {
        console.error("Error updating user bank details:", err);
        return res.status(500).json({
          message: "An error occurred while updating user bank details",
          error: err,
        });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "No record found with the provided User ID" });
      }

      res.status(200).json({
        message: "User bank details updated successfully",
        affectedRows: result.affectedRows,
      });
    }
  );
};
