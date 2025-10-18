"""Lambda handler for Delphi Vault chunks operations.
 
API Gateway invokes this single Lambda for GET, PUT on the
/delphi-vault-chunks resource.
 
Methods:
GET    -> List chunks for a specific file
          Query params: file_name or file_key
PUT    -> Update chunk text or summary
          Body JSON: {"chunk_id": str, "file_key": str, "text": str, "summary": str}
 
Environment:
CHUNKS_TABLE : Name of the DynamoDB table storing chunks (default: delphi-document-chunks)
 
Responses are JSON with appropriate CORS headers.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from opensearchpy import helpers

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
ddb = boto3.resource("dynamodb")

# Region and model/index configuration (align with worker defaults)
AWS_REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
OPENSEARCH_HOST = os.environ.get(
    "OPENSEARCH_HOST", "6qqi01llu92mgfhf5suk.ap-southeast-2.aoss.amazonaws.com"
)
OPENSEARCH_INDEX = os.environ.get("OPENSEARCH_INDEX", "document-vault-index")
OPENSEARCH_EMBED_DIM = int(os.environ.get("OPENSEARCH_EMBED_DIM", "1024"))
EMBED_MODEL = os.environ.get("EMBED_MODEL", "amazon.titan-embed-text-v2:0")

# Configure Bedrock client with short timeouts
_br_config = Config(
    connect_timeout=3, read_timeout=15, retries={"max_attempts": 2, "mode": "standard"}
)
bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION, config=_br_config)


def _get_opensearch_client():
    """Create a signed OpenSearch client using AWS4Auth.

    Imports are inside the function to avoid module import errors when this path isn't used.
    """
    from opensearchpy import OpenSearch, RequestsHttpConnection
    from requests_aws4auth import AWS4Auth

    session = boto3.Session()
    credentials = session.get_credentials()
    if not credentials:
        raise RuntimeError("Unable to locate AWS credentials for OpenSearch client")
    frozen = credentials.get_frozen_credentials()
    awsauth = AWS4Auth(
        frozen.access_key, frozen.secret_key, AWS_REGION, "aoss", session_token=frozen.token
    )
    return OpenSearch(
        hosts=[{"host": OPENSEARCH_HOST, "port": 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
    )


def _ensure_opensearch_index(client) -> None:
    """Ensure the OpenSearch index exists with knn_vector mapping for 'embedding'."""
    try:
        exists = client.indices.exists(index=OPENSEARCH_INDEX)
    except Exception:
        logger.exception("Failed to check OpenSearch index existence")
        raise
    if not exists:
        body = {
            "settings": {"index": {"knn": True, "knn.algo_param.ef_search": 512}},
            "mappings": {
                "properties": {
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": OPENSEARCH_EMBED_DIM,
                        "method": {
                            "name": "hnsw",
                            "engine": "nmslib",
                            "parameters": {},
                            "space_type": "cosinesimil",
                        },
                    },
                    # chunk_id is a keyword (exact match) to support precise lookups/deletes
                    "chunk_id": {"type": "keyword", "index": True},
                }
            },
        }
        try:
            client.indices.create(index=OPENSEARCH_INDEX, body=body)
            logger.info("Created OpenSearch index '%s'", OPENSEARCH_INDEX)
        except Exception:
            logger.exception("Failed to create OpenSearch index '%s'", OPENSEARCH_INDEX)
            raise
    else:
        # Validate mapping of embedding dimension
        try:
            mapping = client.indices.get_mapping(index=OPENSEARCH_INDEX)
            props = mapping.get(OPENSEARCH_INDEX, {}).get("mappings", {}).get("properties", {})
            emb = props.get("embedding", {})
            if emb.get("type") != "knn_vector" or emb.get("dimension") != OPENSEARCH_EMBED_DIM:
                raise RuntimeError(
                    "OpenSearch index embedding mapping incompatible; expected knn_vector/%s"
                    % OPENSEARCH_EMBED_DIM
                )
        except Exception:
            logger.exception("Failed to validate OpenSearch index mapping")
            raise


def _build_embedding_text(title: str, summary: str, text: str) -> str:
    return f"Chunk Title: {title}\nChunk Summary: {summary}\nChunk Text: {text}"


def _reembed_and_update_opensearch(chunk_id: str, title: str, summary: str, text: str) -> bool:
    """Recompute embedding via Bedrock and upsert into OpenSearch for this chunk_id.

    Returns True if at least one document was updated or created; False on failure.
    """
    try:
        emb_text = _build_embedding_text(title or "", summary or "", text or "")
        body = json.dumps({"inputText": emb_text})
        emb_resp = bedrock.invoke_model(modelId=EMBED_MODEL, body=body)
        emb_vec = json.loads(emb_resp["body"].read()).get("embedding")
        if not isinstance(emb_vec, list):
            raise RuntimeError("Invalid embedding response format")
    except Exception:
        logger.exception("Failed to compute embedding with Bedrock")
        return False

    try:
        client = _get_opensearch_client()
        _ensure_opensearch_index(client)

        # Replace any existing doc for this chunk_id by deleting matches then indexing a fresh document
        try:
            res = client.search(
                index=OPENSEARCH_INDEX,
                body={"query": {"terms": {"chunk_id": [chunk_id]}}},
            )
            hits = (res or {}).get("hits", {}).get("hits", [])
            for h in hits:
                try:
                    doc_id = h.get("_id")
                    if doc_id:
                        client.delete(index=OPENSEARCH_INDEX, id=doc_id, refresh=False)
                except Exception:
                    logger.exception("Failed to delete existing OpenSearch doc id=%s for chunk_id=%s", doc_id, chunk_id)
        except Exception:
            logger.exception("Search+delete existing docs failed for chunk_id=%s", chunk_id)

        try:
            # Use bulk indexing (even for a single doc) to mirror worker behavior
            actions = [
                {
                    "_op_type": "index",
                    "_index": OPENSEARCH_INDEX,
                    "_source": {"chunk_id": chunk_id, "embedding": emb_vec},
                }
            ]
            ok, errors = helpers.bulk(
                client,
                actions,
                chunk_size=1,
                raise_on_error=True,
                raise_on_exception=True,
            )
            if errors:
                logger.error("OpenSearch bulk upsert reported errors: %s", errors[:3])
        except Exception:
            logger.exception("Failed to bulk index OpenSearch doc for chunk_id=%s", chunk_id)
            return False

        return True
    except Exception:
        logger.exception("OpenSearch update path failed")
        return False

CHUNKS_TABLE = os.environ.get("CHUNKS_TABLE", "delphi-document-chunks")


def _response(status: int, body: Dict[str, Any]):
    """Helper to build API Gateway proxy response with CORS."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def _error(status: int, message: str, **extra):
    try:
        print(
            f"api_error status={status} message={message} extra={json.dumps(extra, default=str)}"
        )
    except Exception:
        print(f"api_error status={status} message={message}")
    return _response(status, {"success": False, "message": message, **extra})


