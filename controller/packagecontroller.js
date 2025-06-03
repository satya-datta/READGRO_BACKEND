const connection = require("../backend");
require("dotenv").config();

// controller/packageController.js

const { deleteFile } = require("../utils/fileUtils");

// Helper function to delete old files safely
const safelyDeleteFile = (filePath) => {
  try {
    deleteFile(filePath);
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
};
// const multer = require("multer");

// // Configure multer storage
// const AWS = require("aws-sdk");
// const multer = require("multer");
// const multerS3 = require("multer-s3");
// const path = require("path");

// // Configure AWS
// AWS.config.update({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION, // e.g. 'us-east-1'
// });

// // Create S3 instance
// const s3 = new AWS.S3();

// // Configure multer-S3
// const upload = multer({
//   storage: multerS3({
//     s3: s3,
//     bucket: process.env.S3_BUCKET_NAME,
//     // acl: "public-read", // optional: allows public access to the uploaded image
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     key: function (req, file, cb) {
//       const ext = path.extname(file.originalname);
//       const filename = `${Date.now()}${ext}`;
//       cb(null, filename);
//     },
//   }),
// });

// const upload = multer({ storage: storage });
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

// Create Package with image upload
// Add this middleware to your route
exports.createPackage = (req, res, next) => {
  const { packageName, price, description, commission, discountPrice } =
    req.body;

  if (!req.file) {
    return res.status(400).json({ message: "Image is required." });
  }

  const imageUrl = req.file.location; // This is the S3 image URL

  // Save data in your database with imageUrl
  const query = `
    INSERT INTO packages (package_name, package_price, description, package_image, created_time, commission, discount_price)
    VALUES (?, ?, ?, ?, NOW(), ?, ?)
  `;

  connection.query(
    query,
    [packageName, price, description, imageUrl, commission, discountPrice],
    (err, result) => {
      if (err) {
        console.error("Error creating package:", err);
        return res.status(500).json({ message: "Error occurred", error: err });
      }

      res.status(201).json({
        message: "Package created successfully.",
        package_id: result.insertId,
        imageUrl,
      });
    }
  );
};
exports.updatePackageById = async (req, res) => {
  const { package_id } = req.params;
  const { packageName, price, description, commission, discountPrice } =
    req.body;

  if (!package_id) {
    return res.status(400).json({ message: "Package ID is required" });
  }

  if (!packageName || !price || !description || !commission || !discountPrice) {
    return res.status(400).json({ message: "All fields are required" });
  }

  let packageImage = null;

  // Upload new image if provided
  if (req.file && req.file.buffer) {
    try {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "packages" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      });

      packageImage = cloudinaryResult.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return res.status(500).json({
        message: "Failed to upload image to Cloudinary",
        error: err.message || err,
      });
    }
  }

  const query = packageImage
    ? `
      UPDATE packages 
      SET package_name = ?, package_price = ?, description = ?, commission = ?, discount_price = ?, package_image = ?
      WHERE package_id = ?
    `
    : `
      UPDATE packages 
      SET package_name = ?, package_price = ?, description = ?, commission = ?, discount_price = ?
      WHERE package_id = ?
    `;

  const values = packageImage
    ? [
        packageName,
        price,
        description,
        commission,
        discountPrice,
        packageImage,
        package_id,
      ]
    : [packageName, price, description, commission, discountPrice, package_id];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error("Error updating package:", err);
      return res
        .status(500)
        .json({ message: "Internal Server Error", error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json({
      message: "Package updated successfully",
      updatedFields: {
        packageName,
        price,
        description,
        commission,
        discountPrice,
        packageImage,
      },
    });
  });
};

