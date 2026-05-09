import express from "express";
import DC from "../models/DeliveryChallan.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

const router = express.Router();

// Helper function to deduct stock when DC is created
const deductStockForDC = async (dc) => {
  for (const item of dc.items) {
    if (item.productId) {
      const product = await Product.findById(item.productId);
      if (product) {
        const balanceBefore = product.stock;
        product.stock -= item.qty;
        await product.save();

        await StockMovement.create({
          productId: product._id,
          productName: product.name,
          type: "out",
          quantity: item.qty,
          reason: "dc_created",
          referenceId: dc._id.toString(),
          referenceNumber: dc.dcNumber,
          balanceBefore,
          balanceAfter: product.stock,
        });
      }
    }
  }
};

// Helper function to restore stock when DC is deleted
const restoreStockForDC = async (dc) => {
  for (const item of dc.items) {
    if (item.productId) {
      const product = await Product.findById(item.productId);
      if (product) {
        const balanceBefore = product.stock;
        product.stock += item.qty;
        await product.save();

        await StockMovement.create({
          productId: product._id,
          productName: product.name,
          type: "in",
          quantity: item.qty,
          reason: "dc_deleted",
          referenceId: dc._id.toString(),
          referenceNumber: dc.dcNumber,
          balanceBefore,
          balanceAfter: product.stock,
        });
      }
    }
  }
};

// Helper function to handle stock changes during DC update
const updateStockForDC = async (oldDC, newDC) => {
  // Create maps for easy lookup
  const oldItemsMap = new Map(oldDC.items.map(item => [item.productId?.toString() || item._id?.toString(), item.qty]));
  const newItemsMap = new Map(newDC.items.map(item => [item.productId?.toString() || item._id?.toString(), item.qty]));

  // Get all product IDs involved
  const allProductIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

  for (const productIdStr of allProductIds) {
    const oldQty = oldItemsMap.get(productIdStr) || 0;
    const newQty = newItemsMap.get(productIdStr) || 0;
    const qtyDiff = newQty - oldQty;

    if (qtyDiff !== 0) {
      const product = await Product.findById(productIdStr);
      if (product) {
        const balanceBefore = product.stock;
        
        if (qtyDiff > 0) {
          // More quantity in new DC, deduct more stock
          product.stock -= qtyDiff;
          await StockMovement.create({
            productId: product._id,
            productName: product.name,
            type: "out",
            quantity: qtyDiff,
            reason: "dc_updated",
            referenceId: newDC._id.toString(),
            referenceNumber: newDC.dcNumber,
            notes: `Quantity increased from ${oldQty} to ${newQty}`,
            balanceBefore,
            balanceAfter: product.stock,
          });
        } else {
          // Less quantity in new DC, restore stock
          product.stock += Math.abs(qtyDiff);
          await StockMovement.create({
            productId: product._id,
            productName: product.name,
            type: "in",
            quantity: Math.abs(qtyDiff),
            reason: "dc_updated",
            referenceId: newDC._id.toString(),
            referenceNumber: newDC.dcNumber,
            notes: `Quantity decreased from ${oldQty} to ${newQty}`,
            balanceBefore,
            balanceAfter: product.stock,
          });
        }
        
        await product.save();
      }
    }
  }
};

// Create DC
router.post("/", async (req, res) => {
  try {
    const newDC = new DC(req.body);
    await newDC.save();
    
    // Deduct stock
    await deductStockForDC(newDC);
    
    res.status(201).json(newDC);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all DCs (with optional search/filter)
router.get("/", async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { dcNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];
    }

    const total = await DC.countDocuments(query);
    const data = await DC.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single DC
router.get("/:id", async (req, res) => {
  try {
    const dc = await DC.findById(req.params.id);
    if (!dc) return res.status(404).json({ error: "DC not found" });
    res.json(dc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update DC
router.put("/:id", async (req, res) => {
  try {
    const oldDC = await DC.findById(req.params.id);
    if (!oldDC) return res.status(404).json({ error: "DC not found" });

    const newDC = await DC.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    
    // Update stock based on changes
    await updateStockForDC(oldDC, newDC);
    
    res.json(newDC);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update status only
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const dc = await DC.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!dc) return res.status(404).json({ error: "DC not found" });
    res.json(dc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete DC
router.delete("/:id", async (req, res) => {
  try {
    const dc = await DC.findByIdAndDelete(req.params.id);
    if (!dc) return res.status(404).json({ error: "DC not found" });
    
    // Restore stock
    await restoreStockForDC(dc);
    
    res.json({ message: "DC deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get("/stats/summary", async (req, res) => {
  try {
    const total = await DC.countDocuments();
    const delivered = await DC.countDocuments({ status: "delivered" });
    const invoice = await DC.countDocuments({ status: "invoice" });
    const cancelled = await DC.countDocuments({ status: "cancelled" });
    const recent = await DC.find().sort({ createdAt: -1 }).limit(5);
    res.json({ total, delivered, invoice, cancelled, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
