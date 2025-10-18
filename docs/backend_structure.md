# Australian Red Cross Document-Level RAG System

## System Overview
A RAG system that processes uploaded documents through chunking, stores chunks with embeddings for retrieval, and provides document chunk management with editing capabilities.

## Core Architecture Components

### 1. Document Ingestion & Processing Pipeline

#### Document Storage (S3)
```
delphi-document-vault/
├── documents/               # Original uploaded PDF files
│   ├── document1.pdf
│   ├── document2.pdf
│   └── ...
└── system-logs/            # Processing and error logs
```

#### Document Processing Flow
1. **Document Upload** → S3 delphi-document-vault bucket (PDF files only)
2. **SQS Message** → Automatic async processing trigger
3. **Text Extraction** → AWS Textract for PDF processing
4. **Chunking** → Intelligent or simple text chunking
5. **Summary Generation** → AI-powered chunk summarization (optional)
6. **Storage** → DynamoDB chunks table with metadata

### 2. Storage Architecture

#### DynamoDB Tables

**Jobs Table (delphi-document-jobs)**
```json
{
  "job_id": "391e0fcd-bbd6-4bae-91f7-2d95520bbc19",
  "file_key": "documents/testing_file.pdf",
  "file_name": "testing_file.pdf", 
  "state": "completed",  // queued, processing, completed, failed
  "chunk_count": 15,
  "requested_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:45Z",
  "error_message": null  // populated if state is failed
}
```

**Chunks Table (delphi-document-chunks)**
```json
{
  "chunk_id": "uuid-chunk-identifier",     // Partition Key
  "file_key": "documents/testing_file.pdf", // Sort Key
  "title": "Emergency Response Protocols",
  "summary": "Overview of emergency response procedures...",
  "text": "Full chunk text content extracted from document...",
  "pages": [1, 2],
  "created_at": "2024-01-15T10:32:00Z",
  "updated_at": "2024-01-15T10:32:00Z"
}
```
    "page_count": 45,
    "word_count": 8500,
    "language": "en",
    "document_structure": {
      "has_sections": true,
      "has_tables": true,
      "has_images": false
    }
  },
  "summary_metadata": {
    "summary_length": 850,
    "key_concepts": ["emergency protocols", "staff responsibilities", "communication procedures"],
    "summary_quality_score": 0.89
  },
  "embedding_metadata": {
    "model_used": "amazon.titan-embed-text-v1",
    "embedding_dimension": 1536,
    "embedding_timestamp": "2024-01-15T10:35:00Z"
  },
  "user_metadata": {
    "uploaded_by": "user_redcross_01",
    "access_level": "internal",
    "tags": ["emergency", "procedures", "2024"]
  }
}
```

**Chat Sessions Table**
```json
{
  "session_id": "sess_12345",
  "user_id": "user_redcross_01",
  "created_at": "2024-01-15T14:30:00Z",
  "last_activity": "2024-01-15T15:45:00Z",
  "conversation_history": [
    {
      "message_id": "msg_001",
      "timestamp": "2024-01-15T14:30:15Z",
      "user_query": "What are the evacuation procedures for different emergency types?",
      "system_response": "Based on the Emergency Response Protocol document...",
      "documents_used": [
        {
          "document_id": "doc_20240115_001",
          "relevance_score": 0.95,
          "document_title": "Emergency_Response_Protocol.pdf",
          "key_sections_referenced": ["Section 3: Evacuation Procedures", "Section 5: Emergency Types"]
        }
      ],
      "response_metadata": {
        "processing_time_ms": 1200,
        "model_used": "anthropic.claude-3-sonnet-20240229-v1:0",
        "context_length": 15000
      }
    }
  ]
}
```

#### OpenSearch Service (Document-Level Vector Database)
- **Index**: `redcross-document-summaries`
- **Vector Field**: 1536-dimensional embeddings of document summaries
- **Document Fields**: 
  - `document_id`: Unique identifier
  - `summary_text`: Full summary content
  - `embedding_vector`: Summary embedding
  - `metadata`: Extracted topics, key concepts, file type
  - `upload_date`: For temporal filtering
  - `access_level`: For permission-based filtering

### 3. Document Processing Pipeline

#### Enhanced Document Processor Lambda
```python
import boto3
import json
from typing import Dict, Any, List

