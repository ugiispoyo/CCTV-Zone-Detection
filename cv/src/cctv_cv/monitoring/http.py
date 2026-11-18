from collections.abc import Callable

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .preview import PreviewHub


def create_http_app(previews: PreviewHub, readiness: Callable[[], bool]) -> FastAPI:
    app = FastAPI(title="CCTV CV Service", version="0.1.0")

    @app.get("/health/live")
    async def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready() -> dict[str, str]:
        if not readiness():
            raise HTTPException(status_code=503, detail="configuration not loaded")
        return {"status": "ready"}

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.post("/api/v1/previews/{camera_id}/demand", status_code=202)
    async def preview_demand(camera_id: str) -> dict[str, bool]:
        await previews.touch(camera_id)
        return {"accepted": True}

    @app.get("/api/v1/previews/{camera_id}/mjpeg", include_in_schema=False)
    async def mjpeg(camera_id: str) -> StreamingResponse:
        await previews.touch(camera_id)
        return StreamingResponse(
            previews.stream(camera_id),
            media_type="multipart/x-mixed-replace; boundary=frame",
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/v1/previews/{camera_id}", response_class=HTMLResponse)
    async def preview_page(camera_id: str) -> str:
        await previews.touch(camera_id)
        return f"""<!doctype html><html><head><style>
html,body,img{{margin:0;width:100%;height:100%;background:#0b1117;object-fit:contain;overflow:hidden}}
</style></head><body><img src='/api/v1/previews/{camera_id}/mjpeg'></body></html>"""

    return app