exports.getCoursesByCourseIds = (req, res) => {
  const { course_ids } = req.body;

  // Validate input
  if (!Array.isArray(course_ids) || course_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "Valid array of course IDs is required" });
  }

  console.log("Fetching course details for multiple course_ids:", course_ids);

  // Create placeholders for SQL query based on the number of course_ids
  const placeholders = course_ids.map(() => "?").join(",");
  const query = `SELECT * FROM course WHERE course_id IN (${placeholders})`;

  connection.query(query, course_ids, (err, results) => {
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

    // Map through the results and format the response
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
};

// Controller method to delete a package and its related courses
exports.deletePackageAndCourses = async (req, res) => {
  const { package_id } = req.params;

  try {
    // Begin a transaction
    await connection.query("START TRANSACTION");

    // Delete related entries from package_courses table
    await connection.query("DELETE FROM package_courses WHERE package_id = ?", [
      package_id,
    ]);

    // Delete the package itself from the packages table
    await connection.query("DELETE FROM packages WHERE package_id = ?", [
      package_id,
    ]);

    // Commit the transaction
    await connection.query("COMMIT");

    res
      .status(200)
      .json({ message: "Package and related courses deleted successfully." });
  } catch (error) {
    // Rollback transaction on error
    await connection.query("ROLLBACK");
    console.error("Error deleting package:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the package." });
  }
};

// Function to get packages with their associated courses, including pagination info
exports.getPackagesWithCourses = (req, res, next) => {
  const { page = 1, limit = 5, searchTerm = "" } = req.query;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // SQL query to get the total number of packages that match the search term (for pagination)
  const countQuery = `
    SELECT COUNT(DISTINCT p.package_id) AS totalPackages
    FROM packages p
    LEFT JOIN package_courses pc ON p.package_id = pc.package_id
    LEFT JOIN course c ON pc.course_id = c.course_id
    WHERE p.package_name LIKE ?;
  `;

  // SQL query to get the packages with courses, applying pagination
  const query = `
    SELECT p.package_id, p.package_name, p.created_time, p.image_path, p.commission, c.course_name
    FROM packages p
    LEFT JOIN package_courses pc ON p.package_id = pc.package_id
    LEFT JOIN course c ON pc.course_id = c.course_id
    WHERE p.package_name LIKE ? 
    ORDER BY p.created_time DESC 
    LIMIT ? OFFSET ?;
  `;

  // Execute the query to get the total number of matching packages
  connection.query(countQuery, [`%${searchTerm}%`], (err, countResult) => {
    if (err) {
      console.error("Error fetching total packages count:", err);
      return res.status(500).json({
        message:
          "An error occurred while fetching the total number of packages.",
        error: err,
      });
    }

    // Calculate the total number of pages
    const totalPackages = countResult[0].totalPackages;
    const totalPages = Math.ceil(totalPackages / limit); // Round up the division result

    // Now, execute the query to fetch the paginated packages and their courses
    connection.query(
      query,
      [`%${searchTerm}%`, parseInt(limit), parseInt(offset)],
      (err, result) => {
        if (err) {
          console.error("Error fetching packages with courses:", err);
          return res.status(500).json({
            message: "An error occurred while fetching the packages.",
            error: err,
          });
        }

        // Combine the rows into the appropriate structure
        const packagesWithCourses = result.reduce((acc, row) => {
          const existingPackage = acc.find(
            (pkg) => pkg.package_id === row.package_id
          );

          if (existingPackage) {
            // Ensure the 'courses' array is always initialized
            if (!existingPackage.courses) {
              existingPackage.courses = [];
            }
            existingPackage.courses.push(row.course_name);
          } else {
            acc.push({
              package_id: row.package_id,
              package_name: row.package_name,
              created_time: row.created_time,
              image_path: row.image_path,
              courses: row.course_name ? [row.course_name] : [], // Handle empty courses
            });
          }

          return acc;
        }, []);

        // Respond with paginated results, including total pages
        res.status(200).json({
          packages: packagesWithCourses,
          totalPages: totalPages,
          currentPage: page,
        });
      }
    );
  });
};

//Remove courses that are mapped

