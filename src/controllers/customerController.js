const Customer = require('../models/Customer');
const Contact = require('../models/Contact');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({ status: 'Active' }).sort({ companyName: 1 });
    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res, next) => {
  try {
    const { companyName, industry, email, phone, address, website, accountTier } = req.body;

    const customer = await Customer.create({
      companyName,
      industry,
      email,
      phone,
      address,
      website,
      accountTier,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get contacts for a customer
// @route   GET /api/customers/:id/contacts
// @access  Private
const getCustomerContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.find({ customer: req.params.id }).sort({ name: 1 });
    res.json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create contact for customer
// @route   POST /api/customers/:id/contacts
// @access  Private
const createContact = async (req, res, next) => {
  try {
    const { name, title, email, phone, isPrimary } = req.body;

    const contact = await Contact.create({
      customer: req.params.id,
      name,
      title,
      email,
      phone,
      isPrimary: Boolean(isPrimary)
    });

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  getCustomerContacts,
  createContact
};
