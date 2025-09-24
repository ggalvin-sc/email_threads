const https = require('https');
const fs = require('fs-extra');
const path = require('path');

class AdvancedSolrProcessor {
  constructor() {
    this.solrHost = 'solr.casedoxx.com';
    this.solrPort = 8983;
    this.emails = [];
    this.messageIdToEmail = new Map();
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.solrHost,
        port: this.solrPort,
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
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  extractEmailHeaders(body) {
    if (!body) return {};

    const headers = {};

    // Extract Message-ID
    const messageIdMatch = body.match(/Message-ID:\s*<([^>]+)>/i) || body.match(/Message-ID:\s*([^\r\n\s]+)/i);
    if (messageIdMatch) {
      headers.messageId = messageIdMatch[1].trim();
    }

    // Extract In-Reply-To
    const inReplyToMatch = body.match(/In-Reply-To:\s*<([^>]+)>/i) || body.match(/In-Reply-To:\s*([^\r\n\s]+)/i);
    if (inReplyToMatch) {
      headers.inReplyTo = inReplyToMatch[1].trim();
    }

    // Extract References
    const referencesMatch = body.match(/References:\s*([^\r\n]+)/i);
    if (referencesMatch) {
      headers.references = referencesMatch[1].trim().split(/\s+/).map(ref => ref.replace(/[<>]/g, ''));
    }

    // Extract From
    const fromMatch = body.match(/From:\s*([^\r\n]+)/i);
    if (fromMatch) {
      headers.from = fromMatch[1].trim();
    }

    // Extract To
    const toMatch = body.match(/To:\s*([^\r\n]+)/i);
    if (toMatch) {
      headers.to = toMatch[1].trim().split(/[,;]/).map(addr => addr.trim());
    }

    // Extract Subject
    const subjectMatch = body.match(/Subject:\s*([^\r\n]+)/i);
    if (subjectMatch) {
      headers.subject = subjectMatch[1].trim();
    }

    // Extract Date
    const dateMatch = body.match(/Date:\s*([^\r\n]+)/i) || body.match(/Sent:\s*([^\r\n]+)/i);
    if (dateMatch) {
      try {
        headers.dateSent = new Date(dateMatch[1].trim());
      } catch (e) {
        headers.dateSent = new Date();
      }
    }

    return headers;
  }

  normalizeSubject(subject) {
    if (!subject) return '';
    return subject
      .replace(/^(RE:|FW:|Fwd:|Re:)\s*/gi, '')
      .trim()
      .toLowerCase();
  }

  async getAllThreadableEmails(limit = 100) {
    console.log(`Getting ${limit} emails with threading information...`);

    // Get emails that have either Message-ID or are replies
    const query = 'body:"Message-ID:"%20OR%20body:"In-Reply-To:"%20OR%20email_subject:("RE:"%20OR%20"FW:"%20OR%20"Fwd:"%20OR%20"Re:")';
    const docs = await this.makeRequest(`/solr/casedoxx/select?q=${query}&rows=${limit}&fl=id,body,email_subject,email_from_str,email_to_str,email_datesent&wt=json`);

    if (!docs.response) {
      throw new Error('No response from Solr');
    }

    const emails = [];

    for (const doc of docs.response.docs) {
      const headers = this.extractEmailHeaders(doc.body);

      const email = {
        id: doc.id,
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
        references: headers.references || [],
        from: headers.from || (Array.isArray(doc.email_from_str) ? doc.email_from_str[0] : doc.email_from_str) || 'Unknown',
        to: headers.to || (Array.isArray(doc.email_to_str) ? doc.email_to_str : [doc.email_to_str]).filter(Boolean),
        subject: headers.subject || doc.email_subject || 'No Subject',
        normalizedSubject: this.normalizeSubject(headers.subject || doc.email_subject),
        dateSent: headers.dateSent || (doc.email_datesent ? new Date(doc.email_datesent) : new Date()),
        body: doc.body || ''
      };

      emails.push(email);
      if (email.messageId) {
        this.messageIdToEmail.set(email.messageId, email);
      }
    }

    this.emails = emails.sort((a, b) => a.dateSent - b.dateSent);
    console.log(`Loaded ${emails.length} emails`);
    return emails;
  }

  // Approach 1: Message-ID only threading
  buildMessageIdOnlyThreads() {
    console.log('\n=== Approach 1: Message-ID Only Threading ===');

    const threads = new Map();
    const processedEmails = new Set();

    for (const email of this.emails) {
      if (processedEmails.has(email.id)) continue;

      // Find thread root
      let rootId = email.messageId || email.id;

      if (email.inReplyTo && this.messageIdToEmail.has(email.inReplyTo)) {
        // This is a reply, find the root
        let current = email;
        while (current.inReplyTo && this.messageIdToEmail.has(current.inReplyTo)) {
          current = this.messageIdToEmail.get(current.inReplyTo);
        }
        rootId = current.messageId || current.id;
      }

      if (!threads.has(rootId)) {
        threads.set(rootId, {
          id: rootId,
          emails: [],
          subject: email.subject,
          participants: new Set(),
          method: 'message-id-only'
        });
      }

      const thread = threads.get(rootId);
      thread.emails.push(email);
      thread.participants.add(email.from);
      email.to.forEach(addr => thread.participants.add(addr));
      processedEmails.add(email.id);
    }

    // Convert participants to arrays
    for (const thread of threads.values()) {
      thread.participants = Array.from(thread.participants).filter(Boolean);
      thread.emails.sort((a, b) => a.dateSent - b.dateSent);
    }

    return threads;
  }

  // Approach 2: Message-ID + Time proximity
  buildMessageIdWithProximityThreads(proximityHours = 24) {
    console.log(`\n=== Approach 2: Message-ID + Time Proximity (${proximityHours}h) ===`);

    const threads = new Map();
    const processedEmails = new Set();

    for (const email of this.emails) {
      if (processedEmails.has(email.id)) continue;

      let threadId = email.messageId || email.id;
      let foundThread = null;

      // First try Message-ID threading
      if (email.inReplyTo && this.messageIdToEmail.has(email.inReplyTo)) {
        let current = email;
        while (current.inReplyTo && this.messageIdToEmail.has(current.inReplyTo)) {
          current = this.messageIdToEmail.get(current.inReplyTo);
        }
        threadId = current.messageId || current.id;
        foundThread = threads.get(threadId);
      }

      // If no Message-ID match, try time proximity with same participants
      if (!foundThread) {
        for (const [tid, thread] of threads) {
          const lastEmail = thread.emails[thread.emails.length - 1];
          const timeDiff = Math.abs(email.dateSent - lastEmail.dateSent) / (1000 * 60 * 60); // hours

          // Check if within time window and has common participants
          if (timeDiff <= proximityHours) {
            const threadParticipants = Array.from(thread.participants);
            const hasCommonParticipant =
              threadParticipants.includes(email.from) ||
              email.to.some(addr => threadParticipants.includes(addr));

            if (hasCommonParticipant) {
              foundThread = thread;
              threadId = tid;
              break;
            }
          }
        }
      }

      if (!threads.has(threadId)) {
        threads.set(threadId, {
          id: threadId,
          emails: [],
          subject: email.subject,
          participants: new Set(),
          method: 'message-id-proximity'
        });
      }

      const thread = threads.get(threadId);
      thread.emails.push(email);
      thread.participants.add(email.from);
      email.to.forEach(addr => thread.participants.add(addr));
      processedEmails.add(email.id);
    }

    // Convert participants to arrays
    for (const thread of threads.values()) {
      thread.participants = Array.from(thread.participants).filter(Boolean);
      thread.emails.sort((a, b) => a.dateSent - b.dateSent);
    }

    return threads;
  }

  // Approach 3: Message-ID + Subject matching
  buildHybridThreads() {
    console.log('\n=== Approach 3: Message-ID + Subject Line Matching ===');

    const threads = new Map();
    const processedEmails = new Set();
    const subjectToThread = new Map();

    for (const email of this.emails) {
      if (processedEmails.has(email.id)) continue;

      let threadId = null;
      let foundThread = null;

      // First try Message-ID threading
      if (email.inReplyTo && this.messageIdToEmail.has(email.inReplyTo)) {
        let current = email;
        while (current.inReplyTo && this.messageIdToEmail.has(current.inReplyTo)) {
          current = this.messageIdToEmail.get(current.inReplyTo);
        }
        threadId = current.messageId || current.id;
        foundThread = threads.get(threadId);
      }

      // If no Message-ID match, try subject matching
      if (!foundThread && email.normalizedSubject) {
        if (subjectToThread.has(email.normalizedSubject)) {
          threadId = subjectToThread.get(email.normalizedSubject);
          foundThread = threads.get(threadId);
        }
      }

      // Create new thread if needed
      if (!foundThread) {
        threadId = email.messageId || email.id;
        if (email.normalizedSubject) {
          subjectToThread.set(email.normalizedSubject, threadId);
        }
      }

      if (!threads.has(threadId)) {
        threads.set(threadId, {
          id: threadId,
          emails: [],
          subject: email.subject,
          participants: new Set(),
          method: 'hybrid-message-id-subject'
        });
      }

      const thread = threads.get(threadId);
      thread.emails.push(email);
      thread.participants.add(email.from);
      email.to.forEach(addr => thread.participants.add(addr));
      processedEmails.add(email.id);
    }

    // Convert participants to arrays
    for (const thread of threads.values()) {
      thread.participants = Array.from(thread.participants).filter(Boolean);
      thread.emails.sort((a, b) => a.dateSent - b.dateSent);
    }

    return threads;
  }

  compareThreadingApproaches(limit = 100) {
    return this.getAllThreadableEmails(limit).then(() => {
      const approach1 = this.buildMessageIdOnlyThreads();
      const approach2 = this.buildMessageIdWithProximityThreads(24);
      const approach3 = this.buildHybridThreads();

      return {
        messageIdOnly: {
          threads: approach1,
          stats: {
            totalThreads: approach1.size,
            totalEmails: Array.from(approach1.values()).reduce((sum, t) => sum + t.emails.length, 0),
            averageThreadSize: Array.from(approach1.values()).reduce((sum, t) => sum + t.emails.length, 0) / approach1.size,
            threadsWithMultipleEmails: Array.from(approach1.values()).filter(t => t.emails.length > 1).length
          }
        },
        messageIdWithProximity: {
          threads: approach2,
          stats: {
            totalThreads: approach2.size,
            totalEmails: Array.from(approach2.values()).reduce((sum, t) => sum + t.emails.length, 0),
            averageThreadSize: Array.from(approach2.values()).reduce((sum, t) => sum + t.emails.length, 0) / approach2.size,
            threadsWithMultipleEmails: Array.from(approach2.values()).filter(t => t.emails.length > 1).length
          }
        },
        hybrid: {
          threads: approach3,
          stats: {
            totalThreads: approach3.size,
            totalEmails: Array.from(approach3.values()).reduce((sum, t) => sum + t.emails.length, 0),
            averageThreadSize: Array.from(approach3.values()).reduce((sum, t) => sum + t.emails.length, 0) / approach3.size,
            threadsWithMultipleEmails: Array.from(approach3.values()).filter(t => t.emails.length > 1).length
          }
        }
      };
    });
  }

  displayComparison(results) {
    console.log('\n' + '='.repeat(80));
    console.log('THREADING APPROACH COMPARISON');
    console.log('='.repeat(80));

    const approaches = ['messageIdOnly', 'messageIdWithProximity', 'hybrid'];
    const labels = ['Message-ID Only', 'Message-ID + Proximity', 'Message-ID + Subject'];

    approaches.forEach((approach, i) => {
      const data = results[approach];
      console.log(`\n${i + 1}. ${labels[i]}:`);
      console.log(`   Total Threads: ${data.stats.totalThreads}`);
      console.log(`   Total Emails: ${data.stats.totalEmails}`);
      console.log(`   Average Thread Size: ${data.stats.averageThreadSize.toFixed(1)} emails`);
      console.log(`   Multi-Email Threads: ${data.stats.threadsWithMultipleEmails}`);

      // Show top 3 largest threads
      const sortedThreads = Array.from(data.threads.values())
        .sort((a, b) => b.emails.length - a.emails.length)
        .slice(0, 3);

      console.log(`   Top 3 Largest Threads:`);
      sortedThreads.forEach((thread, j) => {
        const subject = thread.subject.substring(0, 50) + (thread.subject.length > 50 ? '...' : '');
        console.log(`     ${j + 1}. ${thread.emails.length} emails: "${subject}"`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('DETAILED THREAD EXAMPLES');
    console.log('='.repeat(80));

    approaches.forEach((approach, i) => {
      const data = results[approach];
      const multiEmailThreads = Array.from(data.threads.values())
        .filter(t => t.emails.length > 1)
        .sort((a, b) => b.emails.length - a.emails.length)
        .slice(0, 2);

      if (multiEmailThreads.length > 0) {
        console.log(`\n${labels[i]} - Example Multi-Email Threads:`);

        multiEmailThreads.forEach((thread, j) => {
          console.log(`\n  Thread ${j + 1}: "${thread.subject}"`);
          console.log(`    ${thread.emails.length} emails, ${thread.participants.length} participants`);
          console.log(`    Participants: ${thread.participants.slice(0, 3).join(', ')}${thread.participants.length > 3 ? ` (+${thread.participants.length - 3} more)` : ''}`);
          console.log(`    Email sequence:`);

          thread.emails.forEach((email, k) => {
            const from = email.from.split('<')[0].trim() || email.from;
            const date = email.dateSent.toLocaleDateString();
            const subject = email.subject.substring(0, 40) + (email.subject.length > 40 ? '...' : '');
            console.log(`      ${k + 1}. ${date} - ${from}: ${subject}`);
          });
        });
      }
    });
  }

  async runComparison(emailLimit = 100) {
    try {
      console.log(`Running threading comparison with ${emailLimit} emails...\n`);

      const results = await this.compareThreadingApproaches(emailLimit);
      this.displayComparison(results);

      return results;
    } catch (error) {
      console.error('Error running comparison:', error);
      throw error;
    }
  }
}

module.exports = AdvancedSolrProcessor;