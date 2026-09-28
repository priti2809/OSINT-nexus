import urllib.request
import urllib.parse
import json
import sys

def test_endpoint(name, url, method="GET", data=None, headers=None):
    print(f"Testing {name} ({method} {url})...")
    if headers is None:
        headers = {'User-Agent': 'AegisTestClient/1.0'}
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=5) as res:
            code = res.getcode()
            body = res.read().decode('utf-8', errors='ignore')
            print(f"  Status: {code} OK")
            print(f"  Response (truncated): {body[:100]}...")
            return True
    except Exception as e:
        print(f"  FAILED: {e}")
        return False

def test_all():
    base = "http://127.0.0.1:8000"
    success = True
    
    # 1. Homepage
    success &= test_endpoint("Homepage", f"{base}/")
    
    # 2. GeoIP
    success &= test_endpoint("GeoIP", f"{base}/api/geoip?ip=8.8.8.8")
    
    # 3. Username search
    success &= test_endpoint("Username Search", f"{base}/api/search_username?username=torvalds")
    
    # 4. Domain Info
    success &= test_endpoint("Domain Info", f"{base}/api/domain_info?domain=google.com")
    
    # 5. URL Reputation
    success &= test_endpoint("URL Reputation", f"{base}/api/url_reputation?url=google.com")
    
    # 6. Metadata Extract
    dummy_jpeg = b'\xFF\xD8\xFF\xE1\x00\x58Exif\x00\x00II*\x00\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00' + b'\x00' * 100
    success &= test_endpoint(
        "Metadata Extract", 
        f"{base}/api/extract_metadata", 
        method="POST", 
        data=dummy_jpeg,
        headers={
            'User-Agent': 'AegisTestClient/1.0',
            'Content-Type': 'application/octet-stream',
            'X-Filename': 'test.jpg'
        }
    )
    
    if success:
        print("\nAll endpoints are fully operational!")
        sys.exit(0)
    else:
        print("\nSome endpoints FAILED!")
        sys.exit(1)

if __name__ == '__main__':
    test_all()
