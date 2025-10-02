const fs = require('fs');

// Create test data with complex branching to test the email tree visualization
const testThreadData = {
  "summary": {
    "generatedAt": new Date().toISOString(),
    "totalEmails": 8,
    "totalThreads": 2,
    "methodUsed": "Complex Branching Test Data"
  },
  "threads": {
    "BRANCHING_THREAD_1": {
      "id": "BRANCHING_THREAD_1",
      "subject": "Project Update with Complex Forwarding",
      "totalEmails": 6,
      "participantCount": 4,
      "participants": [
        "alice@company.com",
        "john@company.com",
        "bill@company.com",
        "jenny@company.com"
      ],
      "dateRange": {
        "start": "2024-01-01T09:00:00Z",
        "end": "2024-01-01T16:30:00Z"
      },
      "maxDepth": 3,
      "branchCount": 3,
      "replyCount": 2,
      "forwardCount": 3,
      "emails": [
        {
          "id": "email_1",
          "messageId": "<msg001@company.com>",
          "inReplyTo": "",
          "references": [],
          "threadId": "BRANCHING_THREAD_1",
          "from": "alice@company.com",
          "to": ["john@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "Project Update - Q1 Planning",
          "dateSent": "2024-01-01T09:00:00Z",
          "custodian": "Test Import",
          "fileName": "email_1.eml",
          "begBates": "TEST_001_00001",
          "endBates": "TEST_001_00003",
          "begAttach": "TEST_001_00004",
          "endAttach": "TEST_001_00010",
          "fullText": "Hi John,\n\nHere's the Q1 project update with budget details and timeline.\n\nAttachments:\nQ1_Project_Plan.xlsx (1.2 MB); Budget_Breakdown.pdf (850 kB)\n\nPlease review and let me know your thoughts.\n\nBest,\nAlice",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "email_2",
          "messageId": "<msg002@company.com>",
          "inReplyTo": "<msg001@company.com>",
          "references": ["<msg001@company.com>"],
          "threadId": "BRANCHING_THREAD_1",
          "from": "john@company.com",
          "to": ["alice@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "RE: Project Update - Q1 Planning",
          "dateSent": "2024-01-01T10:15:00Z",
          "custodian": "Test Import",
          "fileName": "email_2.eml",
          "begBates": "TEST_001_00011",
          "endBates": "TEST_001_00012",
          "begAttach": "",
          "endAttach": "",
          "fullText": "Alice,\n\nThanks for the update. The timeline looks good but I have concerns about the budget allocation for Phase 2.\n\nI'm forwarding this to Bill and Jenny for their input.\n\nJohn",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "email_3",
          "messageId": "<msg003@company.com>",
          "inReplyTo": "<msg002@company.com>",
          "references": ["<msg001@company.com>", "<msg002@company.com>"],
          "threadId": "BRANCHING_THREAD_1",
          "from": "john@company.com",
          "to": ["bill@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "FWD: Project Update - Q1 Planning - Need Budget Review",
          "dateSent": "2024-01-01T10:17:00Z",
          "custodian": "Test Import",
          "fileName": "email_3.eml",
          "begBates": "TEST_001_00013",
          "endBates": "TEST_001_00015",
          "begAttach": "TEST_001_00016",
          "endAttach": "TEST_001_00020",
          "fullText": "Bill,\n\nCan you review Alice's Q1 project plan? I'm particularly concerned about Phase 2 budget.\n\n--- Forwarded Message ---\nFrom: Alice\nSubject: Project Update - Q1 Planning\n[Original email content included]\n\nAttachments:\nBudget_Analysis_Comments.docx (450 kB)\n\nThanks,\nJohn",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "email_4",
          "messageId": "<msg004@company.com>",
          "inReplyTo": "<msg002@company.com>",
          "references": ["<msg001@company.com>", "<msg002@company.com>"],
          "threadId": "BRANCHING_THREAD_1",
          "from": "john@company.com",
          "to": ["jenny@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "FWD: Project Update - Q1 Planning - Timeline Review",
          "dateSent": "2024-01-01T10:20:00Z",
          "custodian": "Test Import",
          "fileName": "email_4.eml",
          "begBates": "TEST_001_00021",
          "endBates": "TEST_001_00023",
          "begAttach": "",
          "endAttach": "",
          "fullText": "Jenny,\n\nCould you review the timeline in Alice's project plan? Your expertise in resource planning would be valuable.\n\n--- Forwarded Message ---\nFrom: Alice\nSubject: Project Update - Q1 Planning\n[Original email content included]\n\nThanks,\nJohn",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "email_5",
          "messageId": "<msg005@company.com>",
          "inReplyTo": "<msg003@company.com>",
          "references": ["<msg001@company.com>", "<msg002@company.com>", "<msg003@company.com>"],
          "threadId": "BRANCHING_THREAD_1",
          "from": "bill@company.com",
          "to": ["john@company.com"],
          "cc": ["alice@company.com"],
          "bcc": [],
          "subject": "RE: FWD: Project Update - Budget Approved with Changes",
          "dateSent": "2024-01-01T14:30:00Z",
          "custodian": "Test Import",
          "fileName": "email_5.eml",
          "begBates": "TEST_001_00024",
          "endBates": "TEST_001_00026",
          "begAttach": "TEST_001_00027",
          "endAttach": "TEST_001_00035",
          "fullText": "John and Alice,\n\nI've reviewed the budget. Overall looks good but recommend reducing Phase 2 by 15% and extending timeline by 2 weeks.\n\nAttachments:\nRevised_Budget_Proposal.xlsx (1.1 MB); Risk_Assessment.pdf (680 kB)\n\nApproved with these modifications.\n\nBill",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "email_6",
          "messageId": "<msg006@company.com>",
          "inReplyTo": "<msg004@company.com>",
          "references": ["<msg001@company.com>", "<msg002@company.com>", "<msg004@company.com>"],
          "threadId": "BRANCHING_THREAD_1",
          "from": "jenny@company.com",
          "to": ["john@company.com"],
          "cc": ["alice@company.com"],
          "bcc": [],
          "subject": "RE: FWD: Project Update - Timeline Concerns",
          "dateSent": "2024-01-01T16:30:00Z",
          "custodian": "Test Import",
          "fileName": "email_6.eml",
          "begBates": "TEST_001_00036",
          "endBates": "TEST_001_00037",
          "begAttach": "",
          "endAttach": "",
          "fullText": "John and Alice,\n\nAfter reviewing the timeline, I think we're being too aggressive with Phase 1 deliverables. Suggest extending by 3 weeks to ensure quality.\n\nThis aligns with Bill's budget recommendation.\n\nJenny",
          "confidentiality": "Internal Use Only"
        }
      ]
    },
    "SIMPLE_THREAD_2": {
      "id": "SIMPLE_THREAD_2",
      "subject": "Quick Status Update",
      "totalEmails": 2,
      "participantCount": 2,
      "participants": [
        "manager@company.com",
        "developer@company.com"
      ],
      "dateRange": {
        "start": "2024-01-02T09:00:00Z",
        "end": "2024-01-02T09:15:00Z"
      },
      "maxDepth": 1,
      "branchCount": 1,
      "replyCount": 1,
      "forwardCount": 0,
      "emails": [
        {
          "id": "simple_email_1",
          "messageId": "<simple001@company.com>",
          "inReplyTo": "",
          "references": [],
          "threadId": "SIMPLE_THREAD_2",
          "from": "manager@company.com",
          "to": ["developer@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "Quick Status Check",
          "dateSent": "2024-01-02T09:00:00Z",
          "custodian": "Test Import",
          "fileName": "simple_email_1.eml",
          "begBates": "TEST_002_00001",
          "endBates": "TEST_002_00001",
          "begAttach": "",
          "endAttach": "",
          "fullText": "Hi there,\n\nHow's the feature development going?\n\nThanks",
          "confidentiality": "Internal Use Only"
        },
        {
          "id": "simple_email_2",
          "messageId": "<simple002@company.com>",
          "inReplyTo": "<simple001@company.com>",
          "references": ["<simple001@company.com>"],
          "threadId": "SIMPLE_THREAD_2",
          "from": "developer@company.com",
          "to": ["manager@company.com"],
          "cc": [],
          "bcc": [],
          "subject": "RE: Quick Status Check",
          "dateSent": "2024-01-02T09:15:00Z",
          "custodian": "Test Import",
          "fileName": "simple_email_2.eml",
          "begBates": "TEST_002_00002",
          "endBates": "TEST_002_00002",
          "begAttach": "",
          "endAttach": "",
          "fullText": "Going well! Should have it ready by end of week.\n\nThanks",
          "confidentiality": "Internal Use Only"
        }
      ]
    }
  }
};

// Write the test data
fs.writeFileSync('thread_report.json', JSON.stringify(testThreadData, null, 2));

console.log('✅ Created branching test data');
console.log('📊 Thread Structure:');
console.log('   BRANCHING_THREAD_1:');
console.log('   - Alice → John (original)');
console.log('   - John → Alice (reply)');
console.log('   - John → Bill (forward branch 1)');
console.log('   - John → Jenny (forward branch 2)');
console.log('   - Bill → John+Alice (reply to branch 1)');
console.log('   - Jenny → John+Alice (reply to branch 2)');
console.log('');
console.log('   SIMPLE_THREAD_2:');
console.log('   - Manager → Developer');
console.log('   - Developer → Manager (reply)');
console.log('');
console.log('🌳 This creates a proper email tree with branches!');