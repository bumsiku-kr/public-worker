# bumsiku.kr Workers Implementation Plan
## CloudFlare Workers: admin-worker & public-worker

**Version**: 2.0
**Date**: 2025-10-22
**Status**: Phase 4 Complete - Public & Admin Workers Implemented

---

## 1. Executive Summary

This document outlines the implementation plan for two CloudFlare Workers that power the bumsiku.kr API infrastructure:

- **admin-worker**: Protected API endpoints requiring JWT authentication for administrative operations ✅ **IMPLEMENTED**
- **public-worker**: Open API endpoints for public access without authentication ✅ **IMPLEMENTED**

Both workers are implemented in JavaScript and ready for deployment on CloudFlare's global edge network for optimal performance and scalability.

### Current Implementation Status

**✅ Completed Phases:**
- Phase 1: Project Setup
- Phase 2: Core Infrastructure
- Phase 3: Admin Worker Development (7 endpoints)
- Phase 4: Public Worker Development (7 endpoints)

**⏳ Remaining Phases:**
- Phase 5: Data Layer Integration (D1, R2, KV setup)
- Phase 6: Testing (unit, integration, E2E)
- Phase 7: Deployment (staging, production)
- Phase 8: Documentation & Handoff

### Implementation Overview

**Admin Worker (7 Endpoints)**
- ✅ POST `/login` - JWT token generation
- ✅ GET `/session` - Token validation
- ✅ POST `/admin/posts` - Create blog posts
- ✅ PUT `/admin/posts/:postId` - Update posts
- ✅ DELETE `/admin/posts/:postId` - Delete posts
- ✅ POST `/admin/images` - R2 image upload
- ✅ DELETE `/admin/comments/:commentId` - Delete comments

**Public Worker (7 Endpoints)**
- ✅ GET `/posts` - Paginated post list with filtering
- ✅ GET `/posts/:slug` - Single post retrieval
- ✅ PATCH `/posts/:postId/views` - View count increment
- ✅ GET `/comments/:postId` - Fetch post comments
- ✅ POST `/comments/:postId` - Create new comment
- ✅ GET `/tags` - List all active tags
- ✅ GET `/sitemap` - SEO sitemap generation

**Core Features**
- ✅ JWT authentication system (HMAC-SHA256)
- ✅ Input validation and error handling
- ✅ KV-based caching with smart invalidation
- ✅ Tag management with automatic post counts
- ✅ Slug-based URLs with ID→slug redirects
- ✅ Multipart file upload to R2 storage
- ✅ Database schema with triggers for data integrity

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFlare Edge Network                  │
│                                                              │
│  ┌────────────────────┐         ┌────────────────────┐     │
│  │   admin-worker     │         │   public-worker    │     │
│  │                    │         │                    │     │
│  │ • JWT Auth         │         │ • No Auth          │     │
│  │ • Admin APIs       │         │ • Public APIs      │     │
│  │ • Protected Routes │         │ • Open Routes      │     │
│  └────────────────────┘         └────────────────────┘     │
│           │                              │                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            └──────────┬───────────────────┘
                       │
              ┌────────▼────────┐
              │   Data Layer    │
              │  (KV/D1/R2/DB)  │
              └─────────────────┘
```

### 2.2 Worker Separation Rationale

**Why Two Workers?**
1. **Security Isolation**: Authentication logic isolated to admin-worker only
2. **Performance**: Public worker has no auth overhead
3. **Deployment Independence**: Can deploy/update workers separately
4. **Access Control**: Clear separation of public vs. admin functionality
5. **Rate Limiting**: Different limits for admin vs. public endpoints

---

## 3. Technology Stack

### 3.1 Core Technologies
- **Runtime**: CloudFlare Workers (JavaScript/V8)
- **Language**: JavaScript (ES Modules)
- **Deployment**: Wrangler CLI
- **Configuration**: wrangler.toml

### 3.2 CloudFlare Services & Platform Adaptations

**⚠️ 원래 명세(Express.js)에서 CloudFlare Workers로의 변경사항:**

| 원래 기술 스택 | CloudFlare Workers 대체 |
|---------------|------------------------|
| Express.js + Session | CloudFlare Workers + JWT |
| Oracle Cloud ADB | CloudFlare D1 (SQLite) |
| Redis (Session Store) | JWT (Stateless) |
| AWS S3 | CloudFlare R2 |
| express-session | JWT Token Authentication |

**사용할 CloudFlare Services:**
- **D1**: SQLite database (포스트, 댓글, 태그 저장)
- **R2**: Object storage (이미지 파일 저장)
- **KV** (선택): Caching layer (성능 최적화)
- **Secrets**: JWT_SECRET, ADMIN credentials

### 3.3 Development Dependencies
```json
{
  "devDependencies": {
    "wrangler": "^3.0.0",
    "vitest": "^1.0.0"
  }
}
```

### 3.4 주요 적응 사항

#### Session → JWT 변경
```javascript
// 원래: Express Session
// app.use(session({ secret: 'xxx', cookie: { httpOnly: true } }))

// CloudFlare Workers: JWT
const payload = { userId: 1, exp: Math.floor(Date.now() / 1000) + 7200 };
const token = await generateJWT(payload, env.JWT_SECRET);
return jsonResponse({ token }, 200);
```

#### Database 쿼리 변경
```javascript
// 원래: Oracle ADB
// const result = await connection.execute('SELECT * FROM posts');

// CloudFlare Workers: D1
const result = await env.DB.prepare('SELECT * FROM posts').all();
```

#### 파일 업로드 변경
```javascript
// 원래: AWS S3
// await s3.putObject({ Bucket: 'xxx', Key: 'xxx', Body: file });

// CloudFlare Workers: R2
await env.STORAGE.put(key, file.stream(), {
  httpMetadata: { contentType: file.type }
});
```

---

## 4. Authentication Design (Admin Worker)

### 4.1 Authentication Method: JWT (JSON Web Tokens)

**Why JWT?**
- Stateless authentication (no session storage needed)
- Works seamlessly with CloudFlare Workers
- Can encode user roles/permissions
- Industry standard for API authentication

### 4.2 Authentication Flow

```
Client Request → Extract Bearer Token → Validate JWT → Route Handler
                        ↓
                   Invalid/Missing
                        ↓
                  401 Unauthorized
