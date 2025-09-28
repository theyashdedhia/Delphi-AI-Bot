"""Lambda handler for Delphi Vault file operations.
 
API Gateway invokes this single Lambda for GET, POST, DELETE on the
/delphi-vault-file resource.
 
Methods:
GET    -> List objects in the S3 bucket (optionally filtered by prefix)
POST   -> Upload a PDF. Body JSON: {"fileName": str, "fileData": base64 str}
DELETE -> Delete a file. Accepts JSON body {"key": str} or query param ?key=...
 
Environment:
DOCS_BUCKET : Name of the S3 bucket to store documents.
DOCS_PREFIX : (Optional) prefix/folder inside bucket (no leading slash).
 
Responses are JSON with appropriate CORS headers.
"""

import base64
import binascii
import json
import logging
import mimetypes
import os
from datetime import datetime, timezone
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

BUCKET = os.environ.get("DOCS_BUCKET", "delphi-document-vault")
PREFIX = os.environ.get("DOCS_PREFIX", "").strip().lstrip("/")
if PREFIX and not PREFIX.endswith("/"):
    PREFIX = PREFIX + "/"
PRESIGN_EXP_SECONDS = int(
    os.environ.get("PRESIGN_EXP_SECONDS", "300")
)  # default 5 minutes

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB limit for PDFs


def _response(status: int, body: Dict[str, Any]):
    """Helper to build API Gateway proxy response with CORS."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def _error(status: int, message: str, **extra):
    return _response(status, {"success": False, "message": message, **extra})


def list_or_get_object(event: Dict[str, Any]):
    """List objects or return a presigned URL for a single object if ?key= provided."""
    if not BUCKET:
        return _error(500, "DOCS_BUCKET not configured")

    qs = (event or {}).get("queryStringParameters") or {}
    requested_key = qs.get("key") if qs else None

    # Single file presign branch
    if requested_key:
        s3_key = f"{PREFIX}{requested_key}" if PREFIX else requested_key
        try:
            # We can optionally HEAD first to validate existence
            s3.head_object(Bucket=BUCKET, Key=s3_key)
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey"}:
                return _error(404, "File not found", key=requested_key)
            logger.exception("Head object failed")
            return _error(500, "Failed to access file", error=str(e))

        try:
            url = s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": BUCKET, "Key": s3_key},
                ExpiresIn=PRESIGN_EXP_SECONDS,
            )
            return _response(
                200,
                {
                    "success": True,
                    "key": requested_key,
                    "url": url,
                    "expires_in": PRESIGN_EXP_SECONDS,
                },
            )
        except ClientError as e:
            logger.exception("Presign failed")
            return _error(500, "Failed to generate presigned URL", error=str(e))

    # List branch
    try:
        paginator = s3.get_paginator("list_objects_v2")
        items = []
        for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if PREFIX and not key.startswith(PREFIX):
                    continue
                short_key = key[len(PREFIX) :] if PREFIX else key
                if not short_key:  # skip prefix placeholder
                    continue
                items.append(
                    {
                        "key": short_key,
                        "size": obj.get("Size"),
                        "last_modified": obj.get("LastModified")
                        .astimezone(timezone.utc)
                        .isoformat(),
                        "etag": obj.get("ETag", "").strip('"'),
                    }
                )
        return _response(200, {"success": True, "files": items, "count": len(items)})
    except ClientError as e:
        logger.exception("List objects failed")
        return _error(500, "Failed to list files", error=str(e))


def upload_file(event_body: Dict[str, Any]):
    if not BUCKET:
        return _error(500, "DOCS_BUCKET not configured")
    file_name = event_body.get("fileName")
    file_data_b64 = event_body.get("fileData")
    if not file_name or not file_data_b64:
        return _error(400, "fileName and fileData required")

    # Enforce PDF extension
    if not file_name.lower().endswith(".pdf"):
        return _error(400, "Only PDF files are allowed")

    try:
        binary = base64.b64decode(file_data_b64)
    except (binascii.Error, ValueError) as exc:
        return _error(400, "fileData must be valid base64", error=str(exc))

    if len(binary) > MAX_FILE_SIZE:
        return _error(400, f"File exceeds max size {MAX_FILE_SIZE//1024//1024}MB")

    content_type, _ = mimetypes.guess_type(file_name)
    if content_type is None:
        content_type = "application/pdf"

    key = f"{PREFIX}{file_name}" if PREFIX else file_name

    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=binary,
            ContentType=content_type,
            Metadata={"uploaded": datetime.utcnow().isoformat()},
        )
        return _response(201, {"success": True, "key": file_name, "size": len(binary)})
    except ClientError as e:
        logger.exception("Upload failed")
        return _error(500, "Failed to upload file", error=str(e))


def delete_file(event: Dict[str, Any]):
    if not BUCKET:
        return _error(500, "DOCS_BUCKET not configured")
    key = None
    # DELETE can send query or body
    qs = event.get("queryStringParameters") or {}
    if qs:
        key = qs.get("key")
    if not key and event.get("body"):
        try:
            body_json = json.loads(event["body"])
            key = body_json.get("key")
        except Exception:
            pass
    if not key:
        return _error(400, "key required")
    s3_key = f"{PREFIX}{key}" if PREFIX else key
    try:
        s3.delete_object(Bucket=BUCKET, Key=s3_key)
        return _response(200, {"success": True, "deleted": key})
    except ClientError as e:
        logger.exception("Delete failed")
        return _error(500, "Failed to delete file", error=str(e))


def lambda_handler(event, context):  # pragma: no cover - entry point
    method = event.get("httpMethod", "").upper()
    logger.info("Event method=%s", method)

    # OPTIONS preflight
    if method == "OPTIONS":
        return _response(200, {"success": True})

    if method == "GET":
        return list_or_get_object(event)
    if method == "POST":
        try:
            body_json = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError as exc:
            return _error(400, "Invalid JSON body", error=str(exc))
        return upload_file(body_json)
    if method == "DELETE":
        return delete_file(event)

    return _error(405, "Method not allowed")
