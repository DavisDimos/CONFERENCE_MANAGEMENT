const express = require('express'); // server pou trexei
const router = express.Router();    // gia na mporeso na trexo ta routes/leitoyrg.
const Paper = require('../models/Paper');   //ta xaraktiristika pou pairnei apo ta models Paper, Assuming the Paper model is in the models directory
const Conference = require('../models/Conference'); 
const mongoose = require('mongoose');
const {AuthorMiddleware} = require('../middleWare/Author');
const {PCchairMiddleware} = require('../middleWare/PCchair');
const {PCmemberMiddleware} = require('../middleWare/PCmember');
const  User= require('../models/User');
// Route for viewing all papers of the author or coauthor
router.get('/di', AuthorMiddleware, async (req, res) => {
    try {
      // Find papers where the user is the AUTHOR or a COAUTHOR
      const papers = await Paper.find({
        $or: [
          { authors: req.user._id },
          { coAuthors: req.user._id }
        ]
      })
        .populate('authors', 'username') // Populate author usernames
        .populate('coAuthors', 'username'); // Populate coauthor usernames
  
      // Check if the user is the AUTHOR or a COAUTHOR of any of the papers
      const unauthorizedPapers = papers.filter(paper => {
        const isAuthor = paper.authors.some(author => author._id.equals(req.user._id));
        const isCoAuthor = paper.coAuthors.some(coAuthors => coAuthors._id.equals(req.user._id));
        return !isAuthor && !isCoAuthor;
      });
  
      if (unauthorizedPapers.length > 0) {
        return res.status(403).json({ message: 'Unauthorized: User is not an AUTHOR or COAUTHOR of some papers' });
      }
  
      // Extract relevant information from each paper
      const papersDetails = papers.map(paper => ({
        id: paper._id,
        title: paper.title,
        content: paper.content,
        status: paper.state,
      }));
  
      res.json(papersDetails);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // view visitor
router.get('/view', async (req, res) => {
    try {
        // Find all papers that are in the published state
        const papers = await Paper.find({
            state: { $in: ['APPROVED', 'FINAL_SUBMITTED'] }
        });

        if (!papers.length) {
            return res.status(404).json({ error: 'No published papers found' });
        }

        // Map the papers to return only the necessary information
        const response = papers.map(paper => ({
            id: paper._id,
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
            coAuthors: paper.coAuthors,
            state: paper.state,
            conferenceId: paper.conferenceId
        }));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching papers:', error);
        res.status(500).json({ error: 'An error occurred while retrieving the papers' });
    }
});

router.get('/pc-member/view-papers', PCmemberMiddleware, async (req, res) => {
    try {
        const pcMemberId = req.user.id; // Assuming the user's identifier is available via req.user.id from the middleware

        // Find all papers assigned to this PC member
        const papers = await Paper.find({ assignedPCMembers: pcMemberId });

        if (!papers || papers.length === 0) {
            return res.status(404).json({ error: 'No papers found for this PC Member.' });
        }

        // Return all relevant paper details including the content
        const paperDetails = papers.map(paper => ({
            id: paper._id,
            title: paper.title,
            abstract: paper.abstract,
            contentType: paper.contentType,
            content: paper.content, // Assuming there's a content field that stores the full paper content
            state: paper.state,
            conferenceId: paper.conferenceId,
            authors: paper.authors,
            coAuthors: paper.coAuthors,
            reviewerComments: paper.reviewerComments,
            reviewerScores: paper.reviewerScores,
            creationDate: paper.creationDate
        }));

        res.status(200).json(paperDetails);

    } catch (error) {
        console.error('Error fetching papers for PC Member:', error);
        res.status(500).json({ error: 'An error occurred while retrieving the papers' });
    }
});

// Route to submit a paper to a conference
router.post('/submit/:id',AuthorMiddleware ,async (req, res) => {
    try {
        const { id } = req.params;
        const { content, contentType } = req.body;

        // Validate the content
        if (!content || !contentType) {
            return res.status(400).json({ error: 'Content and content type are required for submission.' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id);
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Find the associated conference
        const conference = await Conference.findById(paper.conferenceId);
        if (!conference) {
            return res.status(404).json({ error: 'Conference not found.' });
        }

        // Check if the conference is in the SUBMISSION state
        if (conference.state !== 'SUBMISSION') {
            return res.status(400).json({ error: 'Submissions are not allowed. The conference is not in the SUBMISSION state.' });
        }

        // Update the paper's content and state
        paper.content = content;
        paper.contentType = contentType;
        paper.state = 'SUBMITTED';

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Paper submitted successfully.',
            paper: {
                id: paper._id,
                title: paper.title,
                abstract: paper.abstract,
                state: paper.state,
                contentType: paper.contentType,
                conferenceId: paper.conferenceId,
                authors: paper.authors,
                coAuthors: paper.coAuthors,
                creationDate: paper.creationDate
            }
        });
    } catch (error) {
        console.error('Error submitting paper:', error);
        res.status(500).json({ error: 'An error occurred while submitting the paper.' });
    }
});
// Route to create a new paper
router.post('/new', AuthorMiddleware, async (req, res) => {
    try {
        const { 
            title, 
            abstract, 
            content, 
            contentType, 
            state, 
            conferenceId, 
            authors, 
            coAuthors, 
            reviewerComments, 
            reviewerScores 
        } = req.body;

        // Validate required fields
        if (!title || !abstract || (contentType && !content) || !conferenceId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate that the conferenceId exists
        const conference = await Conference.findById(conferenceId);
        if (!conference) {
            return res.status(404).json({ error: 'Conference not found' });
        }

        // Validate authors if provided
        if (authors && !Array.isArray(authors)) {
            return res.status(400).json({ error: 'Authors must be an array of strings' });
        }

        // Validate coAuthors if provided
        if (coAuthors && !Array.isArray(coAuthors)) {
            return res.status(400).json({ error: 'Co-authors must be an array of strings' });
        }

        // Validate reviewerComments if provided
        if (reviewerComments && !Array.isArray(reviewerComments)) {
            return res.status(400).json({ error: 'Reviewer comments must be an array' });
        }

        // Validate reviewerScores if provided
        if (reviewerScores && !Array.isArray(reviewerScores)) {
            return res.status(400).json({ error: 'Reviewer scores must be an array' });
        }

        // Create a new Paper instance
        const paper = new Paper({
            title,
            abstract,
            content,
            contentType,
            state: state || 'CREATED',
            conferenceId,
            authors: authors || [],  // Default to an empty array if not provided
            coAuthors: coAuthors || [],  // Default to an empty array if not provided
            reviewerComments: reviewerComments || [],  // Default to an empty array if not provided
            reviewerScores: reviewerScores || []  // Default to an empty array if not provided
        });

        // Save the paper to the database
        const savedPaper = await paper.save();

        // Add the paper to the conference's papers array
        conference.papers.push(savedPaper._id);

        // Save the updated conference
        await conference.save();

        // Send a success response with the saved paper
        res.status(201).json(savedPaper);
    } catch (error) {
        // Handle duplicate title error
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Paper with this title already exists' });
        }
        // Handle other errors
        res.status(500).json({ error: 'An error occurred while creating the paper', details: error.message });
    }
});
// Route to update an existing paper
router.patch('/:id',AuthorMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Find the paper by ID
        const paper = await Paper.findById(id);
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found' });
        }

        // Update the paper fields
        if (updates.title) paper.title = updates.title;
        if (updates.abstract) paper.abstract = updates.abstract;
        if (updates.authors) paper.authors = updates.authors;
        if (updates.coAuthors) paper.coAuthors = updates.coAuthors;
        if (updates.content) paper.content = updates.content;
        if (updates.contentType) paper.contentType = updates.contentType;
        if (updates.state) paper.state = updates.state;

        // Save the updated paper
        await paper.save();

        res.status(200).json(paper);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while updating the paper' });
    }
});
// Route to search for papers based on title, authors, and abstract
router.get('/search',AuthorMiddleware ,async (req, res) => {
    try {
        const { title, authors, abstract } = req.query;

        // Build the search query
        let searchCriteria = {};

        if (title) {
            searchCriteria.title = { $regex: title, $options: 'i' }; // Case-insensitive search
        }
        if (authors) {
            searchCriteria.authors = { $all: authors.split(',').map(author => author.trim()) }; // Match all provided authors
        }
        if (abstract) {
            searchCriteria.abstract = { $regex: abstract, $options: 'i' }; // Case-insensitive search
        }

        // Search the database
        const papers = await Paper.find(searchCriteria);

        res.status(200).json(papers);
    } catch (error) {
        console.error('Error searching for papers:', error);
        res.status(500).json({ error: 'An error occurred while searching for papers.' });
    }
});