def get_chunks(event: Dict[str, Any]):
    """Get all chunks for a specific file.
    
    Expected query params:
    - file_name: The original file name (e.g., "document.pdf")
    - file_key: The S3 key (alternative to file_name)
    """
    if not CHUNKS_TABLE:
        return _error(500, "CHUNKS_TABLE not configured")

    qs = (event or {}).get("queryStringParameters") or {}
    file_name = qs.get("file_name") if qs else None
    file_key = qs.get("file_key") if qs else None
    
    # Use file_key if provided, otherwise use file_name
    search_key = file_key or file_name
    
    if not search_key:
        return _error(400, "file_name or file_key parameter required")

    try:
        table = ddb.Table(CHUNKS_TABLE)
        
        # Query using GSI on file_key if it exists, otherwise scan and filter
        # For better performance, we should have a GSI on file_key
        try:
            # Try to query using file_key as sort key
            response = table.query(
                IndexName="file_key-index",  # Assuming GSI exists
                KeyConditionExpression=boto3.dynamodb.conditions.Key('file_key').eq(search_key)
            )
            chunks = response.get('Items', [])
        except ClientError as e:
            # If GSI doesn't exist, fall back to scan
            if "ResourceNotFoundException" in str(e) or "ValidationException" in str(e):
                logger.info("GSI not found, using scan operation")
                response = table.scan(
                    FilterExpression=boto3.dynamodb.conditions.Attr('file_key').eq(search_key)
                )
                chunks = response.get('Items', [])
            else:
                raise

        # Sort chunks by chunk_id for consistent ordering
        chunks.sort(key=lambda x: x.get('chunk_id', ''))
        
        # Format chunks for frontend
        formatted_chunks = []
        for chunk in chunks:
            formatted_chunks.append({
                'chunk_id': chunk.get('chunk_id'),
                'file_key': chunk.get('file_key'),
                'title': chunk.get('title', ''),
                'summary': chunk.get('summary', ''),
                'text': chunk.get('text', ''),
                'pages': chunk.get('pages', []),
                'created_at': chunk.get('created_at'),
                'updated_at': chunk.get('updated_at')
            })

        return _response(200, {
            "success": True,
            "chunks": formatted_chunks,
            "count": len(formatted_chunks),
            "file_key": search_key
        })

    except Exception as e:
        logger.exception("Failed to get chunks")
        return _error(500, "Failed to retrieve chunks", error=str(e))


