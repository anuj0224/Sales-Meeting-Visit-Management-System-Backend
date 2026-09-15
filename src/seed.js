const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Customer = require('./models/Customer');
const Contact = require('./models/Contact');
const Meeting = require('./models/Meeting');
const FollowUp = require('./models/FollowUp');

dotenv.config();

const seedDatabase = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales_management';
    await mongoose.connect(connStr);
    console.log('[Seed] Connected to MongoDB for database initialization...');

    // Clear existing data
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Contact.deleteMany({});
    await Meeting.deleteMany({});
    await FollowUp.deleteMany({});
    console.log('[Seed] Existing collections cleared.');

    // 1. Create Demo Users
    const admin = await User.create({
      name: 'Anuj Admin',
      email: 'admin@optronix.com',
      password: 'password123',
      role: 'Admin',
      department: 'Executive'
    });

    const manager = await User.create({
      name: 'Anuj Manager',
      email: 'manager@optronix.com',
      password: 'password123',
      role: 'Sales Manager',
      department: 'Enterprise Sales'
    });

    const employee = await User.create({
      name: 'Anuj Sales Rep',
      email: 'employee@optronix.com',
      password: 'password123',
      role: 'Sales Employee',
      department: 'Enterprise Sales',
      manager: manager._id
    });

    const employee2 = await User.create({
      name: 'Anuj Sales Rep2',
      email: 'sarah.sales@optronix.com',
      password: 'password123',
      role: 'Sales Employee',
      department: 'Enterprise Sales',
      manager: manager._id
    });

    console.log('[Seed] Demo Users Created.');

    // 2. Create Demo Customers
    const customer1 = await Customer.create({
      companyName: 'Apex Solutions Pvt Ltd',
      industry: 'Telecommunications & Fiber',
      email: 'info@apexsolutions.com',
      phone: '+91 98765 43210',
      accountTier: 'Enterprise',
      address: { street: '100 Tech Park, Electronic City', city: 'Bengaluru', state: 'Karnataka', zipCode: '560100' },
      createdBy: admin._id
    });

    const customer2 = await Customer.create({
      companyName: 'Nexus Technologies',
      industry: 'Software & IT Infrastructure',
      email: 'contact@nexustech.io',
      phone: '+91 98123 45678',
      accountTier: 'Mid-Market',
      address: { street: '45 Cyber City, Phase III', city: 'Gurugram', state: 'Haryana', zipCode: '122002' },
      createdBy: manager._id
    });

    console.log('[Seed] Demo Customers Created.');

    // 3. Create Contacts
    const contact1 = await Contact.create({
      customer: customer1._id,
      name: 'Rajesh Kumar',
      title: 'VP of Procurement & Network Infra',
      email: 'rajesh.k@apexsolutions.com',
      phone: '+91 98765 00001',
      isPrimary: true
    });

    const contact2 = await Contact.create({
      customer: customer2._id,
      name: 'Priya Sharma',
      title: 'Chief Technology Officer',
      email: 'priya.sharma@nexustech.io',
      phone: '+91 98123 00002',
      isPrimary: true
    });

    console.log('[Seed] Demo Contacts Created.');

    // 4. Create Standard Scheduled & In-Progress Meetings
    const scheduledMeeting = await Meeting.create({
      customer: customer2._id,
      contact: contact2._id,
      assignedTo: employee._id,
      createdBy: manager._id,
      purpose: 'Initial Product Demonstration & Technical Review',
      location: { address: '45 Cyber City, Phase III, Gurugram' },
      scheduledStartTime: new Date(Date.now() + 86400000), // tomorrow
      scheduledEndTime: new Date(Date.now() + 90000000),
      status: 'Scheduled',
      notes: 'Client requested live demo of fiber testing gear.',
      auditLog: [
        {
          action: 'CREATE_MEETING',
          fromStatus: '',
          toStatus: 'Scheduled',
          performedBy: manager._id,
          performedByName: manager.name,
          timestamp: new Date(),
          reason: 'Initial schedule creation'
        }
      ]
    });

    // 5. Create the 10:02 AM Rescheduled & Completed Meeting Scenario
    const today = new Date();
    const startTime10AM = new Date(today.setHours(10, 0, 0, 0));
    const endTime11AM = new Date(today.setHours(11, 0, 0, 0));
    const checkIn1002AM = new Date(today.setHours(10, 2, 0, 0));
    const pause1040AM = new Date(today.setHours(10, 40, 0, 0));
    const return310PM = new Date(today.setHours(15, 10, 0, 0));
    const complete400PM = new Date(today.setHours(16, 0, 0, 0));

    const rescheduledScenarioMeeting = await Meeting.create({
      customer: customer1._id,
      contact: contact1._id,
      assignedTo: employee._id,
      createdBy: manager._id,
      purpose: 'Annual Optronix Fiber Contract Renewal & Hardware Upgrade',
      location: { address: '100 Tech Park, Electronic City, Bengaluru' },
      scheduledStartTime: startTime10AM,
      scheduledEndTime: endTime11AM,
      status: 'Completed',
      subStatus: 'None',
      notes: 'Customer had urgent morning board call at 10:40 AM; visit resumed at 3:10 PM.',
      visits: [
        {
          sessionIndex: 1,
          checkInTime: checkIn1002AM,
          checkInLocation: { address: '100 Tech Park, Electronic City', latitude: 12.8399, longitude: 77.677 },
          checkOutTime: pause1040AM,
          checkOutLocation: { address: '100 Tech Park Lobby', latitude: 12.8399, longitude: 77.677 },
          sessionStatus: 'Paused/Rescheduled',
          interruptionReason: 'Customer VP Rajesh Kumar asked rep to return at 3:00 PM due to urgent executive meeting.',
          rescheduledReturnTime: new Date(today.setHours(15, 0, 0, 0)),
          notes: 'Session 1: Initial check-in at 10:02 AM. Interrupted at 10:40 AM.'
        },
        {
          sessionIndex: 2,
          checkInTime: return310PM,
          checkInLocation: { address: '100 Tech Park, Conference Room B', latitude: 12.8399, longitude: 77.677 },
          checkOutTime: complete400PM,
          checkOutLocation: { address: '100 Tech Park Main Gate', latitude: 12.8399, longitude: 77.677 },
          sessionStatus: 'Completed',
          notes: 'Session 2: Resumed at 3:10 PM, successfully concluded presentation at 4:00 PM.'
        }
      ],
      outcome: {
        result: 'Follow-up Required',
        notes: 'VP Rajesh Kumar expressed high interest in 400G Optical Transceivers. Requested formal quote and trial units.',
        recordedAt: complete400PM,
        recordedBy: employee._id
      },
      auditLog: [
        {
          action: 'CREATE_MEETING',
          fromStatus: '',
          toStatus: 'Scheduled',
          performedBy: manager._id,
          performedByName: manager.name,
          timestamp: new Date(today.setHours(8, 0, 0, 0)),
          reason: 'Meeting scheduled for 10:00 AM - 11:00 AM'
        },
        {
          action: 'CHECK_IN',
          fromStatus: 'Scheduled',
          toStatus: 'In Progress',
          performedBy: employee._id,
          performedByName: employee.name,
          timestamp: checkIn1002AM,
          reason: 'Check-in recorded at 10:02 AM'
        },
        {
          action: 'PAUSE_RESCHEDULE',
          fromStatus: 'In Progress',
          toStatus: 'In Progress',
          performedBy: employee._id,
          performedByName: employee.name,
          timestamp: pause1040AM,
          reason: 'Customer requested return at 3:00 PM'
        },
        {
          action: 'CHECK_IN',
          fromStatus: 'In Progress',
          toStatus: 'In Progress',
          performedBy: employee._id,
          performedByName: employee.name,
          timestamp: return310PM,
          reason: 'Resumed meeting visit at 3:10 PM'
        },
        {
          action: 'COMPLETE_MEETING',
          fromStatus: 'In Progress',
          toStatus: 'Completed',
          performedBy: employee._id,
          performedByName: employee.name,
          timestamp: complete400PM,
          reason: 'Meeting completed with outcome Follow-up Required'
        }
      ]
    });

    // Create follow-up action for the scenario
    await FollowUp.create({
      meeting: rescheduledScenarioMeeting._id,
      title: 'Prepare Formal Commercial Proposal & Dispatch 400G Demo Units',
      description: 'Send custom quotation for 50 units of 400G Transceivers and deliver evaluation units to Apex Tech Park.',
      owner: employee._id,
      dueDate: new Date(Date.now() + 3 * 86400000), // in 3 days
      priority: 'High',
      status: 'Pending',
      createdBy: employee._id
    });

    console.log('[Seed] Demo Meetings & Follow-ups Created Successfully.');
    console.log('\n--- DEMO CREDENTIALS ---');
    console.log('Admin:        admin@optronix.com / password123');
    console.log('Manager:      manager@optronix.com / password123');
    console.log('Sales Rep:    employee@optronix.com / password123');
    console.log('------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedDatabase();
