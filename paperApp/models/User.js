const mongoose = require('mongoose');   // Importing Mongoose library for MongoDB interaction  
const bcrypt = require('bcrypt');   // Importing bcrypt library for password hashing

// Defining the User schema with necessary fields and validations (username,password,fullName,roles)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, 
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  roles: [{ type: String, enum: ['AUTHOR', 'PC_MEMBER', 'PC_CHAIR'] }],  // Array of roles the user can have
}, { timestamps: true });  // Automatically manage createdAt and updatedAt timestamps

// Pre-save hook to hash the password before saving
userSchema.pre('save', async function(next) {
// If the password is modified or new
  if (this.isModified('password')) { 
    this.password = await bcrypt.hash(this.password, 10); // Hash the password with a salt round of 10
  }
  next(); // Proceed to save
});

// Method to compare a given password with the hashed password in the database
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);  // Compare the passwords
};

const User = mongoose.model('User', userSchema);    // Create the User model using the schema

module.exports = User;  // Export the User model
