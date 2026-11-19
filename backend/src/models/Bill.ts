import mongoose, { Schema, Document } from 'mongoose';

export interface IBillItem {
  frontendId?: string;
  particulars: string;
  quantity?: string | number;
  qty?: string | number;
  kg?: string | number;
  price?: string | number;
  rate?: string | number;
  amount?: number;
}

export interface IBill extends Document {
  customerId: string;
  billNo: string;
  date: string;
  customerName: string;
  address: string;
  items: IBillItem[];
  quantity: number;
  price: number;
  previousBalance: string;
  prevBalance: string;
  advance: number;
  receipt: number;
  totalAmount: number;
  finalBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema(
  {
    frontendId: { type: String, default: '' },
    particulars: { type: String, default: '' },
    quantity: { type: Schema.Types.Mixed, default: '' },
    qty: { type: Schema.Types.Mixed, default: '' },
    kg: { type: Schema.Types.Mixed, default: '' },
    price: { type: Schema.Types.Mixed, default: '' },
    rate: { type: Schema.Types.Mixed, default: '' },
    amount: { type: Number, default: 0 }
  },
  { _id: false }
);

const BillSchema: Schema = new Schema(
  {
    customerId: { type: String, default: '' },
    billNo: { type: String, required: true },
    date: { type: String, required: true },
    customerName: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    items: { type: [BillItemSchema], default: [] },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    previousBalance: { type: String, default: '0' },
    prevBalance: { type: String, default: '0' },
    advance: { type: Number, default: 0 },
    receipt: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    finalBalance: { type: Number, default: 0 }
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

export const Bill = mongoose.model<IBill>('Bill', BillSchema);
