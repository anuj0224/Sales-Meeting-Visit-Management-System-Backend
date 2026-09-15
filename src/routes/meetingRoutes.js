const express = require('express');
const router = express.Router();
const {
  getMeetings,
  getMeetingById,
  createMeeting,
  confirmMeeting,
  checkInMeeting,
  pauseOrRescheduleMeeting,
  checkOutAndCompleteMeeting,
  reopenMeeting,
  updateMeeting
} = require('../controllers/meetingController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/', getMeetings);
router.post('/', createMeeting);
router.get('/:id', getMeetingById);
router.put('/:id', updateMeeting);

// Lifecycle Transition Routes
router.patch('/:id/confirm', confirmMeeting);
router.post('/:id/check-in', checkInMeeting);
router.post('/:id/pause-reschedule', pauseOrRescheduleMeeting);
router.post('/:id/check-out-complete', checkOutAndCompleteMeeting);
router.post('/:id/reopen', authorize('Sales Manager', 'Admin'), reopenMeeting);

module.exports = router;
