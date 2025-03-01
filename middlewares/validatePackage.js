const validatePackage = (req, res, next) => {
    const { packageName, price, description, commission } = req.body;
  
    if (!packageName || !price || !description || commission === undefined) {
      return res.status(400).json({ message: "All fields are required." });
    }
  
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ message: "Price must be a valid positive number." });
    }
  
    if (isNaN(commission) || commission < 0 || commission > 100) {
      return res.status(400).json({ message: "Commission must be a valid percentage (0-100)." });
    }
  
    next();
  };
  
  module.exports = validatePackage;
  