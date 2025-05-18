import mongoose from 'mongoose';

const detectionEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  objectType: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String,
  },
}, {
  timestamps: true,
});

const DetectionEvent = mongoose.models.DetectionEvent || mongoose.model('DetectionEvent', detectionEventSchema);

export default DetectionEvent; 