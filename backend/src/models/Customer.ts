import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  address: string;
  balance: number;
  lastBillNo: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    balance: { type: Number, default: 0 },
    lastBillNo: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
