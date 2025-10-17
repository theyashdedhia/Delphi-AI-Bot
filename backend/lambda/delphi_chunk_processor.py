"""Asynchronous worker Lambda to process uploaded PDFs from SQS.
 
Responsibilities:
- Consume SQS messages with body: {job_id, bucket, key, file_name}
- Run Textract (async job, then poll) to extract text lines
- Perform agentic or naive chunking (based on env ENABLE_AGENTIC_CHUNKING)
- Store chunks into DynamoDB (CHUNKS_TABLE)
- (Optional) Produce embeddings and index to OpenSearch (currently disabled, similar to new.py)
 
Environment Variables:
- AWS_REGION (default ap-southeast-2)
- CHUNKS_TABLE (default delphi-document-chunks)
- ENABLE_AGENTIC_CHUNKING (true/false; default true)
- AGENTIC_LLM_MODEL (see new.py)
- DOCS_BUCKET / DOCS_PREFIX: only used for consistency; message carries bucket/key
 
Note: This worker is designed to run beyond API Gateway timeout limits.
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Callable, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointConnectionError, ReadTimeoutError
from opensearchpy import OpenSearch, RequestsHttpConnection, helpers
from requests_aws4auth import AWS4Auth

AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
OPENSEARCH_HOST = os.environ.get(
    "OPENSEARCH_HOST",
    "6qqi01llu92mgfhf5suk.ap-southeast-2.aoss.amazonaws.com"
)
OPENSEARCH_INDEX = os.environ.get("OPENSEARCH_INDEX", "document-vault-index")

# Configure clients with short network timeouts to avoid hangs
_tx_config = Config(
    connect_timeout=3, read_timeout=10, retries={"max_attempts": 2, "mode": "standard"}
)
textract = boto3.client("textract", region_name=AWS_REGION, config=_tx_config)

_br_config = Config(
    connect_timeout=3, read_timeout=15, retries={"max_attempts": 2, "mode": "standard"}
)
bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION, config=_br_config)

ddb = boto3.resource("dynamodb")

# Agentic chunking model and limits
AGENTIC_LLM_MODEL = os.environ.get(
    "AGENTIC_LLM_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0"
)
EMBED_MODEL = os.environ.get("EMBED_MODEL", "amazon.titan-embed-text-v2:0")

def chunk_text_with_offsets(
    lines: List[Dict[str, Any]], chunk_size: int = 800, overlap: int = 100
):
    chunks = []
    current_chunk = ""
    current_pages = set()
    char_count = 0
    for line in lines:
        text = line.get("text", "")
        page = line.get("page", 1)
        if len(current_chunk) + len(text) + 1 > chunk_size:
            end_idx = char_count + len(current_chunk)
            chunks.append(
                {
                    "text": current_chunk.strip(),
                    "start": char_count,
                    "end": end_idx,
                    "pages": sorted(list(current_pages)),
                }
            )
            overlap_text = current_chunk[-overlap:] if overlap > 0 else ""
            current_chunk = (overlap_text + " " + text).strip()
            current_pages = {page}
            char_count = end_idx - len(overlap_text)
        else:
            current_chunk = (current_chunk + " " + text).strip()
            current_pages.add(page)
    if current_chunk:
        end_idx = char_count + len(current_chunk)
        chunks.append(
            {
                "text": current_chunk.strip(),
                "start": char_count,
                "end": end_idx,
                "pages": sorted(list(current_pages)),
            }
        )
    return chunks


def _safe_json_loads(s: str) -> Any:
    try:
        return json.loads(s)
    except Exception:
        try:
            start = s.find("{")
            end = s.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(s[start : end + 1])
        except Exception:
            pass
    return None


def _bedrock_chat(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float = 0.0,
    max_tokens: int = 1500,
) -> str:
    try:
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": [{"type": "text", "text": user_prompt}]}
            ],
        }
        resp = bedrock.invoke_model(
            modelId=AGENTIC_LLM_MODEL,
            body=json.dumps(body),
            accept="application/json",
            contentType="application/json",
        )
        data = json.loads(resp["body"].read())
        content = data.get("content") or []
        if content and isinstance(content, list) and isinstance(content[0], dict):
            return content[0].get("text") or ""
        return data.get("output_text") or data.get("completion") or ""
    except ClientError as ce:
        err_code = ce.response.get("Error", {}).get("Code")
        if err_code in {"AccessDeniedException", "AccessDenied"}:
            raise PermissionError(
                f"Bedrock chat model access denied for {AGENTIC_LLM_MODEL}. Grant bedrock:InvokeModel on this model."
            ) from ce
        raise


def extract_propositions_from_text(full_text: str) -> List[str]:
    system = (
        "You extract concise, standalone propositions (short sentences) that capture distinct facts "
        'or claims from the user\'s text. Respond ONLY as compact JSON: {"sentences": ["..."]}.'
    )
    user = (
        "From the following text, extract a list of concise propositions. Avoid duplicates and overly long items.\n\n"
        f"Text:\n{full_text}\n\nReturn JSON with key 'sentences'."
    )
    if len(full_text) > 20000:
        full_text = full_text[:20000]
    out = _bedrock_chat(system, user, temperature=0.0, max_tokens=1500)
    data = _safe_json_loads(out) or {}
    sentences = data.get("sentences")
    if isinstance(sentences, list) and all(isinstance(x, str) for x in sentences):
        seen = set()
        result = []
        for s in (x.strip() for x in sentences if x and isinstance(x, str)):
            if s and s not in seen:
                seen.add(s)
                result.append(s)
        if result:
            return result
    naive = []
    import re

    for line in full_text.splitlines():
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", line) if p.strip()]
        naive.extend(parts)
    return naive[:1000]


def cluster_propositions_agentically(propositions: List[str]) -> List[Dict[str, Any]]:
    if not propositions:
        return []
    system = (
        "You group related propositions into concise topical chunks. For each chunk, produce: "
        "chunk_id (5 chars, alnum), title (few words), summary (1-2 sentence), and propositions (list). "
        "Generalize titles when reasonable (e.g., apples -> Food). Respond ONLY as JSON: "
        '{"chunks": [{"chunk_id": "abc12", "title": "...", "summary": "...", "propositions": ["..."]}]}'
    )
    sample_props = propositions[:200]
    user = (
        "Cluster the following propositions into 3-12 coherent chunks. Maintain original phrasing.\n\n"
        f"Propositions:\n- " + "\n- ".join(sample_props)
    )
    out = _bedrock_chat(system, user, temperature=0.0, max_tokens=2000)
    data = _safe_json_loads(out) or {}
    chunks = data.get("chunks")
    result: List[Dict[str, Any]] = []
    if isinstance(chunks, list):
        for i, ch in enumerate(chunks):
            if not isinstance(ch, dict):
                continue
            cid = str(ch.get("chunk_id") or f"c{i+1:02d}")[:8]
            title = (ch.get("title") or f"Chunk {i+1}").strip()
            summary = (ch.get("summary") or title).strip()
            props = ch.get("propositions") or []
            props = [p.strip() for p in props if isinstance(p, str) and p.strip()]
            if not props:
                continue
            result.append(
                {
                    "chunk_id": cid,
                    "title": title,
                    "summary": summary,
                    "propositions": props,
                }
            )
    if not result:
        result.append(
            {
                "chunk_id": "c0001",
                "title": "General",
                "summary": "General related content",
                "propositions": propositions,
            }
        )
    return result


def agentic_chunk_text(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    full_text = "\n".join(l.get("text", "") for l in lines if l and l.get("text"))
    try:
        propositions = extract_propositions_from_text(full_text)
    except PermissionError:
        raise
    except Exception:
        logger.exception(
            "Proposition extraction failed; falling back to naive chunking"
        )
        propositions = []
    try:
        clusters = cluster_propositions_agentically(propositions)
    except PermissionError:
        raise
    except Exception:
        logger.exception(
            "Proposition clustering failed; falling back to naive chunking"
        )
        clusters = []
    chunks: List[Dict[str, Any]] = []
    for ch in clusters:
        text = ". ".join(ch.get("propositions") or [])
        if not text:
            continue
        chunks.append(
            {
                "text": text,
                "title": ch.get("title"),
                "summary": ch.get("summary"),
                "chunk_id": ch.get("chunk_id"),
            }
        )
    if not chunks:
        return chunk_text_with_offsets(
            [{"text": t, "page": 1} for t in full_text.splitlines() if t.strip()]
        )
    return chunks


logger = logging.getLogger()
logger.setLevel(logging.INFO)

CHUNKS_TABLE = os.environ.get("CHUNKS_TABLE", "delphi-document-chunks")
ENABLE_AGENTIC_CHUNKING = (
    os.environ.get("ENABLE_AGENTIC_CHUNKING", "true").strip().lower() == "true"
)
JOBS_TABLE = os.environ.get("JOBS_TABLE", "delphi-document-jobs")


def _put_chunk(table, chunk_id: str, key: str, title: str, summary: str, text: str):
    item = {
        "chunk_id": chunk_id,
        "file_key": key,
        "title": title,
        "summary": summary,
        "text": text,
        "updated_at": datetime.utcnow().isoformat(),
    }
    table.put_item(Item=item)


def _update_job_state(
    jt,
    job_id: str,
    *,
    state: Optional[str] = None,
    progress: Optional[int] = None,
    message: Optional[str] = None,
    attrs: Optional[Dict[str, Any]] = None,
):
    """Best-effort update to the job item with state/progress/message and extra attrs.
    - progress: 0-100 integer (optional)
    - message: short status text
    - attrs: additional attributes to set (e.g., chunk_count, file_key)
    """
    if not jt:
        return
    try:
        update_names = {"#ua": "updated_at"}
        update_values: Dict[str, Any] = {":u": datetime.utcnow().isoformat()}
        parts = ["#ua = :u"]

        if state is not None:
            update_names["#s"] = "state"
            update_values[":s"] = state
            parts.append("#s = :s")
        if progress is not None:
            update_names["#p"] = "progress"
            update_values[":p"] = int(progress)
            parts.append("#p = :p")
        if message is not None:
            update_names["#m"] = "message"
            # Truncate to avoid overly large strings
            update_values[":m"] = str(message)[:1000]
            parts.append("#m = :m")
        if attrs:
            for k, v in attrs.items():
                if k in ("state", "progress", "message", "updated_at"):
                    continue
                name_key = f"#a_{k}"
                value_key = f":a_{k}"
                update_names[name_key] = k
                update_values[value_key] = v
                parts.append(f"{name_key} = {value_key}")

        jt.update_item(
            Key={"job_id": job_id},
            UpdateExpression="SET " + ", ".join(parts),
            ExpressionAttributeNames=update_names,
            ExpressionAttributeValues=update_values,
        )
    except Exception:
        logger.exception("Failed to update job progress state for job_id=%s", job_id)


def _extract_textract_lines(
    bucket: str,
    key: str,
    progress_cb: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> List[Dict[str, Any]]:
    try:
        print("THIS IS THE KEY", key)
        print("THIS IS BUCKET", bucket)
        start_resp = textract.start_document_text_detection(
            DocumentLocation={"S3Object": {"Bucket": bucket, "Name": key}}
        )
        job_id = start_resp["JobId"]
        logger.info("Worker started Textract job: %s for %s", job_id, key)
        if progress_cb:
            progress_cb(
                {
                    "state": "textract_started",
                    "progress": 20,
                    "attrs": {"textract_job_id": job_id},
                }
            )
    except (EndpointConnectionError, ReadTimeoutError) as net_err:
        logger.exception("Worker Textract start network error")
        raise
    except Exception as e:
        logger.exception("Worker Textract start failed")
        raise

    # Poll for completion
    max_wait = int(os.environ.get("TEXTRACT_MAX_WAIT", "600"))  # allow longer in worker
    start_ts = time.time()
    status = None
    last_progress_update_ts = 0.0
    while True:
        status = textract.get_document_text_detection(JobId=job_id)
        job_status = status.get("JobStatus")
        if job_status in ["SUCCEEDED", "FAILED"]:
            logger.info(
                "Worker Textract job %s finished with status: %s", job_id, job_status
            )
            if job_status != "SUCCEEDED":
                raise RuntimeError(f"Textract job failed: {job_status}")
            break
        time.sleep(5)
        if time.time() - start_ts > max_wait:
            raise TimeoutError("Textract polling exceeded worker max wait")
        # Throttled progress updates every ~15s during polling
        now = time.time()
        if progress_cb and (now - last_progress_update_ts) > 15:
            # Heuristic progress during polling 20->55
            elapsed = now - start_ts
            est = min(55, 20 + int((elapsed / max_wait) * 35))
            progress_cb({"state": "textract_polling", "progress": est})
            last_progress_update_ts = now

    # Gather LINE blocks
    text_lines: List[Dict[str, Any]] = []
    next_token = None
    while True:
        resp = (
            textract.get_document_text_detection(JobId=job_id, NextToken=next_token)
            if next_token
            else status
        )
        for block in resp.get("Blocks", []):
            if block.get("BlockType") == "LINE" and "Text" in block:
                text_lines.append({"text": block["Text"], "page": block.get("Page", 1)})
        next_token = resp.get("NextToken")
        if not next_token:
            break
    logger.info("Worker textract.lines count=%s key=%s", len(text_lines), key)
    if progress_cb:
        progress_cb(
            {
                "state": "textract_succeeded",
                "progress": 60,
                "attrs": {"textract_line_count": len(text_lines)},
            }
        )
    return text_lines

def get_opensearch_client():
    session = boto3.Session()
    credentials = session.get_credentials()
    if not credentials:
        raise RuntimeError("Unable to locate AWS credentials for OpenSearch client")
    frozen = credentials.get_frozen_credentials()
    awsauth = AWS4Auth(
        frozen.access_key,
        frozen.secret_key,
        AWS_REGION,
        "aoss",
        session_token=frozen.token,
    )
    return OpenSearch(
        hosts=[{"host": OPENSEARCH_HOST, "port": 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )


def lambda_handler(event, context):
    # SQS event -> Records[...]
    records = event.get("Records", []) or []
    table = ddb.Table(CHUNKS_TABLE)
    jt = ddb.Table(JOBS_TABLE) if JOBS_TABLE else None

    for rec in records:
        try:
            body = rec.get("body")
            msg = json.loads(body) if isinstance(body, str) else (body or {})
            job_id = msg.get("job_id") or str(uuid.uuid4())
            bucket = msg["bucket"]
            key = msg["key"]
            file_name = msg.get("file_name") or key
            logger.info("Worker start job_id=%s key=%s", job_id, key)

            # Initial job state updates
            try:
                _update_job_state(
                    jt,
                    job_id,
                    state="received",
                    progress=5,
                    attrs={
                        "file_key": key,
                        **({"file_name": file_name} if file_name else {}),
                    },
                )
                _update_job_state(jt, job_id, state="processing", progress=10)
            except Exception:
                logger.exception("Failed to update initial job states")

            # Progress callback to bridge from inner steps
            def _progress_cb(data: Dict[str, Any]):
                _update_job_state(
                    jt,
                    job_id,
                    state=data.get("state"),
                    progress=data.get("progress"),
                    attrs=data.get("attrs"),
                )

            lines = _extract_textract_lines(bucket, key, progress_cb=_progress_cb)

            if ENABLE_AGENTIC_CHUNKING:
                try:
                    _update_job_state(jt, job_id, state="chunking_started", progress=65)
                    chunks = agentic_chunk_text(lines)
                    _update_job_state(
                        jt,
                        job_id,
                        state="chunking_completed",
                        progress=80,
                        attrs={"prelim_chunk_count": len(chunks)},
                    )
                except Exception:
                    logger.exception(
                        "Agentic chunking failed in worker; fallback to naive"
                    )
                    chunks = chunk_text_with_offsets(lines)
                    _update_job_state(
                        jt,
                        job_id,
                        state="chunking_fallback_naive",
                        progress=75,
                        attrs={"prelim_chunk_count": len(chunks)},
                    )
            else:
                _update_job_state(
                    jt, job_id, state="chunking_started_naive", progress=65
                )
                chunks = chunk_text_with_offsets(lines)
                _update_job_state(
                    jt,
                    job_id,
                    state="chunking_completed",
                    progress=80,
                    attrs={"prelim_chunk_count": len(chunks)},
                )

            _update_job_state(jt, job_id, state="storing_chunks", progress=85)
            total = max(1, len(chunks))
            bulk_timeout = int(os.environ.get("OPENSEARCH_BULK_TIMEOUT", "30"))
            bulk_max_bytes = int(
                os.environ.get("OPENSEARCH_BULK_MAX_BYTES", str(2 * 1024 * 1024))
            )
            pending_bulk_actions: List[Dict[str, Any]] = []
            bulk_success = 0
            bulk_failures = 0
            client = None

            def _flush_bulk_actions():
                nonlocal client, bulk_success, bulk_failures
                if not pending_bulk_actions:
                    return
                if client is None:
                    client = get_opensearch_client()
                try:
                    ok, errors = helpers.bulk(
                        client,
                        pending_bulk_actions,
                        chunk_size=len(pending_bulk_actions),
                        request_timeout=bulk_timeout,
                        max_chunk_bytes=bulk_max_bytes,
                        raise_on_error=False,
                        raise_on_exception=False,
                    )
                except Exception:
                    logger.exception("OpenSearch bulk indexing request failed")
                    raise
                bulk_success += ok
                bulk_failures += len(errors)
                pending_bulk_actions.clear()

            last_emitted_progress = 85
            for idx, c in enumerate(chunks):
                chunk_id = str(uuid.uuid4())
                title = c.get("title") or f"Chunk {idx+1}"
                summary = c.get("summary") or title
                text = c.get("text") or ""
                _put_chunk(table, chunk_id, key, title, summary, text)
                emb_text = "Chunk Title: {}\nChunk Summary: {}\nChunk Text: {}".format(
                    title, summary, text
                )
                body = json.dumps({"inputText": emb_text})
                emb = bedrock.invoke_model(modelId=EMBED_MODEL, body=body)
                emb_vec = json.loads(emb["body"].read())["embedding"]
                pending_bulk_actions.append(
                    {
                        "_op_type": "index",
                        "_index": OPENSEARCH_INDEX,
                        "_id": chunk_id,
                        "_source": {
                            "chunk_id": chunk_id,
                            "embedding": emb_vec,
                        },
                    }
                )
                # Emit incremental progress sparingly (every ~5% or every 10 chunks)
                pct = 85 + int(((idx + 1) / total) * 13)  # 85 -> 98
                if (
                    pct - last_emitted_progress >= 3
                    or (idx + 1) % 10 == 0
                    or (idx + 1) == total
                ):
                    _update_job_state(
                        jt,
                        job_id,
                        state="storing_chunks",
                        progress=pct,
                        attrs={"stored_chunks": idx + 1},
                    )
                    last_emitted_progress = pct
            _flush_bulk_actions()
            if bulk_failures:
                raise RuntimeError(
                    f"OpenSearch bulk indexing reported {bulk_failures} failures"
                )
            logger.info(
                "Worker job done job_id=%s chunks=%s indexed=%s",
                job_id,
                len(chunks),
                bulk_success,
            )
            # Mark job completed
            try:
                _update_job_state(
                    jt,
                    job_id,
                    state="completed",
                    progress=100,
                    attrs={"chunk_count": len(chunks)},
                )
            except Exception:
                logger.exception("Failed to update job state to completed")
        except Exception as e:
            logger.exception("Worker failed processing record")
            # Mark job failed
            try:
                if JOBS_TABLE and "job_id" in locals():
                    _update_job_state(jt, job_id, state="failed", message=str(e))
            except Exception:
                logger.exception("Failed to update job state to failed")
            # Let the exception bubble to trigger SQS retry/DLQ
            raise

    return {"success": True, "processed": len(records)}
