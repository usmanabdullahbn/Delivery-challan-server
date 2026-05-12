import express from "express";
import Vendor from "../models/Vendor.js";

const router = express.Router();

// Create vendor
router.post("/", async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all vendors
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
      ];
    }
    const vendors = await Vendor.find(query).sort({ name: 1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single vendor
router.get("/:id", async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update vendor
router.put("/:id", async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Vendor removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
