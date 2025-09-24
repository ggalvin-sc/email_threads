const https = require('https');

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
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function extractEmailHeaders(body) {
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

  return headers;
}

async function analyzeThreadingPatterns() {
  console.log('=== Analyzing Email Threading Patterns ===\n');

  try {
    // 1. Find actual email chains (emails with In-Reply-To)
    console.log('1. Looking for email chains with replies...');

    const replyEmails = await makeRequest('/solr/casedoxx/select?q=body:"In-Reply-To:"%20AND%20body:"Message-ID:"&rows=100&fl=id,body,email_subject&wt=json');

    if (replyEmails.response && replyEmails.response.docs.length > 0) {
      console.log(`Found ${replyEmails.response.numFound} emails that are both replies AND have Message-IDs`);

      const threadChains = new Map(); // messageId -> replies
      const rootMessages = new Set();

      // Process each email to build thread relationships
      for (const doc of replyEmails.response.docs.slice(0, 50)) { // Process first 50 for analysis
        const headers = extractEmailHeaders(doc.body);

        if (headers.messageId && headers.inReplyTo) {
          // This email is a reply
          if (!threadChains.has(headers.inReplyTo)) {
            threadChains.set(headers.inReplyTo, []);
            rootMessages.add(headers.inReplyTo);
          }
          threadChains.get(headers.inReplyTo).push({
            id: doc.id,
            messageId: headers.messageId,
            subject: doc.email_subject,
            inReplyTo: headers.inReplyTo
          });
        }
      }

      console.log(`\nFound ${threadChains.size} root messages with replies:`);

      // Show the most active threads
      const sortedThreads = Array.from(threadChains.entries())
        .sort(([,a], [,b]) => b.length - a.length)
        .slice(0, 10);

      sortedThreads.forEach(([rootId, replies], index) => {
        console.log(`\nThread ${index + 1} (Root: ${rootId.substring(0, 30)}...):`);
        console.log(`  ${replies.length} replies`);

        replies.slice(0, 3).forEach((reply, i) => {
          console.log(`    ${i + 1}. ${reply.subject || 'No Subject'} (ID: ${reply.id})`);
        });

        if (replies.length > 3) {
          console.log(`    ... and ${replies.length - 3} more replies`);
        }
      });
    }

    // 2. Analyze subject line patterns for threading
    console.log('\n\n2. Analyzing subject line patterns...');

    const subjectPatterns = await makeRequest('/solr/casedoxx/select?q=email_subject:("RE:"%20OR%20"FW:"%20OR%20"Fwd:"%20OR%20"Re:")&rows=50&fl=id,email_subject,email_from_str&wt=json');

    if (subjectPatterns.response) {
      console.log(`Found ${subjectPatterns.response.numFound} emails with RE:/FW: patterns`);

      const subjectThreads = new Map();

      subjectPatterns.response.docs.forEach(doc => {
        if (doc.email_subject) {
          // Clean subject line (remove RE:, FW:, etc.)
          const cleanSubject = doc.email_subject
            .replace(/^(RE:|FW:|Fwd:|Re:)\s*/gi, '')
            .trim()
            .toLowerCase();

          if (!subjectThreads.has(cleanSubject)) {
            subjectThreads.set(cleanSubject, []);
          }

          subjectThreads.get(cleanSubject).push({
            id: doc.id,
            originalSubject: doc.email_subject,
            from: Array.isArray(doc.email_from_str) ? doc.email_from_str[0] : doc.email_from_str
          });
        }
      });

      // Show subject-based threads with multiple emails
      const multiEmailSubjects = Array.from(subjectThreads.entries())
        .filter(([, emails]) => emails.length > 1)
        .sort(([,a], [,b]) => b.length - a.length);

      console.log(`\nFound ${multiEmailSubjects.length} subjects with multiple emails:`);

      multiEmailSubjects.slice(0, 10).forEach(([subject, emails], index) => {
        console.log(`\nSubject Thread ${index + 1}: "${subject}"`);
        console.log(`  ${emails.length} emails in thread`);

        emails.slice(0, 3).forEach(email => {
          const from = email.from ? email.from.split('<')[0].trim() : 'Unknown';
          console.log(`    - ${email.originalSubject} (from: ${from})`);
        });

        if (emails.length > 3) {
          console.log(`    ... and ${emails.length - 3} more emails`);
        }
      });
    }

    // 3. Look for conversation patterns by domain
    console.log('\n\n3. Analyzing communication patterns by domain...');

    const domainStats = new Map();
    const participantPairs = new Map();

    const emailComms = await makeRequest('/solr/casedoxx/select?q=email_from_str:*%20AND%20email_to_str:*&rows=200&fl=id,email_from_str,email_to_str,email_subject&wt=json');

    if (emailComms.response) {
      emailComms.response.docs.forEach(doc => {
        const from = Array.isArray(doc.email_from_str) ? doc.email_from_str[0] : doc.email_from_str;
        const to = Array.isArray(doc.email_to_str) ? doc.email_to_str[0] : doc.email_to_str;

        if (from && to) {
          // Extract domains
          const fromDomain = from.match(/@([^>\s]+)/);
          const toDomain = to.match(/@([^>\s]+)/);

          if (fromDomain) {
            const domain = fromDomain[1].toLowerCase();
            domainStats.set(domain, (domainStats.get(domain) || 0) + 1);
          }

          // Track communication pairs
          const pair = [from, to].sort().join(' <-> ');
          participantPairs.set(pair, (participantPairs.get(pair) || 0) + 1);
        }
      });

      console.log('\nTop email domains:');
      Array.from(domainStats.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([domain, count], index) => {
          console.log(`  ${index + 1}. ${domain}: ${count} emails`);
        });

      console.log('\nTop communication pairs:');
      Array.from(participantPairs.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([pair, count], index) => {
          console.log(`  ${index + 1}. ${pair}: ${count} exchanges`);
        });
    }

    // 4. Time-based threading analysis
    console.log('\n\n4. Analyzing time-based patterns...');

    const timeQuery = await makeRequest('/solr/casedoxx/select?q=email_datesent:*&rows=100&fl=id,email_datesent,email_subject&sort=email_datesent%20desc&wt=json');

    if (timeQuery.response) {
      const emailsByYear = new Map();

      timeQuery.response.docs.forEach(doc => {
        if (doc.email_datesent) {
          const year = new Date(doc.email_datesent).getFullYear();
          if (year && year > 1990 && year < 2030) { // Valid years only
            emailsByYear.set(year, (emailsByYear.get(year) || 0) + 1);
          }
        }
      });

      console.log('\nEmail activity by year (from sample):');
      Array.from(emailsByYear.entries())
        .sort(([a,], [b,]) => a - b)
        .forEach(([year, count]) => {
          console.log(`  ${year}: ${count} emails`);
        });
    }

  } catch (error) {
    console.error('Error analyzing threading patterns:', error);
  }
}

analyzeThreadingPatterns();