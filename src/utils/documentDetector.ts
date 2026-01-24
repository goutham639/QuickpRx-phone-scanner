/**
 * Document/Label Boundary Detection
 * Detects rectangular documents in images and returns corner coordinates
 */

export interface Corner {
  x: number;
  y: number;
}

export interface DetectedDocument {
  corners: [Corner, Corner, Corner, Corner]; // TL, TR, BR, BL
  confidence: number;
  area: number;
}

/**
 * Detect document boundaries in an image
 * Returns the 4 corners of the detected document
 */
export function detectDocumentBoundary(
  imageData: ImageData
): DetectedDocument | null {
  const { width, height } = imageData;

  // Step 1: Convert to grayscale and detect edges
  const edges = detectEdges(imageData);

  // Step 2: Find contours (connected edge pixels)
  const contours = findContours(edges, width, height);

  // Step 3: Find the largest quadrilateral
  const quad = findLargestQuadrilateral(contours, width, height);

  if (!quad) return null;

  // Step 4: Order corners: TL, TR, BR, BL
  const orderedCorners = orderCorners(quad);

  // Step 5: Calculate confidence based on area and shape
  const area = calculateArea(orderedCorners);
  const imageArea = width * height;
  const areaRatio = area / imageArea;

  // Good detection: document takes 20-80% of image
  const confidence = areaRatio > 0.2 && areaRatio < 0.8 ?
    Math.min(1, areaRatio * 1.5) : 0.3;

  return {
    corners: orderedCorners,
    confidence,
    area,
  };
}

/**
 * Apply Sobel edge detection
 */
function detectEdges(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const grayscale = new Uint8Array(width * height);
  const edges = new Uint8Array(width * height);

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Sobel edge detection
  const threshold = 50;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Sobel X
      const gx =
        -(grayscale[(y - 1) * width + (x - 1)] ?? 0) +
        (grayscale[(y - 1) * width + (x + 1)] ?? 0) +
        -2 * (grayscale[y * width + (x - 1)] ?? 0) +
        2 * (grayscale[y * width + (x + 1)] ?? 0) +
        -(grayscale[(y + 1) * width + (x - 1)] ?? 0) +
        (grayscale[(y + 1) * width + (x + 1)] ?? 0);

      // Sobel Y
      const gy =
        -(grayscale[(y - 1) * width + (x - 1)] ?? 0) -
        2 * (grayscale[(y - 1) * width + x] ?? 0) -
        (grayscale[(y - 1) * width + (x + 1)] ?? 0) +
        (grayscale[(y + 1) * width + (x - 1)] ?? 0) +
        2 * (grayscale[(y + 1) * width + x] ?? 0) +
        (grayscale[(y + 1) * width + (x + 1)] ?? 0);

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
}

/**
 * Find contours using a simple approach
 * Returns largest connected components
 */
function findContours(
  edges: Uint8Array,
  width: number,
  height: number
): Corner[][] {
  const visited = new Uint8Array(edges.length);
  const contours: Corner[] = [];

  // Sample edge points (every 4th pixel for performance)
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = y * width + x;
      if (edges[idx] === 255 && visited[idx] === 0) {
        contours.push({ x, y });
        visited[idx] = 1;
      }
    }
  }

  // Return all edge points as one contour (simplified)
  return contours.length > 0 ? [contours] : [];
}

/**
 * Find the largest quadrilateral from contours
 */
function findLargestQuadrilateral(
  contours: Corner[][],
  width: number,
  height: number
): Corner[] | null {
  if (contours.length === 0 || contours[0]?.length === 0) {
    return null;
  }

  const points = contours[0];
  if (!points || points.length < 4) return null;

  // Find convex hull (simplified: find extreme points)
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  let topLeft: Corner | null = null;
  let topRight: Corner | null = null;
  let bottomLeft: Corner | null = null;
  let bottomRight: Corner | null = null;

  // Find extreme points
  for (const p of points) {
    if (!p) continue;

    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Find corner candidates
  let minTLDist = Infinity;
  let minTRDist = Infinity;
  let minBLDist = Infinity;
  let minBRDist = Infinity;

  for (const p of points) {
    if (!p) continue;

    // Top-left: closest to (0, 0)
    const tlDist = Math.sqrt(p.x * p.x + p.y * p.y);
    if (tlDist < minTLDist) {
      minTLDist = tlDist;
      topLeft = p;
    }

    // Top-right: closest to (width, 0)
    const trDist = Math.sqrt((width - p.x) ** 2 + p.y * p.y);
    if (trDist < minTRDist) {
      minTRDist = trDist;
      topRight = p;
    }

    // Bottom-left: closest to (0, height)
    const blDist = Math.sqrt(p.x * p.x + (height - p.y) ** 2);
    if (blDist < minBLDist) {
      minBLDist = blDist;
      bottomLeft = p;
    }

    // Bottom-right: closest to (width, height)
    const brDist = Math.sqrt((width - p.x) ** 2 + (height - p.y) ** 2);
    if (brDist < minBRDist) {
      minBRDist = brDist;
      bottomRight = p;
    }
  }

  if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
    return null;
  }

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Order corners: TL, TR, BR, BL (clockwise from top-left)
 */
function orderCorners(corners: Corner[]): [Corner, Corner, Corner, Corner] {
  if (corners.length !== 4) {
    throw new Error('Expected 4 corners');
  }

  // Already ordered by findLargestQuadrilateral
  return corners as [Corner, Corner, Corner, Corner];
}

/**
 * Calculate area of quadrilateral using Shoelace formula
 */
function calculateArea(corners: Corner[]): number {
  if (corners.length !== 4) return 0;

  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const p1 = corners[i];
    const p2 = corners[j];
    if (!p1 || !p2) continue;
    area += p1.x * p2.y;
    area -= p1.y * p2.x;
  }

  return Math.abs(area) / 2;
}
