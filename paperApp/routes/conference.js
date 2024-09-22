const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Conference = require('../models/Conference'); // Adjust the path as necessary
const Paper = require('../models/Paper');
const User = require('../models/User'); // Adjust the path as necessary
const {AuthorMiddleware} = require('../middleWare/Author');
const {PCchairMiddleware} = require('../middleWare/PCchair');
const {PCmemberMiddleware} = require('../middleWare/PCmember');

router.get('/pc-chair/view-conferences', PCchairMiddleware, async (req, res) => {
    try {
        const pcChairId = req.user.id; // Assuming the user's identifier is available via req.user.id from the middleware

        // Find all conferences where the PC Chair is responsible
        const conferences = await Conference.find({ pcChair: pcChairId });

        if (!conferences || conferences.length === 0) {
            return res.status(404).json({ error: 'No conferences found for this PC Chair.' });
        }

        // For each conference, find the associated papers
        const conferenceDetails = await Promise.all(conferences.map(async (conference) => {
            const papers = await Paper.find({ conferenceId: conference._id });

            return {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                startDate: conference.startDate,
                endDate: conference.endDate,
                location: conference.location,
                papers: papers.map(paper => ({
                    id: paper._id,
                    title: paper.title,
                    abstract: paper.abstract,
                    contentType: paper.contentType,
                    state: paper.state,
                    authors: paper.authors,
                    coAuthors: paper.coAuthors,
                    reviewerComments: paper.reviewerComments,
                    reviewerScores: paper.reviewerScores,
                    creationDate: paper.creationDate
                }))
            };
        }));

        // Return the conference details with associated papers
        res.status(200).json(conferenceDetails);

    } catch (error) {
        console.error('Error fetching conference details:', error);
        res.status(500).json({ error: 'An error occurred while retrieving the conference details' });
    }
});