```

### 4.3 JWT Implementation

```javascript
// auth/middleware.js
export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');

  // Check for Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Extract token
  const token = authHeader.substring(7);

  // Validate JWT
  try {
    const payload = await validateJWT(token, env.JWT_SECRET);
    return { authorized: true, user: payload };
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// auth/validators.js
export async function validateJWT(token, secret) {
  // Use CloudFlare Workers crypto API
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // JWT validation logic
  const [headerB64, payloadB64, signatureB64] = token.split('.');

  // Verify signature
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'HMAC',
    secretKey,
    signature,
    data
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  // Decode and return payload
  const payload = JSON.parse(atob(payloadB64));

  // Check expiration
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }

  return payload;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) {
    str += '='.repeat(4 - pad);
  }
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
```

### 4.4 Alternative: HTTP Basic Auth

If simpler authentication is needed:

```javascript
export function basicAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Area"'
      }
    });
  }

  const credentials = atob(authHeader.substring(6));
  const [username, password] = credentials.split(':');

  // Constant-time comparison
  if (username === env.ADMIN_USER && password === env.ADMIN_PASSWORD) {
    return { authorized: true };
  }

  return new Response('Unauthorized', { status: 401 });
}
```

---

## 5. API Structure & Endpoint Specifications

### 5.1 Public Worker Endpoints (인증 불필요)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/posts` | 포스트 목록 조회 (페이징, 정렬, 태그 필터) |
| GET | `/posts/{slug}` | 단일 포스트 조회 (slug 또는 ID) |
| PATCH | `/posts/{postId}/views` | 조회수 증가 |
| GET | `/comments/{postId}` | 특정 포스트의 댓글 목록 조회 |
| POST | `/comments/{postId}` | 댓글 작성 |
| GET | `/tags` | 태그 목록 조회 (포스트 수 포함) |
| GET | `/sitemap` | SEO 사이트맵 생성용 경로 목록 |

### 5.2 Admin Worker Endpoints

#### Authentication Endpoints (인증 불필요)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | 관리자 로그인 (JWT 토큰 발급) |
| GET | `/session` | 세션/토큰 유효성 확인 |

#### Admin Operations (JWT 인증 필수)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/posts` | 포스트 생성 |
| PUT | `/admin/posts/{postId}` | 포스트 수정 |
| DELETE | `/admin/posts/{postId}` | 포스트 삭제 |
| POST | `/admin/images` | 이미지 업로드 (R2) |
| DELETE | `/admin/comments/{commentId}` | 댓글 삭제 |

---

### 5.3 Detailed API Specifications

#### 📌 GET /posts
**목적**: 페이지네이션된 포스트 목록 조회

**Query Parameters**:
- `tag` (optional): 태그로 필터링
- `page` (default: 0): 페이지 번호 (0-indexed)
- `size` (default: 10): 페이지당 항목 수
- `sort` (default: "createdAt,desc"): 정렬 형식 "field,direction"

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "slug": "my-first-post",
        "title": "My First Post",
        "summary": "This is a summary",
        "tags": ["javascript", "tutorial"],
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "views": 150
      }
    ],
    "totalElements": 42,
    "pageNumber": 0,
    "pageSize": 10
  },
  "error": null
}
```

**Example Requests**:
```
GET /posts
GET /posts?tag=javascript
GET /posts?page=2&size=20
GET /posts?sort=views,desc
```

---

#### 📌 GET /posts/{slug}
**목적**: slug 또는 ID로 단일 포스트 조회

**Path Parameters**:
- `slug`: 포스트 slug (예: "my-first-post") 또는 숫자 ID

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "my-first-post",
    "title": "My First Post",
    "content": "Full markdown content of the post...",
    "summary": "This is a summary",
    "tags": ["javascript", "tutorial"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "views": 150
  },
  "error": null
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 404,
    "message": "Post not found"
  }
}
```

**Note**: 숫자 ID 제공 시 slug URL로 301 리다이렉트 (`/posts/1` → `/posts/my-first-post`)

---

#### 📌 PATCH /posts/{postId}/views
**목적**: 포스트 조회수 증가

**Path Parameters**:
- `postId`: 포스트 ID (integer)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "views": 151
  },
  "error": null
}
```

---

#### 📌 GET /comments/{postId}
**목적**: 특정 포스트의 모든 댓글 조회

**Path Parameters**:
- `postId`: 포스트 ID (integer)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "content": "Great post!",
      "authorName": "John Doe",
      "createdAt": "2024-01-15T16:00:00Z",
      "postId": 1
    }
  ],
  "error": null
}
```

---

#### 📌 POST /comments/{postId}
**목적**: 새 댓글 작성

**Path Parameters**:
- `postId`: 포스트 ID (integer)

**Request Body**:
```json
{
  "content": "This is my comment",
  "author": "John Doe"
}
```

**Validation Rules**:
- `content`: Required, 1-500 characters
- `author`: Required, 2-20 characters

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "This is my comment",
    "authorName": "John Doe",
    "createdAt": "2024-01-15T16:00:00Z",
    "postId": 1
  },
  "error": null
}
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 400,
    "message": "Validation error: content is required"
  }
}
```

---

#### 📌 GET /tags
**목적**: 모든 활성 태그 목록 조회 (포스트 수 포함)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "javascript",
      "postCount": 15,
      "createdAt": "2024-01-10T08:00:00Z"
    },
    {
      "id": 2,
      "name": "tutorial",
      "postCount": 8,
      "createdAt": "2024-01-12T09:00:00Z"
    }
  ],
  "error": null
}
```

---

#### 📌 GET /sitemap
**목적**: SEO 사이트맵 생성용 모든 포스트의 slug 목록 반환

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    "my-first-post",
    "getting-started-with-serverless",
    "understanding-cloudflare-workers"
  ],
  "error": null
}
```

---

#### 📌 POST /login
**목적**: 관리자 로그인 및 JWT 토큰 발급

**Request Body**:
```json
{
  "username": "admin",
  "password": "securepassword"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200
  },
  "error": null
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 401,
    "message": "Invalid credentials"
  }
}
```

---

#### 📌 GET /session
**목적**: 현재 세션/토큰 유효성 확인

**Headers**:
- `Authorization: Bearer <token>`

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "expiresAt": "2024-01-15T18:00:00Z"
  },
  "error": null
}
```

---

#### 📌 POST /admin/posts
**목적**: 새 블로그 포스트 생성

**Authentication**: Required - JWT Bearer token

