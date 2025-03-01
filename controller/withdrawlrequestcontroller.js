const connection = require("../backend");

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
            return res.status(404).json({ message: "Wallet not found for this user" });
        }

        const walletBalance = results[0].balance;

        // Step 2: Check if balance is sufficient
        if (walletBalance < withdrawAmount) {
            return res.status(400).json({ message: "Insufficient funds in wallet" });
        }

        // Step 3: Insert withdrawal request with status 'pending' and current timestamp
        const insertQuery = "INSERT INTO withdrawal_requests (user_id, amount, status, created_at) VALUES (?, ?, 'pending', NOW())";
        
        connection.query(insertQuery, [user_id, withdrawAmount], (err, result) => {
            if (err) {
                console.error("Error inserting withdrawal request:", err);
                return res.status(500).json({ message: "Internal server error" });
            }

            // Step 4: Deduct the withdrawal amount from wallet balance
            const updateWalletQuery = "UPDATE wallet SET balance = balance - ? WHERE user_id = ?";
            
            connection.query(updateWalletQuery, [withdrawAmount, user_id], (err, updateResult) => {
                if (err) {
                    console.error("Error updating wallet balance:", err);
                    return res.status(500).json({ message: "Error updating wallet balance" });
                }

                return res.status(201).json({ 
                    message: "Withdrawal request submitted successfully", 
                    status: "pending",
                    newBalance: walletBalance - withdrawAmount 
                });
            });
        });
    });
};

exports.getWithdrawalRequests = (req, res) => {
    console.log("get into WR")
    const { user_id } = req.params; // Get user_id from URL

    // Fetch withdrawal requests for the given user_id
    const requestQuery = "SELECT id, amount, status, created_at FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC";
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
        return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

    connection.query(walletQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching wallet balance:", err);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Wallet not found for this user" });
        }

        return res.status(200).json({ success: true, balance: results[0].balance });
    });
};

exports.deductWallet = (req, res) => {
    const { user_id, amount } = req.body; // Extract user_id and amount from request body

    if (!user_id || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "User ID and valid amount are required" });
    }

    // Step 1: Fetch current wallet balance
    const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

    connection.query(walletQuery, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching wallet balance:", err);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Wallet not found for this user" });
        }

        const currentBalance = results[0].balance;

        // Step 2: Check if balance is sufficient
        if (currentBalance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }

        // Step 3: Deduct the amount
        const updateQuery = "UPDATE wallet SET balance = balance - ? WHERE user_id = ?";

        connection.query(updateQuery, [amount, user_id], (updateErr, updateResults) => {
            if (updateErr) {
                console.error("Error updating wallet balance:", updateErr);
                return res.status(500).json({ success: false, message: "Failed to deduct balance" });
            }

            return res.status(200).json({ success: true, message: "Wallet balance deducted successfully", new_balance: currentBalance - amount });
        });
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
      return res.status(500).json({ message: "Error fetching earnings", error: err });
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