exports.deleteCoursesFromPackage = (req, res, next) => {
  const { package_id } = req.params; // Get package ID from URL params
  const { courses } = req.body; // Get the array of course IDs from the request body

  if (!courses || courses.length === 0) {
    return res
      .status(400)
      .json({ message: "No courses selected for deletion." });
  }

  // Validate the existence of the package
  const checkPackageQuery = `SELECT * FROM packages WHERE package_id = ?`;
  connection.query(checkPackageQuery, [package_id], (err, result) => {
    if (err) {
      console.error("Error checking package:", err);
      return res.status(500).json({
        message: "An error occurred while checking the package.",
        error: err,
      });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Package not found." });
    }

    // Validate that the courses exist in the package_courses table
    const checkCoursesQuery = `SELECT * FROM package_courses WHERE package_id = ? AND course_id IN (?)`;
    connection.query(
      checkCoursesQuery,
      [package_id, courses],
      (err, result) => {
        if (err) {
          console.error("Error checking courses:", err);
          return res.status(500).json({
            message: "An error occurred while checking the courses.",
            error: err,
          });
        }

        // If no matching course entries are found in the package_courses table, return an error
        if (result.length === 0) {
          return res
            .status(404)
            .json({ message: "No matching courses found in the package." });
        }

        // Proceed to remove the selected courses from the package_courses table
        const deleteCoursesQuery = `DELETE FROM package_courses WHERE package_id = ? AND course_id IN (?)`;
        connection.query(
          deleteCoursesQuery,
          [package_id, courses],
          (err, result) => {
            if (err) {
              console.error("Error deleting courses:", err);
              return res.status(500).json({
                message: "An error occurred while deleting the courses.",
                error: err,
              });
            }

            res.status(200).json({
              message:
                "Selected courses removed from the package successfully.",
            });
          }
        );
      }
    );
  });
};

// Function to map selected courses to the package
exports.mapCoursesToPackage = (req, res, next) => {
  const { packageId, courses } = req.body;

  // Validation checks
  if (!packageId || !courses || courses.length === 0) {
    return res
      .status(400)
      .json({ message: "Package ID and selected courses are required." });
  }

  // Check if the package exists
  const checkPackageQuery = `SELECT * FROM packages WHERE package_id = ?`;
  connection.query(checkPackageQuery, [packageId], (err, result) => {
    if (err) {
      console.error("Error checking package:", err);
      return res.status(500).json({
        message: "An error occurred while checking the package.",
        error: err,
      });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Package not found." });
    }

    // Now check if all courses exist in the courses table
    const checkCoursesQuery = `SELECT * FROM course WHERE course_id IN (?)`;
    connection.query(checkCoursesQuery, [courses], (err, result) => {
      if (err) {
        console.error("Error checking courses:", err);
        return res.status(500).json({
          message: "An error occurred while checking the courses.",
          error: err,
        });
      }

      if (result.length !== courses.length) {
        return res
          .status(404)
          .json({ message: "One or more courses not found." });
      }

      // Now insert the courses into the package_courses table
      const mapCoursesQuery = `
        INSERT INTO package_courses (package_id, course_id)
        VALUES ?
      `;

      // Prepare the course values to be inserted
      const courseValues = courses.map((courseId) => [packageId, courseId]);

      connection.query(mapCoursesQuery, [courseValues], (err, result) => {
        if (err) {
          console.error("Error mapping courses:", err);
          return res.status(500).json({
            message: "An error occurred while mapping courses.",
            error: err,
          });
        }

        res.status(200).json({
          message: "Courses successfully mapped to the package.",
        });
      });
    });
  });
};

exports.getAllPackages = (req, res) => {
  const getPackagesQuery = `SELECT * FROM packages`;

  connection.query(getPackagesQuery, (err, results) => {
    if (err) {
      console.error("Error fetching packages:", err);
      return res.status(500).json({
        message: "An error occurred while fetching packages.",
        error: err,
      });
    }

    res.status(200).json(results);
  });
};

