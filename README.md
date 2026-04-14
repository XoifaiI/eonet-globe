<div align="center">

<img src="https://iili.io/Bc9cIbp.png" alt="EONET Globe" width="100%" />

# EONET Globe

A real-time interactive globe that visualizes natural events happening across the planet, powered by NASA's Earth Observatory Natural Events Tracker.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-blue?style=for-the-badge&logo=googlechrome&logoColor=white)](https://eonet-globe-363055381330.europe-west1.run.app)
[![NASA EONET](https://img.shields.io/badge/Data-NASA%20EONET-red?style=for-the-badge&logo=nasa&logoColor=white)](https://eonet.gsfc.nasa.gov/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MapLibre](https://img.shields.io/badge/MapLibre%20GL-Maps-396CB2?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org)
[![Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)

</div>

## What is this?

EONET Globe pulls live data from NASA's EONET API and plots every tracked natural event on a 3D globe. You can explore wildfires, tropical cyclones, severe storms, volcanic activity, floods, and sea ice events as they happen. Each event shows its trajectory over time, so you can watch how a cyclone moves across the ocean or how a wildfire spreads over several days.

Users can sign in with Google to contribute by uploading photos and writing collaborative wiki sections for any event. Think of it as a living, community-driven atlas of natural disasters.

## Features

### Interactive Globe
The map supports multiple basemap styles including a dark theme, satellite imagery, and a 3D terrain mode with real elevation data. You can switch between point markers and a heatmap visualization to get a sense of where events are clustering. The globe renders using MapLibre GL with vector tiles from CartoCDN, satellite tiles from ArcGIS, and elevation data from AWS terrain tiles.

### Live Event Tracking
Events are pulled from NASA's EONET v3 API and displayed with category-specific icons and color coding. A sidebar lists every active event with fuzzy search, so typing something like "cycl" will match all tropical cyclones. You can filter by category using toggle badges, and the event count updates in real time. A monitor card shows stats like how many events were reported in the last 7 days and which category is most active.

### Event Details
Clicking an event on the map opens a popup card showing its magnitude, coordinates, duration, and number of observation points. Events with multiple geometry points display a trajectory line so you can see the path it has taken. From there you can open a full detail dialog with tabs for photos, wiki content, and source links.

### Community Photos
Authenticated users can upload photos to any event. Images are processed server-side with Sharp (resized to three sizes, converted to WebP, compressed with Zstandard) and stored in Google Cloud Storage. Every upload goes through Google Cloud Vision SafeSearch detection and OCR text extraction, then any detected text is run through Google Cloud Natural Language moderation. This catches both inappropriate imagery and offensive text embedded in images.

### Collaborative Wiki
Each event has a wiki section where users can create and edit informational content. All text is moderated through Google Cloud Natural Language before being stored, and only standard Latin characters are accepted to prevent unicode-based filter bypass. The wiki supports full revision history, so you can see every edit that has been made and revert to a previous version if needed.

### Content Moderation
The moderation pipeline runs synchronously, so bad content never touches storage. For images, a single Vision API call performs both SafeSearch detection and OCR, then the extracted text is passed through the NL moderation API. For wiki content, the title and body are sent to Google Cloud Natural Language which checks against categories like toxicity, profanity, violence, and sexual content. If anything gets flagged, the response includes the specific reasons so users know exactly why their submission was rejected.

### Mobile Responsive
On smaller screens, the sidebar collapses into a hamburger menu that opens as a side drawer, and the filter bar becomes a bottom sheet. When you select an event on mobile, all overlays close automatically so the popup card has room to breathe.

## Tech Stack

The app is built on Next.js with the App Router, React 19, Tailwind CSS v4, and shadcn/ui. Map rendering is handled by MapLibre GL. State management uses Zustand, and the event list is virtualized with TanStack Virtual to keep scrolling smooth even with thousands of events.

The backend lives in Next.js Route Handlers under `app/api`. Authentication is handled through Google Identity Services with JWT tokens signed and verified using the jose library. Images are processed with Sharp and stored in Google Cloud Storage with Zstandard compression. Rate limiting is implemented with an in-memory bucket store applied via Next.js middleware, with separate tiers for general API access, auth attempts, uploads, and wiki edits. A periodic cleanup job registered via `instrumentation.ts` removes expired images.

The whole thing deploys to Google Cloud Run from a multi-stage Dockerfile.

## Running Locally

```bash
npm install
npm run dev
```

This starts the Next.js dev server on port 3000. You will need a `.env.local` file with your Google OAuth client ID and optionally a GCS bucket name for image storage.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (exposed to the browser at build time) |
| `GOOGLE_CLIENT_ID` | Same client ID, used server-side for token verification |
| `JWT_SECRET` | Secret for signing auth tokens (min 32 characters) |
| `GCS_BUCKET` | Google Cloud Storage bucket for images |
| `ENABLE_MODERATION` | Set to `false` to disable image moderation locally |
| `IMAGE_MAX_AGE_DAYS` | Days before uploaded images expire and get cleaned up |

## Deployment notes

The rate limiter, the EONET response cache, the decoded-image LRU, and the image-cleanup `setInterval` all live in per-process memory. This is intentional for a small deployment but means:

- Rate limits count per instance. A client hitting two Cloud Run instances can send `2 × max` requests per window. Set `--min-instances=1 --max-instances=1` (or a low `--concurrency` with a single instance) if you want strict enforcement, or put a shared limiter (Redis / Memorystore) in front.
- The EONET cache warms per instance — each fresh instance does its own upstream fetch.
- The cleanup interval fires once per instance. Multiple instances doing cleanup is safe (GCS atomic writes with generation preconditions handle the race) but wasteful. For real scale, move cleanup to Cloud Scheduler → Cloud Run job.

Secrets (`JWT_SECRET`, `GOOGLE_CLIENT_ID`) should be wired through Google Secret Manager with `gcloud run deploy --set-secrets=JWT_SECRET=jwt-secret:latest,GOOGLE_CLIENT_ID=google-client-id:latest`, not baked into the image.

## License

This project is licensed under the [GNU General Public License v2.0](LICENSE).