router.post('/create', PCchairMiddleware, async (req, res) => {
    try {
        const { name, description, pcChairs, pcMembers } = req.body;

        // Ensure the conference name is unique and required fields are provided
        if (!name || !description || !pcChairs || (Array.isArray(pcChairs) && pcChairs.length === 0)) {
            return res.status(400).json({ message: "Name, description, and at least one PC Chair are required." });
        }

        // Ensure that pcChairs is always an array and convert to ObjectId
        const pcChairsArray = Array.isArray(pcChairs) ? pcChairs.map(id => new mongoose.Types.ObjectId(id)) : [new mongoose.Types.ObjectId(pcChairs)];

        // Check if the conference already exists with the same name
        const existingConference = await Conference.findOne({ name });
        if (existingConference) {
            return res.status(400).json({ message: "A conference with this name already exists." });
        }

        // Validate that all PC Chairs are valid users with the role 'PC_CHAIR'
        const pcChairUsers = await User.find({ _id: { $in: pcChairsArray }, roles: 'PC_CHAIR' });
        if (pcChairUsers.length !== pcChairsArray.length) {
            const invalidPcChairs = pcChairsArray.filter(id => !pcChairUsers.some(user => user._id.equals(id)));
            console.log('Invalid PC Chairs:', invalidPcChairs);  // Log the invalid PC Chairs for debugging

            return res.status(400).json({
                message: `One or more PC Chairs are invalid or do not have the role 'PC_CHAIR'. Invalid IDs: ${invalidPcChairs}`
            });
        }

        // Safely handle pcMembers, ensuring it's an array and converting to ObjectId
        const pcMembersArray = Array.isArray(pcMembers) ? pcMembers.map(id => new mongoose.Types.ObjectId(id)) : [];

        // Validate that all PC Members are valid users with the role 'PC_MEMBER' (if provided)
        let pcMemberUsers = [];
        if (pcMembersArray.length > 0) {
            pcMemberUsers = await User.find({ _id: { $in: pcMembersArray }, roles: 'PC_MEMBER' });
            if (pcMemberUsers.length !== pcMembersArray.length) {
                const invalidPcMembers = pcMembersArray.filter(id => !pcMemberUsers.some(user => user._id.equals(id)));
                console.log('Invalid PC Members:', invalidPcMembers);  // Log the invalid PC Members for debugging
                return res.status(400).json({
                    message: `One or more PC Members are invalid or do not have the role 'PC_MEMBER'. Invalid IDs: ${invalidPcMembers}`
                });
            }
        }

        // Create a new Conference object
        const newConference = new Conference({
            name,
            description,
            pcChairs: pcChairsArray,  // Already mapped to ObjectId
            pcMembers: pcMembersArray,  // Already safely handled as an array
            state: 'CREATED',
            creationDate: new Date()
        });

        // Save the new conference to the database
        await newConference.save();

        // Respond with the newly created conference's ID and creation date
        res.status(201).json({
            message: 'Conference created successfully.',
            conferenceId: newConference._id,
            creationDate: newConference.creationDate
        });

    } catch (error) {
        console.error('Error creating conference:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Route to update an existing conference
router.patch('/update/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, pcChairs, pcMembers, state } = req.body;

        // Validate that at least one update field is provided
        if (!name && !description && !pcChairs && !pcMembers && !state) {
            return res.status(400).json({ message: "At least one field (name, description, pcChairs, pcMembers, state) must be provided to update." });
        }

        // Check if the conference exists
        const conference = await Conference.findById(id);
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }


           // Validate that all PC Chairs are valid users with the role 'PC_CHAIR' (if provided)
           if (pcChairs) {
            const pcChairUsers = await User.find({ _id: { $in: pcChairs }, role: 'PC_CHAIR' });
            if (pcChairUsers.length !== pcChairs.length) {
                return res.status(400).json({ message: "One or more PC Chairs are invalid or do not have the role 'PC_CHAIR'." });
            }
            conference.pcChairs = pcChairs.map(id => new mongoose.Types.ObjectId(id));
        }

        // Validate that all PC Members are valid users with the role 'PC_MEMBER' (if provided)
        if (pcMembers) {
            const pcMemberUsers = await User.find({ _id: { $in: pcMembers }, role: 'PC_MEMBER' });
            if (pcMemberUsers.length !== pcMembers.length) {
                return res.status(400).json({ message: "One or more PC Members are invalid or do not have the role 'PC_MEMBER'." });
            }
            conference.pcMembers = pcMembers.map(id => new mongoose.Types.ObjectId(id));
        }


        // Update fields as provided
        if (name) conference.name = name;
        if (description) conference.description = description;
        if (pcChairs) conference.pcChairs = pcChairs.map(id => new mongoose.Types.ObjectId(id));
        if (pcMembers) conference.pcMembers = pcMembers.map(id => new mongoose.Types.ObjectId(id));
        if (state) conference.state = state;

        // Save the updated conference
        await conference.save();

        // Respond with the updated conference details
        res.status(200).json({
            message: 'Conference updated successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error updating conference:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to start the submission process for a conference
router.post('/start-submission/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'CREATED'
        if (conference.state !== 'CREATED') {
            return res.status(400).json({ message: "Submission can only be started if the conference is in the 'CREATED' state." });
        }

        // Attempt to transition the state to 'SUBMISSION'
        try {
            conference.transitionState('SUBMISSION');
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message and updated conference state
        res.status(200).json({
            message: 'Submission process started successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error starting submission process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to search for conferences
router.get('/search',PCchairMiddleware,async (req, res) => {
    try {
        const { name, description } = req.query;

        // Build the search criteria object
        const searchCriteria = {};

        if (name) {
            // Use a case-insensitive regex for the name search
            searchCriteria.name = { $regex: new RegExp(name, 'i') };
        }

        if (description) {
            // Use a case-insensitive regex for the description search
            searchCriteria.description = { $regex: new RegExp(description, 'i') };
        }

        // Find conferences that match the search criteria
        const conferences = await Conference.find(searchCriteria).sort({ name: 1 }); // Sort by name alphabetically

        // Return the matched conferences
        res.status(200).json(conferences);
    } catch (error) {
        console.error('Error searching conferences:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to delete a conference if it is in the 'CREATED' state
router.delete('/delete/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the conference is in the 'CREATED' state
        if (conference.state !== 'CREATED') {
            return res.status(400).json({ message: "Conference can only be deleted if it is in the 'CREATED' state." });
        }

        // Delete the conference
        await conference.deleteOne();

        // Respond with success message
        res.status(200).json({ message: "Conference deleted successfully." });

    } catch (error) {
        console.error('Error deleting conference:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to start the reviewer assignment process
router.post('/start-assignment/:id',PCchairMiddleware,async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'SUBMISSION'
        if (conference.state !== 'SUBMISSION') {
            return res.status(400).json({ message: "Reviewer assignment can only be started if the conference is in the 'SUBMISSION' state." });
        }

        // Attempt to transition the state to 'ASSIGNMENT'
        try {
            conference.transitionState('ASSIGNMENT');
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message and updated conference state
        res.status(200).json({
            message: 'Reviewer assignment process started successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error starting reviewer assignment process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to start the review process
router.post('/start-review/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'ASSIGNMENT'
        if (conference.state !== 'ASSIGNMENT') {
            return res.status(400).json({ message: "Review process can only be started if the conference is in the 'ASSIGNMENT' state." });
        }

        // Attempt to transition the state to 'REVIEW'
        try {
            conference.transitionState('REVIEW');
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message and updated conference state
        res.status(200).json({
            message: 'Review process started successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error starting review process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to start the decision-making process
router.post('/start-decision/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'REVIEW'
        if (conference.state !== 'REVIEW') {
            return res.status(400).json({ message: "Decision making can only be started if the conference is in the 'REVIEW' state." });
        }

        // Attempt to transition the state to 'DECISION'
        try {
            conference.transitionState('DECISION');
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message and updated conference state
        res.status(200).json({
            message: 'Decision-making process started successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error starting decision-making process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to start the final submission process
router.post('/start-final-submission/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'DECISION'
        if (conference.state !== 'DECISION') {
            return res.status(400).json({ message: "Final submission can only be started if the conference is in the 'DECISION' state." });
        }

        // Attempt to transition the state to 'FINAL_SUBMISSION'
        try {
            conference.transitionState('FINAL_SUBMISSION');
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message and updated conference state
        res.status(200).json({
            message: 'Final submission process started successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error starting final submission process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to end the conference
router.post('/end-conference/:id',PCchairMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(id);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'FINAL_SUBMISSION'
        if (conference.state !== 'FINAL_SUBMISSION') {
            return res.status(400).json({ message: "Conference can only be ended if it is in the 'FINAL_SUBMISSION' state." });
        }

        // Transition the conference state to 'FINAL'
        conference.state = 'FINAL';

        // Find all papers associated with the conference
        const papers = await Paper.find({ conferenceId: conference._id });

        // Update each paper's state
        for (const paper of papers) {
            if (paper.state === 'APPROVED' && paper.state === 'FINAL_SUBMITTED') {
                paper.state = 'ACCEPTED';
            } else if (paper.state === 'APPROVED' && paper.state !== 'FINAL_SUBMITTED') {
                paper.state = 'REJECTED';
            }
            await paper.save();
        }

        // Save the updated conference state
        await conference.save();

        // Respond with success message
        res.status(200).json({
            message: 'Conference ended successfully.',
            conference: {
                id: conference._id,
                name: conference.name,
                description: conference.description,
                pcChairs: conference.pcChairs,
                pcMembers: conference.pcMembers,
                state: conference.state,
                creationDate: conference.creationDate
            }
        });

    } catch (error) {
        console.error('Error ending conference:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/:conferenceId/add-pc-chairs', PCchairMiddleware, async (req, res) => {
    const { conferenceId } = req.params;
    const { pcChairs } = req.body;
    const userId = req.user._id;
  
    try {
      // Validate request body
      if (!Array.isArray(pcChairs) || pcChairs.some(id => typeof id !== 'string')) {
        return res.status(400).json({ message: 'Invalid request body: pcChairs should be an array of strings' });
      }
  
      // Fetch the conference
      const conference = await Conference.findById(conferenceId);
      if (!conference) {
        return res.status(404).json({ message: 'Conference not found' });
      }
  
      // Check if the user is a PC Chair for the conference
      if (!conference.pcChairs.includes(userId)) {
        return res.status(403).json({ message: 'User is not a PC Chair for the conference' });
      }
  
      // Initialize and update PC Chairs
      const newPcChairs = [];
      const existingPcChairs = new Set(conference.pcChairs);
  
      for (const pcChairId of pcChairs) {
        if (existingPcChairs.has(pcChairId)) {
          // Skip if already a PC Chair
          continue;
        }
        existingPcChairs.add(pcChairId);
        newPcChairs.push(pcChairId);
      }
  
      if (newPcChairs.length === 0) {
        return res.status(400).json({ message: 'No new PC Chairs to add' });
      }
  
      conference.pcChairs = Array.from(existingPcChairs);
      conference.addedPcChairIds = [...(conference.addedPcChairIds || []), ...newPcChairs];
  
      // Save the updated conference
      await conference.save();
  
      // Response with updated conference details
      res.json({
        message: 'PC Chairs added successfully',
        conference: {
          _id: conference._id,
          name: conference.name,
          pcChairs: conference.pcChairs,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/:conferenceId/add-pc-members', PCmemberMiddleware, async (req, res) => {
    const { conferenceId } = req.params;
    const { pcMembers } = req.body;
    const userId = req.user._id;
  
    try {
      // Validate request body
      if (!Array.isArray(pcMembers) || pcMembers.some(id => typeof id !== 'string')) {
        return res.status(400).json({ message: 'Invalid request body: pcMembers should be an array of strings' });
      }
  
      // Fetch the conference
      const conference = await Conference.findById(conferenceId);
      if (!conference) {
        return res.status(404).json({ message: 'Conference not found' });
      }
  
      // Check if the user is a PC Members for the conference
      if (!conference.pcMembers.includes(userId)) {
        return res.status(403).json({ message: 'User is not a PC Members for the conference' });
      }
  
      // Initialize PC Members and identify new additions
      const existingPcMembers = new Set(conference.pcMembers);
      const newPcMembers = pcMembers.filter(pcMemberId => !existingPcMembers.has(pcMemberId));
  
      if (newPcMembers.length === 0) {
        return res.status(400).json({ message: 'No new PC Members to add' });
      }
  
      // Update conference with new PC Members
      conference.pcMembers = [...existingPcMembers, ...newPcMembers];
      conference.addedPcMemberIds = [...(conference.addedPcMemberIds || []), ...newPcMembers];
  
      // Save the updated conference
      await conference.save();
  
      // Respond with updated conference details
      res.json({
        message: 'PC Members added successfully',
        conference: {
          _id: conference._id,
          name: conference.name,
          pcMembers: conference.pcMembers,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Route to get conferences in the 'FINAL' state
router.get('/cview', async (req, res) => {
    try {
        // Find all conferences that are in the 'FINAL' state
        const finalConferences = await Conference.find({ state: 'FINAL' }).populate('pcChairs').populate('pcMembers').populate('papers');
        
        // Check if there are any conferences in the 'FINAL' state
        if (finalConferences.length === 0) {
            return res.status(404).json({ message: "No conferences found in the FINAL state." });
        }

        // Respond with the list of conferences
        res.status(200).json(finalConferences);
    } catch (error) {
        console.error('Error fetching final conferences:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
module.exports = router;