exports.getPackageDetailsById = (req, res) => {
  const { package_id } = req.params;

  if (!package_id) {
    return res.status(400).json({ message: "Package ID is required" });
  }

  const getPackageQuery = `SELECT * FROM packages WHERE package_id = ?`;

  connection.query(getPackageQuery, [package_id], (err, results) => {
    if (err) {
      console.error("Error fetching package details:", err);
      return res.status(500).json({
        message: "An error occurred while fetching package details.",
        error: err,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json(results[0]); // Return the first (and only) package
  });
};

exports.getPackageDetailsByName = (req, res) => {
  const { package_name } = req.params;

  if (!package_name) {
    return res.status(400).json({ message: "Package Name is required" });
  }

  const getPackageQuery = `SELECT * FROM packages WHERE package_name = ?`;

  connection.query(getPackageQuery, [package_name], (err, results) => {
    if (err) {
      console.error("Error fetching package details:", err);
      return res.status(500).json({
        message: "An error occurred while fetching package details.",
        error: err,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json(results[0]); // Return the first (and only) package
  });
};

// Function to map selected courses to a package (add courses)
exports.addCoursesToPackage = (req, res, next) => {
  const { packageId, courses } = req.body;

  // Validation checks
  if (!packageId || !courses || courses.length === 0) {
    return res
      .status(400)
      .json({ message: "Package ID and selected courses are required." });
  }

  // Check if the package exists
  const checkPackageQuery = `SELECT * FROM packages WHERE package_id = ?`;
  connection.query(checkPackageQuery, [packageId], (err, result) => {
    if (err) {
      console.error("Error checking package:", err);
      return res.status(500).json({
        message: "An error occurred while checking the package.",
        error: err,
      });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Package not found." });
    }

    // Now check if all courses exist in the courses table
    const checkCoursesQuery = `SELECT * FROM course WHERE course_id IN (?)`;
    connection.query(checkCoursesQuery, [courses], (err, result) => {
      if (err) {
        console.error("Error checking courses:", err);
        return res.status(500).json({
          message: "An error occurred while checking the courses.",
          error: err,
        });
      }

      if (result.length !== courses.length) {
        return res
          .status(404)
          .json({ message: "One or more courses not found." });
      }

      // Now insert the courses into the package_courses table
      const mapCoursesQuery = `
        INSERT INTO package_courses (package_id, course_id)
        VALUES ?
      `;

      // Prepare the course values to be inserted
      const courseValues = courses.map((courseId) => [packageId, courseId]);

      connection.query(mapCoursesQuery, [courseValues], (err, result) => {
        if (err) {
          console.error("Error adding courses:", err);
          return res.status(500).json({
            message: "An error occurred while adding courses.",
            error: err,
          });
        }

        res.status(200).json({
          message: "Courses successfully added to the package.",
        });
      });
    });
  });
};

exports.getPackageByUserId = (req, res, next) => {
  const userId = req.params.userId;

  const query = `
    SELECT 
        p.package_id, p.package_name, p.description, p.package_price, 
        p.created_time, p.package_image, p.commission 
    FROM user u
    INNER JOIN packages p ON u.PackageId = p.package_id
    WHERE u.UserId = ?;
`;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error retrieving user package details:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "No package found for this user" });
    }

    res.json(results[0]); // Sending first package as response
  });
};

// Fetching a single package by ID with associated courses
exports.getPackageById = (req, res, next) => {
  const { package_id } = req.params; // Get packageId from URL
  console.log("Received packageId:", package_id);

  if (!package_id) {
    return res.status(400).json({ message: "Package ID is missing!" });
  }

  const packageQuery = `
    SELECT p.package_id, p.package_name, p.package_price, p.description, p.created_time, p.commission, p.image_path,
           c.course_id, c.course_name
    FROM packages p
    LEFT JOIN package_courses pc ON p.package_id = pc.package_id
    LEFT JOIN course c ON pc.course_id = c.course_id
    WHERE p.package_id = ?;
  `;

  connection.query(packageQuery, [package_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "An error occurred while fetching the package details.",
        error: err,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Package not found." });
    }

    // Base URL for images (replace with your actual server URL or CDN)
    const baseImageUrl = "http://localhost:5000/uploads"; // Example: Replace with your actual URL

    // Organize package details and associated courses
    const packageDetails = results.reduce((acc, row) => {
      if (!acc) {
        acc = {
          package_id: row.package_id,
          package_name: row.package_name,
          package_price: row.package_price,
          description: row.description,
          commission: row.commission,
          image_path: row.image_path
            ? `${baseImageUrl}/${row.image_path}`
            : null, // Full URL to image
          created_time: row.created_time,
          courses: [],
        };
        // Log the image path to ensure it's correct
        console.log("Image Path:", acc.image_path);
      }

      if (row.course_id) {
        acc.courses.push({
          course_id: row.course_id,
          course_name: row.course_name,
        });
      }

      return acc;
    }, null);

    res.status(200).json(packageDetails);
  });
};

