const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createCustomer,
  getCustomerContacts,
  createContact
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getCustomers);
router.post('/', createCustomer);
router.get('/:id/contacts', getCustomerContacts);
router.post('/:id/contacts', createContact);

module.exports = router;
