const connection = require("../backend");
// Insert User Bank Details
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
  
    // SQL query to insert data into the table
    const query =
      "INSERT INTO user_bank_details (user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id) VALUES (?, ?, ?, ?, ?, ?)";
  
    connection.query(
      query,
      [user_id, account_holder_name, ifsc_code, account_number, bank_name, upi_id],
      (err, result) => {
        if (err) {
          console.error("Error inserting user bank details:", err);
          return res.status(500).json({
            message: "An error occurred while inserting user bank details",
            error: err,
          });
        }
  
        res.status(201).json({
          message: "User bank details inserted successfully",
          ubdid: result.insertId, // Returns the ID of the newly created record
        });
      }
    );
  };
  // Retrieve User Bank Details
exports.getUserBankDetails = (req, res, next) => {
    const  user_id  = req.params.user_id;
  
    // Validation check
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
  
    // SQL query to fetch user bank details by user_id
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
        return res.status(404).json({ message: "No bank details found for this user" });
      }
  
      res.status(200).json({
        message: "User bank details retrieved successfully",
        bank_details: results, // Array of bank details for the given user_id
      });
    });
  };
  // Update User Bank Details
exports.updateUserBankDetails = (req, res, next) => {
    const  user_id  = req.params.user_id;
    const {
      account_holder_name,
      ifsc_code,
      account_number,
      bank_name,
      upi_id,
    } = req.body;
  
    // Validation check
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
  
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
      [account_holder_name, ifsc_code, account_number, bank_name, upi_id, user_id],
      (err, result) => {
        if (err) {
          console.error("Error updating user bank details:", err);
          return res.status(500).json({
            message: "An error occurred while updating user bank details",
            error: err,
          });
        }
        
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "No record found with the provided UBD ID" });
        }
  
        res.status(200).json({
          message: "User bank details updated successfully",
          affectedRows: result.affectedRows,
        });
      }
    );
  };
  
  