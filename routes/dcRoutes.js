import express from "express";
import DC from "../models/DeliveryChallan.js";

const router = express.Router();

// Create DC
router.post("/", async (req, res) => {
  try {
    const newDC = new DC(req.body);
    await newDC.save();
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
    const dc = await DC.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dc) return res.status(404).json({ error: "DC not found" });
    res.json(dc);
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
