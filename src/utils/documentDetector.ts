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

  // Step 5: Validate detection quality
  const validation = validateDetection(orderedCorners, width, height, imageData);

  if (!validation.isValid) {
    return null;
  }

  return {
    corners: orderedCorners,
    confidence: validation.confidence,
    area: validation.area,
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

/**
 * Validate detected document with multiple checks
 */
function validateDetection(
  corners: Corner[],
  width: number,
  height: number,
  _imageData: ImageData
): { isValid: boolean; confidence: number; area: number } {
  const area = calculateArea(corners);
  const imageArea = width * height;
  const areaRatio = area / imageArea;

  // Check 1: Area must be 15-85% of image
  // Too small = noise, too large = probably full frame
  if (areaRatio < 0.15 || areaRatio > 0.85) {
    return { isValid: false, confidence: 0, area };
  }

  // Check 2: Aspect ratio validation
  // Calculate bounding box
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const aspectRatio = boxWidth / boxHeight;

  // Labels are typically 0.6 (portrait) to 2.5 (landscape)
  // Reject extreme ratios (keyboards, screens, etc.)
  if (aspectRatio < 0.6 || aspectRatio > 2.5) {
    return { isValid: false, confidence: 0, area };
  }

  // Check 3: Shape regularity - corners should form a proper quad
  // Calculate angles between consecutive corners
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4]!;
    const curr = corners[i]!;
    const next = corners[(i + 1) % 4]!;

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    angles.push(angle);
  }

  // All angles should be roughly 90 degrees (60-120 range for flexibility)
  const validAngles = angles.filter((a) => a >= 60 && a <= 120);
  if (validAngles.length < 3) {
    // At least 3 corners should have reasonable angles
    return { isValid: false, confidence: 0, area };
  }

  // Check 4: Edge length consistency
  // Opposite edges should be roughly similar length
  const edge1 = Math.sqrt(
    Math.pow(corners[1]!.x - corners[0]!.x, 2) +
    Math.pow(corners[1]!.y - corners[0]!.y, 2)
  );
  const edge2 = Math.sqrt(
    Math.pow(corners[2]!.x - corners[1]!.x, 2) +
    Math.pow(corners[2]!.y - corners[1]!.y, 2)
  );
  const edge3 = Math.sqrt(
    Math.pow(corners[3]!.x - corners[2]!.x, 2) +
    Math.pow(corners[3]!.y - corners[2]!.y, 2)
  );
  const edge4 = Math.sqrt(
    Math.pow(corners[0]!.x - corners[3]!.x, 2) +
    Math.pow(corners[0]!.y - corners[3]!.y, 2)
  );

  // Opposite edges should be within 50% of each other
  const ratio1 = Math.max(edge1, edge3) / Math.min(edge1, edge3);
  const ratio2 = Math.max(edge2, edge4) / Math.min(edge2, edge4);

  if (ratio1 > 2.0 || ratio2 > 2.0) {
    // Too irregular - probably not a document
    return { isValid: false, confidence: 0, area };
  }

  // Calculate final confidence score
  let confidence = 0;

  // Area score: peak at 40-60% coverage
  const idealAreaRatio = areaRatio > 0.4 && areaRatio < 0.6 ? 1.0 : 0.7;
  confidence += idealAreaRatio * 0.3;

  // Aspect ratio score: prefer 1:1 to 2:1
  const aspectScore = aspectRatio >= 1.0 && aspectRatio <= 2.0 ? 1.0 : 0.7;
  confidence += aspectScore * 0.3;

  // Angle score: more valid angles = better
  const angleScore = validAngles.length / 4;
  confidence += angleScore * 0.2;

  // Edge consistency score
  const edgeScore = 1 - Math.max(ratio1 - 1, ratio2 - 1) / 1.5;
  confidence += Math.max(0, edgeScore) * 0.2;

  // Must meet minimum confidence threshold
  if (confidence < 0.5) {
    return { isValid: false, confidence, area };
  }

  return {
    isValid: true,
    confidence: Math.min(1, confidence),
    area,
  };
}
