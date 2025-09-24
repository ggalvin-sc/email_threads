const https = require('https');
const fs = require('fs-extra');
const path = require('path');

class SolrEmailProcessor {
  constructor() {
    this.solrHost = 'solr.casedoxx.com';
    this.solrPort = 8983;
    this.emails = [];
    this.threads = new Map();
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
        // If date parsing fails, use a default
        headers.dateSent = new Date();
      }
    }

    return headers;
  }

  async getUniqueMessageIds(limit = 20) {
    console.log(`Getting first ${limit} unique Message-IDs from Solr...`);

    const docs = await this.makeRequest('/solr/casedoxx/select?q=body:"Message-ID:"&rows=1000&fl=id,body&wt=json');

    if (!docs.response) {
      throw new Error('No response from Solr');
    }

    const messageIds = new Set();
    const messageIdDocs = [];

    for (const doc of docs.response.docs) {
      const headers = this.extractEmailHeaders(doc.body);
      if (headers.messageId && !messageIds.has(headers.messageId)) {
        messageIds.add(headers.messageId);
        messageIdDocs.push({
          solrId: doc.id,
          messageId: headers.messageId,
          body: doc.body
        });

        if (messageIds.size >= limit) {
          break;
        }
      }
    }

    console.log(`Found ${messageIds.size} unique Message-IDs`);
    return messageIdDocs;
  }

  async buildThreadsFromMessageIds(messageIdDocs) {
    console.log('Building email threads from Message-IDs...');

    const emails = [];

    // First, process the root messages
    for (const doc of messageIdDocs) {
      const headers = this.extractEmailHeaders(doc.body);

      const email = {
        id: doc.solrId,
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
        references: headers.references || [],
        from: headers.from || 'Unknown',
        to: headers.to || [],
        subject: headers.subject || 'No Subject',
        dateSent: headers.dateSent || new Date(),
        body: doc.body,
        isRoot: true
      };

      emails.push(email);
      this.messageIdToEmail.set(email.messageId, email);
    }

    // Now find all emails that reply to these Message-IDs
    console.log('Finding reply emails...');

    for (const messageId of messageIdDocs.map(d => d.messageId)) {
      // Search for emails that have this messageId in their In-Reply-To or References
      const replyQuery = encodeURIComponent(`body:"${messageId}"`);
      const replyDocs = await this.makeRequest(`/solr/casedoxx/select?q=${replyQuery}&rows=100&fl=id,body,email_subject&wt=json`);

      if (replyDocs.response && replyDocs.response.docs) {
        for (const replyDoc of replyDocs.response.docs) {
          const headers = this.extractEmailHeaders(replyDoc.body);

          // Only include if it actually references our message ID
          if (headers.inReplyTo === messageId || (headers.references && headers.references.includes(messageId))) {
            const replyEmail = {
              id: replyDoc.id,
              messageId: headers.messageId,
              inReplyTo: headers.inReplyTo,
              references: headers.references || [],
              from: headers.from || 'Unknown',
              to: headers.to || [],
              subject: headers.subject || replyDoc.email_subject || 'No Subject',
              dateSent: headers.dateSent || new Date(),
              body: replyDoc.body,
              isRoot: false
            };

            emails.push(replyEmail);
            if (replyEmail.messageId) {
              this.messageIdToEmail.set(replyEmail.messageId, replyEmail);
            }
          }
        }
      }
    }

    console.log(`Total emails collected: ${emails.length}`);

    this.emails = emails;
    this.buildThreadStructure();

    return emails;
  }

  buildThreadStructure() {
    console.log('Building thread structure...');

    // Group emails into threads
    const threads = new Map();

    for (const email of this.emails) {
      let threadId = null;

      if (email.inReplyTo) {
        // Find the thread this email belongs to
        const parentEmail = this.messageIdToEmail.get(email.inReplyTo);
        if (parentEmail) {
          // Find which thread the parent belongs to
          for (const [tid, thread] of threads) {
            if (thread.emails.some(e => e.messageId === parentEmail.messageId)) {
              threadId = tid;
              break;
            }
          }
        }
      }

      if (!threadId) {
        // Create a new thread
        threadId = email.messageId || email.id;
      }

      if (!threads.has(threadId)) {
        threads.set(threadId, {
          id: threadId,
          rootMessageId: threadId,
          emails: [],
          subject: email.subject,
          participants: new Set()
        });
      }

      const thread = threads.get(threadId);
      thread.emails.push(email);

      if (email.from) thread.participants.add(email.from);
      if (email.to) email.to.forEach(addr => thread.participants.add(addr));
    }

    // Convert participants sets to arrays and sort emails by date
    for (const thread of threads.values()) {
      thread.participants = Array.from(thread.participants);
      thread.emails.sort((a, b) => a.dateSent - b.dateSent);
    }

    this.threads = threads;
    console.log(`Created ${threads.size} threads`);
  }

  async exportToEmailThreadsFormat() {
    console.log('Exporting to email threads format...');

    const emailThreadsData = [];

    for (const [threadId, thread] of this.threads) {
      for (let i = 0; i < thread.emails.length; i++) {
        const email = thread.emails[i];

        emailThreadsData.push({
          BegBates: email.id,
          MessageId: email.messageId,
          InReplyTo: email.inReplyTo || '',
          References: email.references.join(' '),
          ThreadId: threadId,
          From: email.from,
          To: Array.isArray(email.to) ? email.to.join(', ') : email.to,
          CC: '',
          BCC: '',
          Subject: email.subject,
          DateSent: email.dateSent.toISOString(),
          Custodian: 'Solr Import',
          FileName: `email_${email.id}.eml`,
          FullText: email.body,
          Confidentiality: '',
          column_history: `MSG-ID:${email.messageId}|IN-REPLY-TO:${email.inReplyTo || ''}|REFS:${email.references.join(' ')}`
        });
      }
    }

    // Write to CSV format
    const csv = require('csv-writer');
    const csvWriter = csv.createObjectCsvWriter({
      path: path.join(__dirname, '..', 'solr_email_data.csv'),
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
    console.log(`Exported ${emailThreadsData.length} email records to solr_email_data.csv`);

    // Also save thread analysis
    const threadAnalysis = {
      totalThreads: this.threads.size,
      totalEmails: this.emails.length,
      threads: Array.from(this.threads.values()).map(thread => ({
        id: thread.id,
        subject: thread.subject,
        emailCount: thread.emails.length,
        participants: thread.participants,
        dateRange: {
          start: thread.emails[0]?.dateSent,
          end: thread.emails[thread.emails.length - 1]?.dateSent
        }
      }))
    };

    await fs.writeJson(path.join(__dirname, '..', 'solr_thread_analysis.json'), threadAnalysis, { spaces: 2 });
    console.log('Thread analysis saved to solr_thread_analysis.json');

    return emailThreadsData;
  }

  async processFirst20MessageIds() {
    try {
      // Get first 20 unique message IDs
      const messageIdDocs = await this.getUniqueMessageIds(20);

      // Build threads from these message IDs
      await this.buildThreadsFromMessageIds(messageIdDocs);

      // Export to email threads format
      const emailData = await this.exportToEmailThreadsFormat();

      console.log('\n=== Processing Complete ===');
      console.log(`Processed ${this.threads.size} threads with ${this.emails.length} total emails`);

      return {
        threads: Array.from(this.threads.values()),
        emails: this.emails,
        csvPath: path.join(__dirname, '..', 'solr_email_data.csv')
      };

    } catch (error) {
      console.error('Error processing Solr data:', error);
      throw error;
    }
  }
}

module.exports = SolrEmailProcessor;