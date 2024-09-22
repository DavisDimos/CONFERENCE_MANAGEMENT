const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const router = express.Router();
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const {AuthorMiddleware} = require('../middleWare/Author');
const {PCchairMiddleware} = require('../middleWare/PCchair');
const {PCmemberMiddleware} = require('../middleWare/PCmember');
require('dotenv').config();

// Sign-Up Route
router.post('/signup', async (req, res) => {
  try {
    const { username, password, fullName, roles } = req.body;

    // Validate the input
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'Username, password, and full name are required.' });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken.' });
    }

    // Create a new user instance
    const newUser = new User({
      username,
      password,
      fullName,
      roles
    });

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error. Please try again later.', error: error.message });
  }
});

// Login route for user authentication
router.post('/login', (req, res, next) => {
    User.findOne({ username: req.body.username })
      .exec()
      .then(user => {
        if (!user) {
          console.log('User not found');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
  
        bcrypt.compare(req.body.password, user.password, (err, result) => {
          if (err) {
            console.log(err);
            return res.status(401).json({ message: 'Invalid credentials' });
          }
  
          if (result) {
            console.log('Password matched');
  
            const token = jwt.sign(
              {
                username: user.username,
                _id: user._id,
                roles: user.roles || [] // Ensure user.roles is an array or set to an empty array
              },
              process.env.JWT_KEY,
              {
                expiresIn: '1h'
              },
            );
  
            return res.status(200).json({
              message: 'Authentication successful',
              token: token
            });
          } else {
            console.log('Password not matched');
            return res.status(401).json({ message: 'Invalid credentials' });
          }
        });
      })
      .catch(err => {
        console.log(err);
        res.status(500).json({ error: err });
      });
  });
  router.post('/logout', [AuthorMiddleware,PCchairMiddleware,PCmemberMiddleware], async (req, res) => {
    try {
      const userId = req.user ? req.user._id : null; // Ensure req.user is defined
  
      if (!userId) {
        return res.status(400).json({ success: false, message: 'No user found' });
      }
  
      const user = await User.findById(userId);
      if (user) {
        user.tokens = []; // Ensure this field exists or adjust as necessary
        await user.save();
      }
  
      req.user = null; // Clear user details
  
      res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
      console.error('Logout failed:', error.message);
      res.status(500).json({ success: false, message: 'Logout failed', error: error.message });
    }
  });
  
  
module.exports = router;
