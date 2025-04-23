const connection = require("../backend");
const jwt = require("jsonwebtoken"); // Make sure to install this package
const cookieParser = require("cookie-parser"); // Ensure this middleware is used in your app
const JWT_SECRET = "AUTHENTICATED"; // Store this securely in environment variables
const connection2 = require("../backend");
const nodemailer = require("nodemailer");
require("dotenv").config();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const bcrypt = require("bcryptjs");

exports.authadmin = (req, res, next) => {
  const { email, password } = req.body;
  console.log("Enter authentication");

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  // Query the database to get the admin's hashed password
  connection.query(
    "SELECT * FROM admin_details WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      // If no admin found
      if (results.length === 0) {
        console.log("Admin not found");
        return res.status(401).json({ message: "Unknown admin" });
      }

      const admin = results[0];

      // Compare entered password with stored hashed password
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (!passwordMatch) {
        console.log("Invalid password");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      console.log("Successful authentication");

      // Generate a JWT token
      const token = jwt.sign(
        { id: admin.id, email: admin.email }, // Payload
        JWT_SECRET, // Secret key
        { expiresIn: "2h" } // Token expiry
      );
      console.log(token);
      // Set the token as an HTTP-only cookie
      res.cookie("adminToken", token, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 2 * 60 * 60 * 1000,
        // path: "/",
        // domain: ".readgro-backend.onrender.com", // or your domain
      });

      // Send success response
      return res.status(200).json({
        message: "Authentication successful",
        admin: { id: admin.id, email: admin.email, name: admin.name },
      });
    }
  );
};
exports.validateAdminCookie = (req, res) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1]; // Format: "Bearer <token>"

  console.log("Received admin token:", token);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden: Invalid token" });
    }

    return res.status(200).json({
      message: "Token verified successfully",
      admin: decoded,
    });
  });
};
exports.LogoutAdmin = (req, res) => {
  // Clear the adminToken cookie
  res.clearCookie("adminToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
    sameSite: "None",
    secure: true,
  });

  res.status(200).json({ message: "Logout successful" });
};

// Create Course
const multer = require("multer");
const path = require("path");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Directory where images will be stored
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage });

// Controller for creating a course
exports.createCourse = (req, res, next) => {
  upload.single("course_image")(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ message: "Image upload failed", error: err });
    }

    const { course_name, created_time, course_description, instructor } =
      req.body;

    // Validation checks (optional)
    if (!course_name || !course_description || !instructor) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get the image path (if provided)
    const course_image = req.file ? req.file.filename : null;

    // SQL query with course_image
    const query =
      "INSERT INTO course (course_name, created_time, course_description, instructor, course_image) VALUES (?, NOW(), ?, ?, ?);";

    connection.query(
      query,
      [course_name, course_description, instructor, course_image],
      (err, result) => {
        if (err) {
          console.error("Error creating course:", err);
          return res.status(500).json({
            message: "An error occurred while creating the course",
            error: err,
          });
        }

        res.status(201).json({
          message: "Course created successfully",
          course_id: result.insertId, // Returns the ID of the newly created course
        });
      }
    );
  });
};

