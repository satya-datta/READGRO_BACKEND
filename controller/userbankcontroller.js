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

exports.insertUserBankDetails = (req, res, next) => {
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

  console.log("Account number:", account_number);

  // Step 1: First create Razorpay contact
  axios
    .post(
      "https://api.razorpay.com/v1/contacts",
      {
        name: account_holder_name,
        email: `user${user_id}@example.com`,
        contact: "9999999999",
        type: "customer",
      },
      {
        auth: {
          username: process.env.RAZORPAYX_TESTKEY_ID,
          password: process.env.RAZORPAYX_TESTKEY_SECRET,
        },
      }
    )
    .then((contactResponse) => {
      const contact_id = contactResponse.data.id;
      console.log("Razorpay Contact ID:", contact_id);

      // Step 2: Create Razorpay fund account
      return axios
        .post(
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
              username: process.env.RAZORPAYX_TESTKEY_ID,
              password: process.env.RAZORPAYX_TESTKEY_SECRET,
            },
          }
        )
        .then((fundAccountResponse) => {
          const fund_account_id = fundAccountResponse.data.id;
          console.log("Razorpay Fund Account ID:", fund_account_id);

          // Step 3: Only NOW insert into database since Razorpay succeeded
          const encryptedAccountNumber = encrypt(account_number);
          const encryptedUpiId = encrypt(upi_id);
          const insertQuery = `
        INSERT INTO user_bank_details 
        (user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id, contact_id, fund_account_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

          return new Promise((resolve, reject) => {
            connection.query(
              insertQuery,
              [
                user_id,
                account_holder_name,
                ifsc_code,
                encryptedAccountNumber,
                bank_name,
                encryptedUpiId,
                contact_id,
                fund_account_id,
              ],
              (err, result) => {
                if (err) {
                  reject({ type: "DATABASE_ERROR", error: err });
                } else {
                  resolve(result.insertId);
                }
              }
            );
          });
        });
    })
    .then((ubdid) => {
      // Success - everything completed
      res.status(201).json({
        message: "User bank details added & RazorpayX setup completed",
        ubdid: ubdid,
      });
    })
    .catch((error) => {
      console.error("Error in process:", error);

      // Handle different error types
      if (error.response?.data?.error?.code === "BAD_REQUEST_ERROR") {
        // Razorpay validation errors (like invalid IFSC)
        res.status(400).json({
          message: "Bank validation failed",
          error: error.response.data.error.description,
          details: error.response.data.error,
        });
      } else if (error.type === "DATABASE_ERROR") {
        // Database errors
        res.status(500).json({
          message: "Database operation failed",
          error: error.error.message,
        });
      } else {
        // Other errors
        res.status(500).json({
          message: "Bank setup failed",
          error: error.response?.data || error.message,
        });
      }
    });
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
exports.updateUserBankDetails = async (req, res, next) => {
  const user_id = req.params.user_id;
  const { account_holder_name, ifsc_code, account_number, bank_name, upi_id } =
    req.body;

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

  try {
    // Step 1: Fetch existing contact_id from DB
    const [existingData] = await new Promise((resolve, reject) => {
      connection.query(
        `SELECT contact_id FROM user_bank_details WHERE user_id = ?`,
        [user_id],
        (err, results) => {
          if (err) return reject(err);
          if (results.length === 0)
            return reject({ code: 404, message: "User not found" });
          resolve(results);
        }
      );
    });

    const existing_contact_id = existingData.contact_id;

    // Step 2: Create a new fund account
    const fundAccountResponse = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: existing_contact_id,
        account_type: "bank_account",
        bank_account: {
          name: account_holder_name,
          ifsc: ifsc_code,
          account_number: account_number,
        },
      },
      {
        auth: {
          username: process.env.RAZORPAYX_TESTKEY_ID,
          password: process.env.RAZORPAYX_TESTKEY_SECRET,
        },
      }
    );

    const new_fund_account_id = fundAccountResponse.data.id;

    // Step 3: Encrypt sensitive data
    const encryptedAccountNumber = encrypt(account_number);
    const encryptedUpiId = encrypt(upi_id);

    // Step 4: Update DB with new info
    const updateQuery = `
      UPDATE user_bank_details 
      SET 
        account_holder_name = ?, 
        ifsc_code = ?, 
        account_number = ?, 
        bank_name = ?, 
        upi_id = ?, 
        fund_account_id = ?
      WHERE user_id = ?
    `;

    connection.query(
      updateQuery,
      [
        account_holder_name,
        ifsc_code,
        encryptedAccountNumber,
        bank_name,
        encryptedUpiId,
        new_fund_account_id,
        user_id,
      ],
      (err, result) => {
        if (err) {
          console.error("DB update error:", err);
          return res.status(500).json({
            message: "An error occurred while updating user bank details",
            error: err,
          });
        }

        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ message: "No record found for given User ID" });
        }

        res.status(200).json({
          message: "User bank details updated successfully with RazorpayX",
          affectedRows: result.affectedRows,
          fund_account_id: new_fund_account_id,
        });
      }
    );
  } catch (error) {
    console.error("Update Razorpay bank details error:", error);

    if (error.code === 404) {
      return res.status(404).json({ message: error.message });
    }

    if (error.response?.data?.error?.code === "BAD_REQUEST_ERROR") {
      return res.status(400).json({
        message: "Bank validation failed",
        error: error.response.data.error.description,
      });
    }

    return res.status(500).json({
      message: "Failed to update Razorpay fund account",
      error: error.response?.data || error.message,
    });
  }
};
