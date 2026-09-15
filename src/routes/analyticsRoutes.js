const express = require('express');
const router = express.Router();
const { getTeamActivity, getAdminStats } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/team-activity', authorize('Sales Manager', 'Admin'), getTeamActivity);
router.get('/admin-stats', authorize('Admin'), getAdminStats);

module.exports = router;
