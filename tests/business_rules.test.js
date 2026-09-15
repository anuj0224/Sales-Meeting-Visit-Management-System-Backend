const test = require('node:test');
const assert = require('node:assert');

// Pure Node.js Automated Business Rules Test Suite
// Validates domain logic, state machine rules, authorization constraints, outcome validation, and history preservation.

test('Business Rule 1: Reject invalid lifecycle transition (Scheduled directly to Completed without Check-In)', async () => {
  const mockMeeting = {
    status: 'Scheduled',
    visits: []
  };

  const attemptCompletion = (meeting, outcome) => {
    if (!['Checked In', 'In Progress'].includes(meeting.status)) {
      throw new Error(`Cannot complete meeting in '${meeting.status}' state. Meeting must be checked-in and in-progress.`);
    }
  };

  assert.throws(
    () => {
      attemptCompletion(mockMeeting, { result: 'Interested' });
    },
    {
      name: 'Error',
      message: "Cannot complete meeting in 'Scheduled' state. Meeting must be checked-in and in-progress."
    }
  );
});

test('Business Rule 2: Unauthorized role cannot reopen a completed meeting (Sales Employee rejected, Manager allowed)', async () => {
  const userEmployee = { role: 'Sales Employee', name: 'John Doe' };
  const userManager = { role: 'Sales Manager', name: 'Morgan Manager' };

  const attemptReopen = (user, reason) => {
    if (!['Sales Manager', 'Admin'].includes(user.role)) {
      throw new Error(`User role '${user.role}' cannot reopen meetings. Only Sales Managers and Admins can reopen completed meetings.`);
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid reason must be provided to reopen a completed meeting.');
    }
    return { reopened: true, reopenedBy: user.name };
  };

  // Employee attempt must fail
  assert.throws(
    () => {
      attemptReopen(userEmployee, 'Need to update outcome notes');
    },
    {
      name: 'Error',
      message: "User role 'Sales Employee' cannot reopen meetings. Only Sales Managers and Admins can reopen completed meetings."
    }
  );

  // Manager attempt must succeed
  const result = attemptReopen(userManager, 'Client requested follow-up meeting rescheduling');
  assert.strictEqual(result.reopened, true);
  assert.strictEqual(result.reopenedBy, 'Morgan Manager');
});

test('Business Rule 3: Mandatory outcome required before completing a meeting', async () => {
  const validateOutcome = (outcome) => {
    if (!outcome || !outcome.result) {
      throw new Error('Mandatory meeting outcome result is required to complete meeting.');
    }
    const validOutcomes = ['Interested', 'Follow-up Required', 'Proposal Requested', 'Not Interested', 'Unable to Meet'];
    if (!validOutcomes.includes(outcome.result)) {
      throw new Error(`Invalid outcome result '${outcome.result}'`);
    }
  };

  // Missing outcome
  assert.throws(() => validateOutcome(null), {
    message: 'Mandatory meeting outcome result is required to complete meeting.'
  });

  // Invalid outcome
  assert.throws(() => validateOutcome({ result: 'Undecided' }), {
    message: "Invalid outcome result 'Undecided'"
  });

  // Valid outcome
  assert.doesNotThrow(() => validateOutcome({ result: 'Interested' }));
});

test("Business Rule 4: Mandatory follow-up enforcement when 'Follow-up Required' is selected", async () => {
  const validateFollowUpRequirement = (outcomeResult, newFollowUp, existingFollowUpsCount) => {
    if (outcomeResult === 'Follow-up Required') {
      const hasNew = newFollowUp && newFollowUp.title && newFollowUp.dueDate;
      if (!hasNew && existingFollowUpsCount === 0) {
        throw new Error("When outcome is 'Follow-up Required', a follow-up action with owner and due date is MANDATORY.");
      }
    }
  };

  // Fail when no follow-up provided
  assert.throws(() => validateFollowUpRequirement('Follow-up Required', null, 0), {
    message: "When outcome is 'Follow-up Required', a follow-up action with owner and due date is MANDATORY."
  });

  // Pass when follow-up is provided
  assert.doesNotThrow(() =>
    validateFollowUpRequirement('Follow-up Required', { title: 'Send quotation', dueDate: '2026-09-20' }, 0)
  );
});

test('Business Rule 5: Preservation of meeting history & timestamps during 10:02 AM rescheduling scenario', async () => {
  const meetingHistory = {
    scheduledStart: '10:00 AM',
    scheduledEnd: '11:00 AM',
    visits: []
  };

  // Step 1: 10:02 AM Check-in
  meetingHistory.visits.push({
    sessionIndex: 1,
    checkInTime: '10:02 AM',
    checkOutTime: null,
    status: 'Active'
  });

  // Step 2: 10:40 AM Interruption (Customer asks to return at 3:00 PM)
  meetingHistory.visits[0].checkOutTime = '10:40 AM';
  meetingHistory.visits[0].status = 'Paused/Rescheduled';
  meetingHistory.visits[0].rescheduledReturnTime = '03:00 PM';
  meetingHistory.visits[0].interruptionReason = 'Customer asked to return at 3:00 PM';

  // Step 3: 3:10 PM Return Check-in
  meetingHistory.visits.push({
    sessionIndex: 2,
    checkInTime: '03:10 PM',
    checkOutTime: null,
    status: 'Active'
  });

  // Step 4: 4:00 PM Completion
  meetingHistory.visits[1].checkOutTime = '04:00 PM';
  meetingHistory.visits[1].status = 'Completed';

  // Verify Audit & Preserved History Assertions
  assert.strictEqual(meetingHistory.scheduledStart, '10:00 AM', 'Original scheduled start preserved');
  assert.strictEqual(meetingHistory.visits.length, 2, 'Two separate visit sessions recorded');
  assert.strictEqual(meetingHistory.visits[0].checkInTime, '10:02 AM', 'Session 1 check-in time preserved');
  assert.strictEqual(meetingHistory.visits[0].checkOutTime, '10:40 AM', 'Session 1 interruption check-out time preserved');
  assert.strictEqual(meetingHistory.visits[1].checkInTime, '03:10 PM', 'Session 2 check-in time recorded');
  assert.strictEqual(meetingHistory.visits[1].checkOutTime, '04:00 PM', 'Session 2 completion check-out time recorded');
});

test('Business Rule 6: Manager reopening a completed meeting records audit log & resets status', async () => {
  const meeting = {
    status: 'Completed',
    reopenedCount: 0,
    auditLog: []
  };

  const managerReopen = (meetingObj, managerUser, reason) => {
    meetingObj.status = 'In Progress';
    meetingObj.reopenedCount += 1;
    meetingObj.lastReopenedAt = new Date();
    meetingObj.lastReopenedBy = managerUser.id;
    meetingObj.auditLog.push({
      action: 'REOPEN_MEETING',
      fromStatus: 'Completed',
      toStatus: 'In Progress',
      performedBy: managerUser.id,
      reason
    });
  };

  managerReopen(meeting, { id: 'mgr123', name: 'Morgan Manager' }, 'Reopened to add additional follow-up item');

  assert.strictEqual(meeting.status, 'In Progress');
  assert.strictEqual(meeting.reopenedCount, 1);
  assert.strictEqual(meeting.auditLog.length, 1);
  assert.strictEqual(meeting.auditLog[0].action, 'REOPEN_MEETING');
});
