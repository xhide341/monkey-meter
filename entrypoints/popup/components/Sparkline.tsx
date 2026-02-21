import { useRef, useEffect, useState, useCallback } from "react";

interface SparklineProps {
  data: number[];
}

export default function Sparkline({ data }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  /** 
   * Draws the sparkline on the canvas. 
   * Handles high DPI scaling, empty data fallback, smooth curve generation, 
   * gradient filling, active point highlighting, and tooltip positioning.
   */
  const draw = useCallback(
    (highlight: number | null) => {
      const canvas = canvasRef.current;
      const tooltip = tooltipRef.current;
      if (!canvas || !tooltip) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (
        canvas.width !== rect.width * dpr ||
        canvas.height !== rect.height * dpr
      ) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const paddingTop = 8;
      const paddingBottom = 16;
      const paddingLeft = 24;
      const paddingRight = 8;

      ctx.clearRect(0, 0, w, h);

      // Subtle background for the chart area
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(
        paddingLeft,
        paddingTop,
        w - paddingLeft - paddingRight,
        h - paddingTop - paddingBottom,
        4
      );
      ctx.fill();

      // Axis guides / labels
      ctx.fillStyle = "#78716c";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("100", paddingLeft - 4, paddingTop + 4);
      ctx.fillText("0", paddingLeft - 4, h - paddingBottom - 4);

      if (data.length < 2) {
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, h / 2);
        ctx.lineTo(w - paddingRight, h / 2);
        ctx.stroke();
        tooltip.style.opacity = "0";
        return;
      }

      // X-axis labels
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const durationMs = (data.length - 1) * 60_000;
      let durationStr = "";
      if (durationMs >= 3600_000) {
        durationStr = `-${(durationMs / 3600_000).toFixed(1)}h`;
      } else {
        durationStr = `-${Math.round(durationMs / 60_000)}m`;
      }
      ctx.fillText(durationStr, paddingLeft, h - paddingBottom + 4);

      ctx.textAlign = "right";
      ctx.fillText("now", w - paddingRight, h - paddingBottom + 4);

      const max = Math.max(...data, 100);
      const stepX = (w - paddingLeft - paddingRight) / (data.length - 1);

      const getPoint = (index: number) => ({
        x: paddingLeft + index * stepX,
        y:
          h -
          paddingBottom -
          (data[index] / max) * (h - paddingTop - paddingBottom),
      });

      const points = data.map((_, i) => getPoint(i));

      const drawSmoothPath = (context: CanvasRenderingContext2D) => {
        if (points.length < 2) return;
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i === 0 ? 0 : i - 1];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2] || p2;

          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;

          context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      };

      const gradient = ctx.createLinearGradient(
        0,
        paddingTop,
        0,
        h - paddingBottom
      );
      gradient.addColorStop(0, "rgba(251, 146, 60, 0.3)");
      gradient.addColorStop(1, "rgba(251, 146, 60, 0)");

      drawSmoothPath(ctx);
      const last = points[points.length - 1];
      const first = points[0];
      ctx.lineTo(last.x, h - paddingBottom);
      ctx.lineTo(first.x, h - paddingBottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      drawSmoothPath(ctx);
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      const activeIndex = highlight !== null ? highlight : data.length - 1;
      const activePoint = getPoint(activeIndex);

      if (highlight !== null) {
        ctx.beginPath();
        ctx.moveTo(activePoint.x, paddingTop);
        ctx.lineTo(activePoint.x, h - paddingBottom);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw all points
      points.forEach((p, i) => {
        const isHovered = i === activeIndex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? 4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = "#fb923c";
        ctx.fill();
        ctx.lineWidth = isHovered ? 2 : 1.5;
        ctx.strokeStyle = "#1e2433";
        ctx.stroke();
      });

      if (highlight !== null) {
        const score = Math.round(data[highlight]);
        const msAgo = (data.length - 1 - highlight) * 60_000;
        const time = new Date(Date.now() - msAgo).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
        tooltip.innerHTML = `<span class="tooltip-score">${score}%</span><span class="tooltip-time">${time}</span>`;
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.left = `${activePoint.x}px`;
        tooltip.style.opacity = "1";
      } else {
        tooltip.style.opacity = "0";
      }
    },
    [data],
  );

  /** Redraw when data or highlight changes */
  useEffect(() => {
    draw(highlightIndex);
  }, [draw, highlightIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const paddingLeft = 24;
    const paddingRight = 8;
    const stepX = (w - paddingLeft - paddingRight) / (data.length - 1);
    let index = Math.round((x - paddingLeft) / stepX);
    index = Math.max(0, Math.min(data.length - 1, index));
    setHighlightIndex(index);
  };

  return (
    <div className="sparkline-wrapper">
      <canvas
        ref={canvasRef}
        width={300}
        height={64}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHighlightIndex(null)}
      />
      <div ref={tooltipRef} className="chart-tooltip" />
    </div>
  );
}