//• Paper view
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate the ObjectId format (optional but recommended)
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid paper ID format' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id).populate('conferenceId');

        if (!paper) {
            return res.status(404).json({ error: 'Paper not found' });
        }

        res.status(200).json({
            id: paper._id,
            title: paper.title,
            abstract: paper.abstract,
            contentType: paper.contentType,
            state: paper.state,
            conference: paper.conferenceId,  // Populated conference details
            authors: paper.authors,
            coAuthors: paper.coAuthors,
            creationDate: paper.creationDate
        });
    } catch (error) {
        console.error('Error fetching paper:', error);
        res.status(500).json({ error: 'An error occurred while retrieving the paper' });
    }
});

// Withdraw a paper
router.delete('/withdraw/:id',AuthorMiddleware,async (req, res) => {
    try {
        const { id } = req.params;

        // Validate the ObjectId format (optional but recommended)
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid paper ID format' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id);
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found' });
        }

        // Delete the paper from the database
        await Paper.findByIdAndDelete(id);

        res.status(200).json({ message: 'Paper has been successfully withdrawn and deleted.' });
    } catch (error) {
        console.error('Error withdrawing paper:', error);
        res.status(500).json({ error: 'An error occurred while withdrawing the paper.' });
    }
});

// Route to review a paper
router.post('/:id/review',[PCchairMiddleware,PCmemberMiddleware] ,async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewerName, score, comment } = req.body;

        // Validate the input
        if (!reviewerName || score === undefined || !comment) {
            return res.status(400).json({ error: 'Reviewer name, score, and comment are required.' });
        }
        if (score < 0 || score > 10) {
            return res.status(400).json({ error: 'Score must be between 0 and 10.' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id).populate('conferenceId');
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Check if the conference is in the REVIEW state
        const conference = paper.conferenceId;
        if (conference.state !== 'REVIEW') {
            return res.status(400).json({ error: 'Reviews are not allowed. The conference is not in the REVIEW state.' });
        }

        // Add the reviewer's score and comment
        paper.reviewerScores.push({ reviewerName, score });
        paper.reviewerComments.push({ reviewerName, comment });

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Review submitted successfully.',
            paper: {
                id: paper._id,
                title: paper.title,
                state: paper.state,
                reviewerScores: paper.reviewerScores,
                reviewerComments: paper.reviewerComments
            }
        });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ error: 'An error occurred while submitting the review.' });
    }
});
// Route to assign a reviewer to a paper
router.post('/:id/assign-reviewer',PCchairMiddleware ,async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewerName } = req.body;

        // Validate the input
        if (!reviewerName) {
            return res.status(400).json({ error: 'Reviewer name is required.' });
        }

        // Find the paper by ID and populate the conferenceId
        const paper = await Paper.findById(id).populate('conferenceId');
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Check if the conference is in the ASSIGNMENT state
        const conference = paper.conferenceId;
        if (conference.state !== 'ASSIGNMENT') {
            return res.status(400).json({ error: 'Reviewer assignment is not allowed. The conference is not in the ASSIGNMENT state.' });
        }

        // Check if the maximum number of reviewers (2) has been reached
        if (paper.reviewerNames && paper.reviewerNames.length >= 2) {
            return res.status(400).json({ error: 'Maximum number of reviewers already assigned.' });
        }

        // Assign the reviewer to the paper
        paper.reviewerNames = paper.reviewerNames || [];
        paper.reviewerNames.push(reviewerName);

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Reviewer assigned successfully.',
            paper: {
                id: paper._id,
                title: paper.title,
                conferenceId: conference._id,  // Include conferenceId in the response
                reviewerNames: paper.reviewerNames
            }
        });
    } catch (error) {
        console.error('Error assigning reviewer:', error);
        res.status(500).json({ error: 'An error occurred while assigning the reviewer.' });
    }
});

