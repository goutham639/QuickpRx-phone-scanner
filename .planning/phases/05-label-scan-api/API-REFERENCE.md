# Label Scan API Reference

## Overview

Label Scan uses OCR (Google Cloud Vision) instead of barcodes. The phone captures photos of prescription labels, which are processed server-side to extract patient name, address, and phone from the printed text.

## Flow

1. Portal creates session → gets pair_code (6-digit)
2. Phone (PWA) enters pair_code → gets scanner token
3. Phone takes photos → uploads to /upload endpoint
4. Backend: OCR processing → creates delivery drafts
5. Portal shows drafts in real-time (SSE) → pharmacist reviews/corrects

## Endpoints

### 1. Join Session (Pairing)

```
POST /v1/label-scan/sessions/join
```

**Auth:** None (public endpoint - pair_code IS the auth)

**Request:**
```json
{
  "pair_code": "123456"
}
```

**Response (200):**
```json
{
  "session_id": "LSCAN-AB12",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-01-14T23:30:00.000Z"
}
```

**Errors:**
- 404 - Invalid code or session expired
- 400 - pair_code is required

### 2. Upload Label Photo

```
POST /v1/label-scan/sessions/:sessionId/upload
```

**Auth:** Bearer token from join response

**Headers:**
```
Authorization: Bearer <token from join>
Content-Type: multipart/form-data
```

**Body:** Form-data with field `image` (JPEG, PNG, or WebP, max 8MB)

**Response (201):**
```json
{
  "success": true,
  "scan_item": {
    "pk": "uuid",
    "status": "QUEUED",
    "uploaded_at": "2026-01-14T21:30:00.000Z"
  }
}
```

**Errors:**
- 401 - Invalid or expired scanner token
- 403 - Token does not match session
- 400 - Session not in PAIRED status / Session expired / No image / Rate limit exceeded

**Rate Limit:** 30 uploads per minute per session

## Session Status Codes

| Status  | Meaning                                    |
|---------|--------------------------------------------|
| WAITING | Session created, waiting for phone to join |
| PAIRED  | Phone joined, ready to scan                |
| CLOSED  | Session ended                              |

## Scan Item Status Codes

| Status     | Meaning                           |
|------------|-----------------------------------|
| QUEUED     | Uploaded, waiting for OCR         |
| PROCESSING | OCR in progress                   |
| COMPLETED  | OCR done, draft created           |
| FAILED     | OCR failed (show "Retake" button) |

## Key Differences from Barcode Scanner

| Aspect         | Barcode Scanner      | Label Scan OCR       |
|----------------|----------------------|----------------------|
| Input          | Barcode image/stream | Full label photo     |
| Processing     | Client-side decode   | Server-side OCR      |
| Data extracted | Rx number only       | Name, address, phone |
| Result         | Immediate            | Async (1-3 sec)      |
| Phone feedback | Beep on scan         | Upload confirmation  |
