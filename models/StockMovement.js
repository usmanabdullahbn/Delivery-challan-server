import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    reason: {
      type: String,
      enum: ["manual_in", "manual_out", "dc_created", "dc_deleted", "dc_updated", "purchase_received", "purchase_cancelled", "purchase_updated"],
      required: true,
    },
    date: { type: Date, default: Date.now },
    doc: { type: String, default: "" },
    referenceId: { type: String, default: null }, // DC ID if reason is dc_*
    referenceNumber: { type: String, default: null }, // DC number if reason is dc_*
    notes: { type: String, default: "" },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for faster queries
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ referenceId: 1 });

export default mongoose.model("StockMovement", stockMovementSchema);
