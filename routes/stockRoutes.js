import express from "express";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import DeliveryChallan from "../models/DeliveryChallan.js";

const router = express.Router();

// Get all products with stock info
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stock details for a product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const movements = await StockMovement.find({ productId: req.params.id }).sort({ createdAt: -1 }).limit(50);

    res.json({
      product,
      movements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add stock in
router.post("/:id/stock-in", async (req, res) => {
  try {
    const { quantity, date, doc, notes } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const qty = Number(quantity);
    const balanceBefore = product.stock;
    product.stock += qty;
    await product.save();

    // Parse date - if it's a date string like "2026-05-10", it will be converted to Date
    let movementDate = new Date();
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        movementDate = parsedDate;
      }
    }

    await StockMovement.create({
      productId: product._id,
      productName: product.name,
      type: "in",
      quantity: qty,
      reason: "manual_in",
      date: movementDate,
      doc: doc || "",
      notes: notes || "",
      balanceBefore,
      balanceAfter: product.stock,
    });

    res.json({ message: "Stock added", product });
  } catch (err) {
    console.error("Stock in error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Remove stock out
router.post("/:id/stock-out", async (req, res) => {
  try {
    const { quantity, date, doc, notes } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const qty = Number(quantity);
    
    if (product.stock < qty) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${product.stock}, Requested: ${qty}` 
      });
    }

    const balanceBefore = product.stock;
    product.stock -= qty;
    await product.save();

    // Parse date - if it's a date string like "2026-05-10", it will be converted to Date
    let movementDate = new Date();
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        movementDate = parsedDate;
      }
    }

    await StockMovement.create({
      productId: product._id,
      productName: product.name,
      type: "out",
      quantity: qty,
      reason: "manual_out",
      date: movementDate,
      doc: doc || "",
      notes: notes || "",
      balanceBefore,
      balanceAfter: product.stock,
    });

    res.json({ message: "Stock removed", product });
  } catch (err) {
    console.error("Stock out error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get stock movements for a product
router.get("/:id/movements", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const movements = await StockMovement.find({ productId: req.params.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockMovement.countDocuments({ productId: req.params.id });

    res.json({
      data: movements,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stock activity for a product (with customer details for DC movements)
router.get("/:id/activity", async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Fetch all movements for the product
    const movements = await StockMovement.find({ productId: req.params.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Enrich movements with customer data for DC-related movements
    const enrichedMovements = await Promise.all(
      movements.map(async (movement) => {
        const movementObj = movement.toObject();

        // If this movement is related to a delivery challan, fetch customer details
        if (
          movementObj.reason &&
          movementObj.reason.startsWith("dc_") &&
          movementObj.referenceId
        ) {
          try {
            const dc = await DeliveryChallan.findById(movementObj.referenceId)
              .populate("customerId", "name")
              .lean();

            if (dc) {
              movementObj.dcNumber = dc.dcNumber;
              movementObj.customerName = dc.customerName;
              movementObj.customerId = dc.customerId;
            }
          } catch (err) {
            console.error("Error fetching DC details:", err);
          }
        }

        return movementObj;
      })
    );

    const total = await StockMovement.countDocuments({ productId: req.params.id });

    res.json({
      product,
      data: enrichedMovements,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("Stock activity error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get low stock products
router.get("/dashboard/low-stock", async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$minStockLevel"] },
    }).sort({ stock: 1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
