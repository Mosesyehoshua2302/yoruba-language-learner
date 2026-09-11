"""State-sync Lambda handler (Python port of state-handler.ts).

Serves `GET /state` and `PUT /state` behind an API Gateway HTTP API with a
Cognito JWT authorizer. One DynamoDB item per user holds the whole
LearnerState blob, keyed by the token's `sub` claim.

Behaviour is a faithful port of the original TypeScript handler:
  GET  -> 200 { state, updatedAt } | 404 { error }
  PUT  -> 200 { updatedAt } | 400 | 413
  missing/invalid token -> 401
  any other method       -> 405
"""

import json
import os
from datetime import datetime, timezone

import boto3

# Reuse the client across warm invocations.
_TABLE_NAME = os.environ["TABLE_NAME"]
_table = boto3.resource("dynamodb").Table(_TABLE_NAME)

# LearnerState blobs are a few hundred KB at absolute most; cap well below
# the DynamoDB 400 KB item limit to fail fast on garbage payloads.
MAX_STATE_BYTES = 380_000


def _json(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def _user_id(event):
    """Pull the validated `sub` claim the JWT authorizer attached to the event."""
    try:
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
    except (KeyError, TypeError):
        return None
    sub = claims.get("sub") if isinstance(claims, dict) else None
    return sub if isinstance(sub, str) and sub else None


def handler(event, _context=None):
    user_id = _user_id(event)
    if not user_id:
        return _json(401, {"error": "unauthorized"})

    method = event.get("requestContext", {}).get("http", {}).get("method")

    if method == "GET":
        res = _table.get_item(Key={"userId": user_id})
        item = res.get("Item")
        if not item:
            return _json(404, {"error": "no state saved yet"})
        return _json(200, {"state": item.get("state"), "updatedAt": item.get("updatedAt")})

    if method == "PUT":
        body = event.get("body")
        if not body:
            return _json(400, {"error": "missing body"})
        # API Gateway may base64-encode the body; the SPA sends plain JSON, but
        # measure the raw bytes the client sent to match the original cap.
        if len(body.encode("utf-8")) > MAX_STATE_BYTES:
            return _json(413, {"error": "state too large"})
        try:
            parsed = json.loads(body)
        except (ValueError, TypeError):
            return _json(400, {"error": "invalid JSON"})

        state = parsed.get("state") if isinstance(parsed, dict) else None
        if not isinstance(state, dict) or not isinstance(state.get("version"), (int, float)) \
                or isinstance(state.get("version"), bool):
            return _json(400, {"error": "body must be { state: LearnerState }"})

        updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        _table.put_item(Item={"userId": user_id, "state": state, "updatedAt": updated_at})
        return _json(200, {"updatedAt": updated_at})

    return _json(405, {"error": "method not allowed"})
