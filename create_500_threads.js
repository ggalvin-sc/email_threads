const fs = require('fs');

// Function to generate random email addresses
const generateEmail = () => {
    const firstNames = ['Sarah', 'Justin', 'Allan', 'Bjorn', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Emily', 'James', 'Ashley', 'Christopher', 'Amanda', 'Daniel', 'Michelle', 'Matthew', 'Stephanie', 'Anthony', 'Melissa'];
    const lastNames = ['Bailey', 'Pettinelli', 'Carasco', 'Gangeness', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor'];
    const domains = ['3m.com', 'lab.com', 'environmental.com', 'finance.com', 'consulting.com', 'test-lab.com', 'analysis.com', 'research.com'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];

    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
};

// Function to generate random subjects
const generateSubject = () => {
    const subjects = [
        'Laboratory Report Request',
        'Budget Update - Q3 Projects',
        'Environmental Compliance Review',
        'Site Analysis Results',
        'Quarterly Financial Report',
        'Safety Protocol Updates',
        'Research Data Analysis',
        'Project Status Update',
        'Meeting Schedule Confirmation',
        'Document Review Required',
        'Contract Amendment Discussion',
        'Technical Specifications',
        'Performance Metrics Report',
        'Regulatory Compliance Check',
        'Cost Analysis Summary',
        'Timeline Adjustment Request',
        'Quality Assurance Review',
        'Risk Assessment Update',
        'Resource Allocation Plan',
        'Implementation Timeline'
    ];

    return subjects[Math.floor(Math.random() * subjects.length)];
};

// Function to generate random bates numbers
const generateBatesNumber = (baseNumber) => {
    return `3M_AFFF_MDL${String(baseNumber).padStart(8, '0')}`;
};

// Function to generate random attachment content
const generateAttachments = () => {
    const attachmentTypes = [
        'Laboratory Report.pdf',
        'Data Analysis.xlsx',
        'Site Survey.docx',
        'Financial Summary.pdf',
        'Test Results.xlsx',
        'Project Timeline.docx',
        'Budget Breakdown.xlsx',
        'Compliance Report.pdf',
        'Meeting Notes.docx',
        'Technical Specifications.pdf'
    ];

    const count = Math.floor(Math.random() * 4) + 1; // 1-4 attachments
    const attachments = [];

    for (let i = 0; i < count; i++) {
        const filename = attachmentTypes[Math.floor(Math.random() * attachmentTypes.length)];
        const size = Math.floor(Math.random() * 2000) + 100; // 100KB - 2MB
        attachments.push(`${filename} (${size} kB)`);
    }

    return attachments.join('; ');
};

// Generate 500 threads
const threads = {};
let currentBatesBase = 2400000;

for (let i = 1; i <= 500; i++) {
    const threadId = `THREAD_${String(i).padStart(3, '0')}`;
    const emailCount = Math.floor(Math.random() * 8) + 2; // 2-9 emails per thread
    const participants = [];

    // Generate 2-6 participants per thread
    const participantCount = Math.floor(Math.random() * 5) + 2;
    for (let p = 0; p < participantCount; p++) {
        participants.push(generateEmail());
    }

    const emails = [];
    let messageIdCounter = 1;

    // Generate emails for this thread
    for (let e = 0; e < emailCount; e++) {
        const emailId = `email_${i}_${e + 1}`;
        const messageId = `<msg-${i}-${messageIdCounter++}@3m.com>`;
        const isReply = e > 0;

        // Calculate bates ranges
        const emailBatesStart = currentBatesBase;
        const emailBatesEnd = currentBatesBase + Math.floor(Math.random() * 5) + 1;
        let attachBatesStart = '';
        let attachBatesEnd = '';

        // 60% chance of having attachments
        const hasAttachments = Math.random() > 0.4;
        let attachmentText = '';

        if (hasAttachments) {
            attachBatesStart = emailBatesEnd + 1;
            attachBatesEnd = attachBatesStart + Math.floor(Math.random() * 50) + 10;
            attachmentText = `\n\nAttachments:\n${generateAttachments()}`;
        }

        currentBatesBase = hasAttachments ? attachBatesEnd + 1 : emailBatesEnd + 1;

        const email = {
            id: emailId,
            messageId: messageId,
            inReplyTo: isReply ? emails[e-1].messageId : '',
            references: isReply ? emails.slice(0, e).map(em => em.messageId) : [],
            threadId: threadId,
            from: participants[Math.floor(Math.random() * participants.length)],
            to: [participants[Math.floor(Math.random() * participants.length)]],
            cc: Math.random() > 0.7 ? [participants[Math.floor(Math.random() * participants.length)]] : [],
            bcc: [],
            subject: isReply ? `RE: ${generateSubject()}` : generateSubject(),
            dateSent: new Date(2016 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
            custodian: 'Generated Test Import',
            fileName: `${emailId}.eml`,
            begBates: generateBatesNumber(emailBatesStart),
            endBates: generateBatesNumber(emailBatesEnd),
            begAttach: hasAttachments ? generateBatesNumber(attachBatesStart) : '',
            endAttach: hasAttachments ? generateBatesNumber(attachBatesEnd) : '',
            fullText: `This is a test email for thread ${threadId}, message ${e + 1}.\n\nGenerated for testing purposes.${attachmentText}\n\nBest regards,\nTest User`,
            confidentiality: Math.random() > 0.5 ? 'Internal Use Only' : 'Confidential'
        };

        emails.push(email);
    }

    // Calculate thread statistics
    const replyCount = emails.filter(email => email.inReplyTo).length;
    const dateRange = {
        start: emails.reduce((earliest, email) => email.dateSent < earliest ? email.dateSent : earliest, emails[0].dateSent),
        end: emails.reduce((latest, email) => email.dateSent > latest ? email.dateSent : latest, emails[0].dateSent)
    };

    threads[threadId] = {
        id: threadId,
        subject: emails[0].subject.replace(/^RE:\s*/, ''),
        totalEmails: emailCount,
        participantCount: participants.length,
        participants: participants,
        dateRange: dateRange,
        maxDepth: Math.max(1, replyCount),
        branchCount: 1,
        replyCount: replyCount,
        forwardCount: 0,
        emails: emails
    };
}

// Create the final data structure
const testThreadData = {
    summary: {
        generatedAt: new Date().toISOString(),
        totalEmails: Object.values(threads).reduce((sum, thread) => sum + thread.totalEmails, 0),
        totalThreads: 500,
        methodUsed: 'Generated 500 Thread Test Data'
    },
    threads: threads
};

// Write the data
fs.writeFileSync('thread_report.json', JSON.stringify(testThreadData, null, 2));

console.log('✅ Created thread_report.json with 500 test threads');
console.log('📊 Summary:');
console.log(`   - Total threads: ${testThreadData.summary.totalThreads}`);
console.log(`   - Total emails: ${testThreadData.summary.totalEmails}`);
console.log(`   - Average emails per thread: ${(testThreadData.summary.totalEmails / testThreadData.summary.totalThreads).toFixed(1)}`);

const threadsWithAttachments = Object.values(threads).filter(thread =>
    thread.emails.some(email => email.begAttach && email.begAttach !== '')
).length;

console.log(`   - Threads with attachments: ${threadsWithAttachments}`);
console.log('🚀 Ready to test with 500 threads!');