
import { createBrowserRouter } from "react-router-dom";

import { ROIDrawingTool, HeatMap } from "./component";


const router = createBrowserRouter([
  {
    path: "/heatmap",
    element: <HeatMap />,
  },
  {
    path: "/roi-drawing-tool",
    element: <ROIDrawingTool />,
  }
]);
export default router;