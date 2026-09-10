const mongoose = require('mongoose');
const Counter = require('./Counter');

const categorySchema = new mongoose.Schema(
  {
    id: {
      type: Number,
    },
    categoryType: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Strips special characters except spaces/hyphens and forces proper casing
      set: (v) => v.replace(/[^a-zA-Z0-9 -]/g, '').trim()
    },
    categoryDescription: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

categorySchema.pre('save', async function () {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { id: 'category_id' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.id = counter.seq;
  }
});

module.exports = mongoose.model('CategorySchema', categorySchema);