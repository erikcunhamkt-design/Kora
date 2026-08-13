import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAccessibility } from "@/contexts/accessibility-context-value";

const FocusSpotlightContext = createContext<(() => void) | undefined>(undefined);

export const FocusSpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useAccessibility();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Spotlight target coordinates
  const targetX = useRef(window.innerWidth / 2);
  const targetY = useRef(window.innerHeight / 2);
  
  // Current interpolated coordinates (for spring physics)
  const currentX = useRef(window.innerWidth / 2);
  const currentY = useRef(window.innerHeight / 2);

  const isActive = settings.adhd && settings.focusSpotlightActive;

  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      targetX.current = e.clientX;
      targetY.current = e.clientY;
    };

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);
    handleResize();

    // Animation loop using requestAnimationFrame
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    const render = () => {
      if (!canvas || !ctx) return;

      // Spring physics interpolation
      currentX.current += (targetX.current - currentX.current) * 0.12;
      currentY.current += (targetY.current - currentY.current) * 0.12;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw semi-opaque dark layer
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Carve out spotlight circle using destination-out
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      
      const radius = 160;
      const grad = ctx.createRadialGradient(
        currentX.current,
        currentY.current,
        0,
        currentX.current,
        currentY.current,
        radius
      );
      grad.addColorStop(0, "rgba(0, 0, 0, 1)");
      grad.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(currentX.current, currentY.current, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive]);

  return (
    <>
      {isActive && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
          style={{ mixBlendMode: "multiply" }}
        />
      )}
      {children}
    </>
  );
};