def lambda_handler(event, context):
    """
    Process uploaded document: extract text, generate summary, create embeddings
    """
    s3_event = event['Records'][0]['s3']
    bucket = s3_event['bucket']['name']
    key = s3_event['object']['key']
    
    # Generate unique document ID
    document_id = generate_document_id(key)
    
    try:
        # Step 1: Extract metadata and text
        file_metadata = extract_file_metadata(bucket, key)
        extracted_text = extract_text_content(bucket, key, file_metadata['file_type'])
        
        # Step 2: Analyze document structure and content
        document_analysis = analyze_document_content(extracted_text)
        
        # Step 3: Generate intelligent summary
        document_summary = generate_document_summary(
            extracted_text, 
            file_metadata, 
            document_analysis
        )
        
        # Step 4: Generate embedding from summary
        summary_embedding = generate_summary_embedding(document_summary)
        
        # Step 5: Store everything
        store_document_data(
            document_id, 
            file_metadata, 
            extracted_text, 
            document_analysis,
            document_summary, 
            summary_embedding
        )
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "document_id": document_id,
                "status": "processed",
                "summary_length": len(document_summary)
                
            })
        }
        
    except Exception as e:
        # Log error and update status
        log_processing_error(document_id, str(e))
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

def generate_document_summary(text: str, metadata: Dict, analysis: Dict) -> str:
    """
    Generate comprehensive document summary using Claude
    """
    bedrock_client = boto3.client('bedrock-runtime')
    
    # Adaptive summarization based on document characteristics
    if analysis.get('word_count', 0) > 10000:
        summary_style = "comprehensive"
        target_length = "800-1000 words"
    elif analysis.get('word_count', 0) > 3000:
        summary_style = "detailed"
        target_length = "400-600 words"
    else:
        summary_style = "concise"
        target_length = "200-300 words"
    
    prompt = f"""
You are summarizing a document for Australian Red Cross staff. Create a {summary_style} summary that captures:

1. MAIN PURPOSE: What is this document's primary objective?
2. KEY INFORMATION: What are the most important facts, procedures, or guidelines?
3. ACTIONABLE ITEMS: What should staff know or do based on this document?
4. CONTEXT: When and how should this information be applied?

Document Details:
- Filename: {metadata.get('original_filename', 'Unknown')}
- Length: {analysis.get('word_count', 0)} words

Target Summary Length: {target_length}

Document Content:
{text[:8000]}{'...' if len(text) > 8000 else ''}

Provide a well-structured summary that would help Red Cross staff quickly understand the document's value and content.
"""

    response = bedrock_client.invoke_model(
        modelId='anthropic.claude-3-haiku-20240307-v1:0',  # Fast and cost-effective
        body=json.dumps({
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1200,
            "temperature": 0.1
        })
    )
    
    summary = json.loads(response['body'].read())['content'][0]['text']
    return summary

def analyze_document_content(text: str) -> Dict[str, Any]:
    """
    Analyze document structure and extract metadata using AWS Comprehend
    """
    comprehend = boto3.client('comprehend')
    
    # Detect key phrases and entities
    key_phrases = comprehend.detect_key_phrases(Text=text[:5000], LanguageCode='en')
    entities = comprehend.detect_entities(Text=text[:5000], LanguageCode='en')
    
    # Extract topics using custom logic
    topics = extract_topics_from_keyphrases(key_phrases['KeyPhrases'])
    
    # Analyze document structure
    structure_analysis = {
        "has_sections": bool(re.search(r'\b(section|chapter|\d+\.)\b', text, re.IGNORECASE)),
        "has_procedures": bool(re.search(r'\b(step|procedure|process|protocol)\b', text, re.IGNORECASE)),
        "has_emergency_content": bool(re.search(r'\b(emergency|urgent|crisis|evacuation)\b', text, re.IGNORECASE)),
        "word_count": len(text.split()),
        "estimated_reading_time": len(text.split()) // 200  # words per minute
    }
    
    return {
        "key_entities": [entity['Text'] for entity in entities['Entities'][:10]],
        "document_structure": structure_analysis,
        "language": "en"  # Could be detected dynamically
    }
```

### 4. Query Processing & Document Retrieval

#### Query Pipeline with Full Document Context
```python
def process_query(query: str, session_id: str, filters: Dict = None) -> Dict:
    """
    Process user query using document-level retrieval
    """
    # Step 1: Generate query embedding
    query_embedding = generate_query_embedding(query)
    
    # Step 2: Find relevant documents using summary embeddings
    relevant_documents = find_relevant_documents(
        query_embedding, 
        filters=filters,
        top_k=3,  # Fewer documents since we're using full content
        min_relevance=0.7
    )
    
    # Step 3: Retrieve full document content
    full_documents_content = []
    for doc in relevant_documents:
        full_content = retrieve_full_document(doc['document_id'])
        full_documents_content.append({
            'document_id': doc['document_id'],
            'relevance_score': doc['relevance_score'],
            'metadata': get_document_metadata(doc['document_id']),
            'full_content': full_content,
            'summary': doc['summary_text']
        })
    
    # Step 4: Generate comprehensive response using full documents
    response = generate_response_with_full_context(query, full_documents_content)
    
    # Step 5: Store conversation
    store_conversation(session_id, query, response, relevant_documents)
    
    return response

