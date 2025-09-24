const fs = require('fs-extra');
const path = require('path');

class ThreadVisualizer {
  constructor() {
    this.themes = {
      default: {
        nodeColor: '#4A90E2',
        replyColor: '#7ED321',
        forwardColor: '#F5A623',
        externalColor: '#D0021B',
        lineColor: '#8E8E93',
        backgroundColor: '#FFFFFF'
      },
      dark: {
        nodeColor: '#0A84FF',
        replyColor: '#32D74B',
        forwardColor: '#FF9F0A',
        externalColor: '#FF453A',
        lineColor: '#636366',
        backgroundColor: '#1C1C1E'
      }
    };
  }

  /**
   * Generate HTML visualization of email thread
   */
  generateHTMLVisualization(threadData, options = {}) {
    const theme = this.themes[options.theme || 'default'];
    const showDetails = options.showDetails !== false;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Thread: ${threadData.threadId}</title>
    <style>
        ${this.generateCSS(theme)}
    </style>
</head>
<body>
    <div class="container">
        <header class="thread-header">
            <h1>Email Thread: ${threadData.threadId}</h1>
            <div class="thread-stats">
                <span class="stat">📧 ${threadData.totalEmails} emails</span>
                <span class="stat">👥 ${threadData.participants.length} participants</span>
                <span class="stat">🌳 Depth: ${threadData.maxDepth || 0}</span>
                <span class="stat">🔀 Branches: ${threadData.branchCount || 0}</span>
            </div>
        </header>

        <div class="thread-timeline">
            <div class="timeline-header">
                <span>📅 ${this.formatDate(threadData.dateRange?.start)} → ${this.formatDate(threadData.dateRange?.end)}</span>
            </div>
        </div>

        <div class="thread-visualization">
            ${this.renderThreadNodes(threadData.roots, 0, showDetails)}
        </div>

        <div class="participants-panel">
            <h3>Participants</h3>
            <div class="participants-list">
                ${threadData.participants.map(p => `<span class="participant">${p}</span>`).join('')}
            </div>
        </div>
    </div>

    <script>
        ${this.generateJavaScript()}
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate CSS styles for the visualization
   */
  generateCSS(theme) {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background-color: ${theme.backgroundColor};
            color: ${theme.backgroundColor === '#FFFFFF' ? '#333' : '#FFF'};
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .thread-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 12px;
            background: linear-gradient(135deg, ${theme.nodeColor}20, ${theme.replyColor}20);
        }

        .thread-header h1 {
            margin-bottom: 15px;
            font-size: 2em;
            font-weight: 600;
        }

        .thread-stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .stat {
            background: ${theme.nodeColor}30;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 500;
        }

        .thread-timeline {
            margin-bottom: 30px;
            text-align: center;
        }

        .timeline-header {
            background: ${theme.lineColor}20;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 500;
        }

        .thread-visualization {
            background: ${theme.backgroundColor === '#FFFFFF' ? '#FAFAFA' : '#2C2C2E'};
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
        }

        .thread-node {
            margin: 20px 0;
            position: relative;
        }

        .email-card {
            background: ${theme.backgroundColor};
            border: 2px solid ${theme.nodeColor};
            border-radius: 12px;
            padding: 20px;
            margin-left: 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .email-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .email-card.reply {
            border-color: ${theme.replyColor};
            border-left: 6px solid ${theme.replyColor};
        }

        .email-card.forward {
            border-color: ${theme.forwardColor};
            border-left: 6px solid ${theme.forwardColor};
        }

        .email-card.external {
            border-color: ${theme.externalColor};
            border-left: 6px solid ${theme.externalColor};
        }

        .email-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .email-subject {
            font-weight: 600;
            font-size: 1.1em;
            color: ${theme.nodeColor};
        }

        .email-date {
            font-size: 0.85em;
            color: ${theme.lineColor};
        }

        .email-from {
            font-weight: 500;
            margin-bottom: 5px;
        }

        .email-to {
            font-size: 0.9em;
            color: ${theme.lineColor};
            margin-bottom: 10px;
        }

        .email-body {
            background: ${theme.backgroundColor === '#FFFFFF' ? '#F8F9FA' : '#1C1C1E'};
            padding: 15px;
            border-radius: 8px;
            font-size: 0.9em;
            max-height: 100px;
            overflow: hidden;
            position: relative;
        }

        .email-body.expanded {
            max-height: none;
        }

        .expand-button {
            background: ${theme.nodeColor};
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.8em;
            cursor: pointer;
            margin-top: 10px;
        }

        .thread-children {
            margin-left: 40px;
            border-left: 3px solid ${theme.lineColor}40;
            padding-left: 20px;
            margin-top: 20px;
        }

        .participants-panel {
            background: ${theme.backgroundColor === '#FFFFFF' ? '#F8F9FA' : '#2C2C2E'};
            padding: 20px;
            border-radius: 12px;
        }

        .participants-panel h3 {
            margin-bottom: 15px;
            color: ${theme.nodeColor};
        }

        .participants-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .participant {
            background: ${theme.nodeColor}20;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 0.85em;
            border: 1px solid ${theme.nodeColor}40;
        }

        .email-tags {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }

        .tag {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 500;
        }

        .tag.reply {
            background: ${theme.replyColor}30;
            color: ${theme.replyColor};
        }

        .tag.forward {
            background: ${theme.forwardColor}30;
            color: ${theme.forwardColor};
        }

        .tag.external {
            background: ${theme.externalColor}30;
            color: ${theme.externalColor};
        }

        .tag.internal {
            background: ${theme.nodeColor}30;
            color: ${theme.nodeColor};
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .thread-stats {
                gap: 10px;
            }

            .email-header {
                flex-direction: column;
            }

            .thread-children {
                margin-left: 20px;
            }
        }
    `;
  }

  /**
   * Render thread nodes recursively
   */
  renderThreadNodes(nodes, depth, showDetails) {
    if (!nodes || nodes.length === 0) return '';

    return nodes.map(node => {
      const emailType = this.getEmailType(node);
      const tags = this.getEmailTags(node);

      return `
        <div class="thread-node" style="margin-left: ${depth * 20}px;">
            <div class="email-card ${emailType}" data-message-id="${node.messageId}">
                <div class="email-header">
                    <div class="email-subject">${this.escapeHtml(node.subject || 'No Subject')}</div>
                    <div class="email-date">${this.formatDate(node.dateSent)}</div>
                </div>

                <div class="email-from">From: ${this.escapeHtml(node.from)}</div>

                ${node.to && node.to.length > 0 ? `
                    <div class="email-to">To: ${node.to.map(t => this.escapeHtml(t)).join(', ')}</div>
                ` : ''}

                ${showDetails && node.fullText ? `
                    <div class="email-body" id="body-${node.messageId}">
                        ${this.escapeHtml(node.fullText.substring(0, 200))}
                        ${node.fullText.length > 200 ? '...' : ''}
                    </div>
                    ${node.fullText.length > 200 ? `
                        <button class="expand-button" onclick="toggleEmailBody('${node.messageId}')">
                            Show More
                        </button>
                    ` : ''}
                ` : ''}

                <div class="email-tags">
                    ${tags.map(tag => `<span class="tag ${tag.type}">${tag.label}</span>`).join('')}
                </div>
            </div>

            ${node.children && node.children.length > 0 ? `
                <div class="thread-children">
                    ${this.renderThreadNodes(node.children, depth + 1, showDetails)}
                </div>
            ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Get email type for styling
   */
  getEmailType(email) {
    if (email.isExternal) return 'external';
    if (email.isForward) return 'forward';
    if (email.inReplyTo) return 'reply';
    return 'original';
  }

  /**
   * Get email tags for display
   */
  getEmailTags(email) {
    const tags = [];

    if (email.isExternal) {
      tags.push({ type: 'external', label: '🌐 External' });
    } else {
      tags.push({ type: 'internal', label: '🏢 Internal' });
    }

    if (email.isForward) {
      tags.push({ type: 'forward', label: '↪️ Forward' });
    } else if (email.inReplyTo) {
      tags.push({ type: 'reply', label: '↩️ Reply' });
    }

    if (email.confidentiality && email.confidentiality !== 'Internal') {
      tags.push({ type: 'confidential', label: `🔒 ${email.confidentiality}` });
    }

    return tags;
  }

  /**
   * Generate JavaScript for interactivity
   */
  generateJavaScript() {
    return `
        function toggleEmailBody(messageId) {
            const body = document.getElementById('body-' + messageId);
            const button = body.nextElementSibling;

            if (body.classList.contains('expanded')) {
                body.classList.remove('expanded');
                button.textContent = 'Show More';
            } else {
                body.classList.add('expanded');
                button.textContent = 'Show Less';
            }
        }

        // Add click handlers for email cards
        document.addEventListener('DOMContentLoaded', function() {
            const emailCards = document.querySelectorAll('.email-card');

            emailCards.forEach(card => {
                card.addEventListener('click', function(e) {
                    if (e.target.classList.contains('expand-button')) return;

                    // Toggle selection
                    const isSelected = card.classList.contains('selected');

                    // Remove selection from all cards
                    emailCards.forEach(c => c.classList.remove('selected'));

                    // Add selection to clicked card if it wasn't selected
                    if (!isSelected) {
                        card.classList.add('selected');
                        card.style.borderWidth = '3px';
                    } else {
                        card.style.borderWidth = '2px';
                    }
                });
            });
        });
    `;
  }

  /**
   * Utility functions
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  formatDate(date) {
    if (!date) return 'Unknown';
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Generate D3.js tree visualization
   */
  generateD3Visualization(threadData, options = {}) {
    const width = options.width || 800;
    const height = options.height || 600;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Email Thread Tree - ${threadData.threadId}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        .node circle {
            fill: #4A90E2;
            stroke: #fff;
            stroke-width: 2px;
        }

        .node.reply circle {
            fill: #7ED321;
        }

        .node.forward circle {
            fill: #F5A623;
        }

        .node.external circle {
            fill: #D0021B;
        }

        .node text {
            font: 12px sans-serif;
            text-anchor: middle;
        }

        .link {
            fill: none;
            stroke: #8E8E93;
            stroke-width: 2px;
        }

        .tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            pointer-events: none;
            font-size: 12px;
            max-width: 300px;
        }
    </style>
</head>
<body>
    <h1>Email Thread Tree: ${threadData.threadId}</h1>
    <div id="visualization"></div>

    <script>
        const data = ${JSON.stringify(this.convertToD3Format(threadData))};

        const margin = {top: 20, right: 120, bottom: 20, left: 120};
        const width = ${width} - margin.right - margin.left;
        const height = ${height} - margin.top - margin.bottom;

        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.right + margin.left)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        const tree = d3.tree().size([height, width]);
        const root = d3.hierarchy(data);

        tree(root);

        // Add links
        g.selectAll(".link")
            .data(root.descendants().slice(1))
            .enter().append("path")
            .attr("class", "link")
            .attr("d", d => {
                return "M" + d.y + "," + d.x
                    + "C" + (d.y + d.parent.y) / 2 + "," + d.x
                    + " " + (d.y + d.parent.y) / 2 + "," + d.parent.x
                    + " " + d.parent.y + "," + d.parent.x;
            });

        // Add nodes
        const node = g.selectAll(".node")
            .data(root.descendants())
            .enter().append("g")
            .attr("class", d => "node " + (d.data.type || ""))
            .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

        node.append("circle")
            .attr("r", 8);

        node.append("text")
            .attr("dy", 20)
            .text(d => d.data.subject ? d.data.subject.substring(0, 20) : "No Subject");

        // Add tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        node.on("mouseover", function(event, d) {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(
                "<strong>" + (d.data.subject || "No Subject") + "</strong><br/>" +
                "From: " + (d.data.from || "") + "<br/>" +
                "Date: " + (d.data.date || "") + "<br/>" +
                "Type: " + (d.data.type || "original")
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition().duration(500).style("opacity", 0);
        });
    </script>
</body>
</html>`;
  }

  /**
   * Convert thread data to D3 format
   */
  convertToD3Format(threadData) {
    if (!threadData.roots || threadData.roots.length === 0) {
      return { name: "Empty Thread" };
    }

    const convertNode = (node) => ({
      subject: node.subject,
      from: node.from,
      date: this.formatDate(node.dateSent),
      type: this.getEmailType(node),
      children: node.children ? node.children.map(convertNode) : undefined
    });

    // If multiple roots, create a virtual root
    if (threadData.roots.length > 1) {
      return {
        subject: `Thread: ${threadData.threadId}`,
        from: "System",
        date: "",
        type: "thread",
        children: threadData.roots.map(convertNode)
      };
    }

    return convertNode(threadData.roots[0]);
  }
}

module.exports = ThreadVisualizer;