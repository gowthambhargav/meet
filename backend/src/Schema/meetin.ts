import mongoose from "mongoose";

const MeetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    scheduledTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Added meeting code (human/shareable) and shareUrl for convenience
    code: { type: String, required: true, unique: true },
    shareUrl: { type: String },
    isActive: { type: Boolean, default: false },
    peopleInCall: { type: Number, default: 0 },
    maxParticipants: { type: Number, default: 50 },
    ParticipantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", MeetingSchema);

export default Meeting;