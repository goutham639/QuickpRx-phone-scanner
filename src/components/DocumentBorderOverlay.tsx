import { useEffect, useRef } from 'react';
import type { DetectedDocument } from '../utils/documentDetector';

interface DocumentBorderOverlayProps {
  detectedDoc: DetectedDocument | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  containerWidth: number;
  containerHeight: number;
}

export default function DocumentBorderOverlay({
  detectedDoc,
  videoRef,
  containerWidth,
  containerHeight,
}: DocumentBorderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detectedDoc) {
      // No detection - show searching state
      return;
    }

    // Calculate scale from video to display
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let scaleX: number, scaleY: number, offsetX = 0, offsetY = 0;

    if (containerAspect > videoAspect) {
      // Container is wider - fit to height
      scaleY = containerHeight / video.videoHeight;
      scaleX = scaleY;
      offsetX = (containerWidth - video.videoWidth * scaleX) / 2;
    } else {
      // Container is taller - fit to width
      scaleX = containerWidth / video.videoWidth;
      scaleY = scaleX;
      offsetY = (containerHeight - video.videoHeight * scaleY) / 2;
    }

    // Draw detected border
    const { corners, confidence } = detectedDoc;

    // Choose color based on confidence
    let strokeColor: string;
    let glowColor: string;

    if (confidence > 0.7) {
      strokeColor = '#22c55e'; // green-500
      glowColor = 'rgba(34, 197, 94, 0.6)';
    } else if (confidence > 0.5) {
      strokeColor = '#eab308'; // yellow-500
      glowColor = 'rgba(234, 179, 8, 0.6)';
    } else {
      strokeColor = '#ef4444'; // red-500
      glowColor = 'rgba(239, 68, 68, 0.6)';
    }

    // Draw quadrilateral
    ctx.beginPath();
    corners.forEach((corner, index) => {
      const x = corner.x * scaleX + offsetX;
      const y = corner.y * scaleY + offsetY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // Draw with glow effect
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;
    ctx.stroke();

    // Draw corner markers
    corners.forEach((corner) => {
      const x = corner.x * scaleX + offsetX;
      const y = corner.y * scaleY + offsetY;

      // Corner circle
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.fill();

      // Inner white dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      ctx.fill();
    });

    // Draw semi-transparent fill
    ctx.beginPath();
    corners.forEach((corner, index) => {
      const x = corner.x * scaleX + offsetX;
      const y = corner.y * scaleY + offsetY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = confidence > 0.7 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)';
    ctx.fill();
  }, [detectedDoc, videoRef, containerWidth, containerHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
