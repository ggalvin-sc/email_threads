const fs = require('fs-extra');
const csv = require('csv-parser');
const { spawn } = require('child_process');
const path = require('path');
const _ = require('lodash');

class EmailThreadProcessor {
  constructor() {
    this.emails = [];
    this.threads = new Map();
    this.pythonScriptPath = path.join(__dirname, 'python', 'thread_parser.py');
  }

  /**
   * Load emails from CSV/DAT file with the specified field structure
   */
  async loadEmailsFromFile(filePath) {
    return new Promise((resolve, reject) => {
      const emails = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Parse the column_history field to extract threading information
          const threadInfo = this.parseColumnHistory(row.column_history);

          const email = {
            id: row.BegBates,
            messageId: threadInfo.messageId,
            inReplyTo: threadInfo.inReplyTo,
            references: threadInfo.references,
            threadId: threadInfo.threadId,
            from: row.From,
            to: row.To ? row.To.split(',').map(e => e.trim()) : [],
            cc: row.CC ? row.CC.split(',').map(e => e.trim()) : [],
            bcc: row.BCC ? row.BCC.split(',').map(e => e.trim()) : [],
            subject: row.Subject,
            dateSent: new Date(row.DateSent),
            custodian: row.Custodian,
            fileName: row.FileName,
            fullText: row.FullText,
            confidentiality: row.Confidentiality,
            isForward: threadInfo.isForward,
            isExternal: threadInfo.isExternal,
            // Additional metadata
            begBates: row.BegBates,
            endBates: row.EndBates,
            fileType: row.FileType,
            hash: row.Hash,
            nativeLink: row.nativelink,
            author: row.author,
            title: row.Title,
            dateCreated: new Date(row.DateCreated),
            dateLastModified: new Date(row.DateLastModified)
          };

          emails.push(email);
        })
        .on('end', () => {
          this.emails = emails;
          console.log(`Loaded ${emails.length} emails from ${filePath}`);
          resolve(emails);
        })
        .on('error', reject);
    });
  }

  /**
   * Parse the column_history field to extract threading metadata
   */
  parseColumnHistory(columnHistory) {
    if (!columnHistory) return {};

    const parts = columnHistory.split('|');
    const result = {};

    parts.forEach(part => {
      if (part.startsWith('MSG-ID:')) {
        result.messageId = part.replace('MSG-ID:', '');
      } else if (part.startsWith('IN-REPLY-TO:')) {
        result.inReplyTo = part.replace('IN-REPLY-TO:', '');
      } else if (part.startsWith('REFS:')) {
        const refs = part.replace('REFS:', '');
        result.references = refs === '<>' ? [] : refs.split(' ').filter(r => r);
      } else if (part.startsWith('THREAD:')) {
        result.threadId = part.replace('THREAD:', '');
      } else if (part === 'FWD:true') {
        result.isForward = true;
      } else if (part === 'EXTERNAL:true') {
        result.isExternal = true;
      }
    });

    return result;
  }

  /**
   * Group emails by thread ID
   */
  groupByThreads() {
    this.threads.clear();

    this.emails.forEach(email => {
      if (!email.threadId) return;

      if (!this.threads.has(email.threadId)) {
        this.threads.set(email.threadId, []);
      }

      this.threads.get(email.threadId).push(email);
    });

    // Sort emails within each thread by date
    this.threads.forEach((emails, threadId) => {
      emails.sort((a, b) => a.dateSent - b.dateSent);
    });

    return this.threads;
  }

  /**
   * Build thread tree structure for a specific thread
   */
  buildThreadTree(threadId) {
    const emails = this.threads.get(threadId);
    if (!emails) return null;

    const emailMap = new Map();
    const roots = [];

    // Create email map for quick lookup
    emails.forEach(email => {
      emailMap.set(email.messageId, {
        ...email,
        children: []
      });
    });

    // Build parent-child relationships
    emails.forEach(email => {
      const emailNode = emailMap.get(email.messageId);

      if (email.inReplyTo && emailMap.has(email.inReplyTo)) {
        // This email is a reply to another email in the thread
        const parent = emailMap.get(email.inReplyTo);
        parent.children.push(emailNode);
      } else {
        // This is a root email (original or forwarded)
        roots.push(emailNode);
      }
    });

    return {
      threadId,
      roots,
      totalEmails: emails.length,
      participants: this.getUniqueParticipants(emails),
      dateRange: {
        start: emails[0].dateSent,
        end: emails[emails.length - 1].dateSent
      }
    };
  }

  /**
   * Get unique participants in a thread
   */
  getUniqueParticipants(emails) {
    const participants = new Set();

    emails.forEach(email => {
      participants.add(email.from);
      email.to.forEach(addr => participants.add(addr));
      email.cc.forEach(addr => participants.add(addr));
    });

    return Array.from(participants);
  }

  /**
   * Generate thread statistics
   */
  generateThreadStats(threadId) {
    const tree = this.buildThreadTree(threadId);
    if (!tree) return null;

    const stats = {
      threadId,
      totalEmails: tree.totalEmails,
      participants: tree.participants,
      participantCount: tree.participants.length,
      maxDepth: this.calculateMaxDepth(tree.roots),
      branchCount: this.countBranches(tree.roots),
      forwardCount: 0,
      replyCount: 0,
      externalCount: 0,
      dateRange: tree.dateRange
    };

    // Calculate email type counts
    const emails = this.threads.get(threadId);
    emails.forEach(email => {
      if (email.isForward) stats.forwardCount++;
      if (email.inReplyTo) stats.replyCount++;
      if (email.isExternal) stats.externalCount++;
    });

    return stats;
  }

  /**
   * Calculate maximum depth of thread tree
   */
  calculateMaxDepth(roots, currentDepth = 0) {
    if (!roots || roots.length === 0) return currentDepth;

    let maxDepth = currentDepth;

    roots.forEach(node => {
      const depth = this.calculateMaxDepth(node.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  /**
   * Count number of branches in thread tree
   */
  countBranches(roots) {
    if (!roots || roots.length === 0) return 0;

    let branches = 0;

    roots.forEach(node => {
      if (node.children.length > 1) {
        branches += node.children.length;
      }
      branches += this.countBranches(node.children);
    });

    return branches;
  }

  /**
   * Export thread data for python-emailthreads processing
   */
  async exportForPythonProcessing(threadId, outputDir) {
    const tree = this.buildThreadTree(threadId);
    if (!tree) throw new Error(`Thread ${threadId} not found`);

    const emails = this.threads.get(threadId);
    const emlDir = path.join(outputDir, 'eml_files');

    await fs.ensureDir(emlDir);

    // Create .eml files for each email
    for (const email of emails) {
      const emlContent = this.generateEmlContent(email);
      const emlPath = path.join(emlDir, `${email.id}.eml`);
      await fs.writeFile(emlPath, emlContent);
    }

    // Create metadata file
    const metadataPath = path.join(outputDir, 'thread_metadata.json');
    await fs.writeJson(metadataPath, {
      threadId,
      tree,
      stats: this.generateThreadStats(threadId)
    }, { spaces: 2 });

    return { emlDir, metadataPath };
  }

  /**
   * Generate RFC 5322 compliant .eml content
   */
  generateEmlContent(email) {
    const headers = [
      `Message-ID: ${email.messageId}`,
      `From: ${email.from}`,
      `To: ${email.to.join(', ')}`,
      email.cc.length > 0 ? `CC: ${email.cc.join(', ')}` : null,
      `Subject: ${email.subject}`,
      `Date: ${email.dateSent.toUTCString()}`,
      email.inReplyTo ? `In-Reply-To: ${email.inReplyTo}` : null,
      email.references.length > 0 ? `References: ${email.references.join(' ')}` : null
    ].filter(Boolean);

    return headers.join('\r\n') + '\r\n\r\n' + (email.fullText || '');
  }

  /**
   * Process all threads and generate comprehensive report
   */
  async generateThreadReport(outputPath) {
    this.groupByThreads();

    const report = {
      summary: {
        totalEmails: this.emails.length,
        totalThreads: this.threads.size,
        generatedAt: new Date().toISOString()
      },
      threads: {}
    };

    for (const [threadId, emails] of this.threads) {
      report.threads[threadId] = this.generateThreadStats(threadId);
    }

    await fs.writeJson(outputPath, report, { spaces: 2 });
    return report;
  }
}

module.exports = EmailThreadProcessor;