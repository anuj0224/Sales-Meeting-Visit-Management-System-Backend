const express = require('express');
const router = express.Router();
const { getUsers, getTeamMembers } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/', getUsers);
router.get('/team', authorize('Sales Manager', 'Admin'), getTeamMembers);

module.exports = router;
