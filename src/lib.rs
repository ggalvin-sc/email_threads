use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use indexmap::IndexMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMessage {
    pub id: String,
    pub message_id: String,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub thread_id: String,
    pub from: String,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: String,
    pub date_sent: DateTime<Utc>,
    pub custodian: String,
    pub file_name: String,
    pub full_text: String,
    pub confidentiality: String,
    pub is_forward: bool,
    pub is_external: bool,
    pub beg_bates: String,
    pub end_bates: String,
    pub file_type: String,
    pub hash: String,
    pub native_link: String,
    pub author: String,
    pub title: String,
    pub date_created: DateTime<Utc>,
    pub date_last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadNode {
    pub email: EmailMessage,
    pub children: Vec<ThreadNode>,
    pub depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadTree {
    pub thread_id: String,
    pub roots: Vec<ThreadNode>,
    pub total_emails: usize,
    pub participants: Vec<String>,
    pub date_range: DateRange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadStats {
    pub thread_id: String,
    pub total_emails: usize,
    pub participants: Vec<String>,
    pub participant_count: usize,
    pub max_depth: usize,
    pub branch_count: usize,
    pub forward_count: usize,
    pub reply_count: usize,
    pub external_count: usize,
    pub date_range: DateRange,
}

#[wasm_bindgen]
pub struct EmailThreadProcessor {
    emails: Vec<EmailMessage>,
    threads: IndexMap<String, Vec<EmailMessage>>,
}

#[wasm_bindgen]
impl EmailThreadProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> EmailThreadProcessor {
        console_log!("Initializing EmailThreadProcessor");
        EmailThreadProcessor {
            emails: Vec::new(),
            threads: IndexMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn load_emails_from_csv(&mut self, csv_data: &str) -> Result<usize, JsValue> {
        console_log!("Loading emails from CSV data, length: {}", csv_data.len());

        if csv_data.is_empty() {
            return Err(JsValue::from_str("CSV data is empty"));
        }

        let mut emails = Vec::new();
        let mut rdr = csv::Reader::from_reader(csv_data.as_bytes());
        let mut row_count = 0;
        let mut error_count = 0;

        // Log headers for debugging
        if let Ok(headers) = rdr.headers() {
            console_log!("CSV headers: {:?}", headers);
        }

        for result in rdr.deserialize() {
            row_count += 1;
            match result {
                Ok(record) => {
                    match self.parse_csv_record(record) {
                        Ok(email) => {
                            console_log!("Successfully parsed email {}: {}", emails.len() + 1, email.subject);
                            emails.push(email);
                        },
                        Err(e) => {
                            error_count += 1;
                            console_log!("Error parsing email record {}: {}", row_count, e);
                            if error_count > 5 {
                                return Err(JsValue::from_str(&format!("Too many parsing errors ({}), stopping", error_count)));
                            }
                            continue;
                        }
                    }
                }
                Err(e) => {
                    error_count += 1;
                    console_log!("Error reading CSV record {}: {}", row_count, e);
                    if error_count > 5 {
                        return Err(JsValue::from_str(&format!("Too many CSV reading errors ({}), stopping", error_count)));
                    }
                    continue;
                }
            }
        }

        let count = emails.len();
        self.emails = emails;
        console_log!("Successfully loaded {} emails out of {} rows ({} errors)", count, row_count, error_count);

        if count == 0 {
            return Err(JsValue::from_str("No valid emails were parsed from CSV"));
        }

        Ok(count)
    }

    fn parse_csv_record(&self, record: CsvRecord) -> Result<EmailMessage, String> {
        let thread_info = self.parse_column_history(&record.column_history);

        let date_sent = chrono::DateTime::parse_from_rfc3339(&record.date_sent)
            .or_else(|_| chrono::DateTime::parse_from_str(&record.date_sent, "%Y-%m-%dT%H:%M:%SZ"))
            .map_err(|e| format!("Invalid date format for DateSent: {}", e))?
            .with_timezone(&Utc);

        let date_created = chrono::DateTime::parse_from_rfc3339(&record.date_created)
            .or_else(|_| chrono::DateTime::parse_from_str(&record.date_created, "%Y-%m-%dT%H:%M:%SZ"))
            .map_err(|e| format!("Invalid date format for DateCreated: {}", e))?
            .with_timezone(&Utc);

        let date_last_modified = chrono::DateTime::parse_from_rfc3339(&record.date_last_modified)
            .or_else(|_| chrono::DateTime::parse_from_str(&record.date_last_modified, "%Y-%m-%dT%H:%M:%SZ"))
            .map_err(|e| format!("Invalid date format for DateLastModified: {}", e))?
            .with_timezone(&Utc);

        Ok(EmailMessage {
            id: record.beg_bates.clone(),
            message_id: thread_info.message_id.unwrap_or_default(),
            in_reply_to: thread_info.in_reply_to,
            references: thread_info.references.unwrap_or_default(),
            thread_id: thread_info.thread_id.unwrap_or_default(),
            from: record.from,
            to: record.to.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            cc: record.cc.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            bcc: record.bcc.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            subject: record.subject,
            date_sent,
            custodian: record.custodian,
            file_name: record.file_name,
            full_text: record.full_text,
            confidentiality: record.confidentiality,
            is_forward: thread_info.is_forward,
            is_external: thread_info.is_external,
            beg_bates: record.beg_bates,
            end_bates: record.end_bates,
            file_type: record.file_type,
            hash: record.hash,
            native_link: record.native_link,
            author: record.author,
            title: record.title,
            date_created,
            date_last_modified,
        })
    }

    fn parse_column_history(&self, column_history: &str) -> ThreadInfo {
        let mut info = ThreadInfo::default();

        if column_history.is_empty() {
            return info;
        }

        for part in column_history.split('|') {
            if part.starts_with("MSG-ID:") {
                info.message_id = Some(part.replace("MSG-ID:", ""));
            } else if part.starts_with("IN-REPLY-TO:") {
                info.in_reply_to = Some(part.replace("IN-REPLY-TO:", ""));
            } else if part.starts_with("REFS:") {
                let refs = part.replace("REFS:", "");
                if refs != "<>" {
                    info.references = Some(refs.split_whitespace().map(|s| s.to_string()).collect());
                }
            } else if part.starts_with("THREAD:") {
                info.thread_id = Some(part.replace("THREAD:", ""));
            } else if part == "FWD:true" {
                info.is_forward = true;
            } else if part == "EXTERNAL:true" {
                info.is_external = true;
            }
        }

        info
    }

    #[wasm_bindgen]
    pub fn group_by_threads(&mut self) -> usize {
        console_log!("Grouping emails by threads");
        self.threads.clear();

        for email in &self.emails {
            if !email.thread_id.is_empty() {
                self.threads
                    .entry(email.thread_id.clone())
                    .or_insert_with(Vec::new)
                    .push(email.clone());
            }
        }

        // Sort emails within each thread by date
        for emails in self.threads.values_mut() {
            emails.sort_by(|a, b| a.date_sent.cmp(&b.date_sent));
        }

        console_log!("Found {} threads", self.threads.len());
        self.threads.len()
    }

    #[wasm_bindgen]
    pub fn build_thread_tree(&self, thread_id: &str) -> Result<JsValue, JsValue> {
        console_log!("Building thread tree for: {}", thread_id);

        let emails = match self.threads.get(thread_id) {
            Some(emails) => emails,
            None => return Err(JsValue::from_str("Thread not found")),
        };

        let mut email_map: HashMap<String, EmailMessage> = HashMap::new();
        let mut children_map: HashMap<String, Vec<String>> = HashMap::new();

        // Build email map and children relationships
        for email in emails {
            email_map.insert(email.message_id.clone(), email.clone());

            if let Some(parent_id) = &email.in_reply_to {
                children_map
                    .entry(parent_id.clone())
                    .or_insert_with(Vec::new)
                    .push(email.message_id.clone());
            }
        }

        // Find root emails (those without parents in this thread)
        let mut roots = Vec::new();
        for email in emails {
            if email.in_reply_to.is_none() ||
               !email_map.contains_key(email.in_reply_to.as_ref().unwrap()) {
                roots.push(self.build_node(&email_map, &children_map, &email.message_id, 0));
            }
        }

        let participants = self.get_unique_participants(emails);
        let date_range = DateRange {
            start: emails.first().map(|e| e.date_sent).unwrap_or_else(Utc::now),
            end: emails.last().map(|e| e.date_sent).unwrap_or_else(Utc::now),
        };

        let thread_tree = ThreadTree {
            thread_id: thread_id.to_string(),
            roots,
            total_emails: emails.len(),
            participants,
            date_range,
        };

        serde_wasm_bindgen::to_value(&thread_tree).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn build_node(
        &self,
        email_map: &HashMap<String, EmailMessage>,
        children_map: &HashMap<String, Vec<String>>,
        message_id: &str,
        depth: usize,
    ) -> ThreadNode {
        let email = email_map.get(message_id).unwrap().clone();
        let mut children = Vec::new();

        if let Some(child_ids) = children_map.get(message_id) {
            for child_id in child_ids {
                children.push(self.build_node(email_map, children_map, child_id, depth + 1));
            }
        }

        ThreadNode {
            email,
            children,
            depth,
        }
    }

    fn get_unique_participants(&self, emails: &[EmailMessage]) -> Vec<String> {
        let mut participants = std::collections::HashSet::new();

        for email in emails {
            participants.insert(email.from.clone());
            for addr in &email.to {
                participants.insert(addr.clone());
            }
            for addr in &email.cc {
                participants.insert(addr.clone());
            }
        }

        participants.into_iter().collect()
    }

    #[wasm_bindgen]
    pub fn generate_thread_stats(&self, thread_id: &str) -> Result<JsValue, JsValue> {
        console_log!("Generating stats for thread: {}", thread_id);

        let emails = match self.threads.get(thread_id) {
            Some(emails) => emails,
            None => return Err(JsValue::from_str("Thread not found")),
        };

        let tree_result = self.build_thread_tree(thread_id)?;
        let tree: ThreadTree = serde_wasm_bindgen::from_value(tree_result)?;

        let participants = self.get_unique_participants(emails);
        let max_depth = self.calculate_max_depth(&tree.roots);
        let branch_count = self.count_branches(&tree.roots);

        let mut forward_count = 0;
        let mut reply_count = 0;
        let mut external_count = 0;

        for email in emails {
            if email.is_forward {
                forward_count += 1;
            }
            if email.in_reply_to.is_some() {
                reply_count += 1;
            }
            if email.is_external {
                external_count += 1;
            }
        }

        let stats = ThreadStats {
            thread_id: thread_id.to_string(),
            total_emails: emails.len(),
            participant_count: participants.len(),
            participants,
            max_depth,
            branch_count,
            forward_count,
            reply_count,
            external_count,
            date_range: tree.date_range,
        };

        serde_wasm_bindgen::to_value(&stats).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn calculate_max_depth(&self, roots: &[ThreadNode]) -> usize {
        roots.iter()
            .map(|node| self.node_max_depth(node, 0))
            .max()
            .unwrap_or(0)
    }

    fn node_max_depth(&self, node: &ThreadNode, current_depth: usize) -> usize {
        if node.children.is_empty() {
            current_depth
        } else {
            node.children.iter()
                .map(|child| self.node_max_depth(child, current_depth + 1))
                .max()
                .unwrap_or(current_depth)
        }
    }

    fn count_branches(&self, roots: &[ThreadNode]) -> usize {
        roots.iter()
            .map(|node| self.node_branch_count(node))
            .sum()
    }

    fn node_branch_count(&self, node: &ThreadNode) -> usize {
        let mut branches = if node.children.len() > 1 {
            node.children.len()
        } else {
            0
        };

        for child in &node.children {
            branches += self.node_branch_count(child);
        }

        branches
    }

    #[wasm_bindgen]
    pub fn get_thread_ids(&self) -> Vec<String> {
        self.threads.keys().cloned().collect()
    }

    #[wasm_bindgen]
    pub fn get_email_count(&self) -> usize {
        self.emails.len()
    }

    #[wasm_bindgen]
    pub fn get_thread_count(&self) -> usize {
        self.threads.len()
    }
}

#[derive(Default)]
struct ThreadInfo {
    message_id: Option<String>,
    in_reply_to: Option<String>,
    references: Option<Vec<String>>,
    thread_id: Option<String>,
    is_forward: bool,
    is_external: bool,
}

#[derive(Deserialize)]
struct CsvRecord {
    #[serde(rename = "BegBates")]
    beg_bates: String,
    #[serde(rename = "EndBates")]
    end_bates: String,
    #[serde(rename = "BegAttach", default)]
    beg_attach: String,
    #[serde(rename = "EndAttach", default)]
    end_attach: String,
    #[serde(rename = "Custodian")]
    custodian: String,
    #[serde(rename = "DuplicateCustodian", default)]
    duplicate_custodian: String,
    #[serde(rename = "From")]
    from: String,
    #[serde(rename = "To")]
    to: String,
    #[serde(rename = "CC", default)]
    cc: String,
    #[serde(rename = "BCC", default)]
    bcc: String,
    #[serde(rename = "Subject")]
    subject: String,
    #[serde(rename = "DateSent")]
    date_sent: String,
    #[serde(rename = "FileName")]
    file_name: String,
    #[serde(rename = "FileType")]
    file_type: String,
    #[serde(rename = "FileExtension", default)]
    file_extension: String,
    #[serde(rename = "ESIType", default)]
    esi_type: String,
    #[serde(rename = "DeDuplicatedPath", default)]
    deduplicated_path: String,
    #[serde(rename = "DateCreated")]
    date_created: String,
    #[serde(rename = "DateLastModified")]
    date_last_modified: String,
    #[serde(rename = "Title")]
    title: String,
    #[serde(rename = "author")]
    author: String,
    #[serde(rename = "Confidentiality")]
    confidentiality: String,
    #[serde(rename = "Hash")]
    hash: String,
    #[serde(rename = "nativelink")]
    native_link: String,
    #[serde(rename = "FullText")]
    full_text: String,
    #[serde(rename = "EndAttach_Left", default)]
    end_attach_left: String,
    #[serde(rename = "column_history")]
    column_history: String,
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}! Email thread processor is ready.", name));
}

// Utils
#[wasm_bindgen]
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}