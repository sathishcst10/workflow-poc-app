import { useEffect, useRef, useState } from "react";

export default function HeatMap() {
    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const heatmapRef = useRef(null);

    const [ready, setReady] = useState({
        scriptLoaded: false,
        imageLoaded: false,
    });

    // ✅ Load heatmap.js script dynamically (idempotent)
    useEffect(() => {
        const existing = document.querySelector('script[src="/heatmap.js"]');
        if (!existing) {
            const script = document.createElement("script");
            script.src = "/heatmap.js";
            script.onload = () => {
                console.log("✅ heatmap.js loaded");
                setReady((prev) => ({ ...prev, scriptLoaded: true }));
            };
            document.body.appendChild(script);
        } else {
            setReady((prev) => ({ ...prev, scriptLoaded: true }));
        }
    }, []);

    // ✅ When both script and image are loaded, and container has size, init heatmap
    useEffect(() => {
        if (!ready.scriptLoaded || !ready.imageLoaded || !containerRef.current || !window.h337)
            return;

        const container = containerRef.current;

        const init = () => {
            const width = container.offsetWidth;
            const height = container.offsetHeight;

            if (width === 0 || height === 0) {
                console.warn("Container not sized yet, retrying...");
                setTimeout(init, 50); // retry until layout complete
                return;
            }

            console.log("✅ Creating heatmap with size", width, height);

            const heatmap = window.h337.create({
                container,
                radius: 30,
                maxOpacity: 0.6,
                minOpacity: 0.1,
                blur: 0.9,
            });

            heatmapRef.current = heatmap;

            const points = [];
            const max = 10; // max value for heatmap
            let len = 50; // updated length for points

            while (len--) {
                const val = Math.floor(Math.random() * 20);
                const point = {
                    x: Math.floor(Math.random() * width),
                    y: Math.floor(Math.random() * height),
                    value: val,
                };
                points.push(point);
            }

            heatmap.setData({ max, data: points });
            console.log("✅ Heatmap rendered");
        };

        init();
    }, [ready]);

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "1280px",
                height: "720px",
                overflow: "hidden",
                border: "2px dashed blue",
            }}
        >
            <img
                ref={imageRef}
                src="https://kamerai-wsa-demo.s3.ap-south-1.amazonaws.com/tickets/media/images/AreaControlMonitor/2024/1205/13/collab_P1_133825_0.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250411T095358Z&X-Amz-SignedHeaders=host&X-Amz-Expires=86400&X-Amz-Credential=AKIARE3WVEQIEYV3EZHJ%2F20250411%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Signature=cbacabfe3a756633b797ccb3a779071431eb65415f5c79f24ce35f11d92c3fd2" // make sure it's in public/
                onLoad={() => {
                    console.log("✅ Image loaded");
                    setReady((prev) => ({ ...prev, imageLoaded: true }));
                }}
                alt="heatmap"
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    zIndex: 0,
                }}
            />
        </div>
    );
}