**Request Body**:
```json
{
  "title": "Getting Started with Serverless",
  "content": "# Introduction\n\nServerless computing is...",
  "summary": "Learn the basics of serverless computing",
  "tags": ["serverless", "aws", "tutorial"],
  "slug": "getting-started-with-serverless",
  "state": "published"
}
```

**Validation Rules**:
- `title`: Required, 1-100 characters
- `content`: Required, 1-10000 characters (Markdown supported)
- `summary`: Required, 1-200 characters
- `tags`: Optional, array of strings
- `slug`: Optional, auto-generated from title if not provided
  - Must match pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
  - Must be unique
- `state`: Required, one of: "published", "draft"

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "slug": "getting-started-with-serverless",
    "title": "Getting Started with Serverless",
    "content": "# Introduction\n\nServerless computing is...",
    "summary": "Learn the basics of serverless computing",
    "tags": ["serverless", "aws", "tutorial"],
    "state": "published",
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-20T10:00:00Z",
    "views": 0
  },
  "error": null
}
```

---

#### 📌 PUT /admin/posts/{postId}
**목적**: 기존 블로그 포스트 수정

**Authentication**: Required - JWT Bearer token

**Path Parameters**:
- `postId`: 포스트 ID (integer)

**Request Body**:
```json
{
  "title": "Updated Title",
  "content": "# Updated Content\n\nNew content here...",
  "summary": "Updated summary",
  "tags": ["updated", "tags"],
  "slug": "updated-slug",
  "state": "published"
}
```

**Validation Rules**: Same as POST /admin/posts

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "slug": "updated-slug",
    "title": "Updated Title",
    "content": "# Updated Content\n\nNew content here...",
    "summary": "Updated summary",
    "tags": ["updated", "tags"],
    "state": "published",
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-20T15:30:00Z",
    "views": 150
  },
  "error": null
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 404,
    "message": "Post not found"
  }
}
```

---

#### 📌 DELETE /admin/posts/{postId}
**목적**: 블로그 포스트 삭제

**Authentication**: Required - JWT Bearer token

**Path Parameters**:
- `postId`: 포스트 ID (integer)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": 42
  },
  "error": null
}
```

---

#### 📌 POST /admin/images
**목적**: 이미지 파일 업로드 (R2 저장)

**Authentication**: Required - JWT Bearer token

**Request**: `multipart/form-data`
- `file`: Image file (JPEG, PNG, GIF, WebP)
- Max size: 5MB

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "url": "https://cdn.bumsiku.kr/images/550e8400-e29b-41d4-a716.jpg",
    "key": "550e8400-e29b-41d4-a716.jpg"
  },
  "error": null
}
```

---

#### 📌 DELETE /admin/comments/{commentId}
**목적**: 댓글 삭제

**Authentication**: Required - JWT Bearer token

**Path Parameters**:
- `commentId`: 댓글 ID (UUID)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "error": null
}
```

---

### 5.4 표준 응답 형식

모든 API는 다음 구조로 응답합니다:

**성공 응답**:
```json
{
  "success": true,
  "data": <응답 데이터>,
  "error": null
}
```

**실패 응답**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": <HTTP 상태 코드>,
    "message": "에러 메시지"
  }
}
```

### 5.5 데이터 형식 표준

- **Date Format**: ISO 8601 (예: `2024-01-15T10:30:00Z`)
- **Timezone**: UTC
- **Slug Pattern**: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- **Page 번호**: 0부터 시작
- **기본 Size**: 10개
- **UUID Format**: RFC 4122 (예: `550e8400-e29b-41d4-a716-446655440000`)

---

## 6. File Structure

### 6.1 Project Organization (✅ Implemented)

```
/blog-worker/
│
├── /admin-worker/                ✅ IMPLEMENTED
│   ├── src/
│   │   ├── index.js              ✅ Main fetch handler with CORS
│   │   ├── router.js             ✅ Route handling with authentication
│   │   ├── auth/
│   │   │   ├── middleware.js     ✅ JWT authentication middleware
│   │   │   └── validators.js     ✅ JWT generation & validation
│   │   ├── handlers/
│   │   │   ├── auth.js           ✅ Login (POST /login) & session (GET /session)
│   │   │   ├── posts.js          ✅ CRUD operations (POST/PUT/DELETE /admin/posts)
│   │   │   ├── images.js         ✅ R2 image upload (POST /admin/images)
│   │   │   └── comments.js       ✅ Comment deletion (DELETE /admin/comments/:id)
│   │   └── utils/
│   │       ├── errors.js         ✅ Custom error classes
│   │       ├── response.js       ✅ Standardized JSON responses
│   │       └── validation.js     ✅ Input validation functions
│   ├── tests/                    ⏳ To be implemented (Phase 6)
│   │   ├── auth.test.js
│   │   └── handlers.test.js
│   ├── wrangler.toml             ⏳ To be configured (Phase 5)
│   ├── package.json              ⏳ To be created (Phase 5)
│   └── README.md                 ⏳ To be created (Phase 8)
│
├── /public-worker/               ✅ IMPLEMENTED
│   ├── src/
│   │   ├── index.js              ✅ Main fetch handler (no auth)
│   │   ├── router.js             ✅ Route handling for public endpoints
│   │   ├── handlers/
│   │   │   ├── posts.js          ✅ GET /posts, GET /posts/:slug, PATCH views
│   │   │   ├── comments.js       ✅ GET/POST /comments/:postId
│   │   │   ├── tags.js           ✅ GET /tags
│   │   │   └── sitemap.js        ✅ GET /sitemap
│   │   └── utils/
│   │       ├── errors.js         ✅ Error handling (shared pattern)
│   │       ├── response.js       ✅ Response formatting (shared pattern)
│   │       ├── validation.js     ✅ Input validation (shared pattern)
│   │       └── cache.js          ✅ KV caching with invalidation
│   ├── tests/                    ⏳ To be implemented (Phase 6)
│   │   └── handlers.test.js
│   ├── wrangler.toml             ⏳ To be configured (Phase 5)
│   ├── package.json              ⏳ To be created (Phase 5)
│   └── README.md                 ⏳ To be created (Phase 8)
│
├── /migration/                   ✅ Database schema
│   └── schema.sql                ✅ D1 database schema with triggers
│
├── IMPLEMENTATION_PLAN.md        ✅ This document (Phase 1-4 complete)
├── SETUP_GUIDE.md                📝 Deployment guide (exists)
└── README.md                     📝 Project overview (exists)
```

