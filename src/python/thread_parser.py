#!/usr/bin/env python3
"""
Python script to process email threads using the python-emailthreads library.
This script converts .eml files into thread structures compatible with visualization.
"""

import os
import sys
import json
import argparse
from pathlib import Path
import mailbox
import tempfile
from email import message_from_string
from email.mime.text import MIMEText

try:
    import emailthreads
except ImportError:
    print("Error: python-emailthreads library not found. Install with: pip install emailthreads")
    sys.exit(1)


class EmailThreadParser:
    def __init__(self):
        self.threads = {}

    def load_eml_files(self, eml_directory):
        """Load .eml files from directory and create a mailbox."""
        eml_dir = Path(eml_directory)
        if not eml_dir.exists():
            raise FileNotFoundError(f"Directory {eml_directory} not found")

        # Create a temporary mbox file
        temp_mbox = tempfile.NamedTemporaryFile(mode='w+', suffix='.mbox', delete=False)
        temp_mbox_path = temp_mbox.name
        temp_mbox.close()

        # Create mailbox and add emails
        mbox = mailbox.mbox(temp_mbox_path)

        eml_files = list(eml_dir.glob('*.eml'))
        print(f"Found {len(eml_files)} .eml files")

        for eml_file in eml_files:
            try:
                with open(eml_file, 'r', encoding='utf-8') as f:
                    email_content = f.read()

                # Parse email message
                msg = message_from_string(email_content)

                # Add to mailbox
                mbox.add(msg)
                print(f"Added {eml_file.name} to mailbox")

            except Exception as e:
                print(f"Error processing {eml_file}: {e}")
                continue

        mbox.close()
        return temp_mbox_path

    def parse_threads(self, mbox_path):
        """Parse email threads using python-emailthreads."""
        try:
            mbox = mailbox.mbox(mbox_path)
            threads = emailthreads.parse(mbox)
            mbox.close()

            return threads

        except Exception as e:
            print(f"Error parsing threads: {e}")
            return None

    def convert_thread_to_dict(self, thread):
        """Convert thread object to dictionary for JSON serialization."""
        if hasattr(thread, 'message'):
            msg = thread.message

            # Extract basic email information
            thread_dict = {
                'message_id': msg.get('Message-ID', ''),
                'subject': msg.get('Subject', ''),
                'from': msg.get('From', ''),
                'to': msg.get('To', ''),
                'cc': msg.get('CC', ''),
                'date': msg.get('Date', ''),
                'in_reply_to': msg.get('In-Reply-To', ''),
                'references': msg.get('References', ''),
                'body': self.extract_body(msg),
                'children': []
            }

            # Process children recursively
            if hasattr(thread, 'children'):
                for child in thread.children:
                    child_dict = self.convert_thread_to_dict(child)
                    thread_dict['children'].append(child_dict)

            return thread_dict
        else:
            return {
                'message_id': '',
                'subject': '',
                'from': '',
                'to': '',
                'cc': '',
                'date': '',
                'in_reply_to': '',
                'references': '',
                'body': '',
                'children': []
            }

    def extract_body(self, msg):
        """Extract body text from email message."""
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True)
                    if isinstance(body, bytes):
                        body = body.decode('utf-8', errors='ignore')
                    break
        else:
            body = msg.get_payload(decode=True)
            if isinstance(body, bytes):
                body = body.decode('utf-8', errors='ignore')

        return body or ""

    def analyze_thread_structure(self, thread_dict, depth=0):
        """Analyze thread structure and generate statistics."""
        stats = {
            'depth': depth,
            'total_messages': 1,
            'max_depth': depth,
            'branch_count': len(thread_dict.get('children', [])),
            'participants': set()
        }

        # Add participants
        if thread_dict.get('from'):
            stats['participants'].add(thread_dict['from'])

        # Analyze children
        for child in thread_dict.get('children', []):
            child_stats = self.analyze_thread_structure(child, depth + 1)
            stats['total_messages'] += child_stats['total_messages']
            stats['max_depth'] = max(stats['max_depth'], child_stats['max_depth'])
            stats['branch_count'] += child_stats['branch_count']
            stats['participants'].update(child_stats['participants'])

        return stats

    def process_directory(self, eml_directory, output_file):
        """Process entire directory of .eml files."""
        print(f"Processing emails from: {eml_directory}")

        # Load emails into mailbox
        mbox_path = self.load_eml_files(eml_directory)

        try:
            # Parse threads
            threads = self.parse_threads(mbox_path)

            if threads is None:
                print("Failed to parse threads")
                return False

            # Convert to dictionary format
            result = {
                'threads': [],
                'summary': {
                    'total_threads': 0,
                    'total_messages': 0,
                    'processing_timestamp': str(datetime.now())
                }
            }

            thread_count = 0
            total_messages = 0

            # Process each thread
            for thread in threads:
                thread_dict = self.convert_thread_to_dict(thread)
                stats = self.analyze_thread_structure(thread_dict)

                thread_entry = {
                    'thread_id': f"thread_{thread_count}",
                    'root_message': thread_dict,
                    'statistics': {
                        'total_messages': stats['total_messages'],
                        'max_depth': stats['max_depth'],
                        'branch_count': stats['branch_count'],
                        'participants': list(stats['participants'])
                    }
                }

                result['threads'].append(thread_entry)
                thread_count += 1
                total_messages += stats['total_messages']

            result['summary']['total_threads'] = thread_count
            result['summary']['total_messages'] = total_messages

            # Save results
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"Thread analysis saved to: {output_file}")
            print(f"Processed {thread_count} threads with {total_messages} total messages")

            return True

        finally:
            # Cleanup temporary mbox file
            if os.path.exists(mbox_path):
                os.unlink(mbox_path)


def main():
    parser = argparse.ArgumentParser(description='Parse email threads using python-emailthreads')
    parser.add_argument('eml_directory', help='Directory containing .eml files')
    parser.add_argument('output_file', help='Output JSON file for thread analysis')

    args = parser.parse_args()

    parser_instance = EmailThreadParser()
    success = parser_instance.process_directory(args.eml_directory, args.output_file)

    if success:
        print("Thread parsing completed successfully")
        sys.exit(0)
    else:
        print("Thread parsing failed")
        sys.exit(1)


if __name__ == '__main__':
    from datetime import datetime
    main()