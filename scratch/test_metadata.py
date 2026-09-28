import urllib.request
import json
import sys

def test_metadata_extractor():
    print("Testing local Aegis Metadata Extractor endpoint...")
    url = "http://127.0.0.1:8000/api/extract_metadata"
    # Create a simple dummy JPEG binary with basic signature
    dummy_jpeg = b'\xFF\xD8\xFF\xE1\x00\x58Exif\x00\x00II*\x00\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00' + b'\x00' * 100
    
    try:
        req = urllib.request.Request(
            url,
            data=dummy_jpeg,
            headers={
                'User-Agent': 'AegisTestClient/1.0',
                'Content-Type': 'application/octet-stream',
                'X-Filename': 'test_image.jpg'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            code = res.getcode()
            data = json.loads(res.read().decode())
            print(f"Status: {code} OK")
            print(f"Parsed metadata response: {data}")
            if "File Type" in data and "Filename" in data:
                print("Metadata API verification: SUCCESS")
            else:
                print("Metadata API verification: FAILED")
    except Exception as e:
        print(f"API Connection or parsing test failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    test_metadata_extractor()
