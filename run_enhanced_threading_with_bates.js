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
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runEnhancedThreading() {
  try {
    console.log('=== Enhanced Threading with Bates Information ===\n');

    // Query for emails with full bates information
    console.log('Getting emails with complete bates and attachment data...');

    const query = `/solr/casedoxx/select?q=email_from_str:*&rows=50&fl=id,email_from_str,email_to_str,email_cc_str,email_subject,email_timesent,email_fulltext,bates_begbates,bates_endbates,bates_begattach,bates_endattach&wt=json`;

    const response = await makeRequest(query);

    if (response.response && response.response.docs) {
      const docs = response.response.docs;
      console.log(`Found ${docs.length} emails with bates data`);

      // Show sample of the data structure
      console.log('\n=== SAMPLE EMAILS WITH BATES DATA ===');

      docs.slice(0, 3).forEach((doc, i) => {
        console.log(`\nEmail ${i + 1} (ID: ${doc.id}):`);
        console.log(`  From: ${Array.isArray(doc.email_from_str) ? doc.email_from_str.join(', ') : doc.email_from_str || 'N/A'}`);
        console.log(`  Subject: ${doc.email_subject || 'No Subject'}`);
        console.log(`  Email Bates: ${doc.bates_begbates || 'N/A'} - ${doc.bates_endbates || 'N/A'}`);
        console.log(`  Attachment Bates: ${doc.bates_begattach || 'N/A'} - ${doc.bates_endattach || 'N/A'}`);

        // Check if this email has attachments
        if (doc.bates_begattach && doc.bates_begattach !== doc.bates_begbates) {
          console.log(`  📎 HAS ATTACHMENTS! (Different bates ranges)`);
        } else if (doc.bates_begattach && doc.bates_begattach === doc.bates_begbates) {
          console.log(`  📧 Email and attachments share same bates range`);
        } else {
          console.log(`  📄 No separate attachment bates`);
        }

        // Look for attachment references in fulltext
        if (doc.email_fulltext) {
          const attachmentMatch = doc.email_fulltext.match(/Attachments?:\s*\n([^\n]+)/i);
          if (attachmentMatch) {
            console.log(`  📎 Attachment List Found: ${attachmentMatch[1].substring(0, 100)}...`);
          }
        }
      });

      // Find emails with different attachment bates ranges
      const emailsWithAttachments = docs.filter(doc =>
        doc.bates_begattach &&
        doc.bates_begattach !== doc.bates_begbates
      );

      console.log(`\n=== EMAILS WITH SEPARATE ATTACHMENT BATES ===`);
      console.log(`Found ${emailsWithAttachments.length} emails with separate attachment bates ranges`);

      emailsWithAttachments.slice(0, 5).forEach((doc, i) => {
        console.log(`\nAttachment Email ${i + 1}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Subject: ${doc.email_subject || 'No Subject'}`);
        console.log(`  Email Range: ${doc.bates_begbates} - ${doc.bates_endbates}`);
        console.log(`  Attachment Range: ${doc.bates_begattach} - ${doc.bates_endattach}`);

        // Calculate attachment page count
        const emailStart = parseInt(doc.bates_begbates.replace(/\D/g, '')) || 0;
        const emailEnd = parseInt(doc.bates_endbates.replace(/\D/g, '')) || 0;
        const attachStart = parseInt(doc.bates_begattach.replace(/\D/g, '')) || 0;
        const attachEnd = parseInt(doc.bates_endattach.replace(/\D/g, '')) || 0;

        console.log(`  Email Pages: ${emailEnd - emailStart + 1}`);
        console.log(`  Attachment Pages: ${attachEnd - attachStart + 1}`);

        // Parse attachment list from fulltext if available
        if (doc.email_fulltext) {
          const attachmentMatch = doc.email_fulltext.match(/Attachments?:\s*\n([^\n]+)/i);
          if (attachmentMatch) {
            const attachmentLine = attachmentMatch[1];
            const attachments = attachmentLine.split(';').map(att => att.trim()).filter(att => att);
            console.log(`  Attachment Files (${attachments.length}):`);
            attachments.slice(0, 3).forEach(att => {
              console.log(`    - ${att}`);
            });
            if (attachments.length > 3) {
              console.log(`    ... and ${attachments.length - 3} more`);
            }
          }
        }
      });

      // Export sample data for testing
      console.log('\n=== CREATING TEST DATA ===');

      const testEmails = emailsWithAttachments.slice(0, 10).map(doc => ({
        BegBates: doc.bates_begbates,
        EndBates: doc.bates_endbates,
        BegAttach: doc.bates_begattach,
        EndAttach: doc.bates_endattach,
        MessageId: '', // We'll need to parse from fulltext
        InReplyTo: '', // We'll need to parse from fulltext
        References: '', // We'll need to parse from fulltext
        ThreadId: doc.id, // Using doc ID as thread ID for now
        From: Array.isArray(doc.email_from_str) ? doc.email_from_str.join(', ') : doc.email_from_str,
        To: Array.isArray(doc.email_to_str) ? doc.email_to_str.join(', ') : (doc.email_to_str || ''),
        CC: Array.isArray(doc.email_cc_str) ? doc.email_cc_str.join(', ') : (doc.email_cc_str || ''),
        BCC: '',
        Subject: doc.email_subject || '',
        DateSent: doc.email_timesent || '2024-01-01T00:00:00Z',
        Custodian: 'Enhanced Solr Import',
        FileName: `email_${doc.id}.eml`,
        FullText: doc.email_fulltext || '',
        Confidentiality: '',
        column_history: `ID:${doc.id}|BATES:${doc.bates_begbates}-${doc.bates_endbates}|ATTACH:${doc.bates_begattach}-${doc.bates_endattach}`
      }));

      // Write enhanced CSV
      const csvWriter = require('csv-writer').createObjectCsvWriter({
        path: 'enhanced_bates_data.csv',
        header: [
          {id: 'BegBates', title: 'BegBates'},
          {id: 'EndBates', title: 'EndBates'},
          {id: 'BegAttach', title: 'BegAttach'},
          {id: 'EndAttach', title: 'EndAttach'},
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

      await csvWriter.writeRecords(testEmails);
      console.log(`\nCreated enhanced_bates_data.csv with ${testEmails.length} emails`);

      console.log('\n=== SUMMARY ===');
      console.log(`Total emails processed: ${docs.length}`);
      console.log(`Emails with separate attachment bates: ${emailsWithAttachments.length}`);
      console.log(`Sample data exported to: enhanced_bates_data.csv`);

    } else {
      console.log('No response data received from Solr');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the enhanced threading
runEnhancedThreading().catch(console.error);