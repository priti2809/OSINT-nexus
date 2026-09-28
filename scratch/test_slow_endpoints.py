import urllib.request
import json
import sys

def test_slow_endpoints():
    print("Testing slow Aegis endpoints with 15s timeout...")
    base = "http://127.0.0.1:8000"
    
    # 1. Test Username Search
    try:
        url = f"{base}/api/search_username?username=torvalds"
        print(f"Querying: {url}")
        req = urllib.request.Request(url, headers={'User-Agent': 'AegisTestClient/1.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            print(f"  Status: {res.getcode()} OK")
            print(f"  Username results: {len(data.get('results', []))} entries")
    except Exception as e:
        print(f"  FAILED Username Search: {e}")
        sys.exit(1)
        
    # 2. Test Domain Info
    try:
        url = f"{base}/api/domain_info?domain=google.com"
        print(f"Querying: {url}")
        req = urllib.request.Request(url, headers={'User-Agent': 'AegisTestClient/1.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            print(f"  Status: {res.getcode()} OK")
            print(f"  Domain IP resolved: {data.get('ip')}")
    except Exception as e:
        print(f"  FAILED Domain Info: {e}")
        sys.exit(1)
        
    print("\nSlow endpoints verification: SUCCESS")

if __name__ == '__main__':
    test_slow_endpoints()