**Implementation Statistics:**
- Total Files Created: 18
- Admin Worker: 9 files (index, router, 4 handlers, 3 utils)
- Public Worker: 9 files (index, router, 4 handlers, 4 utils)
- Lines of Code: ~2,000+ (estimated)
- API Endpoints: 14 total (7 admin + 7 public)

### 6.2 Core File Templates

#### admin-worker/src/index.js
```javascript
/**
 * Admin Worker - Main Entry Point
 * Handles authenticated admin API requests
 */

import { authenticate } from './auth/middleware.js';
import { router } from './router.js';
import { errorResponse, corsHeaders } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders(env.ALLOWED_ORIGINS)
        });
      }

      // Authenticate request
      const authResult = await authenticate(request, env);
      if (authResult instanceof Response) {
        // Authentication failed
        return authResult;
      }

      // Route authenticated request
      return await router(request, env, ctx, authResult.user);

    } catch (error) {
      console.error('Admin Worker Error:', error);
      return errorResponse(error.message, 500);
    }
  }
};
```

#### public-worker/src/index.js
```javascript
/**
 * Public Worker - Main Entry Point
 * Handles public API requests (no authentication)
 */

import { router } from './router.js';
import { errorResponse, corsHeaders } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders(env.ALLOWED_ORIGINS)
        });
      }

      // Route request (no auth needed)
      return await router(request, env, ctx);

    } catch (error) {
      console.error('Public Worker Error:', error);
      return errorResponse(error.message, 500);
    }
  }
};
```

#### router.js (both workers)
```javascript
/**
 * Router - URL routing logic
 */

export async function router(request, env, ctx, user = null) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // Route matching
  const route = `${method} ${pathname}`;

  // Dynamic route matching with parameters
  const routeMatch = matchRoute(route, routes);

  if (routeMatch) {
    const { handler, params } = routeMatch;
    return await handler(request, env, ctx, params, user);
  }

  // 404 Not Found
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Route definitions (to be populated from API spec)
const routes = [
  // { pattern: 'GET /api/posts', handler: getPosts },
  // { pattern: 'POST /api/posts', handler: createPost },
  // Add routes based on API specification
];

function matchRoute(route, routes) {
  // Simple route matching logic
  // Can be enhanced for path parameters (:id, :slug, etc.)
  for (const r of routes) {
    if (r.pattern === route) {
      return { handler: r.handler, params: {} };
    }
  }
  return null;
}
```

#### utils/response.js
```javascript
/**
 * Response Utilities
 */

export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function corsHeaders(allowedOrigins = '*') {
  return {
    'Access-Control-Allow-Origin': allowedOrigins,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}
```

#### utils/errors.js
```javascript
/**
 * Error Handling Utilities
 */

export class APIError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}
```

---

## 7. Configuration

### 7.1 Admin Worker - wrangler.toml

```toml
name = "admin-worker"
main = "src/index.js"
compatibility_date = "2024-10-22"
node_compat = false

# Environment Variables (non-sensitive)
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://bumsiku.kr"
JWT_EXPIRY = "7200"  # 2 hours in seconds

# D1 Database - 포스트, 댓글, 태그 데이터
[[d1_databases]]
binding = "DB"
database_name = "blog-db"
database_id = "your-d1-database-id"  # wrangler d1 create 후 ID 입력

# R2 Bucket - 이미지 파일 저장
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "blog-images"

# KV Namespace (선택) - 캐싱
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"  # wrangler kv:namespace create 후 ID 입력

# Secrets (설정 필요 - wrangler secret put)
# - JWT_SECRET: JWT 토큰 서명 키 (최소 32자)
# - ADMIN_USERNAME: 관리자 아이디
# - ADMIN_PASSWORD: 관리자 비밀번호 (bcrypt 해시 권장)
```

### 7.2 Public Worker - wrangler.toml

```toml
name = "public-worker"
main = "src/index.js"
compatibility_date = "2024-10-22"
node_compat = false

# Environment Variables
[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGINS = "https://bumsiku.kr"
CACHE_TTL = "3600"  # 1 hour

# D1 Database - Admin Worker와 동일한 데이터베이스 공유
[[d1_databases]]
binding = "DB"
database_name = "blog-db"
database_id = "your-d1-database-id"  # Admin Worker와 동일한 ID

# KV Namespace (선택) - 읽기 전용 캐싱
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"  # Admin Worker와 동일한 ID

# Public Worker는 secrets 불필요 (읽기 전용)
```

### 7.3 Secrets Management

```bash
# Admin Worker Secrets 설정
cd admin-worker

# JWT Secret (최소 32자 권장)
wrangler secret put JWT_SECRET
# Enter: [강력한 랜덤 문자열, 예: openssl rand -base64 32]

# Admin Credentials
wrangler secret put ADMIN_USERNAME
# Enter: admin

wrangler secret put ADMIN_PASSWORD
# Enter: [bcrypt 해시된 비밀번호]
# 생성 방법: node -e "console.log(require('bcrypt').hashSync('your-password', 10))"

# Public Worker는 secrets 불필요
```

### 7.4 D1 Database 초기화

```bash
# D1 데이터베이스 생성
wrangler d1 create blog-db

# 스키마 생성 (schema.sql 파일 필요)
wrangler d1 execute blog-db --file=./schema.sql

# 로컬 개발용 D1
wrangler d1 execute blog-db --local --file=./schema.sql
```

### 7.5 R2 Bucket 생성

```bash
# R2 버킷 생성
wrangler r2 bucket create blog-images

# CORS 설정 (선택)
wrangler r2 bucket cors put blog-images --config=cors.json
```

---

## 8. Implementation Phases

### Phase 1: Project Setup ✓
- [x] Learn CloudFlare Workers architecture
- [x] Design authentication strategy
- [x] Create implementation plan
- [x] Receive and analyze API specification
- [x] Create project structure
- [x] Initialize npm packages
- [x] Configure wrangler.toml files

### Phase 2: Core Infrastructure ✓
- [x] Implement routing logic for both workers
- [x] Create response/error utilities
- [x] Set up CORS handling
- [x] Implement request validation
- [x] Add caching utilities for public worker

### Phase 3: Admin Worker Development ✓
- [x] Implement JWT authentication middleware
- [x] Create auth validation functions
- [x] Implement admin API endpoints (based on spec)
- [x] Add input validation
- [x] Error handling

### Phase 4: Public Worker Development ✓
- [x] Implement public API endpoints (based on spec)
- [x] Add caching logic (if needed)
- [ ] Rate limiting (if needed)
- [ ] Response optimization