def update_chunk(event_body: Dict[str, Any]):
    """Update a chunk's text or summary.
    
    Expected body:
    {
        "chunk_id": "uuid",
        "file_key": "filename.pdf",
        "text": "updated text content",
        "summary": "updated summary"
    }
    """
    if not CHUNKS_TABLE:
        return _error(500, "CHUNKS_TABLE not configured")

    chunk_id = event_body.get("chunk_id")
    file_key = event_body.get("file_key")
    text = event_body.get("text")
    summary = event_body.get("summary")
    title = event_body.get("title")

    if not chunk_id or not file_key:
        return _error(400, "chunk_id and file_key are required")

    if not text and not summary and not title:
        return _error(400, "At least one of text, summary, or title must be provided")

    try:
        table = ddb.Table(CHUNKS_TABLE)
        
        # Build update expression dynamically
        update_expression = "SET updated_at = :updated_at"
        expression_values = {
            ":updated_at": datetime.utcnow().isoformat()
        }
        
        if text is not None:
            update_expression += ", #text = :text"
            expression_values[":text"] = text
            
        if summary is not None:
            update_expression += ", summary = :summary"
            expression_values[":summary"] = summary
            
        if title is not None:
            update_expression += ", title = :title"
            expression_values[":title"] = title

        # Use ExpressionAttributeNames for reserved words
        expression_names = {}
        if text is not None:
            expression_names["#text"] = "text"

        # Update the item
        update_params = {
            "Key": {
                "chunk_id": chunk_id,
                "file_key": file_key
            },
            "UpdateExpression": update_expression,
            "ExpressionAttributeValues": expression_values,
            "ReturnValues": "ALL_NEW"
        }
        
        if expression_names:
            update_params["ExpressionAttributeNames"] = expression_names

        response = table.update_item(**update_params)

        updated_item = response.get('Attributes', {})

        # Attempt to recompute and update embedding in OpenSearch (non-fatal on failure)
        try:
            emb_ok = _reembed_and_update_opensearch(
                chunk_id=updated_item.get('chunk_id'),
                title=updated_item.get('title', ''),
                summary=updated_item.get('summary', ''),
                text=updated_item.get('text', ''),
            )
        except Exception:
            logger.exception("Unexpected failure updating OpenSearch embedding")
            emb_ok = False

        return _response(200, {
            "success": True,
            "message": "Chunk updated successfully",
            "embedding_updated": bool(emb_ok),
            "chunk": {
                'chunk_id': updated_item.get('chunk_id'),
                'file_key': updated_item.get('file_key'),
                'title': updated_item.get('title', ''),
                'summary': updated_item.get('summary', ''),
                'text': updated_item.get('text', ''),
                'pages': updated_item.get('pages', []),
                'created_at': updated_item.get('created_at'),
                'updated_at': updated_item.get('updated_at')
            }
        })

    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return _error(404, "Chunk not found")
        logger.exception("Failed to update chunk")
        return _error(500, "Failed to update chunk", error=str(e))
    except Exception as e:
        logger.exception("Failed to update chunk")
        return _error(500, "Failed to update chunk", error=str(e))


def lambda_handler(event, context):  # pragma: no cover - entry point
    method = event.get("httpMethod", "").upper()
    logger.info("Event method=%s", method)
    print(f"lambda.invoke method={method}")

    # OPTIONS preflight
    if method == "OPTIONS":
        return _response(200, {"success": True})

    if method == "GET":
        return get_chunks(event)
    
    if method == "PUT":
        try:
            body_json = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError as exc:
            return _error(400, "Invalid JSON body", error=str(exc))
        return update_chunk(body_json)

    return _error(405, "Method not allowed")