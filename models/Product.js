import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    unit: { type: String, default: "Nos" },
    rate: { type: Number, default: 0 },
    category: { type: String, default: "General" },
    code: { type: String, default: "" },
    stock: { type: Number, default: 0, min: 0 },
    minStockLevel: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
