#!/usr/bin/env python3
"""Archive existing Runway image URLs to Drive. Requires GOOGLE_SERVICE_ACCOUNT_JSON secret and shared destination folder."""
import json, os, hashlib, tempfile, urllib.request
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

def main():
    manifest = json.loads(Path(__file__).with_name("manifest.json").read_text())
    creds = service_account.Credentials.from_service_account_info(
        json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]),
        scopes=["https://www.googleapis.com/auth/drive.file"])
    drive = build("drive", "v3", credentials=creds)
    folder = os.environ.get("DRIVE_FOLDER_ID", "1yHb8ot1JDDJZiSDAnVrvw7JptI2iJJy4")
    seen = set()
    for item in manifest:
        name = item["filename"]
        if not name.startswith("V002_") or "/" in name or name in seen:
            raise ValueError("Invalid or duplicate filename")
        seen.add(name)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / name
            req = urllib.request.Request(item["url"], headers={"User-Agent":"LE-DEKLIK-archiver/1.0"})
            with urllib.request.urlopen(req, timeout=60) as response:
                if not response.headers.get("Content-Type","").startswith("image/"):
                    raise ValueError("URL did not return an image")
                with path.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
            if path.stat().st_size == 0:
                raise ValueError("Empty image")
            safe = name.replace("'", "\\'")
            existing = drive.files().list(q=f"'{folder}' in parents and name = '{safe}' and trashed = false", fields="files(id,name)",page_size=10).execute()["files"]
            if existing:
                print(f"SKIP existing {name}")
                continue
            media = MediaFileUpload(str(path), mimetype=item.get("mime_type","image/jpeg"), resumable=True)
            created = drive.files().create(body={"name":name,"parents":[folder]},media_body=media,fields="id,name,size").execute()
            print(f"UPLOADED {created['name']} id={created['id']} sha256={hashlib.sha256(path.read_bytes()).hexdigest()}")
if __name__ == "__main__":
    main()
