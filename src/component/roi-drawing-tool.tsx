import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

// ROI shape types
type Point = { x: number; y: number };
type RectangleROI = {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

type PolygonROI = {
  id: string;
  type: "polygon";
  points: Point[];
};

type ROI = RectangleROI | PolygonROI;

// Drawing state types
type DrawingMode =
  | "idle"
  | "drawing-rectangle"
  | "drawing-polygon"
  | "moving"
  | "resizing"
  | "editing-polygon-point";
type ResizeHandle =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

export const ROIDrawingTool = () => {
  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [rois, setRois] = useState<ROI[]>([]);
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("idle");
  const [currentShape, setCurrentShape] = useState<"rectangle" | "polygon">(
    "rectangle"
  );
  const [tempPolygonPoints, setTempPolygonPoints] = useState<Point[]>([]);
  const [tempStartPoint, setTempStartPoint] = useState<Point | null>(null);
  const [tempEndPoint, setTempEndPoint] = useState<Point | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null
  );
  
  // Popover state
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<Point>({ x: 0, y: 0 });
  const [popoverAnchorRef, setPopoverAnchorRef] = useState<HTMLDivElement | null>(null);
  const [lastClickPosition, setLastClickPosition] = useState<Point>({ x: 0, y: 0 });

  const [open, setOpen] = useState(false);

  // Sample image URL (replace with your actual image)
  const imageUrl = "/test.jpg";

  // Get canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d");
  }, []);

  // Generate unique ID
  const generateId = () =>
    `roi-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Draw everything
  const drawCanvas = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all ROIs
    rois.forEach((roi) => {
      const isSelected = roi.id === selectedRoiId;

      ctx.strokeStyle = isSelected ? "#00FFFF" : "#FF0000";
      ctx.lineWidth = isSelected ? 2 : 2;

      if (roi.type === "rectangle") {
        ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

        // Fill semi-transparent
        ctx.fillStyle = isSelected
          ? "rgba(0, 255, 255, 0.2)"
          : "rgba(255, 0, 0, 0.1)";
        ctx.fillRect(roi.x, roi.y, roi.width, roi.height);

        // Draw resize handles if selected
        if (isSelected) {
          drawResizeHandles(ctx, roi);
        }
      } else if (roi.type === "polygon") {
        if (roi.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(roi.points[0].x, roi.points[0].y);

          for (let i = 1; i < roi.points.length; i++) {
            ctx.lineTo(roi.points[i].x, roi.points[i].y);
          }

          ctx.closePath();
          ctx.stroke();

          // Fill semi-transparent
          ctx.fillStyle = isSelected
            ? "rgba(0, 255, 255, 0.2)"
            : "rgba(255, 0, 0, 0.1)";
          ctx.fill();

          // Draw points for polygon if selected
          if (isSelected) {
            roi.points.forEach((point) => {
              ctx.fillStyle = "#00FFFF";
              ctx.beginPath();
              ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      }
    });

    // Draw current temporary shape
    if (drawingMode === "drawing-rectangle" && tempStartPoint && tempEndPoint) {
      const x = Math.min(tempStartPoint.x, tempEndPoint.x);
      const y = Math.min(tempStartPoint.y, tempEndPoint.y);
      const width = Math.abs(tempEndPoint.x - tempStartPoint.x);
      const height = Math.abs(tempEndPoint.y - tempStartPoint.y);

      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
      ctx.fillRect(x, y, width, height);
    }

    // Draw in-progress polygon
    if (drawingMode === "drawing-polygon" && tempPolygonPoints.length > 0) {
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(tempPolygonPoints[0].x, tempPolygonPoints[0].y);

      for (let i = 1; i < tempPolygonPoints.length; i++) {
        ctx.lineTo(tempPolygonPoints[i].x, tempPolygonPoints[i].y);
      }

      if (tempEndPoint) {
        ctx.lineTo(tempEndPoint.x, tempEndPoint.y);
      }

      ctx.stroke();

      // Draw polygon points
      tempPolygonPoints.forEach((point) => {
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [
    rois,
    selectedRoiId,
    drawingMode,
    tempStartPoint,
    tempEndPoint,
    tempPolygonPoints,
    getContext,
  ]);

  // Handle resize handles drawing
  const drawResizeHandles = (
    ctx: CanvasRenderingContext2D,
    roi: RectangleROI
  ) => {
    const handleSize = 6;
    const handles = [
      { x: roi.x, y: roi.y }, // top-left
      { x: roi.x + roi.width, y: roi.y }, // top-right
      { x: roi.x, y: roi.y + roi.height }, // bottom-left
      { x: roi.x + roi.width, y: roi.y + roi.height }, // bottom-right
    ];

    handles.forEach((handle, index) => {
      ctx.fillStyle = "#ed1c24";
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  };

  // Detect if point is inside rectangle ROI
  const isPointInRect = (x: number, y: number, roi: RectangleROI) => {
    return (
      x >= roi.x &&
      x <= roi.x + roi.width &&
      y >= roi.y &&
      y <= roi.y + roi.height
    );
  };

  // Detect if point is inside polygon ROI (using ray-casting algorithm)
  const isPointInPolygon = (x: number, y: number, roi: PolygonROI) => {
    let inside = false;
    const points = roi.points;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  };

  // Find resize handle at position
  const getResizeHandleAtPosition = (
    x: number,
    y: number,
    roi: RectangleROI
  ): ResizeHandle => {
    const handleSize = 6;
    const handles = [
      { pos: "top-left", x: roi.x, y: roi.y },
      { pos: "top-right", x: roi.x + roi.width, y: roi.y },
      { pos: "bottom-left", x: roi.x, y: roi.y + roi.height },
      { pos: "bottom-right", x: roi.x + roi.width, y: roi.y + roi.height },
    ];

    for (const handle of handles) {
      if (
        x >= handle.x - handleSize &&
        x <= handle.x + handleSize &&
        y >= handle.y - handleSize &&
        y <= handle.y + handleSize
      ) {
        return handle.pos as ResizeHandle;
      }
    }

    return null;
  };

  // Find if a polygon point is being clicked and return its index
  const getPolygonPointAtPosition = (
    x: number,
    y: number,
    roi: PolygonROI
  ): number => {
    const handleSize = 6; // Size of the clickable area around points

    for (let i = 0; i < roi.points.length; i++) {
      const point = roi.points[i];
      const distance = Math.sqrt(
        Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2)
      );

      if (distance <= handleSize) {
        return i;
      }
    }

    return -1; // No point found
  };

  // Find ROI that contains point
  const findRoiAtPosition = (x: number, y: number) => {
    // Check in reverse to select the topmost (last drawn) ROI first
    for (let i = rois.length - 1; i >= 0; i--) {
      const roi = rois[i];

      if (roi.type === "rectangle" && isPointInRect(x, y, roi)) {
        return roi;
      } else if (roi.type === "polygon" && isPointInPolygon(x, y, roi)) {
        return roi;
      }
    }

    return null;
  };

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setLastClickPosition({ x, y });

    if (drawingMode === "idle") {
      // Check if clicking on resize handle for rectangle
      if (selectedRoiId) {
        const selectedRoi = rois.find((roi) => roi.id === selectedRoiId);
        if (selectedRoi && selectedRoi.type === "rectangle") {
          const handle = getResizeHandleAtPosition(x, y, selectedRoi);
          if (handle) {
            setDrawingMode("resizing");
            setResizeHandle(handle);
            setTempStartPoint({ x, y });
            return;
          }
        } else if (selectedRoi && selectedRoi.type === "polygon") {
          // Check if clicking on a polygon point
          const pointIndex = getPolygonPointAtPosition(x, y, selectedRoi);
          if (pointIndex !== -1) {
            // Start editing the polygon point
            setDrawingMode("editing-polygon-point");
            setSelectedPointIndex(pointIndex);
            setTempStartPoint({ x, y });
            return;
          }
        }
      }

      // Check if clicking inside an existing ROI
      const clickedRoi = findRoiAtPosition(x, y);

      if (clickedRoi) {
        setSelectedRoiId(clickedRoi.id);
        setDrawingMode("moving");
        if (clickedRoi.type === "rectangle") {
          setDragOffset({
            x: x - clickedRoi.x,
            y: y - clickedRoi.y,
          });
        } else if (clickedRoi.type === "polygon") {
          // For polygon, store the current mouse position as the reference point
          setDragOffset({ x, y });
          setTempStartPoint({ x, y }); // Store the initial click position
        }
      } else {
        setSelectedRoiId(null);
        if (currentShape === "rectangle") {
          setDrawingMode("drawing-rectangle");
          setTempStartPoint({ x, y });
          setTempEndPoint({ x, y });
        } else if (currentShape === "polygon") {
          setDrawingMode("drawing-polygon");
          setTempPolygonPoints([{ x, y }]);
        }
      }
    } else if (drawingMode === "drawing-polygon") {
      // Add point to the polygon
      if (tempPolygonPoints.length > 2) {
        // Check if clicking close to the first point to close the polygon
        const firstPoint = tempPolygonPoints[0];
        const distance = Math.sqrt(
          Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2)
        );

        if (distance < 20) {
          // Close enough to the first point
          // Create new polygon ROI
          const newRoi: PolygonROI = {
            id: generateId(),
            type: "polygon",
            points: [...tempPolygonPoints],
          };

          setRois([...rois, newRoi]);
          setSelectedRoiId(newRoi.id);
          setDrawingMode("idle");
          setTempPolygonPoints([]);
          return;
        }
      }

      // Add new point
      setTempPolygonPoints([...tempPolygonPoints, { x, y }]);
    }
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawingMode === "drawing-rectangle") {
      setTempEndPoint({ x, y });
    } else if (
      drawingMode === "drawing-polygon" &&
      tempPolygonPoints.length > 0
    ) {
      setTempEndPoint({ x, y });
    } else if (drawingMode === "moving" && selectedRoiId && dragOffset) {
      // Update the position of the selected ROI
      setRois(
        rois.map((roi) => {
          if (roi.id !== selectedRoiId) return roi;

          // Get canvas boundaries
          const canvas = canvasRef.current;
          if (!canvas) return roi;

          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;

          if (roi.type === "rectangle") {
            // Calculate new position
            const newX = x - dragOffset.x;
            const newY = y - dragOffset.y;

            // Check if the rectangle would go out of bounds
            const wouldExceedBoundaries =
              newX < 0 ||
              newY < 0 ||
              newX + roi.width > canvasWidth ||
              newY + roi.height > canvasHeight;

            // Only move if it stays within boundaries
            if (!wouldExceedBoundaries) {
              return {
                ...roi,
                x: newX,
                y: newY,
              };
            } else {
              // Keep rectangle within bounds
              return {
                ...roi,
                x: Math.max(0, Math.min(canvasWidth - roi.width, newX)),
                y: Math.max(0, Math.min(canvasHeight - roi.height, newY)),
              };
            }
          } else if (roi.type === "polygon" && tempStartPoint) {
            // Calculate the movement delta since the initial click
            const dx = x - tempStartPoint.x;
            const dy = y - tempStartPoint.y;

            // Check if any point would go outside boundaries after move
            const wouldExceedBoundaries = roi.points.some((point) => {
              const newX = point.x + dx;
              const newY = point.y + dy;
              return (
                newX < 0 ||
                newX > canvasWidth ||
                newY < 0 ||
                newY > canvasHeight
              );
            });

            // Only move if all points remain within boundaries
            if (!wouldExceedBoundaries) {
              // Move all polygon points by the delta
              return {
                ...roi,
                points: roi.points.map((point) => ({
                  x: point.x + dx,
                  y: point.y + dy,
                })),
              };
            } else {
              // Return the original polygon if movement would exceed boundaries
              return roi;
            }
          }

          return roi;
        })
      );

      // Update tempStartPoint for next movement calculation
      if (tempStartPoint) {
        setTempStartPoint({ x, y });
      }
    } else if (
      drawingMode === "resizing" &&
      selectedRoiId &&
      resizeHandle &&
      tempStartPoint
    ) {
      // Handle resizing for rectangle ROI
      setRois(
        rois.map((roi) => {
          if (roi.id !== selectedRoiId || roi.type !== "rectangle") return roi;

          let newX = roi.x;
          let newY = roi.y;
          let newWidth = roi.width;
          let newHeight = roi.height;

          switch (resizeHandle) {
            case "top-left":
              newX = x;
              newY = y;
              newWidth = roi.width + (roi.x - x);
              newHeight = roi.height + (roi.y - y);
              break;
            case "top-right":
              newY = y;
              newWidth = x - roi.x;
              newHeight = roi.height + (roi.y - y);
              break;
            case "bottom-left":
              newX = x;
              newWidth = roi.width + (roi.x - x);
              newHeight = y - roi.y;
              break;
            case "bottom-right":
              newWidth = x - roi.x;
              newHeight = y - roi.y;
              break;
          }

          return {
            ...roi,
            x: newWidth > 0 ? newX : roi.x + newWidth,
            y: newHeight > 0 ? newY : roi.y + newHeight,
            width: Math.abs(newWidth),
            height: Math.abs(newHeight),
          };
        })
      );
    } else if (
      drawingMode === "editing-polygon-point" &&
      selectedRoiId &&
      selectedPointIndex !== null
    ) {
      // Update the position of the selected polygon point
      setRois(
        rois.map((roi) => {
          if (roi.id !== selectedRoiId || roi.type !== "polygon") return roi;

          // Get canvas boundaries
          const canvas = canvasRef.current;
          if (!canvas) return roi;

          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;

          // Make sure the new point position stays within canvas boundaries
          const boundedX = Math.max(0, Math.min(x, canvasWidth));
          const boundedY = Math.max(0, Math.min(y, canvasHeight));

          // Create a new array of points with the updated point
          const newPoints = [...roi.points];
          newPoints[selectedPointIndex] = { x: boundedX, y: boundedY };

          return {
            ...roi,
            points: newPoints,
          };
        })
      );
    } else if (drawingMode === "idle") {
      // Hover effect for resize handles and polygon points
      const canvas = canvasRef.current;
      if (canvas && selectedRoiId) {
        const selectedRoi = rois.find((r) => r.id === selectedRoiId);
        if (selectedRoi && selectedRoi.type === "rectangle") {
          const handle = getResizeHandleAtPosition(x, y, selectedRoi);
          canvas.style.cursor = handle ? "pointer" : "default";
        } else if (selectedRoi && selectedRoi.type === "polygon") {
          // Check if mouse is over a polygon point
          const pointIndex = getPolygonPointAtPosition(x, y, selectedRoi);
          canvas.style.cursor = pointIndex !== -1 ? "pointer" : "default";
        }
      } else {
        if (canvas) {
          canvas.style.cursor = "default";
        }
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (drawingMode === "drawing-rectangle" && tempStartPoint && tempEndPoint) {
      // Create new rectangle ROI
      const x = Math.min(tempStartPoint.x, tempEndPoint.x);
      const y = Math.min(tempStartPoint.y, tempEndPoint.y);
      const width = Math.abs(tempEndPoint.x - tempStartPoint.x);
      const height = Math.abs(tempEndPoint.y - tempStartPoint.y);

      if (width > 5 && height > 5) {
        // Only create if it has some size
        const newRoi: RectangleROI = {
          id: generateId(),
          type: "rectangle",
          x,
          y,
          width,
          height,
        };

        setRois([...rois, newRoi]);
        setSelectedRoiId(newRoi.id);
      }

      setDrawingMode("idle");
      setTempStartPoint(null);
      setTempEndPoint(null);
    } else if (drawingMode === "moving" || drawingMode === "resizing") {
      setDrawingMode("idle");
      setDragOffset(null);
      setResizeHandle(null);
      setTempStartPoint(null);
    } else if (drawingMode === "editing-polygon-point") {
      // Finish editing polygon point
      setDrawingMode("idle");
      setSelectedPointIndex(null);
      setTempStartPoint(null);
    }
  };

  // Handle key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Delete selected ROI
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRoiId) {
        setRois(rois.filter((roi) => roi.id !== selectedRoiId));
        setSelectedRoiId(null);
      }

      // Cancel drawing polygon
      if (e.key === "Escape") {
        if (drawingMode === "drawing-polygon") {
          setDrawingMode("idle");
          setTempPolygonPoints([]);
          setTempEndPoint(null);
        }
      }

      // Complete polygon with Enter
      if (
        e.key === "Enter" &&
        drawingMode === "drawing-polygon" &&
        tempPolygonPoints.length > 2
      ) {
        const newRoi: PolygonROI = {
          id: generateId(),
          type: "polygon",
          points: [...tempPolygonPoints],
        };

        setRois([...rois, newRoi]);
        setSelectedRoiId(newRoi.id);
        setDrawingMode("idle");
        setTempPolygonPoints([]);
        setTempEndPoint(null);
      }
    },
    [rois, selectedRoiId, drawingMode, tempPolygonPoints]
  );

  // Export ROIs as JSON
  const exportROIs = () => {
    const exportData = rois.map((roi) => {
      if (roi.type === "rectangle") {
        return {
          id: roi.id,
          type: roi.type,
          x: roi.x,
          y: roi.y,
          width: roi.width,
          height: roi.height,
        };
      } else {
        return {
          id: roi.id,
          type: roi.type,
          points: roi.points,
        };
      }
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "roi-export.json";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Set up canvas and event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (canvas && container && imageLoaded) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      drawCanvas();

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [drawCanvas, imageLoaded, handleKeyDown]);

  // Redraw canvas when state changes
  useEffect(() => {
    drawCanvas();
  }, [
    rois,
    selectedRoiId,
    drawingMode,
    tempStartPoint,
    tempEndPoint,
    tempPolygonPoints,
    drawCanvas,
  ]);
  
  // Show popover when a ROI is selected or created
  useEffect(() => {
    if (selectedRoiId && drawingMode === 'idle') {
      // Use the last click position for the popover location
      setPopoverPosition(lastClickPosition);
      
      // Open the popover
      setPopoverOpen(true);
    } else {
      // Close the popover when no ROI is selected
      setPopoverOpen(false);
    }
  }, [selectedRoiId, drawingMode, lastClickPosition]);

  return (
    <div className="roi-drawing-container">
      <h1>ROI Drawing Tool</h1>

      <div className="toolbar">
        <div className="shape-selector">
          <label>
            <input
              type="radio"
              name="shape"
              checked={currentShape === "rectangle"}
              onChange={() => setCurrentShape("rectangle")}
            />
            Rectangle
          </label>
          <label>
            <input
              type="radio"
              name="shape"
              checked={currentShape === "polygon"}
              onChange={() => setCurrentShape("polygon")}
            />
            Polygon
          </label>
        </div>

        <button onClick={() => exportROIs()}>Export JSON</button>
        <button
          onClick={() => {
            if (selectedRoiId) {
              setRois(rois.filter((roi) => roi.id !== selectedRoiId));
              setSelectedRoiId(null);
            }
          }}
        >
          Delete Selected
        </button>
        <button
          onClick={() => {
            setRois([]);
            setSelectedRoiId(null);
          }}
        >
          Clear All
        </button>
      </div>

      <div
        className="canvas-container"
        ref={containerRef}
        style={{
          position: "relative",
          width: "800px",
          height: "600px",
          border: "1px solid #ccc",
        }}
      >
        <img
          src={imageUrl}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          onLoad={() => setImageLoaded(true)}
          alt="Background"
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        
        {/* Invisible div that serves as an anchor for the popover */}
        <div 
          ref={(el) => setPopoverAnchorRef(el)}
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            left: `${popoverPosition.x}px`,
            top: `${popoverPosition.y}px`,
            pointerEvents: "none"
          }}
        />
        
        {/* Custom popover at last click position */}
        {popoverOpen && selectedRoiId && (
          <div 
            className="custom-popover"
            style={{
              position: "absolute",
              left: `${popoverPosition.x}px`,
              top: `${popoverPosition.y}px`,
              zIndex: 50,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "12px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
              minWidth: "200px"
            }}
          >
            <div>
              <h4 className="font-bold mb-2">ROI Details</h4>
              <p><span className="font-medium">ID:</span> {selectedRoiId}</p>
              
              {(() => {
                const selectedRoi = rois.find(roi => roi.id === selectedRoiId);
                if (selectedRoi?.type === "rectangle") {
                  return (
                    <>
                      <p className="mb-1"><span className="font-medium">Type:</span> Rectangle</p>
                      <p className="mb-1"><span className="font-medium">X:</span> {selectedRoi.x.toFixed(0)}</p>
                      <p className="mb-1"><span className="font-medium">Y:</span> {selectedRoi.y.toFixed(0)}</p>
                      <p className="mb-1"><span className="font-medium">Width:</span> {selectedRoi.width.toFixed(0)}</p>
                      <p className="mb-1"><span className="font-medium">Height:</span> {selectedRoi.height.toFixed(0)}</p>
                    </>
                  );
                } else if (selectedRoi?.type === "polygon") {
                  return (
                    <>
                      <p className="mb-1"><span className="font-medium">Type:</span> Polygon</p>
                      <p className="mb-1"><span className="font-medium">Points:</span> {selectedRoi.points.length}</p>
                    </>
                  );
                }
                return null;
              })()}
              <div className="mt-2">
                <button 
                  className="px-2 py-1 bg-blue-500 text-white text-sm rounded"
                  onClick={() => setPopoverOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="border p-2">
        <pre>{JSON.stringify(rois, null, 2)}</pre>
      </div>
      {selectedRoiId && (
        <div className="selected-roi-info">
          <h3>Selected ROI</h3>
          <p>ID: {selectedRoiId}</p>
          {rois.find((roi) => roi.id === selectedRoiId)?.type ===
          "rectangle" ? (
            <p>Type: Rectangle</p>
          ) : (
            <p>Type: Polygon</p>
          )}
        </div>
      )}

      <style jsx>{`
        .roi-drawing-container {
          font-family: Arial, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }

        .toolbar {
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .shape-selector {
          display: flex;
          gap: 15px;
          margin-right: 20px;
        }

        button {
          padding: 8px 16px;
          background-color: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:hover {
          background-color: #45a049;
        }

        .canvas-container {
          margin-bottom: 20px;
        }

        .instructions {
          margin-top: 20px;
          padding: 10px;
          background-color: #222222;
          border-radius: 4px;
        }

        .selected-roi-info {
          margin-top: 20px;
          padding: 10px;
          background-color: #e6f7ff;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
