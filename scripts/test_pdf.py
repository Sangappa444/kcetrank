import urllib.request
import io

try:
    import pdfplumber
except ImportError:
    import os
    os.system('pip install pdfplumber')
    import pdfplumber

url = "https://cetonline.karnataka.gov.in/keawebentry456/ugcet2025/PROF_CODE_E_R_R1kannada.pdf"
print(f"Downloading {url}...")

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        pdf_bytes = response.read()
        
    print(f"Downloaded {len(pdf_bytes)} bytes. Parsing...")
    
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        first_page = pdf.pages[0]
        text = first_page.extract_text()
        print("--- EXTRACTED TEXT FROM PAGE 1 ---")
        print(text[:1000]) # Print first 1000 chars
        print("----------------------------------")
        
        tables = first_page.extract_tables()
        if tables:
            print(f"Found {len(tables)} tables on page 1.")
            print("First row of first table:", tables[0][0])
        else:
            print("No structured tables detected on page 1 by pdfplumber.")
            
except Exception as e:
    print(f"Error: {e}")
