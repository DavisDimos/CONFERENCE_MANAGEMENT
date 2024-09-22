const mongoose = require('mongoose'); // Importing Mongoose library for MongoDB interaction
const { Schema } = mongoose; // Extracting Schema from mongoose for convenience

// Defining the Conference schema with necessary fields and validations (name,description,pcChairs,papers,pcMembers,state,creationDate)
const conferenceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  pcChairs: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  papers: [{ type: Schema.Types.ObjectId, ref: 'Paper' }],
  pcMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  state: { 
    type: String, 
    enum: ['CREATED', 'SUBMISSION', 'ASSIGNMENT', 'REVIEW', 'DECISION', 'FINAL_SUBMISSION', 'FINAL'],  // State of the conference 
    default: 'CREATED' // Default state is CREATED
  },
  creationDate: { type: Date, default: Date.now }   // Automatically set creation date to current date
});

// Method to handle valid state transitions
conferenceSchema.methods.transitionState = function(newState) {
  const validTransitions = {
    'CREATED': ['SUBMISSION'],
    'SUBMISSION': ['ASSIGNMENT'],
    'ASSIGNMENT': ['REVIEW'],
    'REVIEW': ['DECISION'],
    'DECISION': ['FINAL_SUBMISSION'],
    'FINAL_SUBMISSION': ['FINAL']
  };

  if (validTransitions[this.state].includes(newState)) {
    // Check if the transition is valid
    this.state = newState;
    return true;     // Indicate success
  } else {
    throw new Error(`Invalid state transition from ${this.state} to ${newState}`);  // Throw an error for invalid transitions
  }
};

// Pre-save hook to set the creation date if the conference is new
conferenceSchema.pre('save', function(next) {
  if (this.isNew) {
    this.creationDate = new Date(); // Set creation date to current date
  }
  next();   // Proceed to save
});

const Conference = mongoose.model('Conference', conferenceSchema); // Create the Conference model using the schema

module.exports = Conference; // Export the Conference model
