/**
* Chat Lambda function for Delphi AI Bot
* Handles POST requests to /chat endpoint with CORS support
*/
 
export const handler = async (event) => {
    console.log('Chat Lambda invoked:', JSON.stringify(event, null, 2));
    console.log('HTTP Method:', event.httpMethod);
    console.log('Request Context:', event.requestContext);
    
    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify({ success: true })
        };
    }
    
    // Handle any request method for debugging
    const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'UNKNOWN';
    console.log('Determined HTTP Method:', httpMethod);
    
    // For now, process any request as a chat request to debug the issue
    // TODO: Add proper method checking once we confirm the event structure
    
    try {
        // Parse request body
        const body = JSON.parse(event.body || '{}');
        const messages = body.messages || [];
        
        console.log('Received messages:', messages);
        
        // Get the last user message
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const userContent = lastUserMessage ? lastUserMessage.content : 'No message provided';
        
        // Simple response generation (replace with your AI logic)
        const response = {
            content: `I received your message: "${userContent}". This is a sample response from the chat Lambda function.`,
            summary: `Summary: You asked about "${userContent.slice(0, 50)}..."`,
            citations: [
                { title: 'Sample Document 1', url: 'https://example.com/doc1' },
                { title: 'Sample Document 2', url: 'https://example.com/doc2' }
            ]
        };
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify(response)
        };
        
    } catch (error) {
        console.error('Error processing chat request:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};