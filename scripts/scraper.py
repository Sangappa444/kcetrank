import pdfplumber
import sqlite3
import os
import urllib.request
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
RAW_PDF_DIR = os.path.join(DATA_DIR, 'raw_pdfs')
DB_PATH = os.path.join(DATA_DIR, 'cutoffs.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS cutoffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year TEXT,
            round TEXT,
            college_code TEXT,
            college_name TEXT,
            course_name TEXT,
            category TEXT,
            cutoff_rank TEXT
        )
    ''')
    conn.commit()
    return conn

def download_sample_pdf():
    url = "https://cetonline.karnataka.gov.in/keawebentry456/ugcet2025/PROF_CODE_E_R_R1kannada.pdf"
    file_path = os.path.join(RAW_PDF_DIR, "2025_r1.pdf")
    if not os.path.exists(file_path):
        print(f"Downloading {url}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(file_path, 'wb') as f:
                f.write(response.read())
        print("Download complete.")
    return file_path

def parse_pdf(file_path, year, round_val, conn):
    print(f"Parsing {file_path}...")
    c = conn.cursor()
    
    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if not text: continue
            
            # Extract college names and their vertical positions
            colleges = []
            for line in text.split('\n'):
                if line.startswith("College:"):
                    # e.g., "College: E001 Univesity of Visvesvaraya College of Engineering ..."
                    match = re.search(r"College:\s*([A-Z0-9]+)\s+(.*)", line)
                    if match:
                        colleges.append({
                            'code': match.group(1).strip(),
                            'name': match.group(2).strip()
                        })
            
            # If pdfplumber extract_tables loses the mapping, we can just use the fact that 
            # usually there is 1 table per college, or if multiple colleges on a page, 
            # tables are returned in top-to-bottom order.
            tables = page.extract_tables()
            
            # Simple heuristic: zip colleges and tables. If there are fewer colleges than tables,
            # it might mean a table continued from previous page.
            # This is a complex problem in PDF scraping, but we'll try a basic mapping first.
            
            if len(colleges) == len(tables):
                for i in range(len(tables)):
                    college = colleges[i]
                    table = tables[i]
                    process_table(table, college, year, round_val, c)
            elif len(colleges) > 0 and len(tables) > 0:
                # If there's a mismatch (e.g. table continued from last page), we assume 
                # the first table belongs to the last college of the previous page.
                # For simplicity in this v1 script, we'll just use the last seen college for all tables
                # if there's a mismatch.
                current_college = colleges[0]
                college_idx = 0
                for table in tables:
                    # In a real robust scraper, we'd check bounding boxes.
                    process_table(table, current_college, year, round_val, c)
            
            conn.commit()
            print(f"Processed page {page_num+1}/{len(pdf.pages)}")

def process_table(table, college, year, round_val, cursor):
    if not table or len(table) < 2: return
    headers = table[0]
    
    if "Course Name" not in headers:
        # Might be a continuation table without headers
        pass
    
    for row in table[1:]:
        if not row or len(row) != len(headers): continue
        course_name = row[0].replace('\n', ' ').strip() if row[0] else ""
        if not course_name or course_name == "Course Name": continue
        
        for i in range(1, len(headers)):
            category = headers[i].replace('\n', '').strip() if headers[i] else ""
            cutoff = row[i].replace('\n', '').strip() if row[i] else ""
            
            if cutoff and cutoff != "--" and category:
                cursor.execute('''
                    INSERT INTO cutoffs (year, round, college_code, college_name, course_name, category, cutoff_rank)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (year, round_val, college['code'], college['name'], course_name, category, cutoff))

if __name__ == "__main__":
    conn = init_db()
    pdf_path = download_sample_pdf()
    
    # Clear existing data for idempotency during testing
    conn.cursor().execute("DELETE FROM cutoffs")
    conn.commit()
    
    parse_pdf(pdf_path, "2025", "1", conn)
    
    # Check results
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM cutoffs")
    print(f"Total rows inserted: {c.fetchone()[0]}")
    
    c.execute("SELECT * FROM cutoffs LIMIT 5")
    for row in c.fetchall():
        print(row)
    
    conn.close()
    print("Done!")