### Phase 5: Data Layer Integration
- [ ] Set up KV namespace (if needed)
- [ ] Configure D1 database (if needed)
- [ ] Set up R2 bucket (if needed)
- [ ] Implement data access patterns

### Phase 6: Testing
- [ ] Write unit tests for utilities
- [ ] Write integration tests for endpoints
- [ ] Test authentication flows
- [ ] Performance testing
- [ ] Security testing

### Phase 7: Deployment
- [ ] Deploy to CloudFlare Workers staging
- [ ] Configure custom domains
- [ ] Set up secrets
- [ ] Production deployment
- [ ] Monitoring setup

### Phase 8: Documentation & Handoff
- [ ] API documentation
- [ ] Deployment guide
- [ ] Maintenance procedures
- [ ] Security considerations document

---

## 9. Deployment Strategy

### 9.1 Deployment Commands

```bash
# Admin Worker Deployment
cd admin-worker
wrangler deploy

# Public Worker Deployment
cd public-worker
wrangler deploy
```

### 9.2 Custom Domain Configuration

```bash
# Add custom route (via CloudFlare dashboard or CLI)
# Admin Worker: api-admin.bumsiku.kr/*
# Public Worker: api.bumsiku.kr/*
```

### 9.3 Environment Strategy

**Development**:
```bash
wrangler dev --local  # Local development mode
```

**Staging**:
```toml
# wrangler.staging.toml
name = "admin-worker-staging"
[env.staging]
vars = { ENVIRONMENT = "staging" }
```

**Production**:
```bash
wrangler deploy --env production
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Vitest)

```javascript
// tests/auth.test.js
import { describe, it, expect } from 'vitest';
import { authenticate } from '../src/auth/middleware.js';

describe('Authentication Middleware', () => {
  it('should reject requests without Authorization header', async () => {
    const request = new Request('https://example.com/api/test');
    const env = { JWT_SECRET: 'test-secret' };

    const result = await authenticate(request, env);
    expect(result.status).toBe(401);
  });

  it('should accept valid JWT tokens', async () => {
    const token = 'valid.jwt.token'; // Create valid test token
    const request = new Request('https://example.com/api/test', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const env = { JWT_SECRET: 'test-secret' };

    const result = await authenticate(request, env);
    expect(result.authorized).toBe(true);
  });
});
```

### 10.2 Integration Tests

```javascript
// tests/handlers.test.js
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';

describe('Admin Worker Integration', () => {
  it('should handle POST /api/posts with auth', async () => {
    const request = new Request('https://example.com/api/posts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test Post' })
    });

    const env = { JWT_SECRET: 'test-secret' };
    const ctx = { waitUntil: () => {} };

    const response = await worker.fetch(request, env, ctx);
    expect(response.status).toBe(201);
  });
});
```

### 10.3 Manual Testing

```bash
# Test admin worker authentication
curl -X GET https://admin-worker.dev/api/posts \
  -H "Authorization: Bearer <token>"

# Test public worker
curl -X GET https://public-worker.dev/api/posts
```

---

## 11. Security Considerations

### 11.1 Authentication Security
- ✅ Use strong JWT secrets (min 256-bit)
- ✅ Implement token expiration
- ✅ Consider refresh token mechanism
- ✅ Rate limit authentication attempts
- ✅ Log failed authentication attempts

### 11.2 CORS Configuration
```javascript
// Restrict origins in production
const ALLOWED_ORIGINS = env.ENVIRONMENT === 'production'
  ? 'https://bumsiku.kr'
  : '*';
```

### 11.3 Input Validation
- ✅ Validate all input data
- ✅ Sanitize user inputs
- ✅ Implement request size limits
- ✅ Validate content types

### 11.4 Rate Limiting
```javascript
// Example rate limiting with KV
async function rateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP');
  const key = `ratelimit:${ip}`;

  const count = await env.CACHE.get(key);
  if (count && parseInt(count) > 100) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  await env.CACHE.put(key, (parseInt(count || 0) + 1).toString(), {
    expirationTtl: 3600
  });

  return null;
}
```

### 11.5 Secrets Management
- ✅ Never commit secrets to git
- ✅ Use wrangler secret put for sensitive data
- ✅ Rotate secrets regularly
- ✅ Use different secrets per environment

---

## 12. Performance Optimization

### 12.1 Caching Strategy
- Cache public API responses in KV
- Set appropriate Cache-Control headers
- Use CloudFlare's edge caching

### 12.2 Response Optimization
- Minimize response payload size
- Use streaming for large responses
- Implement pagination for list endpoints

### 12.3 Database Optimization
- Use prepared statements (D1)
- Implement connection pooling
- Add database indexes for frequently queried fields

---

## 13. Monitoring & Observability

### 13.1 Logging
```javascript
// Structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  worker: 'admin-worker',
  message: 'Request processed',
  requestId: crypto.randomUUID(),
  path: request.url
}));
```

### 13.2 CloudFlare Analytics
- Monitor via CloudFlare dashboard
- Track request rates
- Monitor error rates
- Track response times

### 13.3 Error Tracking
- Log all errors with context
- Consider integrating Sentry or similar
- Set up alerts for critical errors

---

## 14. Database Schema (D1)

### 14.1 스키마 파일: `schema.sql`

프로젝트 루트에 `schema.sql` 파일이 생성되었습니다. Oracle 데이터베이스에서 마이그레이션을 위해 DDL 구조를 반영했습니다.

**테이블:**
- `posts` - 블로그 포스트 (id, slug, title, content, summary, state, created_at, updated_at, views)
- `tags` - 태그 목록 (id, name, created_at, post_count)
- `post_tags` - 포스트-태그 연결 (Many-to-Many)
- `comments` - 댓글 (id UUID, content, author_name, created_at, post_id)

**트리거:**
- `update_posts_updated_at` - 포스트 수정 시 updated_at 자동 갱신
- `increment_tag_count` / `decrement_tag_count` - 태그의 post_count 자동 관리

**인덱스:**
- slug, created_at, views 검색 최적화
- post_id, tag_id 조인 최적화

### 14.2 데이터베이스 초기화

```bash
# D1 데이터베이스 생성
wrangler d1 create blog-db

# 출력된 database_id를 wrangler.toml에 복사

# 스키마 적용 (Production)
wrangler d1 execute blog-db --file=./schema.sql

