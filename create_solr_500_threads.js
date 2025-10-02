const https = require('https');
const fs = require('fs');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'solr.casedoxx.com',
      port: 8983,
      path: path,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function cleanParticipant(email) {
  if (!email) return 'Unknown';

  // Remove quotes and extra whitespace
  let cleaned = email.replace(/['"]/g, '').trim();

  // Handle cases like "Name <email@domain.com>" or just "email@domain.com"
  const emailMatch = cleaned.match(/<([^>]+)>/);
  if (emailMatch) {
    return emailMatch[1]; // Extract email from angle brackets
  }

  // Handle comma-separated names/emails
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }

  return cleaned;
}

function extractMessageId(fullText) {
  if (!fullText) return null;

  // Try to find Message-ID in the email headers
  const messageIdMatch = fullText.match(/Message-ID:\s*<([^>]+)>/i);
  if (messageIdMatch) {
    return `<${messageIdMatch[1]}>`;
  }

  return null;
}

function extractInReplyTo(fullText) {
  if (!fullText) return '';

  // Try to find In-Reply-To in the email headers
  const replyToMatch = fullText.match(/In-Reply-To:\s*<([^>]+)>/i);
  if (replyToMatch) {
    return `<${replyToMatch[1]}>`;
  }

  return '';
}

function extractReferences(fullText) {
  if (!fullText) return [];

  // Try to find References in the email headers
  const referencesMatch = fullText.match(/References:\s*(.+)/i);
  if (referencesMatch) {
    // Extract all message IDs from references
    const refs = referencesMatch[1].match(/<[^>]+>/g);
    return refs || [];
  }

  return [];
}

async function createSolrAllThreads() {
  try {
    console.log('=== Fetching Optimized Set of Emails from Solr ===\n');
    console.log('Note: Larger queries are timing out, so fetching maximum stable amount\n');

    // Fetch 500 emails (maximum stable query size)
    const maxFetch = 500;
    console.log(`🎯 Fetching ${maxFetch.toLocaleString()} emails for comprehensive threading analysis\n`);

    // Query for 500 emails with full data including bates info - using correct field names
    const query = encodeURI(`/solr/casedoxx/select?q=email_from_str:*&rows=${maxFetch}&fl=id,email_from_str,email_to_str,email_cc_str,email_subject,email_datesent,body,bates_begbates,bates_endbates,bates_begattach,bates_endattach,email_message-id&wt=json&sort=email_datesent desc`);

    console.log(`Querying Solr for ${maxFetch.toLocaleString()} emails...`);
    const response = await makeRequest(query);

    if (!response.response || !response.response.docs) {
      throw new Error('No response data from Solr');
    }

    const docs = response.response.docs;
    console.log(`✅ Retrieved ${docs.length.toLocaleString()} emails from Solr`);

    // Debug: Show sample of retrieved data
    if (docs.length > 0) {
      console.log('Sample email data:', {
        id: docs[0].id,
        from: docs[0].email_from_str,
        subject: docs[0].email_subject,
        hasBody: !!docs[0].body,
        messageId: docs[0]['email_message-id'],
        bates: docs[0].bates_begbates,
        bodyPreview: docs[0].body ? docs[0].body.substring(0, 100) + '...' : 'No body'
      });
    }

    // Group emails into threads using hybrid approach
    console.log('\n=== Building Thread Structure ===');

    const messageIdToEmails = new Map();
    const subjectToEmails = new Map();
    const emailsById = new Map();

    // First pass: index all emails
    docs.forEach((doc, index) => {
      // Process email_from_str array - combine name components
      const fromArray = Array.isArray(doc.email_from_str) ? doc.email_from_str : [doc.email_from_str];
      const fromName = fromArray.length >= 2 ? fromArray[1] : fromArray[0]; // Use second element (full name) if available

      // Clean subject by removing brackets if present
      let subject = doc.email_subject || 'No Subject';
      if (subject.startsWith('[') && subject.endsWith(']')) {
        subject = subject.slice(1, -1);
      }

      const email = {
        id: `solr_email_${doc.id}`,
        messageId: doc['email_message-id'] ? `<${doc['email_message-id']}>` : extractMessageId(doc.body) || `<generated-${doc.id}@solr>`,
        inReplyTo: extractInReplyTo(doc.body),
        references: extractReferences(doc.body),
        from: cleanParticipant(fromName),
        to: Array.isArray(doc.email_to_str) ? doc.email_to_str.map(cleanParticipant) : [cleanParticipant(doc.email_to_str)].filter(Boolean),
        cc: Array.isArray(doc.email_cc_str) ? doc.email_cc_str.map(cleanParticipant) : [cleanParticipant(doc.email_cc_str)].filter(Boolean),
        bcc: [],
        subject: subject,
        dateSent: doc.email_datesent || new Date().toISOString(),
        custodian: 'Solr Import',
        fileName: `email_${doc.id}.eml`,
        begBates: doc.bates_begbates || '',
        endBates: doc.bates_endbates || '',
        begAttach: doc.bates_begattach || '',
        endAttach: doc.bates_endattach || '',
        fullText: doc.body || '',
        confidentiality: 'Internal Use Only',
        solrId: doc.id,
        chronologicalIndex: index
      };

      emailsById.set(email.id, email);

      if (index < 3) {
        console.log(`Email ${index + 1} processed:`, {
          id: email.id,
          messageId: email.messageId,
          from: email.from,
          subject: email.subject
        });
      }

      // Index by Message-ID for threading
      if (email.messageId) {
        if (!messageIdToEmails.has(email.messageId)) {
          messageIdToEmails.set(email.messageId, []);
        }
        messageIdToEmails.get(email.messageId).push(email);
      }

      // Index by subject for subject-based threading
      const normalizedSubject = email.subject.replace(/^(Re:|RE:|Fw:|FW:|Fwd:)\s*/i, '').toLowerCase().trim();
      if (normalizedSubject) {
        if (!subjectToEmails.has(normalizedSubject)) {
          subjectToEmails.set(normalizedSubject, []);
        }
        subjectToEmails.get(normalizedSubject).push(email);
      }
    });

    // Second pass: Build threads using hybrid approach
    const threads = new Map();
    const processedEmails = new Set();

    // Helper function to create thread
    function createThread(rootEmail, threadEmails) {
      const threadId = `SOLR_THREAD_${rootEmail.solrId}`;
      const participants = new Set();

      threadEmails.forEach(email => {
        participants.add(email.from);
        email.to.forEach(addr => participants.add(addr));
        email.cc.forEach(addr => participants.add(addr));
      });

      // Sort emails chronologically
      threadEmails.sort((a, b) => new Date(a.dateSent) - new Date(b.dateSent));

      // Set threadId for all emails
      threadEmails.forEach(email => {
        email.threadId = threadId;
      });

      const dates = threadEmails.map(e => new Date(e.dateSent));
      const replyCount = threadEmails.filter(e => e.inReplyTo).length;
      const forwardCount = threadEmails.filter(e => e.subject.match(/^(Fw:|FW:|Fwd:)/i)).length;

      return {
        threadId: threadId,
        id: threadId,
        subject: rootEmail.subject.replace(/^(Re:|RE:|Fw:|FW:|Fwd:)\s*/i, ''),
        totalEmails: threadEmails.length,
        participantCount: participants.size,
        participants: Array.from(participants).filter(p => p && p !== 'Unknown'),
        dateRange: {
          start: new Date(Math.min(...dates)).toISOString(),
          end: new Date(Math.max(...dates)).toISOString()
        },
        maxDepth: Math.max(1, replyCount),
        branchCount: 1,
        replyCount: replyCount,
        forwardCount: forwardCount,
        emails: threadEmails
      };
    }

    // Process Message-ID based threads first (highest priority)
    console.log('Building Message-ID based threads...');
    let messageIdThreads = 0;

    Array.from(emailsById.values()).forEach(email => {
      if (processedEmails.has(email.id)) return;

      const threadEmails = [email];
      const tempProcessed = new Set([email.id]); // Use temporary set to avoid marking emails as processed prematurely

      // Find all emails in this thread using Message-ID chain
      function findRelatedEmails(currentEmail) {
        // Find replies to this email
        Array.from(emailsById.values()).forEach(otherEmail => {
          if (tempProcessed.has(otherEmail.id) || processedEmails.has(otherEmail.id)) return;

          if (otherEmail.inReplyTo === currentEmail.messageId ||
              otherEmail.references.includes(currentEmail.messageId)) {
            threadEmails.push(otherEmail);
            tempProcessed.add(otherEmail.id);
            findRelatedEmails(otherEmail); // Recursively find more
          }
        });

        // Find parent of this email
        if (currentEmail.inReplyTo) {
          const parentEmail = Array.from(emailsById.values()).find(e =>
            e.messageId === currentEmail.inReplyTo && !tempProcessed.has(e.id) && !processedEmails.has(e.id)
          );
          if (parentEmail) {
            threadEmails.push(parentEmail);
            tempProcessed.add(parentEmail.id);
            findRelatedEmails(parentEmail);
          }
        }
      }

      findRelatedEmails(email);

      if (threadEmails.length > 1) {
        // Only mark as processed if we found a real thread
        threadEmails.forEach(e => processedEmails.add(e.id));
        const thread = createThread(email, threadEmails);
        threads.set(thread.threadId, thread);
        messageIdThreads++;
      }
      // If single email, don't mark as processed yet - let single-email thread creation handle it
    });

    console.log(`✅ Created ${messageIdThreads} Message-ID based threads`);

    // Process remaining emails using subject-based threading
    console.log('Building subject-based threads for remaining emails...');
    let subjectThreads = 0;

    Array.from(emailsById.values()).forEach(email => {
      if (processedEmails.has(email.id)) return;

      const normalizedSubject = email.subject.replace(/^(Re:|RE:|Fw:|FW:|Fwd:)\s*/i, '').toLowerCase().trim();
      const subjectEmails = subjectToEmails.get(normalizedSubject) || [];
      const unprocessedSubjectEmails = subjectEmails.filter(e => !processedEmails.has(e.id));

      if (unprocessedSubjectEmails.length > 1) {
        const thread = createThread(email, unprocessedSubjectEmails);
        threads.set(thread.threadId, thread);
        unprocessedSubjectEmails.forEach(e => processedEmails.add(e.id));
        subjectThreads++;
      }
    });

    console.log(`✅ Created ${subjectThreads} subject-based threads`);

    // Create single-email threads for remaining emails
    console.log('Creating single-email threads...');
    console.log(`Total emails: ${emailsById.size}, Processed emails: ${processedEmails.size}`);
    let singleThreads = 0;

    Array.from(emailsById.values()).forEach(email => {
      if (processedEmails.has(email.id)) return;

      if (singleThreads < 3) {
        console.log(`Creating single thread for email: ${email.id}`);
      }

      const thread = createThread(email, [email]);
      threads.set(thread.threadId, thread);
      processedEmails.add(email.id);
      singleThreads++;
    });

    console.log(`✅ Created ${singleThreads} single-email threads`);

    // Convert to final format - keep all threads (no limit)
    const threadArray = Array.from(threads.values());

    const threadsObject = {};
    threadArray.forEach(thread => {
      threadsObject[thread.threadId] = thread;
    });

    const totalEmailsInThreads = threadArray.reduce((sum, thread) => sum + thread.totalEmails, 0);

    const finalData = {
      summary: {
        generatedAt: new Date().toISOString(),
        totalEmails: totalEmailsInThreads,
        totalThreads: threadArray.length,
        methodUsed: 'Solr Hybrid Threading (Message-ID + Subject)',
        solrTotalAvailable: 'Unknown (count query timed out)',
        emailsFetched: maxFetch
      },
      threads: threadsObject
    };

    // Write the data
    fs.writeFileSync('thread_report.json', JSON.stringify(finalData, null, 2));

    console.log('\n=== SUCCESS ===');
    console.log(`✅ Created thread_report.json with real Solr data`);
    console.log(`📊 Summary:`);
    console.log(`   - Solr emails available: ${finalData.summary.solrTotalAvailable}`);
    console.log(`   - Emails fetched: ${finalData.summary.emailsFetched.toLocaleString()}`);
    console.log(`   - Total threads created: ${finalData.summary.totalThreads.toLocaleString()}`);
    console.log(`   - Total emails in threads: ${finalData.summary.totalEmails.toLocaleString()}`);
    console.log(`   - Average emails per thread: ${(finalData.summary.totalEmails / finalData.summary.totalThreads).toFixed(1)}`);
    console.log(`   - Message-ID threads: ${messageIdThreads}`);
    console.log(`   - Subject-based threads: ${subjectThreads}`);
    console.log(`   - Single-email threads: ${singleThreads}`);

    const threadsWithAttachments = threadArray.filter(thread =>
      thread.emails.some(email => email.begAttach && email.begAttach !== '')
    ).length;

    console.log(`   - Threads with attachments: ${threadsWithAttachments.toLocaleString()}`);
    console.log('\n🚀 Ready to test with all available Solr data!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
createSolrAllThreads().catch(console.error);