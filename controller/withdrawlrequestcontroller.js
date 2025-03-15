const connection = require("../backend");
const Razorpay = require("razorpay");
require("dotenv").config();
const axios = require("axios");

const crypto = require("crypto");
const nodemailer = require("nodemailer");
exports.CreateWR = (req, res) => {
  const { user_id } = req.params; // Get user_id from URL
  const { withdrawAmount } = req.body; // Get withdrawal amount from request body

  if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ message: "Invalid withdrawal amount" });
  }

  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

  connection.query(walletQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching wallet balance:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "Wallet not found for this user" });
    }

    const walletBalance = results[0].balance;

    // Step 2: Check if balance is sufficient
    if (walletBalance < withdrawAmount) {
      return res.status(400).json({ message: "Insufficient funds in wallet" });
    }

    // Step 3: Insert withdrawal request with status 'pending' and current timestamp
    const insertQuery =
      "INSERT INTO withdrawal_requests (user_id, amount, status, created_at) VALUES (?, ?, 'pending', NOW())";

    connection.query(insertQuery, [user_id, withdrawAmount], (err, result) => {
      if (err) {
        console.error("Error inserting withdrawal request:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      // Step 4: Deduct the withdrawal amount from wallet balance
      const updateWalletQuery =
        "UPDATE wallet SET balance = balance - ? WHERE user_id = ?";

      connection.query(
        updateWalletQuery,
        [withdrawAmount, user_id],
        (err, updateResult) => {
          if (err) {
            console.error("Error updating wallet balance:", err);
            return res
              .status(500)
              .json({ message: "Error updating wallet balance" });
          }

          return res.status(201).json({
            message: "Withdrawal request submitted successfully",
            status: "pending",
            newBalance: walletBalance - withdrawAmount,
          });
        }
      );
    });
  });
};

exports.getWithdrawalRequests = (req, res) => {
  console.log("get into WR");
  const { user_id } = req.params; // Get user_id from URL

  // Fetch withdrawal requests for the given user_id
  const requestQuery =
    "SELECT id, amount, status, created_at FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC";
  connection.query(requestQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching withdrawal requests:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    // if (results.length === 0) {
    //     return res.json({ message: "No withdrawal requests found for this user" });
    // }

    return res.status(200).json({ withdrawalRequests: results });
  });
};

exports.getTransactionsByRefferId = (req, res) => {
  console.log("Fetching transactions for referrer ID");
  const { reffer_id } = req.params; // Get reffer_id from URL

  // Query to fetch transactions based on reffer_id
  const query = `
        SELECT * FROM wallettransactions  WHERE reffer_id = ? ORDER BY created_at DESC`;

  connection.query(query, [reffer_id], (err, results) => {
    if (err) {
      console.error("Error fetching transactions:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    return res.status(200).json({ transactions: results });
  });
};

exports.getWalletDetails = (req, res) => {
  const { user_id } = req.params; // Extract user_id from request parameters

  if (!user_id) {
    return res
      .status(400)
      .json({ success: false, message: "User ID is required" });
  }

  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

  connection.query(walletQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching wallet balance:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Wallet not found for this user" });
    }

    return res.status(200).json({ success: true, balance: results[0].balance });
  });
};

exports.deductWallet = (req, res) => {
  const { user_id, amount } = req.body; // Extract user_id and amount from request body

  if (!user_id || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "User ID and valid amount are required",
    });
  }

  // Step 1: Fetch current wallet balance
  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

  connection.query(walletQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching wallet balance:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Wallet not found for this user" });
    }

    const currentBalance = results[0].balance;

    // Step 2: Check if balance is sufficient
    if (currentBalance < amount) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient wallet balance" });
    }

    // Step 3: Deduct the amount
    const updateQuery =
      "UPDATE wallet SET balance = balance - ? WHERE user_id = ?";

    connection.query(
      updateQuery,
      [amount, user_id],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.error("Error updating wallet balance:", updateErr);
          return res
            .status(500)
            .json({ success: false, message: "Failed to deduct balance" });
        }

        return res.status(200).json({
          success: true,
          message: "Wallet balance deducted successfully",
          new_balance: currentBalance - amount,
        });
      }
    );
  });
};

