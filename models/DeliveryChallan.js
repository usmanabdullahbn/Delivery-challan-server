import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  unit: { type: String, default: "Nos" },
  qty: { type: Number, required: true, min: 1 },
  rate: { type: Number, default: 0 },
});

const dcSchema = new mongoose.Schema(
  {
    dcNumber: { type: String, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true },
    customerAddress: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    items: [itemSchema],
    date: { type: Date, default: Date.now },
    deliveryDate: { type: Date, default: null },
    vehicleNumber: { type: String, default: "" },
    driverName: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["invoice", "delivered", "cancelled"],
      default: "invoice",
    },
  },
  { timestamps: true }
);

// Auto-generate DC number before saving
dcSchema.pre("save", async function (next) {
  if (!this.dcNumber) {
    const count = await mongoose.model("DeliveryChallan").countDocuments();
    const year = new Date().getFullYear();
    this.dcNumber = `DC-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

export default mongoose.model("DeliveryChallan", dcSchema);
