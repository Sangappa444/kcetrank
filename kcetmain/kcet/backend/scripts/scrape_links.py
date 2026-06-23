import urllib.request
import re
from bs4 import BeautifulSoup
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

def find_pdf_links(url):
    print(f"Fetching {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req).read()
        soup = BeautifulSoup(html, 'html.parser')
        links = soup.find_all('a', href=True)
        pdf_links = []
        for a in links:
            href = a['href']
            text = a.text.strip().lower()
            if 'cutoff' in text or 'cut off' in text or 'mock' in text or 'allotment' in text:
                if href.lower().endswith('.pdf'):
                    if not href.startswith('http'):
                        href = 'https://cetonline.karnataka.gov.in' + (href if href.startswith('/') else '/' + href)
                    pdf_links.append((a.text.strip(), href))
        return pdf_links
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return []

urls_to_check = [
    'https://cetonline.karnataka.gov.in/kea/ugneet24',
    'https://cetonline.karnataka.gov.in/kea/ugneet2023',
    'https://cetonline.karnataka.gov.in/kea/ugneet2024',
    'https://cetonline.karnataka.gov.in/kea/medical'
]

for u in urls_to_check:
    res = find_pdf_links(u)
    if res:
        print(f"\nFound at {u}:")
        for text, link in res:
            print(f"- {text}: {link}")
