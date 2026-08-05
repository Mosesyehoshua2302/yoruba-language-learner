import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

// LearnerState blobs are a few hundred KB at absolute most; cap well below
// the DynamoDB 400 KB item limit to fail fast on garbage payloads.
const MAX_STATE_BYTES = 380_000;

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  // JWT authorizer guarantees a validated token; `sub` is the stable user id.
  const userId = event.requestContext.authorizer?.jwt?.claims?.sub;
  if (typeof userId !== 'string' || !userId) {
    return json(401, { error: 'unauthorized' });
  }

  const method = event.requestContext.http.method;

  if (method === 'GET') {
    const res = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { userId } }),
    );
    if (!res.Item) return json(404, { error: 'no state saved yet' });
    return json(200, { state: res.Item.state, updatedAt: res.Item.updatedAt });
  }

  if (method === 'PUT') {
    if (!event.body) return json(400, { error: 'missing body' });
    if (Buffer.byteLength(event.body, 'utf8') > MAX_STATE_BYTES) {
      return json(413, { error: 'state too large' });
    }
    let parsed: { state?: unknown };
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return json(400, { error: 'invalid JSON' });
    }
    const state = parsed.state;
    if (
      typeof state !== 'object' ||
      state === null ||
      typeof (state as { version?: unknown }).version !== 'number'
    ) {
      return json(400, { error: 'body must be { state: LearnerState }' });
    }
    const updatedAt = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { userId, state, updatedAt },
      }),
    );
    return json(200, { updatedAt });
  }

  return json(405, { error: 'method not allowed' });
}
