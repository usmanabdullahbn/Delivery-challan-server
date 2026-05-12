import express from "express";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

const router = express.Router();

// Helper function to increment stock when purchase is received
const incrementStockForPurchase = async (purchase) => {
  for (const item of purchase.items) {
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
          reason: "purchase_received",
          referenceId: purchase._id.toString(),
          referenceNumber: purchase.purchaseNumber,
          balanceBefore,
          balanceAfter: product.stock,
        });
      }
    }
  }
};

// Helper function to decrement stock if purchase is cancelled
const decrementStockForPurchase = async (purchase) => {
  for (const item of purchase.items) {
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
          reason: "purchase_cancelled",
          referenceId: purchase._id.toString(),
          referenceNumber: purchase.purchaseNumber,
          balanceBefore,
          balanceAfter: product.stock,
        });
      }
    }
  }
};

// Helper function to handle stock changes when purchase is updated
const updateStockForPurchase = async (oldPurchase, newPurchase) => {
  const oldStatus = oldPurchase.status;
  const newStatus = newPurchase.status;

  // If transitioning to received status, increment stock
  if (newStatus === "received" && oldStatus !== "received") {
    await incrementStockForPurchase(newPurchase);
  }
  // If transitioning from received to pending/cancelled, decrement stock
  else if (oldStatus === "received" && newStatus !== "received") {
    await decrementStockForPurchase(oldPurchase);
  }
  // If status remains received, handle qty changes
  else if (oldStatus === "received" && newStatus === "received") {
    // Create maps for item qty lookup
    const oldItemsMap = new Map(
      oldPurchase.items.map((item) => [
        item.productId?.toString() || item._id?.toString(),
        item.qty,
      ])
    );
    const newItemsMap = new Map(
      newPurchase.items.map((item) => [
        item.productId?.toString() || item._id?.toString(),
        item.qty,
      ])
    );

    // Get all product IDs involved
    const allProductIds = new Set([
      ...oldItemsMap.keys(),
      ...newItemsMap.keys(),
    ]);

    for (const productIdStr of allProductIds) {
      const oldQty = oldItemsMap.get(productIdStr) || 0;
      const newQty = newItemsMap.get(productIdStr) || 0;
      const qtyDiff = newQty - oldQty;

      if (qtyDiff !== 0) {
        const product = await Product.findById(productIdStr);
        if (product) {
          const balanceBefore = product.stock;

          if (qtyDiff > 0) {
            // More quantity in new purchase, increment stock
            product.stock += qtyDiff;
            await StockMovement.create({
              productId: product._id,
              productName: product.name,
              type: "in",
              quantity: qtyDiff,
              reason: "purchase_updated",
              referenceId: newPurchase._id.toString(),
              referenceNumber: newPurchase.purchaseNumber,
              notes: `Quantity increased from ${oldQty} to ${newQty}`,
              balanceBefore,
              balanceAfter: product.stock,
            });
          } else {
            // Less quantity in new purchase, decrement stock
            product.stock -= Math.abs(qtyDiff);
            await StockMovement.create({
              productId: product._id,
              productName: product.name,
              type: "out",
              quantity: Math.abs(qtyDiff),
              reason: "purchase_updated",
              referenceId: newPurchase._id.toString(),
              referenceNumber: newPurchase.purchaseNumber,
              notes: `Quantity decreased from ${oldQty} to ${newQty}`,
              balanceBefore,
              balanceAfter: product.stock,
            });
          }

          await product.save();
        }
      }
    }
  }
};

// Create purchase order
router.post("/", async (req, res) => {
  try {
    const purchase = new Purchase(req.body);
    await purchase.save();
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all purchases with pagination
router.get("/", async (req, res) => {
  try {
    const { search, status, page = 1, limit = 15 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { purchaseNumber: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const purchases = await Purchase.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Purchase.countDocuments(query);

    res.json({
      data: purchases,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single purchase
router.get("/:id", async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate("vendorId")
      .populate("items.productId");
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });
    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update purchase
router.put("/:id", async (req, res) => {
  try {
    // Get old purchase before update
    const oldPurchase = await Purchase.findById(req.params.id);
    if (!oldPurchase) return res.status(404).json({ error: "Purchase not found" });

    // Update purchase
    const newPurchase = await Purchase.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    // Handle stock changes based on status/qty changes
    await updateStockForPurchase(oldPurchase, newPurchase);

    res.json(newPurchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update purchase status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, receivedDate } = req.body;

    if (!["pending", "received", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Get current purchase to check previous status
    const currentPurchase = await Purchase.findById(req.params.id);
    if (!currentPurchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    const updateData = { status };
    if (status === "received" && receivedDate) {
      updateData.receivedDate = new Date(receivedDate);
    }

    const purchase = await Purchase.findByIdAndUpdate(req.params.id, updateData, { new: true });

    // Only increment stock if transitioning TO "received" (not if it was already received)
    if (status === "received" && currentPurchase.status !== "received" && purchase) {
      for (const item of purchase.items) {
        if (item.productId) {
          const product = await Product.findById(item.productId);
          const balanceBefore = product ? product.stock : 0;
          
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.qty } }
          );

          // Log stock movement
          const updatedProduct = await Product.findById(item.productId);
          const balanceAfter = updatedProduct ? updatedProduct.stock : 0;
          
          await StockMovement.create({
            productId: item.productId,
            productName: updatedProduct ? updatedProduct.name : "",
            type: "in",
            quantity: item.qty,
            reason: "purchase_received",
            date: new Date(),
            doc: "",
            referenceId: purchase._id.toString(),
            referenceNumber: purchase.purchaseNumber,
            balanceBefore,
            balanceAfter,
          });
        }
      }
    }

    res.json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete purchase
router.delete("/:id", async (req, res) => {
  try {
    const purchase = await Purchase.findByIdAndDelete(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    // If purchase was received, restore stock
    if (purchase.status === "received") {
      await decrementStockForPurchase(purchase);
    }

    res.json({ message: "Purchase deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
