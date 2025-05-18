import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true, unique: true },
  // Add more fields as needed, e.g. name, avatar, etc.
}, { timestamps: true });

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

export default Profile;