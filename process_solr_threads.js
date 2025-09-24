const SolrEmailProcessor = require('./src/SolrEmailProcessor');
const EmailThreadProcessor = require('./src/emailThreadProcessor');
const path = require('path');

async function processSolrThreads() {
  console.log('=== Processing Solr Email Threads ===\n');

  try {
    // Step 1: Extract data from Solr
    console.log('Step 1: Extracting data from Solr...');
    const solrProcessor = new SolrEmailProcessor();
    const result = await solrProcessor.processFirst20MessageIds();

    console.log('\nSolr extraction completed!');
    console.log(`- ${result.threads.length} threads found`);
    console.log(`- ${result.emails.length} total emails`);
    console.log(`- Data saved to: ${result.csvPath}`);

    // Step 2: Process with existing email thread system
    console.log('\nStep 2: Processing with existing email thread system...');
    const emailProcessor = new EmailThreadProcessor();

    // Load the CSV we just created
    await emailProcessor.loadEmailsFromFile(result.csvPath);

    // Group emails by threads
    emailProcessor.groupByThreads();

    // Create output directory and generate thread report
    const outputDir = path.join(__dirname, 'output', 'SOLR-' + new Date().toISOString().split('T')[0]);
    await require('fs-extra').ensureDir(outputDir);
    await emailProcessor.generateThreadReport(path.join(outputDir, 'thread_report.json'));

    // Calculate thread analysis
    const threadAnalysis = {
      totalThreads: emailProcessor.threads.size,
      totalEmails: emailProcessor.emails.length,
      threads: Array.from(emailProcessor.threads.entries()).map(([threadId, emails]) => ({
        id: threadId,
        emailCount: emails.length,
        participants: emailProcessor.getUniqueParticipants(emails),
        stats: emailProcessor.generateThreadStats(threadId)
      }))
    };

    console.log('\n=== Results Summary ===');
    console.log(`Thread Analysis:`);
    console.log(`- Total threads: ${threadAnalysis.totalThreads}`);
    console.log(`- Total emails: ${threadAnalysis.totalEmails}`);
    console.log(`- Average thread length: ${(threadAnalysis.totalEmails / threadAnalysis.totalThreads).toFixed(1)} emails`);
    console.log(`- Output directory: ${outputDir}`);

    // Display thread details
    console.log('\n=== Thread Details ===');
    result.threads.forEach((thread, index) => {
      console.log(`\nThread ${index + 1}:`);
      console.log(`  ID: ${thread.id}`);
      console.log(`  Subject: ${thread.subject}`);
      console.log(`  Emails: ${thread.emails.length}`);
      console.log(`  Participants: ${thread.participants.slice(0, 3).join(', ')}${thread.participants.length > 3 ? ` (+${thread.participants.length - 3} more)` : ''}`);

      // Show email sequence
      console.log(`  Email sequence:`);
      thread.emails.forEach((email, i) => {
        const from = email.from.split('<')[0].trim() || email.from;
        const date = email.dateSent.toLocaleDateString();
        console.log(`    ${i + 1}. ${from} - ${date} - ${email.subject.substring(0, 50)}${email.subject.length > 50 ? '...' : ''}`);
      });
    });

    return {
      solrData: result,
      threadAnalysis,
      outputDir
    };

  } catch (error) {
    console.error('Error processing Solr threads:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  processSolrThreads().catch(console.error);
}

module.exports = processSolrThreads;