def find_relevant_documents(query_embedding: List[float], filters: Dict, top_k: int, min_relevance: float):
    """
    Search document summaries using vector similarity
    """
    opensearch_client = boto3.client('opensearchserverless')
    
    search_body = {
        "size": top_k,
        "min_score": min_relevance,
        "query": {
            "script_score": {
                "query": {
                    "bool": {
                        "must": [{"match_all": {}}],
                        "filter": build_filters(filters)
                    }
                },
                "script": {
                    "source": "cosineSimilarity(params.query_vector, 'embedding_vector') + 1.0",
                    "params": {"query_vector": query_embedding}
                }
            }
        },
        "_source": ["document_id", "summary_text", "metadata"]
    }
    
    response = opensearch_client.search(
        index="redcross-document-summaries", 
        body=search_body
    )
    
    return [
        {
            "document_id": hit["_source"]["document_id"],
            "summary_text": hit["_source"]["summary_text"],
            "metadata": hit["_source"]["metadata"],
            "relevance_score": hit["_score"]
        }
        for hit in response["hits"]["hits"]
    ]

def generate_response_with_full_context(query: str, documents: List[Dict]) -> Dict:
    """
    Generate comprehensive response using full document content
    """
    bedrock_client = boto3.client('bedrock-runtime')
    
    # Prepare context with full documents
    context_sections = []
    source_map = {}
    
    for i, doc in enumerate(documents):
        source_key = f"Document_{i+1}"
        source_map[source_key] = {
            "title": doc['metadata']['original_filename'],
            "document_id": doc['document_id'],
            "relevance": doc['relevance_score'],
            "upload_date": doc['metadata']['upload_timestamp']
        }
        
        # Include both summary and relevant portions of full content
        context_sections.append(f"""
{source_key}: {doc['metadata']['original_filename']}
Summary: {doc['summary']}

Full Content:
{doc['full_content'][:4000]}{'...' if len(doc['full_content']) > 4000 else ''}
---
""")
    
    # Construct comprehensive prompt
    system_prompt = f"""
You are an AI assistant for Australian Red Cross staff. Provide comprehensive, accurate responses based on the provided documents.

CITATION REQUIREMENTS:
1. Always cite sources as [Document_X: filename]
2. Reference specific sections when possible
3. If information spans multiple documents, cite all relevant sources
4. Only use information from the provided documents
5. If the query cannot be fully answered from the documents, clearly state what information is missing

USER QUERY: {query}

AVAILABLE DOCUMENTS:
{''.join(context_sections)}

Provide a thorough response with proper citations. Focus on being helpful while maintaining accuracy.
"""

    response = bedrock_client.invoke_model(
        modelId='anthropic.claude-3-sonnet-20240229-v1:0',
        body=json.dumps({
            "messages": [
                {
                    "role": "user", 
                    "content": system_prompt
                }
            ],
            "max_tokens": 2000,
            "temperature": 0.1
        })
    )
    
    llm_response = json.loads(response['body'].read())['content'][0]['text']
    
    return {
        "answer": llm_response,
        "sources": source_map,
        "documents_used": [doc['document_id'] for doc in documents],
        "query_context": {
            "documents_found": len(documents),
            "total_content_length": sum(len(doc['full_content']) for doc in documents)
        }
    }
```

### 5. API Gateway & Frontend Integration

#### REST API Endpoints
```yaml
/api/v1/upload:
  POST:
    description: "Upload any document type"
    body: multipart/form-data
    fields:
      - file: binary (required)
      - tags: string[] (optional)
      - access_level: string (optional, default: "internal")
    response:
      document_id: string
      processing_status: "processing" | "completed" | "failed"
      estimated_processing_time: number

/api/v1/chat:
  POST:
    description: "Query documents"
    body:
      query: string (required)
      session_id: string (optional)
      filters:
        date_range: object (optional)
        topics: string[] (optional)
        access_level: string (optional)
    response:
      answer: string
      sources: object[]
      documents_used: string[]
      session_id: string

/api/v1/documents:
  GET:
    description: "List uploaded documents"
    parameters:
      page: number
      limit: number
      search: string (optional)
      topic_filter: string (optional)
    response:
      documents: object[]
      total_count: number
      page_info: object

/api/v1/documents/{document_id}:
  GET:
    description: "Get document details and summary"
    response:
      document_id: string
      filename: string
      summary: string
      metadata: object
      upload_info: object
  
  DELETE:
    description: "Remove document from system"
    response:
      status: "deleted"
