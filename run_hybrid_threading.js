const AdvancedSolrProcessor = require('./src/AdvancedSolrProcessor');
const fs = require('fs-extra');
const path = require('path');

async function runHybridThreading() {
  const processor = new AdvancedSolrProcessor();

  try {
    console.log('Running hybrid threading approach (Message-ID + Subject)...\n');

    // Get 200 emails for a good sample
    const emails = await processor.getAllThreadableEmails(200);

    // Build hybrid threads
    const threads = processor.buildHybridThreads();

    console.log('\n' + '='.repeat(80));
    console.log('HYBRID THREADING RESULTS');
    console.log('='.repeat(80));

    const threadsArray = Array.from(threads.values());
    const multiEmailThreads = threadsArray.filter(t => t.emails.length > 1);
    const singleEmailThreads = threadsArray.filter(t => t.emails.length === 1);

    console.log(`\nSummary:`);
    console.log(`  Total emails processed: ${emails.length}`);
    console.log(`  Total threads created: ${threadsArray.length}`);
    console.log(`  Multi-email conversations: ${multiEmailThreads.length}`);
    console.log(`  Single email threads: ${singleEmailThreads.length}`);
    console.log(`  Average thread size: ${(emails.length / threadsArray.length).toFixed(1)} emails`);

    // Show the most interesting conversations
    const sortedThreads = multiEmailThreads.sort((a, b) => b.emails.length - a.emails.length);

    console.log(`\n=== TOP 10 CONVERSATIONS ===`);

    sortedThreads.slice(0, 10).forEach((thread, index) => {
      console.log(`\n${index + 1}. Thread: "${thread.subject}"`);
      console.log(`   ${thread.emails.length} emails, ${thread.participants.length} participants`);
      console.log(`   Time span: ${thread.emails[0].dateSent.toLocaleDateString()} to ${thread.emails[thread.emails.length-1].dateSent.toLocaleDateString()}`);

      // Show participants
      const participantList = thread.participants
        .filter(p => p && p !== 'Unknown')
        .map(p => p.split('<')[0].trim() || p.split('@')[0])
        .slice(0, 4);
      console.log(`   Participants: ${participantList.join(', ')}${thread.participants.length > 4 ? ` (+${thread.participants.length - 4} more)` : ''}`);

      // Show email sequence
      console.log(`   Conversation flow:`);
      thread.emails.forEach((email, i) => {
        const from = email.from.split('<')[0].trim() || email.from.split('@')[0];
        const date = email.dateSent.toLocaleDateString();
        const time = email.dateSent.toLocaleTimeString();
        const shortSubject = email.subject.substring(0, 60) + (email.subject.length > 60 ? '...' : '');
        console.log(`     ${i + 1}. ${date} ${time} - ${from}`);
        console.log(`        "${shortSubject}"`);
      });
    });

    // Show some examples of subject-line grouping effectiveness
    console.log(`\n=== SUBJECT LINE GROUPING EXAMPLES ===`);

    const subjectGroups = new Map();
    multiEmailThreads.forEach(thread => {
      const normalizedSubject = thread.emails[0].normalizedSubject;
      if (normalizedSubject && normalizedSubject.length > 5) {
        if (!subjectGroups.has(normalizedSubject)) {
          subjectGroups.set(normalizedSubject, []);
        }
        subjectGroups.get(normalizedSubject).push(thread);
      }
    });

    const topSubjects = Array.from(subjectGroups.entries())
      .filter(([subject, threads]) => threads.reduce((sum, t) => sum + t.emails.length, 0) > 1)
      .sort(([,a], [,b]) => b.reduce((sum, t) => sum + t.emails.length, 0) - a.reduce((sum, t) => sum + t.emails.length, 0))
      .slice(0, 5);

    topSubjects.forEach(([subject, threadList], index) => {
      const totalEmails = threadList.reduce((sum, t) => sum + t.emails.length, 0);
      console.log(`\n${index + 1}. Subject: "${subject}"`);
      console.log(`   ${totalEmails} emails across ${threadList.length} thread(s)`);

      threadList.forEach((thread, i) => {
        console.log(`   Thread ${i + 1}: ${thread.emails.length} emails`);
        thread.emails.slice(0, 3).forEach((email, j) => {
          const from = email.from.split('<')[0].trim() || email.from.split('@')[0];
          const date = email.dateSent.toLocaleDateString();
          console.log(`     - ${date}: ${from}`);
        });
        if (thread.emails.length > 3) {
          console.log(`     ... and ${thread.emails.length - 3} more emails`);
        }
      });
    });

    // Export for email thread system
    console.log(`\n=== EXPORTING FOR EMAIL THREAD SYSTEM ===`);

    const emailThreadsData = [];
    let emailCount = 0;

    for (const thread of multiEmailThreads.slice(0, 20)) { // Top 20 conversations
      for (const email of thread.emails) {
        emailThreadsData.push({
          BegBates: email.id,
          MessageId: email.messageId || '',
          InReplyTo: email.inReplyTo || '',
          References: email.references.join(' '),
          ThreadId: thread.id,
          From: email.from,
          To: Array.isArray(email.to) ? email.to.join(', ') : email.to || '',
          CC: '',
          BCC: '',
          Subject: email.subject,
          DateSent: email.dateSent.toISOString(),
          Custodian: 'Hybrid Solr Import',
          FileName: `email_${email.id}.eml`,
          FullText: email.body,
          Confidentiality: '',
          column_history: `MSG-ID:${email.messageId || ''}|IN-REPLY-TO:${email.inReplyTo || ''}|REFS:${email.references.join(' ')}|THREAD:${thread.id}`
        });
        emailCount++;
      }
    }

    // Write CSV for email thread system
    const csvWriter = require('csv-writer').createObjectCsvWriter({
      path: './hybrid_threads_data.csv',
      header: [
        {id: 'BegBates', title: 'BegBates'},
        {id: 'MessageId', title: 'MessageId'},
        {id: 'InReplyTo', title: 'InReplyTo'},
        {id: 'References', title: 'References'},
        {id: 'ThreadId', title: 'ThreadId'},
        {id: 'From', title: 'From'},
        {id: 'To', title: 'To'},
        {id: 'CC', title: 'CC'},
        {id: 'BCC', title: 'BCC'},
        {id: 'Subject', title: 'Subject'},
        {id: 'DateSent', title: 'DateSent'},
        {id: 'Custodian', title: 'Custodian'},
        {id: 'FileName', title: 'FileName'},
        {id: 'FullText', title: 'FullText'},
        {id: 'Confidentiality', title: 'Confidentiality'},
        {id: 'column_history', title: 'column_history'}
      ]
    });

    await csvWriter.writeRecords(emailThreadsData);

    console.log(`\nExported ${emailCount} emails from top conversations to: hybrid_threads_data.csv`);
    console.log(`\nTo view in your email thread system:`);
    console.log(`1. cp hybrid_threads_data.csv email_test_data.csv`);
    console.log(`2. npm start`);

    return {
      totalThreads: threadsArray.length,
      multiEmailThreads: multiEmailThreads.length,
      totalEmails: emails.length,
      topConversations: sortedThreads.slice(0, 10)
    };

  } catch (error) {
    console.error('Error running hybrid threading:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runHybridThreading().catch(console.error);
}

module.exports = runHybridThreading;