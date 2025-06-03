// routes/packageRouter.js
const express = require("express");
const connection = require("../backend");
// const multer = require("multer");
require("dotenv").config();
const packageController = require("../controller/packagecontroller");
const validatePackage = require("../middlewares/validatePackage");
// const upload = require("../middlewares/upload"); // Multer upload instance
const Packagerouter = express.Router();
// const AWS = require("aws-sdk");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

// Route to create package
Packagerouter.post(
  "/create-package",
  upload.single("packageImage"),
  validatePackage,
  packageController.createPackage
);
Packagerouter.get("/getallpackages", packageController.getAllPackages);

// Route for mapping courses to a package
Packagerouter.post("/course-mapping", packageController.mapCoursesToPackage);
Packagerouter.post(
  "/create-package_withcourses",
  upload.single("packageImage"),
  packageController.createPackageWithCourses
);

// Route to get packages with courses
// Define the route for fetching packages with courses
Packagerouter.get(
  "/getuserpackage/:userId",
  packageController.getPackageByUserId
);
Packagerouter.get(
  "/packages-with-courses",
  packageController.getPackagesWithCourses
);
Packagerouter.get(
  "/getcoursemappings/:package_id",
  packageController.getCourseMapping
);
Packagerouter.get(
  "/getpackage/:package_id",
  packageController.getPackageDetailsById
);
Packagerouter.get(
  "/getpackagebyname/:package_name",
  packageController.getPackageDetailsByName
);
// Route to fetch a single package by ID
// Packagerouter.get(
//   "/edit_package/:package_id",
//   packageController.getPackageById
// );
Packagerouter.post("/getcoursedetails", (req, res) => {
  const { course_ids } = req.body;

  if (!Array.isArray(course_ids) || course_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "Valid array of course IDs is required" });
  }

  console.log("Fetching course details for multiple course_ids:", course_ids);

  const placeholders = course_ids.map(() => "?").join(",");
  const query = `
    SELECT * FROM course 
    WHERE course_id IN (${placeholders}) 
    ORDER BY FIELD(course_id, ${placeholders})
  `;

  const values = [...course_ids, ...course_ids]; // For IN and FIELD()

  connection.query(query, values, (err, results) => {
    if (err) {
      console.error("Error fetching courses:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No courses found for the provided IDs" });
    }

    const courses = results.map((course) => {
      const {
        course_id,
        course_name,
        course_description,
        instructor,
        course_image,
      } = course;
      return {
        id: course_id,
        name: course_name,
        description: course_description,
        instructor: instructor,
        image: course_image,
      };
    });

    res.status(200).json({
      message: "Courses fetched successfully",
      courses: courses,
    });
  });
});

// Route to update a package by ID
//Packagerouter.put("/edit_package/:package_id", packageController.updatePackageById);
// Update package with image
Packagerouter.put(
  "/edit_package/:package_id",
  upload.single("packageImage"),
  validatePackage,
  packageController.updatePackageById
);

// Route to delete a package and its related courses
Packagerouter.delete(
  "/delete-package/:package_id",
  packageController.deletePackageAndCourses
);

// // Route to update a package by ID (PUT method)
// Packagerouter.put("/edit_package/:package_id", upload.single('image'), packageController.updatePackageById);

// Route to delete selected courses from a package
Packagerouter.delete(
  "/remove_courses/:package_id",
  packageController.deleteCoursesFromPackage
);

// Route for adding courses to a package

Packagerouter.post("/add_courses", packageController.addCoursesToPackage);

// Route to get all available courses
Packagerouter.get("/courses", packageController.getAllCourses);

module.exports = Packagerouter;