// Route to approve a paper
router.post('/:id/approve',PCchairMiddleware,async (req, res) => {
    try {
        const { id } = req.params;

        // Find the paper by ID
        const paper = await Paper.findById(id).populate('conferenceId');
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Get the associated conference
        const conference = paper.conferenceId;
        if (!conference) {
            return res.status(404).json({ error: 'Conference not found.' });
        }

        // Check if the conference is in the DECISION state
        if (conference.state !== 'DECISION') {
            return res.status(400).json({ error: 'Paper approval is not allowed. The conference is not in the DECISION state.' });
        }

        // Update the paper's state to APPROVED
        paper.state = 'APPROVED';

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Paper approved successfully, but it needs modifications to address reviewer comments.',
            paper: {
                id: paper._id,
                title: paper.title,
                state: paper.state,
                conferenceId: conference._id,
                reviewerComments: paper.reviewerComments
            }
        });
    } catch (error) {
        console.error('Error approving paper:', error);
        res.status(500).json({ error: 'An error occurred while approving the paper.' });
    }
});

// Route to reject a paper
router.post('/:id/reject',PCchairMiddleware,async (req, res) => {
    try {
        const { id } = req.params;

        // Find the paper by ID and populate the conferenceId
        const paper = await Paper.findById(id).populate('conferenceId');
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Check if the conference is in the DECISION state
        const conference = paper.conferenceId;
        if (conference.state !== 'DECISION') {
            return res.status(400).json({ error: 'Paper rejection is not allowed. The conference is not in the DECISION state.' });
        }

        // Update the paper's state to REJECTED
        paper.state = 'REJECTED';

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Paper has been rejected successfully.',
            paper: {
                id: paper._id,
                title: paper.title,
                state: paper.state,
                conferenceId: conference._id
            }
        });
    } catch (error) {
        console.error('Error rejecting paper:', error);
        res.status(500).json({ error: 'An error occurred while rejecting the paper.' });
    }
});
// Route for final submission of a paper
router.post('/:id/final-submit',AuthorMiddleware,async (req, res) => {
    try {
        const { id } = req.params;
        const { finalContent, finalContentType, addressingComments } = req.body;

        // Validate the input
        if (!finalContent || !finalContentType || !addressingComments) {
            return res.status(400).json({ error: 'Final content, content type, and addressing comments are required.' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id).populate('conferenceId');
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found.' });
        }

        // Get the associated conference
        const conference = paper.conferenceId;
        if (!conference) {
            return res.status(404).json({ error: 'Conference not found.' });
        }

        // Check if the conference is in the FINAL_SUBMISSION state
        if (conference.state !== 'FINAL_SUBMISSION') {
            return res.status(400).json({ error: 'Final submission is not allowed. The conference is not in the FINAL_SUBMISSION state.' });
        }

        // Check if the paper is in the APPROVED state
        if (paper.state !== 'APPROVED') {
            return res.status(400).json({ error: 'Final submission is only allowed for approved papers.' });
        }

        // Update the paper's content and state
        paper.content = finalContent;
        paper.contentType = finalContentType;
        paper.addressingComments = addressingComments;  // New field to track addressing comments
        paper.state = 'FINAL_SUBMITTED';

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Paper has been successfully submitted for final review.',
            paper: {
                id: paper._id,
                title: paper.title,
                state: paper.state,
                conferenceId: conference._id,
                addressingComments: paper.addressingComments
            }
        });
    } catch (error) {
        console.error('Error during final submission:', error);
        res.status(500).json({ error: 'An error occurred while submitting the paper for final review.' });
    }
});

