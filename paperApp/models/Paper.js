const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the schema
const paperSchema = new Schema({
  title: { type: String, required: true, unique: true },
  abstract: { type: String, required: true },
  content: { 
    type: Buffer, 
    required: function() { 
        return ['SUBMITTED', 'REVIEWED', 'APPROVED', 'ACCEPTED', 'FINAL_SUBMITTED'].includes(this.state);
    }
  },
  contentType: { 
    type: String, 
    enum: ['application/pdf', 'application/x-latex'], 
    required: function() { return this.content != null; }
  },
  reviewerComments: [{
    pcMember: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to a PC Member
    comment: { type: String, required: true }
  }],
  reviewerScores: [{
    pcMember: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to a PC Member
    score: { type: Number, min: 0, max: 10, required: true }
  }],
  state: { 
    type: String, 
    enum: ['CREATED', 'SUBMITTED', 'REVIEWED', 'REJECTED', 'APPROVED', 'ACCEPTED', 'FINAL_SUBMITTED'], 
    default: 'CREATED'
  },
  creationDate: { type: Date, default: Date.now },
  conferenceId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Conference',  // Reference to the Conference model
    required: true      // Assuming every paper must be associated with a conference
  },
  authors: [{ type: String }],  // Array of primary author names
  coAuthors: [{ type: String }] // Array of co-author names
});

// Pre-save hook to set the creation date if the paper is new
paperSchema.pre('save', function(next) {
  if (this.isNew) {
    this.creationDate = new Date();
  }
  next();
});

const Paper = mongoose.model('Paper', paperSchema);

module.exports = Paper;