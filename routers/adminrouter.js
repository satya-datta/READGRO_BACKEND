const router = require("express").Router();
const admincontroller = require("../controller/admincontroller");
const connection = require("../backend");
const jwt = require("jsonwebtoken");

// Secret key for JWT signing (use environment variables)
const JWT_SECRET = process.env.JWT_SECRET || "AUTHENTICATED";

const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const AWS = require("aws-sdk");
// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, // e.g. 'us-east-1'
});

// Create S3 instance
const s3 = new AWS.S3();

// Configure multer-S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    // acl: "public-read", // optional: allows public access to the uploaded image
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}${ext}`;
      cb(null, filename);
    },
  }),
});
router.put(
  "/updatecoursedetails/:course_id",
  upload.single("course_image"),
  (req, res) => {
    const { course_id } = req.params;
    const { course_name, course_description, instructor } = req.body;
    const course_image = req.file ? req.file.location : null;

    // Validate input
    if (!course_id) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    if (!course_name || !course_description || !instructor) {
      return res.status(400).json({ message: "All fields are required" });
    }

    console.log("Updating course details");

    // If an image is uploaded, update the image along with other fields
    const query = course_image
      ? `
      UPDATE course 
      SET course_name = ?, course_description = ?, instructor = ?, course_image = ?
      WHERE course_id = ?
    `
      : `
      UPDATE course 
      SET course_name = ?, course_description = ?, instructor = ?
      WHERE course_id = ?
    `;

    const values = course_image
      ? [course_name, course_description, instructor, course_image, course_id]
      : [course_name, course_description, instructor, course_id];

    connection.query(query, values, (err, result) => {
      if (err) {
        console.error("Error updating course:", err);
        return res
          .status(500)
          .json({ message: "Internal Server Error", error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.status(200).json({
        message: "Course updated successfully",
        updatedFields: {
          course_name,
          course_description,
          instructor,
          course_image,
        },
      });
    });
  }
);

router.put("/updatetopic/:topic_id", admincontroller.updateTopic);

router.post("/create-topic", admincontroller.createTopic);
router.delete("/delete-topic/:topic_id", (req, res) => {
  const { topic_id } = req.params;

  // Validate input
  if (!topic_id) {
    return res.status(400).json({ message: "Topic ID is required" });
  }

  console.log("Deleting topic");

  const query = "DELETE FROM topics WHERE topic_id = ?";

  connection.query(query, [topic_id], (err, result) => {
    if (err) {
      console.error("Error deleting topic:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.status(200).json({
      message: "Topic deleted successfully",
      deletedTopicId: topic_id,
    });
  });
});

// Middleware to protect routes
const authenticate = (req, res, next) => {
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

    // Attach admin details to the request object
    req.admin = decoded; // Example: { id, email }
    next(); // Proceed to the next middleware/route handler
  });
};

// Public routes (do not require authentication)
router.post("/authadmin", admincontroller.authadmin);
router.post("/logout", (req, res) => {
  // Clear the adminToken cookie
  res.clearCookie("adminToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
    sameSite: "Lax",
  });

  res.status(200).json({ message: "Logout successful" });
});
router.get("/auth/validate", admincontroller.validateAdminToken);

// Protected routes (require authentication)
// router.post("/create-course", authenticate, admincontroller.createCourse);
// router.get("/getallcourses", authenticate, admincontroller.getAllCourses);
// router.get("/gettopics/:course_id", authenticate, admincontroller.getTopicsByCourseId);
// router.get("/getspecific_course/:course_id", authenticate, admincontroller.getCourseByCourseId);
router.post(
  "/create-course",
  upload.single("course_image"),
  admincontroller.createCourse
);

router.get("/getadmindashboard", admincontroller.Getadmindashboard);
router.get("/getadmindetails", admincontroller.getAdminDetails);
router.post("/update-admin", admincontroller.updateAdmin);
router.post("/admin-cred-send-otp", admincontroller.sendOtp);

router.get("/getallcourses", admincontroller.getAllCourses);

router.get(
  "/getpackagebycourse/:course_id",
  admincontroller.getPackagesByCourse
);

router.get("/gettopics/:course_id", admincontroller.getTopicsByCourseId);
router.get(
  "/getspecific_course/:course_id",
  admincontroller.getCourseByCourseId
);
router.delete("/delete-course/:course_id", (req, res) => {
  const { course_id } = req.params;

  // Validate input
  if (!course_id) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  console.log("Deleting course");

  const query = "DELETE FROM course WHERE course_id = ?";

  connection.query(query, [course_id], (err, result) => {
    if (err) {
      console.error("Error deleting course:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({
      message: "Course deleted successfully",
      deletedCourseId: course_id,
    });
  });
});

router.post("/sendadmin-otp", admincontroller.sendloginOtp);
router.post("/verifyadmin-otp", admincontroller.VerifyOtp);
router.put("/website_hero", admincontroller.updateWebsiteHero);
router.get("/getwebsite_hero", admincontroller.getWebsiteHeroImages);

module.exports = router;