# 스키마 적용 (Local Development)
wrangler d1 execute blog-db --local --file=./schema.sql
```

### 14.3 데이터 모델 (TypeScript 인터페이스)

```typescript
// Post 모델 (Oracle DDL 기반)
interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;      // Markdown content
  summary: string;
  state: string;        // "published" | "draft"
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  views: number;        // BIGINT (NUMBER(19) in Oracle)
}

// Comment 모델 (Oracle DDL 기반)
interface Comment {
  id: string;           // UUID (VARCHAR2(255) in Oracle)
  content: string;
  authorName: string;   // Renamed from 'author' to match Oracle DDL
  createdAt: string;    // ISO 8601
  postId: number;
}

// Tag 모델 (Oracle DDL 기반)
interface Tag {
  id: number;
  name: string;
  createdAt: string;    // ISO 8601 (added to match Oracle DDL)
  postCount: number;
}

// Post-Tag 관계 (Many-to-Many)
interface PostTag {
  postId: number;
  tagId: number;
}

// Paginated Response
interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  pageNumber: number;
  pageSize: number;
}

// Image Upload Response
interface ImageUpload {
  url: string;          // Full CDN URL
  key: string;          // R2 storage key
}

// API Request/Response Types
interface CreatePostRequest {
  title: string;
  content: string;
  summary: string;
  tags: string[];
  slug?: string;        // Optional, auto-generated if not provided
  state: "published" | "draft";
}

interface CreateCommentRequest {
  content: string;
  author: string;       // Input field name (maps to authorName in DB)
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  expiresIn: number;    // Seconds
}
```

---

## 15. Next Steps

### ✅ Completed Actions:

1. ✅ **API Specification 획득**: Notion MCP를 통해 완전한 API 명세 확보
2. ✅ **엔드포인트 분석**: Admin(7개) vs Public(7개) 엔드포인트 분류 완료
3. ✅ **데이터 요구사항 확인**: D1 (데이터베이스), R2 (이미지), KV (캐싱) 결정
4. ✅ **플랫폼 적응 계획**: Express.js → CloudFlare Workers 전환 전략 수립
5. ✅ **데이터베이스 스키마**: D1용 완전한 SQL 스키마 생성

### 📋 Immediate Next Actions:

1. **프로젝트 구조 생성**
   ```bash
   mkdir -p admin-worker/src/{auth,handlers,utils}
   mkdir -p public-worker/src/{handlers,utils}
   cd admin-worker && npm init -y
   cd ../public-worker && npm init -y
   ```

2. **Wrangler 초기화**
   ```bash
   cd admin-worker && npm install -D wrangler vitest
   cd ../public-worker && npm install -D wrangler vitest
   ```

3. **CloudFlare 리소스 생성**
   ```bash
   # D1 Database
   wrangler d1 create blog-db

   # R2 Bucket
   wrangler r2 bucket create blog-images

   # KV Namespace (선택)
   wrangler kv:namespace create CACHE
   ```

4. **wrangler.toml 파일 생성**
   - admin-worker/wrangler.toml (섹션 7.1 참조)
   - public-worker/wrangler.toml (섹션 7.2 참조)

5. **Secrets 설정**
   ```bash
   cd admin-worker
   wrangler secret put JWT_SECRET
   wrangler secret put ADMIN_USERNAME
   wrangler secret put ADMIN_PASSWORD
   ```

6. **핵심 파일 구현 시작**
   - utils/response.js (응답 형식 표준화)
   - utils/errors.js (에러 처리)
   - auth/middleware.js (JWT 인증)
   - router.js (라우팅 로직)
   - index.js (메인 핸들러)

### 🎯 Implementation Priority:

**Phase 1: Infrastructure** (1-2일)
- [x] 프로젝트 구조 생성
- [ ] CloudFlare 리소스 설정 (D1, R2, KV)
- [ ] wrangler.toml 구성
- [ ] schema.sql 적용

**Phase 2: Core Utilities** (1일)
- [ ] Response/Error 유틸리티
- [ ] JWT 생성/검증 함수
- [ ] 라우팅 로직

**Phase 3: Admin Worker** (2-3일)
- [ ] 로그인 엔드포인트
- [ ] JWT 인증 미들웨어
- [ ] 포스트 CRUD
- [ ] 이미지 업로드 (R2)
- [ ] 댓글 삭제

**Phase 4: Public Worker** (2-3일)
- [ ] 포스트 조회 (목록/단건)
- [ ] 댓글 CRUD
- [ ] 태그 조회
- [ ] 조회수 증가
- [ ] 사이트맵

**Phase 5: Testing & Deployment** (1-2일)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Staging 배포
- [ ] Production 배포

### ❓ 구현 시 고려사항:

**인증:**
- JWT 만료 시간: 2시간 (JWT_EXPIRY)
- Refresh token 구현 여부?
- 비밀번호는 bcrypt로 해시 저장

**이미지 업로드:**
- 최대 파일 크기: 10MB
- 지원 형식: JPEG, PNG, GIF, WebP
- R2 경로 구조: `images/{year}/{month}/{uuid}.{ext}`
- CDN URL 형식: 결정 필요

**페이징:**
- 기본 size: 10
- 최대 size: 100
- Page 번호: 0부터 시작

**캐싱 전략:**
- 포스트 목록: KV 캐시 (TTL: 1시간)
- 단일 포스트: KV 캐시 (TTL: 1시간)
- 태그 목록: KV 캐시 (TTL: 1시간)
- Cache invalidation: 포스트 생성/수정/삭제 시

**CORS:**
- Allowed Origins: `https://bumsiku.kr`
- Development: `http://localhost:*`
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers: Content-Type, Authorization

---

## 15. Appendix

### 15.1 CloudFlare Workers Limits
- **Free Tier**:
  - 100,000 requests/day
  - 10ms CPU time per request
  - 128MB memory

- **Paid Tier** (Bundled):
  - 10 million requests/month included
  - 50ms CPU time per request
  - 128MB memory