// Route for pcChair to view all details about their conferences and papers within them
router.get('/pcChair/view',PCchairMiddleware,async (req, res) => {
    try {
        // Assuming the pcChair's identifier (e.g., userId) is available via req.user.id from middleware
        const pcChairId = req.user.id;

        // Validate the ObjectId format
        if (!mongoose.Types.ObjectId.isValid(pcChairId)) {
            return res.status(400).json({ error: 'Invalid pcChair ID format' });
        }

        // Find all conferences where the pcChair is responsible
        const conferences = await Conference.find({ pcChairId });

        if (conferences.length === 0) {
            return res.status(404).json({ error: 'No conferences found for this pcChair' });
        }

        // Extract conference IDs
        const conferenceIds = conferences.map(conference => conference._id);

        // Find all papers associated with these conferences
        const papers = await Paper.find({ conferenceId: { $in: conferenceIds } });

        // Respond with the full details
        res.status(200).json({
            conferences,
            papers
        });
    } catch (error) {
        console.error('Error fetching conference and paper details:', error);
        res.status(500).json({ error: 'An error occurred while retrieving conference and paper details' });
    }
});

// Route to add a co-author who can manage the paper
router.post('/:id/add-coauthor',AuthorMiddleware ,async (req, res) => {
    try {
        const { id } = req.params; // Paper ID
        const { coAuthorName } = req.body; // Co-author name to be added
        const currentAuthorName = req.user.name; // Assuming current user's name is available from authentication middleware

        // Validate the ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid paper ID format' });
        }

        // Find the paper by ID
        const paper = await Paper.findById(id);
        if (!paper) {
            return res.status(404).json({ error: 'Paper not found' });
        }

        // Check if the current user is an author of the paper
        if (!paper.authors.includes(currentAuthorName)) {
            return res.status(403).json({ error: 'You do not have permission to manage this paper' });
        }

        // Check if the co-author exists as a user in the system
        const coAuthor = await User.findOne({ name: coAuthorName });
        if (!coAuthor) {
            return res.status(404).json({ error: 'Co-author not found in the system' });
        }

        // Check if the co-author is already listed in the paper's authors
        if (paper.authors.includes(coAuthorName)) {
            return res.status(400).json({ error: 'This user is already a co-author of the paper' });
        }

        // Add the co-author to the paper's authors list
        paper.authors.push(coAuthorName);

        // Save the updated paper
        await paper.save();

        res.status(200).json({
            message: 'Co-author added successfully and now has permission to manage the paper.',
            paper: {
                id: paper._id,
                title: paper.title,
                authors: paper.authors,
                state: paper.state,
                conferenceId: paper.conferenceId
            }
        });
    } catch (error) {
        console.error('Error adding co-author:', error);
        res.status(500).json({ error: 'An error occurred while adding the co-author' });
    }
});

