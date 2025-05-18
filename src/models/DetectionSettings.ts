import mongoose from 'mongoose';

const detectionSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ipCameraUrl: {
    type: String,
    required: true,
  },
  ipCameraPort: {
    type: String,
    default: '8080',
  },
  ntfyTopic: {
    type: String,
    default: '',
  },
  ntfyPriority: {
    type: String,
    default: 'default',
  },
  enableLogging: {
    type: Boolean,
    default: false,
  },
  enablePersonDetection: {
    type: Boolean,
    default: true,
  },
  streamQuality: {
    type: Number,
    default: 80,
    min: 1,
    max: 100,
  },
  frameBufferSize: {
    type: Number,
    default: 10,
    min: 1,
    max: 30,
  },
}, {
  timestamps: true,
});

const DetectionSettings = mongoose.models.DetectionSettings || mongoose.model('DetectionSettings', detectionSettingsSchema);

export default DetectionSettings; 