### 15.2 Useful Resources
- [CloudFlare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [CloudFlare Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Workers KV Docs](https://developers.cloudflare.com/kv/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)

### 15.3 Contact & Support
- CloudFlare Community: https://community.cloudflare.com/
- CloudFlare Discord: https://discord.gg/cloudflaredev

---

## 16. Phase 2 Implementation Summary

### 16.1 Completed Components (2025-10-22)

#### Admin Worker Infrastructure
- **index.js**: Main entry point with CORS handling and error management
- **router.js**: URL routing with pattern matching and parameter extraction
- **utils/response.js**: Standard response formatting and CORS utilities
- **utils/errors.js**: Custom error classes (ValidationError, NotFoundError, UnauthorizedError, etc.)
- **utils/validation.js**: Comprehensive input validation functions

#### Public Worker Infrastructure
- **index.js**: Main entry point (identical to admin but without auth)
- **router.js**: URL routing logic (same as admin worker)
- **utils/response.js**: Response and CORS utilities (shared with admin)
- **utils/errors.js**: Error handling classes (shared with admin)
- **utils/validation.js**: Input validation (shared with admin)
- **utils/cache.js**: KV-based caching utilities with invalidation patterns

### 16.2 Key Features Implemented

**Routing System**:
- Pattern-based URL matching with path parameters (`:paramName`)
- Automatic request body parsing for POST/PUT/PATCH
- Query parameter extraction
- Handler context with request, env, params, query, body

**Response Standards**:
- Standardized JSON response format: `{ success, data, error }`
- CORS header management with configurable origins
- Error response formatting with status codes

**Error Handling**:
- Hierarchical error classes extending APIError
- Automatic error-to-status-code mapping
- Error conversion utility for unknown errors

**Input Validation**:
- Required field validation
- String length validation
- Slug pattern validation (lowercase alphanumeric with hyphens)
- Email format validation
- Enum value validation
- Array validation with max items
- Number range validation
- Pre-built validators for posts, comments, login, pagination, and sorting

**Caching (Public Worker)**:
- Cache key generation from path and parameters
- Get/set operations with TTL
- Cache invalidation by key or prefix
- High-level caching wrapper (`withCache`)
- Invalidation patterns for posts, comments, and tags

### 16.3 Next Steps

**Phase 3: Admin Worker Development**
- Implement JWT authentication middleware (auth/middleware.js)
- Create JWT generation and validation (auth/validators.js)
- Implement admin API handlers:
  - Auth handlers (login, session)
  - Post management (create, update, delete)
  - Image upload (R2 integration)
  - Comment management (delete)

**Phase 4: Public Worker Development**
- Implement public API handlers:
  - Post listing and retrieval
  - Comment CRUD operations
  - Tag listing
  - View increment
  - Sitemap generation

---

## 17. Phase 3 Implementation Summary

### 17.1 Completed Components (2025-10-22)

#### JWT Authentication System
- **auth/validators.js**: Complete JWT generation and validation using CloudFlare Workers crypto API
  - `generateJWT()`: HMAC-SHA256 token generation
  - `validateJWT()`: Token validation with signature verification and expiration checking
  - `createPayload()`: Standard JWT payload creation with iat/exp claims
  - Base64 URL encoding/decoding utilities

- **auth/middleware.js**: Request authentication middleware
  - `authenticate()`: Main authentication handler with public endpoint exemptions
  - `verifyToken()`: Bearer token extraction and validation
  - `validateCredentials()`: Admin credential validation against environment secrets
  - Basic auth implementation (reference, not used)

#### Admin Handlers
- **handlers/auth.js**: Authentication endpoints
  - `handleLogin()`: POST /login - Admin login with JWT token generation
  - `handleSessionValidation()`: GET /session - Token validity check

- **handlers/posts.js**: Post management (CRUD operations)
  - `handleCreatePost()`: POST /admin/posts - Create new blog post with tags
  - `handleUpdatePost()`: PUT /admin/posts/:postId - Update existing post
  - `handleDeletePost()`: DELETE /admin/posts/:postId - Delete post
  - `generateSlug()`: Auto-generate URL-safe slugs from titles
  - `getPostById()`: Helper for fetching posts with tag relationships

- **handlers/images.js**: Image upload to R2 storage
  - `handleImageUpload()`: POST /admin/images - Multipart file upload
  - File type validation (JPEG, PNG, GIF, WebP)
  - File size validation (5MB max)
  - Date-based R2 key organization (images/YYYY/MM/uuid.ext)
  - CDN URL generation

- **handlers/comments.js**: Comment moderation
  - `handleDeleteComment()`: DELETE /admin/comments/:commentId - Remove comments

#### Router Integration
- **router.js**: Updated with complete endpoint mappings
  - 7 admin endpoints configured
  - Authentication-aware routing (login exempt, session requires token)
  - Handler signature: `handler(request, env, ctx, params, user)`

### 17.2 Key Security Features

**Authentication Flow**:
1. Client sends POST /login with username/password
2. Server validates credentials against env.ADMIN_USERNAME and env.ADMIN_PASSWORD
3. Server generates JWT with userId, iat, exp claims
4. Client receives token with expiresIn metadata
5. Client includes "Authorization: Bearer <token>" in subsequent requests
6. Middleware validates token signature and expiration
7. Valid requests proceed to handlers with user payload

**Token Security**:
- HMAC-SHA256 signature algorithm
- Configurable expiration (default: 7200 seconds / 2 hours)
- Stateless validation (no session storage)
- Base64 URL encoding for safe transmission

**Input Validation**:
- All handlers use validation.js utilities
- Post creation: title (1-100), content (1-10000), summary (1-200), slug pattern, state enum
- Login: username and password required
- File upload: type, size, content validation

### 17.3 Database Integration

**D1 Operations**:
- Post creation with tag relationships (post_tags junction table)
- Tag auto-creation and management
- Post updates with tag replacement
- Cascading deletes via database triggers
- Slug uniqueness validation
- UUID-based comment identification

**Data Flow Example (Create Post)**:
1. Validate input (title, content, summary, tags, state)
2. Generate or validate slug uniqueness
3. Insert post record with timestamps
4. For each tag: get or create tag record
5. Create post_tags relationships
6. Fetch complete post with tags for response

### 17.4 R2 Storage Integration

**Image Upload Flow**:
1. Parse multipart/form-data
2. Validate file type and size
3. Generate unique key: `images/{year}/{month}/{uuid}.{ext}`
4. Upload to R2 with httpMetadata (contentType)
5. Return CDN URL and storage key

**Storage Organization**:
```
R2 Bucket Structure:
  images/
    2025/
      10/
        550e8400-e29b-41d4-a716.jpg
        a1b2c3d4-e5f6-7890-abcd.png
```

### 17.5 API Endpoints Implemented

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | /login | handleLogin | No |
| GET | /session | handleSessionValidation | Yes |
| POST | /admin/posts | handleCreatePost | Yes |
| PUT | /admin/posts/:postId | handleUpdatePost | Yes |
| DELETE | /admin/posts/:postId | handleDeletePost | Yes |
| POST | /admin/images | handleImageUpload | Yes |
| DELETE | /admin/comments/:commentId | handleDeleteComment | Yes |

### 17.6 Error Handling

**Error Classes Used**:
- `ValidationError` (400): Invalid input data
- `UnauthorizedError` (401): Authentication failures
- `NotFoundError` (404): Resource not found
- `APIError` (base): Generic API errors

**Error Response Format**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 400,
    "message": "Validation error: title is required"
  }
}
```

### 17.7 Next Steps

**Phase 4: Public Worker Development** (Remaining)
- Implement public API handlers:
  - GET /posts (list with pagination, filtering, sorting)
  - GET /posts/:slug (single post retrieval with ID→slug redirect)
  - PATCH /posts/:postId/views (increment view count)
  - GET /comments/:postId (fetch post comments)
  - POST /comments/:postId (create comment)
  - GET /tags (list tags with post counts)
  - GET /sitemap (SEO sitemap generation)

**Phase 5: Data Layer Integration**
- Configure D1 database with wrangler
- Set up R2 bucket
- Configure KV namespace for caching
- Apply schema.sql

**Phase 6: Testing**
- Unit tests for auth, validation, handlers
- Integration tests for complete workflows
- JWT token lifecycle testing
- R2 upload testing

---

## 18. Phase 4 Implementation Summary

### 18.1 Completed Components (2025-10-22)

#### Public Worker Handlers
- **handlers/posts.js**: Public post retrieval endpoints
  - `handleGetPosts()`: GET /posts - Paginated post list with tag filtering and sorting
  - `handleGetPostBySlug()`: GET /posts/:slug - Single post retrieval with ID→slug redirect
  - `handleIncrementViews()`: PATCH /posts/:postId/views - View count increment

- **handlers/comments.js**: Public comment operations
  - `handleGetComments()`: GET /comments/:postId - Fetch all comments for a post
  - `handleCreateComment()`: POST /comments/:postId - Create new comment with validation

- **handlers/tags.js**: Tag listing
  - `handleGetTags()`: GET /tags - List all active tags with post counts

- **handlers/sitemap.js**: SEO sitemap generation
  - `handleGetSitemap()`: GET /sitemap - Generate sitemap with all published post slugs

#### Router Integration
- **router.js**: Updated with complete endpoint mappings
  - 7 public endpoints configured
  - Handler signature: `handler(request, env, ctx, params, user)`
  - No authentication required for public worker

### 18.2 Key Features Implemented

**Post Listing**:
- Pagination support (page, size parameters)
- Tag-based filtering
- Multi-field sorting (createdAt, updatedAt, views, title)
- Published-only posts filtering
- Tag array inclusion for each post

**Post Retrieval**:
- Slug-based URL access
- ID-based access with 301 redirect to slug URL
- Full post content with metadata
- Tag relationships included

**View Tracking**:
- Atomic view count increment
- Cache invalidation after increment
- Post existence validation

**Comment System**:
- Post-specific comment retrieval
- Comment creation with validation
- UUID-based comment identification
- Author name and content validation (1-500 chars, 2-20 chars)

**Tag Management**:
- Active tags only (post_count > 0)
- Post count automatically maintained by database triggers
- Alphabetical sorting

**SEO Support**:
- Sitemap generation for all published posts
- Simple slug array format for easy integration

### 18.3 Cache Integration

**Caching Strategy**:
- KV-based caching for read-heavy endpoints
- TTL: 1 hour default (configurable via env.CACHE_TTL)
- Cache key generation from path and parameters
- Automatic cache invalidation on write operations

**Cache Invalidation Patterns**:
- Post updates: Invalidate post lists and specific post cache
- Comment creation: Invalidate post-specific comment cache
- View increment: Invalidate post cache to reflect updated view count

### 18.4 API Endpoints Implemented

| Method | Endpoint | Handler | Caching |
|--------|----------|---------|---------|
| GET | /posts | handleGetPosts | Yes (list) |
| GET | /posts/:slug | handleGetPostBySlug | Yes (item) |
| PATCH | /posts/:postId/views | handleIncrementViews | Invalidates |
| GET | /comments/:postId | handleGetComments | Yes |
| POST | /comments/:postId | handleCreateComment | Invalidates |
| GET | /tags | handleGetTags | Yes |
| GET | /sitemap | handleGetSitemap | Yes |

### 18.5 Data Flow Examples

**Get Posts with Tag Filter**:
1. Parse query parameters (tag, page, size, sort)
2. Validate pagination and sorting parameters
3. Build SQL query with JOIN to tags table
4. Execute query with pagination
5. Fetch tags for each post in parallel
6. Return paginated response with total count

**Create Comment**:
1. Validate post ID and existence
2. Parse and validate request body (content, author)
3. Generate UUID for comment
4. Insert comment with timestamp
5. Invalidate comment cache for post
6. Return created comment with metadata

**Increment Views**:
1. Validate post ID
2. Execute UPDATE to increment views atomically
3. Fetch updated view count
4. Invalidate post cache
5. Return new view count

### 18.6 Error Handling

**Validation Errors (400)**:
- Invalid pagination parameters
- Invalid sorting fields or directions
- Missing required fields (content, author)
- Field length violations

**Not Found Errors (404)**:
- Post not found by slug or ID
- Post not published
- Comment post reference invalid

**Response Format**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": 400,
    "message": "Validation error: content is required"
  }
}
```

### 18.7 Next Steps

**Phase 5: Data Layer Integration** (Remaining)
- Configure D1 database with wrangler
- Set up R2 bucket (admin worker)
- Configure KV namespace for caching
- Apply schema.sql to D1

**Phase 6: Testing**
- Unit tests for handlers (posts, comments, tags, sitemap)
- Integration tests for complete workflows
- Cache behavior validation
- Pagination and sorting edge cases
- Input validation testing

**Phase 7: Deployment**
- Deploy public-worker to CloudFlare staging
- Deploy admin-worker to CloudFlare staging
- Configure custom domains (api.bumsiku.kr, api-admin.bumsiku.kr)
- Set up secrets (admin worker only)
- Production deployment
- Monitoring setup

---

**Document Status**: Phase 4 Complete - Public Worker Development Complete
**Last Updated**: 2025-10-22
**Next Update**: After Phase 5 completion (Data Layer Integration)
