#!/bin/bash

# Webhook test script for GitHub Classroom Access Fixer

WEBHOOK_SECRET="development_webhook_secret_123"
SERVER_URL="http://localhost:3000/webhook/github"

# Generate signature
generate_signature() {
    local payload="$1"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* /sha256=/'
}

# Send individual assignment webhook
send_individual_webhook() {
    echo "📤 Sending individual assignment webhook..."
    
    PAYLOAD='{
      "action": "created",
      "repository": {
        "id": 123456,
        "name": "lab-assignment-1-johnsmith",
        "full_name": "test-classroom-org/lab-assignment-1-johnsmith",
        "private": true,
        "owner": {
          "login": "test-classroom-org",
          "id": 789
        },
        "html_url": "https://github.com/test-classroom-org/lab-assignment-1-johnsmith",
        "description": "Lab Assignment 1 for johnsmith",
        "created_at": "'$(date -Iseconds)'",
        "default_branch": "main"
      },
      "organization": {
        "login": "test-classroom-org",
        "id": 789
      },
      "sender": {
        "login": "github-classroom[bot]",
        "id": 12345
      }
    }'
    
    SIGNATURE=$(generate_signature "$PAYLOAD")
    
    curl -X POST "$SERVER_URL" \
        -H "Content-Type: application/json" \
        -H "X-Hub-Signature-256: $SIGNATURE" \
        -H "X-GitHub-Event: repository" \
        -H "X-GitHub-Delivery: test-$(date +%s)" \
        -d "$PAYLOAD" \
        -w "\n✅ Response: %{http_code}\n"
}

# Send team assignment webhook
send_team_webhook() {
    echo "📤 Sending team assignment webhook..."
    
    PAYLOAD='{
      "action": "created",
      "repository": {
        "id": 234567,
        "name": "project-team-alpha",
        "full_name": "test-classroom-org/project-team-alpha",
        "private": true,
        "owner": {
          "login": "test-classroom-org",
          "id": 789
        },
        "html_url": "https://github.com/test-classroom-org/project-team-alpha",
        "description": "Team project for Team Alpha",
        "created_at": "'$(date -Iseconds)'",
        "default_branch": "main"
      },
      "organization": {
        "login": "test-classroom-org",
        "id": 789
      },
      "sender": {
        "login": "github-classroom[bot]",
        "id": 12345
      }
    }'
    
    SIGNATURE=$(generate_signature "$PAYLOAD")
    
    curl -X POST "$SERVER_URL" \
        -H "Content-Type: application/json" \
        -H "X-Hub-Signature-256: $SIGNATURE" \
        -H "X-GitHub-Event: repository" \
        -H "X-GitHub-Delivery: test-$(date +%s)" \
        -d "$PAYLOAD" \
        -w "\n✅ Response: %{http_code}\n"
}

# Send custom webhook
send_custom_webhook() {
    local repo_name="$1"
    echo "📤 Sending custom webhook for: $repo_name"
    
    PAYLOAD='{
      "action": "created",
      "repository": {
        "id": 345678,
        "name": "'$repo_name'",
        "full_name": "test-classroom-org/'$repo_name'",
        "private": true,
        "owner": {
          "login": "test-classroom-org",
          "id": 789
        },
        "html_url": "https://github.com/test-classroom-org/'$repo_name'",
        "description": "Custom repo: '$repo_name'",
        "created_at": "'$(date -Iseconds)'",
        "default_branch": "main"
      },
      "organization": {
        "login": "test-classroom-org",
        "id": 789
      },
      "sender": {
        "login": "github-classroom[bot]",
        "id": 12345
      }
    }'
    
    SIGNATURE=$(generate_signature "$PAYLOAD")
    
    curl -X POST "$SERVER_URL" \
        -H "Content-Type: application/json" \
        -H "X-Hub-Signature-256: $SIGNATURE" \
        -H "X-GitHub-Event: repository" \
        -H "X-GitHub-Delivery: test-$(date +%s)" \
        -d "$PAYLOAD" \
        -w "\n✅ Response: %{http_code}\n"
}

# Send invalid signature webhook
send_invalid_webhook() {
    echo "📤 Sending webhook with invalid signature..."
    
    PAYLOAD='{
      "action": "created",
      "repository": {
        "id": 999999,
        "name": "test-invalid-sig",
        "full_name": "test-classroom-org/test-invalid-sig",
        "private": true,
        "owner": {
          "login": "test-classroom-org",
          "id": 789
        }
      }
    }'
    
    curl -X POST "$SERVER_URL" \
        -H "Content-Type: application/json" \
        -H "X-Hub-Signature-256: sha256=invalid_signature" \
        -H "X-GitHub-Event: repository" \
        -H "X-GitHub-Delivery: test-invalid-$(date +%s)" \
        -d "$PAYLOAD" \
        -w "\n❌ Expected rejection: %{http_code}\n"
}

# Main menu
echo "=== GitHub Classroom Webhook Tester ==="
echo ""
echo "1. Send individual assignment webhook (lab-assignment-1-johnsmith)"
echo "2. Send team assignment webhook (project-team-alpha)"
echo "3. Send custom repository webhook"
echo "4. Send invalid signature webhook"
echo "5. Send all test webhooks"
echo ""

if [ "$1" == "1" ]; then
    send_individual_webhook
elif [ "$1" == "2" ]; then
    send_team_webhook
elif [ "$1" == "3" ]; then
    if [ -z "$2" ]; then
        echo "Usage: $0 3 <repository-name>"
        exit 1
    fi
    send_custom_webhook "$2"
elif [ "$1" == "4" ]; then
    send_invalid_webhook
elif [ "$1" == "5" ]; then
    echo "Sending all test webhooks..."
    echo ""
    send_individual_webhook
    echo ""
    sleep 1
    send_team_webhook
    echo ""
    sleep 1
    send_custom_webhook "homework-2-alice123"
    echo ""
    sleep 1
    send_invalid_webhook
else
    echo "Usage: $0 <option> [args]"
    echo "  $0 1                     # Individual assignment"
    echo "  $0 2                     # Team assignment"
    echo "  $0 3 <repo-name>        # Custom repo name"
    echo "  $0 4                     # Invalid signature"
    echo "  $0 5                     # All tests"
fi