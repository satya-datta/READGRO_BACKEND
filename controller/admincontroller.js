const connection = require("../backend");
const jwt = require("jsonwebtoken"); // Make sure to install this package
const cookieParser = require("cookie-parser"); // Ensure this middleware is used in your app
const JWT_SECRET = "AUTHENTICATED"; // Store this securely in environment variables

// Authenticate Admin
exports.authadmin = (req, res, next) => {
  const { email, password } = req.body;
  console.log("Enter authentication");

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  // Query the database to check admin credentials
  connection.query(
    "SELECT * FROM admin_details WHERE email = ? AND password = ?",
    [email, password],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }

      // If admin found
      if (results.length > 0) {
        console.log("Successful");
        const admin = results[0];

        // Generate a JWT token
        const token = jwt.sign(
          { id: admin.id, email: admin.email }, // Payload
          JWT_SECRET, // Secret key
          { expiresIn: "2h" } // Token expiry
        );

        // Set the token as an HTTP-only cookie
        res.cookie("adminToken", token, {
          httpOnly: true, // Prevent access to the cookie via JavaScript
          secure: process.env.NODE_ENV === "production", // Use secure cookies in production
          sameSite: "strict", // Prevent CSRF
          maxAge: 2 * 60 * 60 * 1000, // 2 hours
        });

        // Send success response
        return res.status(200).json({
          message: "Authentication successful",
          admin: { id: admin.id, email: admin.email, name: admin.name },
        });
      } else {
        console.log("Unsuccessful");
        // If admin not found
        return res.status(401).json({ message: "Unknown admin" });
      }
    }
  );
};
exports.validateAdminCookie = (req, res) => {
  const token = req.cookies.adminToken;

  // Check if token exists
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Token verification failed:", err);
      return res.status(403).json({ message: "Forbidden: Invalid token" });
    }

    // If token verification is successful
    console.log("Token verified successfully:", decoded);
    return res.status(200).json({
      message: "Token verified successfully",
      admin: decoded, // { id, email }
    });
  });
};
exports.LogoutAdmin = (req, res) => {
  // Clear the adminToken cookie
  res.clearCookie("adminToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
    sameSite: "strict",
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
      return res.status(400).json({ message: "Image upload failed", error: err });
    }

    const { course_name, created_time, course_description, instructor } = req.body;

    // Validation checks (optional)
    if (!course_name || !course_description || !instructor) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get the image path (if provided)
    const course_image = req.file ? req.file.filename : null;

    // SQL query with course_image
    const query = "INSERT INTO course (course_name, created_time, course_description, instructor, course_image) VALUES (?, NOW(), ?, ?, ?);";

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
  const query = "INSERT INTO topics (topic_name, video_url, course_id) VALUES (?, ?, ?)";
  
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
    return res.status(400).json({ message: "Both topic_name and video_url are required" });
  }

  // Update query
  const query = "UPDATE topics SET topic_name = ?, video_url = ? WHERE topic_id = ?";

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
      return res.status(500).json({ message: "Internal Server Error", error: err });
    }
 
    res.status(200).json({ message: "Courses fetched successfully", courses: results });
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
      return res.status(500).json({ message: "Internal Server Error", error: err });
    }

    res.status(200).json({ message: "Topics fetched successfully", topics: results });
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
      return res.status(500).json({ message: "Internal Server Error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Extracting the course details
    const courseDetails = results[0]; // Assuming `course_id` is unique
    const { course_name, course_description, instructor,course_image } = courseDetails;

    res.status(200).json({
      message: "Course fetched successfully",
      course: {
        id: course_id,
        name: course_name,
        description: course_description,
        instructor: instructor,
        image:course_image
      },
    });
  });
};
 