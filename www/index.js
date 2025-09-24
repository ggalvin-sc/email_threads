import init, { EmailThreadProcessor, set_panic_hook } from './pkg/email_threads_wasm.js';
import * as d3 from 'd3';

/**
 * Main application class for the Email Thread Analyzer
 * Manages WASM integration, UI interactions, and thread visualization
 */
class EmailThreadApp {
    constructor() {
        this.processor = null;
        this.currentThreadData = null;
        this.performanceStart = 0;
        this.currentView = 'tree';
        this.allThreads = new Map();
        this.currentThreadId = null;
        this.init();
    }

    /**
     * Initialize the WASM module and set up the application
     * Side effects: Sets up WASM, initializes processor, sets up event listeners
     */
    async init() {
        try {
            // Initialize WASM module
            await init();
            set_panic_hook();

            this.processor = new EmailThreadProcessor();
            console.log('WASM module initialized successfully');

            this.setupEventListeners();
            this.showPerformanceInfo('WASM module loaded');
        } catch (error) {
            console.error('Failed to initialize WASM module:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    /**
     * Set up all event listeners for the application
     * Side effects: Attaches event listeners to DOM elements
     */
    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('csvFileInput');
        const uploadArea = document.getElementById('uploadArea');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Drag and drop
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--primary-color)';
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--border-color)';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--border-color)';
                if (e.dataTransfer.files.length > 0) {
                    this.processFile(e.dataTransfer.files[0]);
                }
            });
        }

        // Sample data button
        const sampleBtn = document.getElementById('loadSampleData');
        if (sampleBtn) {
            sampleBtn.addEventListener('click', () => this.loadSampleData());
        }

        // View mode controls
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                toggleBtns.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');

                const viewMode = e.target.getAttribute('data-view');
                this.currentView = viewMode;

                if (this.currentThreadData) {
                    this.renderThreadView(this.currentThreadData, viewMode);
                }
            });
        });

        // Retry button
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.hideError();
                this.resetApp();
            });
        }
    }

    /**
     * Handle file upload from input element
     * @param {Event} event - File input change event
     * Side effects: Processes uploaded file
     */
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processFile(file);
        }
    }

    /**
     * Process a file (CSV/DAT) for email thread data
     * @param {File} file - File to process
     * Side effects: Reads file and processes email data
     */
    async processFile(file) {
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.dat')) {
            this.showError('Please select a CSV or DAT file');
            return;
        }

        this.showProcessingStatus('Reading file...');

        try {
            const text = await file.text();
            await this.processEmailData(text);
        } catch (error) {
            console.error('File processing error:', error);
            this.showError('Error reading file: ' + error.message);
        }
    }

    /**
     * Load sample email data from server
     * Side effects: Fetches and processes sample data
     */
    async loadSampleData() {
        this.showProcessingStatus('Loading sample data...');

        try {
            // Try to load the cleaned CSV file first, fall back to original if needed
            let response = await fetch('./email_test_data_clean.csv');
            if (!response.ok) {
                console.log('Clean CSV not found, trying original CSV...');
                response = await fetch('./email_test_data.csv');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            await this.processEmailData(text);
        } catch (error) {
            console.error('Sample data loading error:', error);
            this.showError('Error loading sample data: ' + error.message);
        }
    }

    /**
     * Process email data using WASM processor
     * @param {string} csvData - CSV data as string
     * Side effects: Processes emails, updates UI with results
     */
    async processEmailData(csvData) {
        this.performanceStart = performance.now();
        this.showProcessingStatus('Processing emails...');

        try {
            // Load emails using WASM processor
            const emailCount = this.processor.load_emails_from_csv(csvData);
            console.log(`Loaded ${emailCount} emails`);

            this.showProcessingStatus('Grouping threads...');

            // Group by threads
            const threadCount = this.processor.group_by_threads();
            console.log(`Found ${threadCount} threads`);

            // Get thread IDs
            const threadIds = this.processor.get_thread_ids();

            this.hideProcessingStatus();
            this.showResults(emailCount, threadCount, threadIds);

            const processingTime = performance.now() - this.performanceStart;
            this.showPerformanceInfo(`Processed ${emailCount} emails in ${processingTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('Email processing error:', error);

            // Provide more descriptive error messages
            let errorMessage = 'Error processing emails: ';
            if (error.message && error.message.includes('CSV')) {
                errorMessage += 'CSV parsing failed. This may be due to duplicate column names or malformed CSV data. Please check your file format.';
            } else if (error.message && error.message.includes('undefined')) {
                errorMessage += 'Data processing failed. This is likely due to CSV format issues such as duplicate column headers.';
            } else {
                errorMessage += error.message || 'Unknown error occurred during processing.';
            }

            this.showError(errorMessage);
        }
    }

    /**
     * Display processing results and populate thread list
     * @param {number} emailCount - Total number of emails processed
     * @param {number} threadCount - Total number of threads found
     * @param {Array<string>} threadIds - Array of thread IDs
     * Side effects: Hides upload section, shows thread list, populates sidebar
     */
    showResults(emailCount, threadCount, threadIds) {
        // Hide processing and error sections
        this.hideProcessingStatus();
        this.hideError();

        // Hide upload section and show thread interface
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }

        // Update filter counts
        this.updateFilterCounts(threadCount);

        // Populate thread sidebar
        this.populateThreadList(threadIds);

        // Auto-select first thread if available
        if (threadIds.length > 0) {
            this.selectThread(threadIds[0]);
        }
    }

    /**
     * Update filter count badges in sidebar
     * @param {number} threadCount - Total number of threads
     * Side effects: Updates count displays in filter buttons
     */
    updateFilterCounts(threadCount) {
        const allCount = document.getElementById('allCount');
        if (allCount) {
            allCount.textContent = threadCount;
        }
    }

    /**
     * Populate the thread list sidebar with thread items
     * @param {Array<string>} threadIds - Array of thread IDs
     * Side effects: Creates and displays thread items in sidebar
     */
    async populateThreadList(threadIds) {
        const threadList = document.getElementById('threadList');
        if (!threadList) return;

        threadList.innerHTML = '';

        for (const threadId of threadIds) {
            try {
                // Get thread stats for preview
                const statsData = this.processor.generate_thread_stats(threadId);

                const threadItem = this.createThreadItem(threadId, statsData);
                threadList.appendChild(threadItem);

                // Store thread data for later use
                this.allThreads.set(threadId, statsData);
            } catch (error) {
                console.error(`Error loading thread ${threadId}:`, error);
            }
        }
    }

    /**
     * Create a thread item element for the sidebar
     * @param {string} threadId - Thread identifier
     * @param {Object} statsData - Thread statistics data
     * @returns {HTMLElement} Thread item DOM element
     */
    createThreadItem(threadId, statsData) {
        const item = document.createElement('div');
        item.className = 'thread-item';
        item.setAttribute('data-thread-id', threadId);

        // Calculate relative time
        const relativeTime = this.getRelativeTime(statsData.date_range.end);

        // Get first few words of first email for preview
        const preview = this.getThreadPreview(threadId);

        item.innerHTML = `
            <div class="thread-item-header">
                <div class="thread-item-title">${this.escapeHtml(threadId)}</div>
                <div class="thread-item-time">${relativeTime}</div>
            </div>
            <div class="thread-item-preview">${this.escapeHtml(preview)}</div>
            <div class="thread-item-meta">
                <div class="thread-participants">
                    <i class="fa-solid fa-users"></i>
                    <span>${statsData.participant_count} participants</span>
                </div>
                <div class="thread-replies">
                    <i class="fa-solid fa-reply"></i>
                    <span>${statsData.total_emails}</span>
                </div>
            </div>
        `;

        item.addEventListener('click', () => this.selectThread(threadId));

        return item;
    }

    /**
     * Get a preview text for a thread
     * @param {string} threadId - Thread identifier
     * @returns {string} Preview text
     */
    getThreadPreview(threadId) {
        try {
            const threadTreeData = this.processor.build_thread_tree(threadId);
            if (threadTreeData.roots && threadTreeData.roots.length > 0) {
                const firstEmail = threadTreeData.roots[0].email;
                const text = firstEmail.full_text || firstEmail.subject || 'No content';
                return text.substring(0, 100) + (text.length > 100 ? '...' : '');
            }
        } catch (error) {
            console.error('Error getting thread preview:', error);
        }
        return 'No preview available';
    }

    /**
     * Select and display a thread
     * @param {string} threadId - Thread identifier to select
     * Side effects: Updates UI to show selected thread, displays thread content
     */
    async selectThread(threadId) {
        try {
            this.showProcessingStatus(`Loading thread ${threadId}...`);

            // Update sidebar selection
            document.querySelectorAll('.thread-item').forEach(item => {
                item.classList.remove('active');
            });

            const selectedItem = document.querySelector(`[data-thread-id="${threadId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }

            // Get thread tree and stats from WASM
            const threadTreeData = this.processor.build_thread_tree(threadId);
            const threadStatsData = this.processor.generate_thread_stats(threadId);

            this.currentThreadData = {
                tree: threadTreeData,
                stats: threadStatsData
            };
            this.currentThreadId = threadId;

            this.hideProcessingStatus();

            // Show thread interface elements
            this.showThreadInterface(threadStatsData);

            // Render the thread view
            this.renderThreadView(this.currentThreadData, this.currentView);

        } catch (error) {
            console.error('Thread selection error:', error);
            this.showError('Error loading thread: ' + error.message);
        }
    }

    /**
     * Show thread interface elements (header, stats, controls)
     * @param {Object} statsData - Thread statistics data
     * Side effects: Shows and populates thread UI elements
     */
    showThreadInterface(statsData) {
        // Show thread header
        const threadHeader = document.getElementById('threadHeader');
        const threadTitle = document.getElementById('threadTitle');
        const threadSubtitle = document.getElementById('threadSubtitle');

        if (threadHeader) threadHeader.style.display = 'block';
        if (threadTitle) threadTitle.textContent = statsData.thread_id;
        if (threadSubtitle) threadSubtitle.textContent = `Thread with ${statsData.total_emails} messages`;

        // Show thread stats
        const threadStats = document.getElementById('threadStats');
        const participantCount = document.getElementById('participantCount');
        const messageCount = document.getElementById('messageCount');
        const lastActivity = document.getElementById('lastActivity');

        if (threadStats) threadStats.style.display = 'flex';
        if (participantCount) participantCount.textContent = `${statsData.participant_count} participants`;
        if (messageCount) messageCount.textContent = `${statsData.total_emails} messages`;
        if (lastActivity) lastActivity.textContent = `Last activity ${this.getRelativeTime(statsData.date_range.end)}`;

        // Show thread controls
        const threadControls = document.getElementById('threadControls');
        if (threadControls) threadControls.style.display = 'flex';

        // Show thread visualization
        const threadVisualization = document.getElementById('threadVisualization');
        if (threadVisualization) threadVisualization.style.display = 'block';
    }

    /**
     * Render thread view based on current view mode
     * @param {Object} threadData - Thread data object
     * @param {string} viewMode - View mode ('tree', 'timeline', 'compact')
     * Side effects: Renders thread visualization in the specified mode
     */
    renderThreadView(threadData, viewMode) {
        const container = document.getElementById('threadVisualization');
        if (!container) return;

        switch (viewMode) {
            case 'tree':
                this.renderTreeView(container, threadData);
                break;
            case 'timeline':
                this.renderTimelineView(container, threadData);
                break;
            case 'compact':
                this.renderCompactView(container, threadData);
                break;
            default:
                this.renderTreeView(container, threadData);
        }
    }

    /**
     * Render tree view with avatar bubbles and connecting lines
     * @param {HTMLElement} container - Container element
     * @param {Object} threadData - Thread data object
     * Side effects: Renders UX Pilot-style tree visualization
     */
    renderTreeView(container, threadData) {
        const { tree, stats } = threadData;

        container.innerHTML = `
            <div class="email-thread-tree">
                ${this.renderEmailNodes(tree.roots, 0)}
            </div>
        `;

        this.attachEmailCardListeners();
    }

    /**
     * Render email nodes recursively with avatar bubbles
     * @param {Array} nodes - Array of email nodes
     * @param {number} depth - Current depth in the tree
     * @returns {string} HTML string for email nodes
     */
    renderEmailNodes(nodes, depth) {
        if (!nodes || nodes.length === 0) return '';

        return nodes.map(node => {
            const email = node.email;
            const emailType = this.getEmailType(email);
            const tags = this.getEmailTags(email);
            const authorInitials = this.getAuthorInitials(email.from);

            return `
                <div class="email-node" style="margin-left: ${depth * 40}px;">
                    <div class="email-avatar-section">
                        <div class="email-avatar ${emailType}">
                            ${authorInitials}
                        </div>
                        ${node.children && node.children.length > 0 ? '<div class="thread-line"></div>' : ''}
                    </div>

                    <div class="email-content ${emailType}" data-message-id="${email.message_id}">
                        <div class="email-header">
                            <div class="email-author-info">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(email.from)}&size=32&background=e5e7eb&color=374151"
                                     alt="${this.escapeHtml(email.from)}" class="email-author-avatar">
                                <div class="email-author-details">
                                    <h4>${this.escapeHtml(this.getNameFromEmail(email.from))}</h4>
                                    <p>${this.escapeHtml(email.from)}</p>
                                </div>
                            </div>
                            <div class="email-metadata">
                                <div>${this.formatDate(email.date_sent)}</div>
                                <div class="email-tags">
                                    ${tags.map(tag => `<span class="email-tag ${tag.type}">${tag.label}</span>`).join('')}
                                </div>
                            </div>
                        </div>

                        <h5 class="email-subject">${this.escapeHtml(email.subject || 'No Subject')}</h5>

                        ${email.to && email.to.length > 0 ? `
                            <div class="email-to-info">
                                <strong>To:</strong> ${email.to.map(t => this.escapeHtml(t)).join(', ')}
                            </div>
                        ` : ''}

                        <div class="email-body" id="body-${email.message_id}">
                            ${this.escapeHtml((email.full_text || '').substring(0, 300))}
                            ${(email.full_text || '').length > 300 ? '...' : ''}
                        </div>

                        ${(email.full_text || '').length > 300 ? `
                            <button class="expand-btn" onclick="emailThreadApp.toggleEmailBody('${email.message_id}')">
                                Show More
                            </button>
                        ` : ''}

                        <div class="email-actions">
                            <span><i class="fa-solid fa-users"></i> To: ${email.to.length} recipients</span>
                            <button class="email-action-btn">Reply</button>
                            <button class="email-action-btn">Forward</button>
                        </div>
                    </div>

                    ${node.children && node.children.length > 0 ? `
                        <div class="email-children">
                            ${this.renderEmailNodes(node.children, depth + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Render timeline view of thread
     * @param {HTMLElement} container - Container element
     * @param {Object} threadData - Thread data object
     * Side effects: Renders chronological timeline view
     */
    renderTimelineView(container, threadData) {
        const { tree } = threadData;

        // Flatten all emails and sort by date
        const allEmails = this.flattenEmails(tree.roots);
        allEmails.sort((a, b) => new Date(a.email.date_sent) - new Date(b.email.date_sent));

        const timelineHTML = allEmails.map(node => {
            const email = node.email;
            const tags = this.getEmailTags(email);

            return `
                <div class="timeline-item">
                    <div class="timeline-date">${this.formatDate(email.date_sent)}</div>
                    <div class="timeline-content">
                        <strong>${this.escapeHtml(email.subject)}</strong><br>
                        <small>From: ${this.escapeHtml(email.from)}</small>
                        <p>${this.escapeHtml((email.full_text || '').substring(0, 150))}${(email.full_text || '').length > 150 ? '...' : ''}</p>
                    </div>
                    <div class="timeline-tags">
                        ${tags.map(tag => `<span class="email-tag ${tag.type}">${tag.label}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="timeline-view">
                ${timelineHTML}
            </div>
        `;
    }

    /**
     * Render compact view of thread
     * @param {HTMLElement} container - Container element
     * @param {Object} threadData - Thread data object
     * Side effects: Renders compact list view
     */
    renderCompactView(container, threadData) {
        const { tree } = threadData;
        const allEmails = this.flattenEmails(tree.roots);

        const compactHTML = allEmails.map(node => {
            const email = node.email;

            return `
                <div class="compact-item">
                    <div class="compact-header">
                        <span class="compact-from">${this.escapeHtml(this.getNameFromEmail(email.from))}</span>
                        <span class="compact-subject">${this.escapeHtml(email.subject)}</span>
                        <span class="compact-date">${this.formatDate(email.date_sent)}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="compact-view">
                ${compactHTML}
            </div>
        `;
    }

    // Utility functions
    /**
     * Get email type for styling
     * @param {Object} email - Email object
     * @returns {string} Email type ('original', 'reply', 'forward', 'external')
     */
    getEmailType(email) {
        if (email.is_external) return 'external';
        if (email.is_forward) return 'forward';
        if (email.in_reply_to) return 'reply';
        return 'original';
    }

    /**
     * Get email tags for display
     * @param {Object} email - Email object
     * @returns {Array<Object>} Array of tag objects with type and label
     */
    getEmailTags(email) {
        const tags = [];

        if (email.is_external) {
            tags.push({ type: 'external', label: '🌐 External' });
        } else {
            tags.push({ type: 'internal', label: '🏢 Internal' });
        }

        if (email.is_forward) {
            tags.push({ type: 'forward', label: '↪️ Forward' });
        } else if (email.in_reply_to) {
            tags.push({ type: 'reply', label: '↩️ Reply' });
        } else {
            tags.push({ type: 'original', label: '📧 Original' });
        }

        return tags;
    }

    /**
     * Get author initials from email address
     * @param {string} email - Email address
     * @returns {string} Author initials
     */
    getAuthorInitials(email) {
        const name = this.getNameFromEmail(email);
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return 'UN';
    }

    /**
     * Extract name from email address
     * @param {string} email - Email address
     * @returns {string} Extracted name
     */
    getNameFromEmail(email) {
        if (email.includes('<') && email.includes('>')) {
            const name = email.split('<')[0].trim();
            return name || email.split('@')[0];
        }
        return email.split('@')[0].replace(/[._]/g, ' ');
    }

    /**
     * Get relative time string
     * @param {string} dateString - ISO date string
     * @returns {string} Relative time (e.g., "2 hours ago")
     */
    getRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return 'Recently';
        }
    }

    /**
     * Flatten email tree into array
     * @param {Array} nodes - Array of email nodes
     * @returns {Array} Flattened array of email nodes
     */
    flattenEmails(nodes) {
        let result = [];
        for (const node of nodes) {
            result.push(node);
            if (node.children && node.children.length > 0) {
                result = result.concat(this.flattenEmails(node.children));
            }
        }
        return result;
    }

    /**
     * Toggle email body expansion
     * @param {string} messageId - Message ID
     * Side effects: Expands or collapses email body content
     */
    toggleEmailBody(messageId) {
        const body = document.getElementById(`body-${messageId}`);
        const button = body?.nextElementSibling;

        if (body && button) {
            if (body.classList.contains('expanded')) {
                body.classList.remove('expanded');
                button.textContent = 'Show More';
            } else {
                body.classList.add('expanded');
                button.textContent = 'Show Less';
            }
        }
    }

    /**
     * Attach event listeners to email cards
     * Side effects: Adds click listeners to email cards
     */
    attachEmailCardListeners() {
        const emailCards = document.querySelectorAll('.email-content');

        emailCards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.classList.contains('expand-btn') || e.target.classList.contains('email-action-btn')) {
                    return;
                }

                const isSelected = card.classList.contains('selected');

                emailCards.forEach(c => {
                    c.classList.remove('selected');
                    c.style.borderWidth = '1px';
                });

                if (!isSelected) {
                    card.classList.add('selected');
                    card.style.borderWidth = '2px';
                }
            });
        });
    }

    // UI State Management
    /**
     * Show processing status overlay
     * @param {string} message - Status message to display
     * Side effects: Shows processing overlay with message
     */
    showProcessingStatus(message) {
        const statusElement = document.getElementById('statusText');
        const processingElement = document.getElementById('processingStatus');

        if (statusElement) statusElement.textContent = message;
        if (processingElement) processingElement.style.display = 'flex';

        this.hideError();
    }

    /**
     * Hide processing status overlay
     * Side effects: Hides processing overlay
     */
    hideProcessingStatus() {
        const processingElement = document.getElementById('processingStatus');
        if (processingElement) {
            processingElement.style.display = 'none';
        }
    }

    /**
     * Show error message overlay
     * @param {string} message - Error message to display
     * Side effects: Shows error overlay with message
     */
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        const errorSection = document.getElementById('errorSection');

        if (errorElement) errorElement.textContent = message;
        if (errorSection) errorSection.style.display = 'flex';

        this.hideProcessingStatus();
    }

    /**
     * Hide error overlay
     * Side effects: Hides error overlay
     */
    hideError() {
        const errorSection = document.getElementById('errorSection');
        if (errorSection) {
            errorSection.style.display = 'none';
        }
    }

    /**
     * Show performance information
     * @param {string} message - Performance message
     * Side effects: Updates performance info display
     */
    showPerformanceInfo(message) {
        const performanceInfo = document.getElementById('performanceInfo');
        if (performanceInfo) {
            performanceInfo.textContent = message;
        }
    }

    /**
     * Reset application to initial state
     * Side effects: Clears file input, hides result sections
     */
    resetApp() {
        const fileInput = document.getElementById('csvFileInput');
        const uploadSection = document.getElementById('uploadSection');

        if (fileInput) fileInput.value = '';
        if (uploadSection) uploadSection.style.display = 'flex';

        // Hide all thread interface elements
        ['threadHeader', 'threadStats', 'threadControls', 'threadVisualization'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });

        // Clear thread list
        const threadList = document.getElementById('threadList');
        if (threadList) threadList.innerHTML = '';

        // Reset state
        this.currentThreadData = null;
        this.currentThreadId = null;
        this.allThreads.clear();
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML text
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date string
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Global instance for callback access
let emailThreadApp;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    emailThreadApp = new EmailThreadApp();
    window.emailThreadApp = emailThreadApp; // Make it globally accessible
});