```

## NEW: Chunk-Based Processing API

### Chunk Management Endpoints

#### File Upload with Job Tracking (/delphi-vault-file)

**POST /delphi-vault-file** - Upload PDF file
```json
// Request
{
  "fileName": "testing_file.pdf",
  "fileData": "base64-encoded-pdf-content"
}

// Response
{
  "success": true,
  "key": "testing_file.pdf",
  "size": 401107,
  "message": "Upload accepted; processing will continue asynchronously.",
  "job_id": "391e0fcd-bbd6-4bae-91f7-2d95520bbc19"
}
```

**GET /delphi-vault-file?job_id={job_id}** - Get processing status
```json
// Response
{
  "success": true,
  "job_id": "391e0fcd-bbd6-4bae-91f7-2d95520bbc19",
  "key": "testing_file.pdf",
  "file_key": "documents/testing_file.pdf",
  "state": "completed",  // queued, processing, completed, failed
  "chunk_count": 15,
  "last_updated": "2024-01-15T10:32:45Z",
  "created_at": "2024-01-15T10:30:00Z",
  "error_message": null
}
```

#### Chunks Management (/delphi-vault-chunks)

**GET /delphi-vault-chunks?file_name={filename}** - Get all chunks for a file
```json
// Response
{
  "success": true,
  "chunks": [
    {
      "chunk_id": "uuid-chunk-identifier",
      "file_key": "documents/testing_file.pdf",
      "title": "Emergency Response Protocols",
      "summary": "Overview of emergency response procedures...",
      "text": "Full chunk text content...",
      "pages": [1, 2],
      "created_at": "2024-01-15T10:32:00Z",
      "updated_at": "2024-01-15T10:32:00Z"
    }
  ],
  "count": 15,
  "file_key": "documents/testing_file.pdf"
}
```

**PUT /delphi-vault-chunks** - Update chunk content
```json
// Request
{
  "chunk_id": "uuid-chunk-identifier",
  "file_key": "documents/testing_file.pdf",
  "text": "Updated chunk text content...",
  "summary": "Updated summary...",
  "title": "Updated title..."
}

// Response
{
  "success": true,
  "message": "Chunk updated successfully",
  "chunk": {
    "chunk_id": "uuid-chunk-identifier",
    "file_key": "documents/testing_file.pdf",
    "title": "Updated title...",
    "summary": "Updated summary...",
    "text": "Updated chunk text content...",
    "pages": [1, 2],
    "created_at": "2024-01-15T10:32:00Z",
    "updated_at": "2024-01-15T10:35:22Z"
  }
}
```

### New DynamoDB Tables

**Jobs Table (delphi-document-jobs)**
```json
{
  "job_id": "391e0fcd-bbd6-4bae-91f7-2d95520bbc19",  // Partition Key
  "file_key": "documents/testing_file.pdf",
  "file_name": "testing_file.pdf", 
  "state": "completed",  // queued, processing, completed, failed
  "chunk_count": 15,
  "requested_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:32:45Z",
  "error_message": null  // populated if state is failed
}
```

**Chunks Table (delphi-document-chunks)**
```json
{
  "chunk_id": "uuid-chunk-identifier",     // Partition Key
  "file_key": "documents/testing_file.pdf", // Sort Key
  "title": "Emergency Response Protocols",
  "summary": "Overview of emergency response procedures...",
  "text": "Full chunk text content extracted from document...",
  "pages": [1, 2],
  "created_at": "2024-01-15T10:32:00Z",
  "updated_at": "2024-01-15T10:32:00Z"
}
```

### Processing Workflow

1. **File Upload**: User uploads PDF via React frontend
2. **S3 Storage**: File stored in S3 bucket with unique key
3. **Job Creation**: Job record created in DynamoDB with "queued" status
4. **SQS Message**: Processing message sent to SQS queue
5. **Async Processing**: Lambda worker processes file:
   - Extracts text using Textract
   - Creates chunks using intelligent or simple chunking
   - Stores chunks in DynamoDB
   - Updates job status to "completed"
6. **Status Polling**: Frontend polls job status every 3 seconds
7. **Chunk Viewing**: Once complete, user can view and edit chunks
8. **Chunk Editing**: Real-time updates to chunk content via PUT API

### Frontend Integration

The React frontend provides:
- File upload with progress tracking
- Real-time job status polling  
- Chunk viewer with inline editing
- Progress indicators and notifications
- Error handling and retry mechanisms


## Implementation Benefits

1. **Comprehensive Responses**: Using full documents provides complete context for complex queries
2. **Flexible Document Types**: No need to categorize uploads - system adapts automatically  
3. **Intelligent Summarization**: High-quality summaries enable accurate retrieval
4. **Scalable Architecture**: AWS-native services scale automatically with usage
5. **Chunk Management**: Users can review and edit document chunks for better accuracy
6. **Async Processing**: Large documents don't block the UI during processing