exports.getCourseMapping = (req, res, next) => {
  const packageId = req.params.package_id;
  const query = `
    SELECT course_id 
    FROM package_courses 
    WHERE package_id = ? 
    ORDER BY map_id ASC
  `;

  connection.query(query, [packageId], (err, results) => {
    if (err) {
      console.error("Error fetching course mapping:", err);
      return res.status(500).json({
        message: "An error occurred while fetching the course mapping.",
        error: err,
      });
    }

    res.status(200).json(results); // Send back course_id values ordered by map_id
  });
};

exports.getAllCourses = (req, res, next) => {
  const query = "SELECT course_id, course_name FROM course";

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching courses:", err);
      return res.status(500).json({
        message: "An error occurred while fetching the courses.",
        error: err,
      });
    }

    res.status(200).json(results); // Send back the list of courses
  });
};

exports.createPackageWithCourses = async (req, res, next) => {
  const imageFile = req.file;

  if (!imageFile || !imageFile.buffer) {
    return res.status(400).json({ message: "Image is required." });
  }

  const { packageName, price, description, commission, discountPrice } =
    req.body;
  const courses = JSON.parse(req.body.courses || "[]");

  if (
    !packageName ||
    !price ||
    !description ||
    !commission ||
    !courses ||
    courses.length === 0
  ) {
    return res.status(400).json({
      message: "All fields, including selected courses, are required.",
    });
  }

  // Upload image to Cloudinary using stream
  let imageUrl;
  try {
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "packages" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      streamifier.createReadStream(imageFile.buffer).pipe(stream);
    });

    imageUrl = cloudinaryResult.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({
      message: "Failed to upload image to Cloudinary",
      error: err.message || err,
    });
  }

  // Insert package details into the database
  const packageQuery = `
    INSERT INTO packages (package_name, package_price, description, package_image, created_time, commission, discount_price)
    VALUES (?, ?, ?, ?, NOW(), ?, ?)
  `;

  connection.query(
    packageQuery,
    [packageName, price, description, imageUrl, commission, discountPrice],
    (err, result) => {
      if (err) {
        console.error("Error creating package:", err);
        return res.status(500).json({
          message: "An error occurred while creating the package.",
          error: err,
        });
      }

      const packageId = result.insertId;

      const checkCoursesQuery = `SELECT course_id FROM course WHERE course_id IN (?)`;
      connection.query(checkCoursesQuery, [courses], (err, result) => {
        if (err) {
          console.error("Error checking courses:", err);
          return res.status(500).json({
            message: "An error occurred while checking courses.",
            error: err,
          });
        }

        if (result.length !== courses.length) {
          return res
            .status(404)
            .json({ message: "One or more courses not found." });
        }

        const mapCoursesQuery = `INSERT INTO package_courses (package_id, course_id) VALUES ?`;
        const courseValues = courses.map((courseId) => [packageId, courseId]);

        connection.query(mapCoursesQuery, [courseValues], (err) => {
          if (err) {
            console.error("Error mapping courses:", err);
            return res.status(500).json({
              message: "An error occurred while mapping courses.",
              error: err,
            });
          }

          res.status(201).json({
            message: "Package created and courses mapped successfully.",
            package_id: packageId,
            imageUrl,
          });
        });
      });
    }
  );
};
