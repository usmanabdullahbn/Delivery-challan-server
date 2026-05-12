import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  code: { type: String, default: "" },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  unit: { type: String, default: "Nos" },
  qty: { type: Number, required: true, min: 1 },
  rate: { type: Number, default: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  amount: { type: Number, default: 0 }, // qty * rate
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, unique: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, required: true },
    vendorPhone: { type: String, default: "" },
    items: [itemSchema],
    date: { type: Date, default: Date.now },
    receivedDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "received", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Auto-generate purchase number before saving
purchaseSchema.pre("save", async function (next) {
  if (!this.purchaseNumber) {
    const count = await mongoose.model("Purchase").countDocuments();
    const year = new Date().getFullYear();
    this.purchaseNumber = `PO-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

export default mongoose.model("Purchase", purchaseSchema);
