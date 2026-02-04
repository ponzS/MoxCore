import sys
import requests
from bs4 import BeautifulSoup

def search(term):
    url = 'https://duckduckgo.com/html/'
    params = {'q': term}
    headers = {'User-Agent': 'Mozilla/5.0'}
    r = requests.get(url, params=params, headers=headers, timeout=10)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, 'html.parser')
    results = []
    for a in soup.select('.result__a'):
        title = a.get_text()
        link = a['href']
        snippet = a.find_next_sibling('a', class_='result__snippet')
        snippet_text = snippet.get_text() if snippet else ''
        results.append((title, link, snippet_text))
    return results

if __name__ == '__main__':
    term = sys.argv[1] if len(sys.argv)>1 else 'ponzs'
    for title, link, snippet in search(term)[:5]:
        print(f'Title: {title}')
        print(f'Link: {link}')
        print(f'Snippet: {snippet}\n')
