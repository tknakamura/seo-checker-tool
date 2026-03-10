const mongoose = require('mongoose');

const analysisHistorySchema = new mongoose.Schema(
  {
    url: { type: String, default: null },
    inputType: { type: String, enum: ['url', 'html'], required: true },
    waitForJS: { type: Boolean, default: false },
    overallScore: { type: Number },
    aioOverallScore: { type: Number },
    combinedScore: { type: Number },
    sessionId: { type: String, default: null },
    userId: { type: String, default: null },
  },
  { timestamps: true }
);

analysisHistorySchema.index({ createdAt: -1 });
analysisHistorySchema.index({ sessionId: 1, createdAt: -1 });
analysisHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AnalysisHistory', analysisHistorySchema);