// Create Topic
exports.createTopic = (req, res, next) => {
  const { topic_name, video_url, course_id } = req.body;

  // Validation checks (optional)
  if (!topic_name || !video_url || !course_id) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Corrected query with quotes
  const query =
    "INSERT INTO topics (topic_name, video_url, course_id) VALUES (?, ?, ?)";

  connection.query(query, [topic_name, video_url, course_id], (err, result) => {
    if (err) {
      console.error("Error creating topic:", err);
      return res.status(500).json({
        message: "An error occurred while creating the topic",
        error: err,
      });
    }

    res.status(201).json({
      message: "Topic created successfully",
      topic_id: result.insertId, // Returns the ID of the newly created topic
    });
  });
};
// Update Topic (Only topic_name and video_url)
exports.updateTopic = (req, res, next) => {
  const { topic_name, video_url } = req.body;
  const { topic_id } = req.params; // Get topic ID from URL params

  // Validation checks
  if (!topic_name || !video_url) {
    return res
      .status(400)
      .json({ message: "Both topic_name and video_url are required" });
  }

  // Update query
  const query =
    "UPDATE topics SET topic_name = ?, video_url = ? WHERE topic_id = ?";

  connection.query(query, [topic_name, video_url, topic_id], (err, result) => {
    if (err) {
      console.error("Error updating topic:", err);
      return res.status(500).json({
        message: "An error occurred while updating the topic",
        error: err,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.status(200).json({
      message: "Topic updated successfully",
    });
  });
};

exports.getAllCourses = (req, res) => {
  const query = "SELECT * FROM course";

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching courses:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    res
      .status(200)
      .json({ message: "Courses fetched successfully", courses: results });
  });
};

exports.getTopicsByCourseId = (req, res) => {
  const { course_id } = req.params;

  // Validate input
  if (!course_id) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  const query = "SELECT * FROM topics WHERE course_id = ?";
  console.log("get topics");
  connection.query(query, [course_id], (err, results) => {
    if (err) {
      console.error("Error fetching topics:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    res
      .status(200)
      .json({ message: "Topics fetched successfully", topics: results });
  });
};
exports.getPackagesByCourse = (req, res) => {
  const { course_id } = req.params; // Get course_id from request parameters

  const query = `
    SELECT DISTINCT p.package_id, p.package_name
    FROM packages p
    INNER JOIN package_courses pc ON p.package_id = pc.package_id
    WHERE pc.course_id = ?;
  `;

  connection.query(query, [course_id], (err, results) => {
    if (err) {
      console.error("Error fetching packages:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    res.status(200).json({
      message: "Packages fetched successfully",
      packages: results,
    });
  });
};

exports.getCourseByCourseId = (req, res) => {
  const { course_id } = req.params;

  // Validate input
  if (!course_id) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  console.log("Fetching course details");

  const query = "SELECT * FROM course WHERE course_id = ?";

  connection.query(query, [course_id], (err, results) => {
    if (err) {
      console.error("Error fetching course:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Extracting the course details
    const courseDetails = results[0]; // Assuming `course_id` is unique
    const { course_name, course_description, instructor, course_image } =
      courseDetails;

    res.status(200).json({
      message: "Course fetched successfully",
      course: {
        id: course_id,
        name: course_name,
        description: course_description,
        instructor: instructor,
        image: course_image,
      },
    });
  });
};

const axios = require("axios");

exports.Getadmindashboard = async (req, res) => {
  try {
    console.log("Fetching admin dashboard data...");

    // 📌 Fetch Total Users
    const [users] = await connection2.execute(
      "SELECT COUNT(*) AS totalUsers FROM user"
    );

    // 📌 Fetch Total Packages
    const [packages] = await connection2.execute(
      "SELECT COUNT(*) AS totalPackages FROM packages"
    );

    // 📌 Fetch Total Courses
    const [courses] = await connection2.execute(
      "SELECT COUNT(*) AS totalCourses FROM course"
    );

    // 📌 Fetch Razorpay Account Balance
    let razorpayBalance = 0;
    try {
      const response = await axios.get(
        "https://api.razorpay.com/v1/accounts/balance",
        {
          auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET },
        }
      );
      razorpayBalance = response.data.balance / 100; // Convert from paisa to INR
    } catch (error) {
      console.error("Error fetching Razorpay balance:", error.message);
    }

    // 📌 Send Response
    res.status(200).json({
      message: "Admin Dashboard Data Fetched Successfully",
      data: {
        totalUsers: users[0].totalUsers,
        totalPackages: packages[0].totalPackages,
        totalCourses: courses[0].totalCourses,
        razorpayBalance: razorpayBalance, // Balance in INR
      },
    });
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getAdminDetails = (req, res) => {
  // Query to fetch admin details
  const query = `SELECT id, email, name, phone_number FROM admin_details `;

  connection.query(query, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Database error", error: err });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(result[0]); // Send admin details
  });
};

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
      subject: "Your OTP for Change Credentials",
      html: `<p>Your OTP for processing data : <strong>${otp}</strong></p>`,
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "OTP email failed", error });
  }
};

exports.updateAdmin = async (req, res) => {
  const { email, name, phone_number, password, otp } = req.body;
  console.log(email, name, phone_number, password);
  console.log(otp);
  console.log(otpStore);

  // Verify OTP
  if (otp !== otpStore[ADMIN_EMAIL]) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  try {
    // Since the frontend is already hashing the password, use it directly
    let hashedPassword = password || null;

    // Update query
    const query = `
      UPDATE admin_details 
      SET email = ?, name = ?, phone_number = ?, password = COALESCE(?, password) where id=1
    `;

    connection.query(
      query,
      [email, name, phone_number, hashedPassword],
      (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }
        res.status(200).json({ message: "Admin details updated successfully" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const otpStore2 = {};

// 📌 Step 1: Send OTP to Admin's Email
exports.sendloginOtp = async (req, res) => {
  const { email } = req.body;

  // Check if the user exists in the database
  const userQuery = "SELECT id FROM admin_details WHERE email = ?";
  connection.query(userQuery, [email], async (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin  not found." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore2[email] = otp;
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
  if (!otpStore2[email]) {
    return res
      .status(400)
      .json({ success: false, message: "OTP not found. Request a new OTP." });
  }

  // Verify OTP
  if (otp !== otpStore2[email]) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // Remove OTP after successful verification
  delete otpStore2[email];

  // Fetch admin details from the database
  const adminQuery = `SELECT id, name, email FROM admin_details WHERE email = ?`;

  connection.query(adminQuery, [email], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Database error", error: err });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const admin = results[0];

    // Generate JWT token for admin
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
      },
      JWT_SECRET,
      { expiresIn: "5h" }
    );

    // Set token as an HTTP-only cookie for admin authentication
    res.cookie("adminToken", token, {
      httpOnly: true,
      sameSite: "None", // Required for cross-origin cookies
      maxAge: 2 * 60 * 60 * 1000, // 2 hours
      secure: true, // Required for HTTPS
    });

    // Send response with admin details
    res.status(200).json({
      success: true,
      message: "OTP verified successfully. Admin authenticated.",
      token,
      admin_id: admin.id,
      admin_name: admin.name,
    });
  });
};

// Controller for updating a website hero entry with 3 images
exports.updateWebsiteHero = (req, res, next) => {
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ message: "Image upload failed", error: err });
    }

    const { id } = 1; // Get the ID from the request parameters

    // Get the image paths (if provided)
    const image1 = req.files.image1 ? req.files.image1[0].filename : null;
    const image2 = req.files.image2 ? req.files.image2[0].filename : null;
    const image3 = req.files.image3 ? req.files.image3[0].filename : null;

    //Build the update query dynamically.
    let query = "UPDATE webheroimages SET ";
    const queryParams = [];

    if (image1) {
      query += "image1 = ?, ";
      queryParams.push(image1);
    }

    if (image2) {
      query += "image2 = ?, ";
      queryParams.push(image2);
    }

    if (image3) {
      query += "image3 = ?, ";
      queryParams.push(image3);
    }

    //Remove the trailing comma and space.
    query = query.slice(0, -2);

    query += " WHERE id = 1;";
    queryParams.push(id);

    // SQL query to update image paths in the website_hero table
    connection.query(query, queryParams, (err, result) => {
      if (err) {
        console.error("Error updating website hero entry:", err);
        return res.status(500).json({
          message: "An error occurred while updating the website hero entry",
          error: err,
        });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Website hero entry not found" });
      }

      res.status(200).json({
        message: "Website hero entry updated successfully",
      });
    });
  });
};

exports.getWebsiteHeroImages = (req, res) => {
  const query = "SELECT image1, image2, image3 FROM webheroimages;"; // Or add a WHERE clause if you need specific records

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error retrieving website hero images:", err);
      return res.status(500).json({
        message: "An error occurred while retrieving website hero images",
        error: err,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No website hero images found" });
    }

    // Process the results
    const imageNames = results.map((row) => ({
      image1: row.image1,
      image2: row.image2,
      image3: row.image3,
    }));

    res.status(200).json(imageNames);
  });
};
