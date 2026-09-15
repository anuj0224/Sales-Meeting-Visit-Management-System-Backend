const express = require('express');
const router = express.Router();
const { getFollowUps, createFollowUp, updateFollowUpStatus } = require('../controllers/followUpController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getFollowUps);
router.post('/', createFollowUp);
router.patch('/:id/status', updateFollowUpStatus);

module.exports = router;