exports.getEarnings = (req, res) => {
  const { reffer_id } = req.params;

  if (!reffer_id) {
    return res.status(400).json({ message: "Wallet ID is required" });
  }

  const earningsQuery = `
    SELECT 
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount ELSE 0 END) AS todayEarnings,
      SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN amount ELSE 0 END) AS last7DaysEarnings,
      SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN amount ELSE 0 END) AS last30DaysEarnings,
      SUM(amount) AS overallEarnings
    FROM wallettransactions 
    WHERE reffer_id = ?
  `;

  connection.query(earningsQuery, [reffer_id], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ message: "Error fetching earnings", error: err });
    }

    const earnings = results[0];

    res.status(200).json({
      success: true,
      todayEarnings: earnings.todayEarnings || 0,
      last7DaysEarnings: earnings.last7DaysEarnings || 0,
      last30DaysEarnings: earnings.last30DaysEarnings || 0,
      overallEarnings: earnings.overallEarnings || 0,
    });
  });
};

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

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
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
  otpStore[ADMIN_EMAIL] = otp;
  console.log("otp  sent");
  console.log(ADMIN_EMAIL);
  try {
    await transporter.sendMail({
      from: `"Admin OTP" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: "Your OTP for Payout",
      html: `<p>Your OTP for processing payout: <strong>${otp}</strong></p>`,
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "OTP email failed", error });
  }
};

// 📌 Step 2: Verify OTP and Process RazorpayX Payout
const connection2 = require("../connection2"); // Using your MySQL connection

const { sendEmail } = require("../emailService"); // Import sendEmail function

exports.ProcessPayout = async (req, res) => {
  const { userId, amount, otp, requestId } = req.body;
  console.log("Processing payout for userId:", userId);

  // Verify OTP
  if (otp !== otpStore[ADMIN_EMAIL]) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  const conn = await connection2.getConnection();
  try {
    // 📌 Start MySQL Transaction
    await conn.beginTransaction();

    // 📌 Fetch User's Email
    const [user] = await conn.execute(
      "SELECT email FROM user WHERE userId = ?",
      [userId]
    );

    if (!user.length) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }
    const userEmail = user[0].email;

    // 📌 Fetch Fund Account ID from `user_bankdetails`
    const [bankDetails] = await conn.execute(
      "SELECT fund_account_id FROM user_bank_details WHERE user_id = ?",
      [userId]
    );

    if (!bankDetails.length || !bankDetails[0].fund_account_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid Fund Account or User Not Found",
      });
    }
    const fund_account_id = bankDetails[0].fund_account_id;

    // 📌 Create RazorpayX Payout
    const payoutData = {
      account_number: "035322010000341", // RazorpayX Test Account
      fund_account_id: fund_account_id,
      amount: amount * 100, // Convert to paisa
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
    };

    const response = await axios.post(
      "https://api.razorpay.com/v1/payouts",
      payoutData,
      {
        auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET },
        headers: { "Content-Type": "application/json" },
      }
    );

    // 📌 Update Withdrawal Status to Approved
    await conn.execute(
      "UPDATE withdrawal_requests SET status = 'Approved' WHERE id = ?",
      [requestId]
    );

    // 📌 Send Approval Email
    await sendEmail(
      userEmail,
      "Withdrawal Approved",
      `
      <h3>Dear User,</h3>
      <p>Your withdrawal request of <b>₹${amount}</b> has been <b>Approved</b> and processed successfully.</p>
      <p>Transaction ID: ${response.data.id}</p>
      <p>Thank you for using our service.</p>
    `
    );

    await conn.commit();
    res.json({
      success: true,
      message: "Payout processed successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Payout Processing Error:", error);

    // 📌 Rollback transaction in case of failure
    await conn.rollback();

    // 📌 Refund money back to user's wallet
    await conn.execute(
      "UPDATE wallet SET balance = balance + ?, last_updated = NOW() WHERE user_id = ?",
      [amount, userId]
    );

    // 📌 Update Withdrawal Request Status to Rejected
    await conn.execute(
      "UPDATE withdrawal_requests SET status = 'Rejected' WHERE id = ?",
      [requestId]
    );

    // 📌 Send Rejection Email
    await sendEmail(
      userEmail,
      "Withdrawal Rejected",
      `
      <h3>Dear User,</h3>
      <p>Your withdrawal request of <b>₹${amount}</b> has been <b>Rejected</b>.</p>
      <p>The amount has been refunded to your wallet.</p>
      <p>If you have any questions, please contact support.</p>
    `
    );

    await conn.commit();
    res.status(500).json({
      success: false,
      message: "Payout failed",
      error: error.response?.data || error.message,
    });
  } finally {
    conn.release();
  }
};

exports.getRazorpayPayments = async (req, res) => {
  try {
    const auth = Buffer.from(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const response = await axios.get(`https://api.razorpay.com/v1/payments`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const payments = response.data.items;

    res.status(200).json({
      success: true,
      totalPayments: payments.length,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount / 100, // Convert from paise to rupees
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        created_at: new Date(payment.created_at * 1000), // Convert timestamp to readable date
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Razorpay payments",
      error: error.message,
    });
  }
};
const fetchPayouts = async () => {
  try {
    const response = await axios.get("https://api.razorpay.com/v1/payouts", {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    });

    return response.data; // Returning the payout data
  } catch (error) {
    console.error(
      "Error fetching payouts:",
      error.response?.data || error.message
    );
    throw error;
  }
};

exports.getPayouts = async (req, res) => {
  try {
    const payouts = await fetchPayouts(); // Call the function to fetch payouts
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
};