// Route to accept a paper
router.post('/accept-paper/:conferenceId/:paperId',PCchairMiddleware, async (req, res) => {
    try {
        const { conferenceId, paperId } = req.params;

        // Find the conference by ID
        const conference = await Conference.findById(conferenceId);

        // Check if the conference exists
        if (!conference) {
            return res.status(404).json({ message: "Conference not found." });
        }

        // Check if the current state is 'FINAL'
        if (conference.state !== 'FINAL') {
            return res.status(400).json({ message: "Paper acceptance is only allowed if the conference is in the 'FINAL' state." });
        }

        // Find the paper by ID and conference ID
        const paper = await Paper.findOne({ _id: paperId, conferenceId: conferenceId });

        // Check if the paper exists
        if (!paper) {
            return res.status(404).json({ message: "Paper not found." });
        }

        // Check if the paper's current state allows it to be accepted
        if (paper.state !== 'FINAL_SUBMITTED' && paper.state !== 'APPROVED') {
            return res.status(400).json({ message: "Only papers in the 'FINAL_SUBMITTED' or 'APPROVED' state can be accepted." });
        }

        // Update the paper's state to 'ACCEPTED'
        paper.state = 'ACCEPTED';

        // Save the updated paper state
        await paper.save();

        // Respond with success message and updated paper details
        res.status(200).json({
            message: 'Paper accepted successfully.',
            paper: {
                id: paper._id,
                title: paper.title,
                state: paper.state
            }
        });
} catch (error) {
        console.error('Error accepting paper:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
module.exports = router;
