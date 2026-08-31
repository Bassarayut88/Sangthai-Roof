// ============================================================
// ตัวแก้ไขรูปหลายเหลี่ยมแบบคลิกวาด (Polygon Click-Draw & AutoCAD Studio Engine)
// รองรับทั้ง:
//   1. พรีวิวขนาดกะทัดรัดบนหน้าจอหลัก (#polyDrawCanvas)
//   2. หน้าต่างเขียนแบบเต็มจอ สไตล์ AutoCAD 2D Studio (#cadStudioCanvas)
//      - Infinite Pan & Zoom (ลูกกลิ้งเมาส์ / Spacebar)
//      - Direct Distance Entry (พิมพ์ระยะความยาวแล้ว Enter)
//      - OSNAP (Object Snap: Endpoint ■, Midpoint ▲, Grid)
//      - Ortho Mode (F8 / Shift: ล็อกแนวแกนฉาก 90°)
//      - AutoCAD Full Crosshair Cursor & Dynamic HUD
//      - Interactive Draggable Start Seam (คลิกลาก/จิ้มเลือกจุดเริ่มมุงบนภาพ)
//      - Live Sheet Layout Overlay (จำลองแผ่นเมทัลชีทและลูกศรตัดสดๆ บน CAD)
// ============================================================

// --- สถานะพรีวิวในหน้าจอหลัก ---
let polyHover = null;
let polyView = { scale: 40, ox: 40, oy: 40 };
let polyEditorBound = false;
let isShiftPressed = false;
let orthoModeActive = false;
let draggingPointIndex = -1;
let lastMousePos = { x: 0, y: 0 };
let isDraggingStartSeam = false;
let polyHoveredPointIdx = -1; // ดัชนีจุดที่เมาส์ชี้อยู่
let polyDrawingMode = true; // โหมดคำสั่งวาดเส้น (LINE Mode) - สไตล์ AutoCAD

// --- ประวัติ Undo / Redo & คำสั่ง AutoCAD ---
let cadHistory = [];
let cadRedoStack = [];
let cadActivePromptType = null;
let cadHoveredEdge = -1;
let selectedEdgeForOffset = -1;
let cadOffsetSelectingEdge = false;
let polyInlineTrackingGuides = [];

// --- ภาพพื้นหลังแบบแปลน / PDF Underlay & Calibrate Scale ---
let cadBgImage = {
    img: null,            // HTMLImageElement or Canvas
    x: 0,                 // World X position (meters)
    y: 10,                // World Y position (meters)
    width: 10,            // World width (meters)
    height: 10,           // World height (meters)
    opacity: 0.55,
    visible: true,
    locked: true,         // Default locked once placed
    aspectRatio: 1,
    fileName: '',
    pdfDoc: null,
    pdfPage: 1,
    pdfTotalPages: 1
};

let cadCalibrateState = {
    active: false,
    step: 0,              // 0: idle, 1: wait for pt1, 2: wait for pt2
    pt1: null,            // World coordinates { x, y }
    pt2: null
};

let cadMeasureState = {
    active: false,
    step: 0,              // 0: idle, 1: wait for pt1, 2: wait for pt2
    pt1: null,            // World coordinates { x, y }
    pt2: null,
    result: null          // { dist, dx, dy, angle }
};

let cadArcState = {
    active: false,
    step: 0,              // 0: idle, 1: wait for pt1, 2: wait for pt2 (apex), 3: wait for pt3 (end)
    pt1: null,            // World coordinates { x, y }
    pt2: null,
    pt3: null
};

// --- ระบบเส้นไกด์ไลน์ช่วยร่างแบบ (CAD Guidelines / Construction Lines / XLINE) ---
let cadGuideLines = []; // [{ id, p1: {x,y}, p2: {x,y}, dx, dy, type: '2pt'|'h'|'v', label }]
let cadGuideState = {
    active: false,
    step: 0,              // 0: idle, 1: wait for pt1, 2: wait for pt2
    pt1: null,
    pt2: null
};
let cadShowGuides = true;

let cadDraggingBgImage = false;
let cadBgDragStart = { mouseX: 0, mouseY: 0, imgX: 0, imgY: 0 };
let cadFloatingBgPanelVisible = true;

// --- สถานะ AutoCAD Studio เต็มจอ ---
let cadStudioOpen = false;
let cadTheme = 'dark'; // 'dark' | 'light'
let cadOrtho = false;
let cadSnap = true;
let cadGrid = true;
let cadShowCoords = false;
let cadOverlay = true;
let cadView = { scale: 50, ox: 0, oy: 0 };
let cadPan = { isPanning: false, startX: 0, startY: 0, startOx: 0, startOy: 0 };
let cadHover = { x: 0, y: 0, snapType: null, snapPt: null, rawX: 0, rawY: 0, trackingGuides: [] };
let cadMouseScreen = { x: 0, y: 0 };
let cadDraggingIndex = -1;
let cadDragStartPos = null;
let cadDraggingStartSeam = false;
let cadActiveTool = 'polyline';
let cadEventsBound = false;

function getPolyStep() {
    let el = document.getElementById('polyGridStep');
    let v = el ? parseFloat(el.value) : 0.5;
    return (v > 0) ? v : 0.5;
}

function saveCadState() {
    cadHistory.push({
        points: JSON.parse(JSON.stringify(polygonPoints)),
        startSeamX: polyStartSeamX
    });
    if (cadHistory.length > 50) cadHistory.shift();
    cadRedoStack = [];
}

function cadUndo() {
    if (cadHistory.length === 0) {
        if (polygonPoints.length > 0) {
            polygonPoints.pop();
            renderPointList();
            redrawPolyEditor();
            if (cadStudioOpen) redrawCadStudio();
            if (calcData.calculated && currentMode === 'polygon') calculate();
        }
        return;
    }
    cadRedoStack.push({
        points: JSON.parse(JSON.stringify(polygonPoints)),
        startSeamX: polyStartSeamX
    });
    let state = cadHistory.pop();
    polygonPoints = state.points;
    polyStartSeamX = state.startSeamX;
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    if (calcData.calculated && currentMode === 'polygon') calculate();
    showWarning("↩ ย้อนกลับ (Undo)");
}

function cadRedo() {
    if (cadRedoStack.length === 0) return;
    cadHistory.push({
        points: JSON.parse(JSON.stringify(polygonPoints)),
        startSeamX: polyStartSeamX
    });
    let state = cadRedoStack.pop();
    polygonPoints = state.points;
    polyStartSeamX = state.startSeamX;
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    if (calcData.calculated && currentMode === 'polygon') calculate();
    showWarning("↪ ทำซ้ำ (Redo)");
}

function polyUndo() {
    cadUndo();
}

// ------------------------------------------------------------
// อัลกอริทึมคำสั่ง AutoCAD (OFFSET, MIRROR, ROTATE, SCALE, MOVE)
// ------------------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
    let dx = bx - ax;
    let dy = by - ay;
    let l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    let projX = ax + t * dx;
    let projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
}

function findHoveredEdge(screenX, screenY, worldToScreenFn) {
    if (!polygonPoints || polygonPoints.length < 3) return -1;
    let n = polygonPoints.length;
    let minDist = 14;
    let bestEdge = -1;

    for (let i = 0; i < n; i++) {
        let p1 = polygonPoints[i];
        let p2 = polygonPoints[(i + 1) % n];
        let s1 = worldToScreenFn(p1.x, p1.y);
        let s2 = worldToScreenFn(p2.x, p2.y);
        let d = distToSegment(screenX, screenY, s1.x, s1.y, s2.x, s2.y);
        if (d < minDist) {
            minDist = d;
            bestEdge = i;
        }
    }
    return bestEdge;
}

// 1. OFFSET (ออฟเซ็ตเส้นขอบหลังคา: ทั้งแบบทุกด้าน และแบบเฉพาะเส้นที่เลือก)
function polyOffsetPolygon(points, d) {
    if (!points || points.length < 3 || d === 0) return points;
    let n = points.length;

    let area = 0;
    for (let i = 0; i < n; i++) {
        let j = (i + 1) % n;
        area += (points[i].x * points[j].y - points[j].x * points[i].y);
    }
    let isCCW = area > 0;

    let offsetLines = [];
    for (let i = 0; i < n; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % n];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let len = Math.hypot(dx, dy);
        if (len < 1e-6) len = 1e-6;

        let tx = dx / len;
        let ty = dy / len;
        let nx = isCCW ? ty : -ty;
        let ny = isCCW ? -tx : tx;

        let ox = p1.x + d * nx;
        let oy = p1.y + d * ny;

        offsetLines.push({ ox, oy, tx, ty });
    }

    let newPts = [];
    for (let i = 0; i < n; i++) {
        let prev = offsetLines[(i - 1 + n) % n];
        let curr = offsetLines[i];

        let denom = prev.tx * curr.ty - prev.ty * curr.tx;
        if (Math.abs(denom) > 1e-5) {
            let dx = curr.ox - prev.ox;
            let dy = curr.oy - prev.oy;
            let t = (dx * curr.ty - dy * curr.tx) / denom;
            let ix = prev.ox + t * prev.tx;
            let iy = prev.oy + t * prev.ty;
            newPts.push({
                x: Math.round(ix * 1000) / 1000,
                y: Math.round(iy * 1000) / 1000
            });
        } else {
            newPts.push({
                x: Math.round(curr.ox * 1000) / 1000,
                y: Math.round(curr.oy * 1000) / 1000
            });
        }
    }
    return newPts;
}

// ออฟเซ็ตเฉพาะเส้นที่เลือก (Single Selected Edge Offset)
function polyOffsetSingleEdge(points, edgeIndex, d) {
    if (!points || points.length < 3 || d === 0 || edgeIndex < 0 || edgeIndex >= points.length) return points;
    let n = points.length;
    let pts = points.map(p => ({ x: p.x, y: p.y }));

    let area = 0;
    for (let i = 0; i < n; i++) {
        let j = (i + 1) % n;
        area += (pts[i].x * pts[j].y - pts[j].x * pts[i].y);
    }
    let isCCW = area > 0;

    let i = edgeIndex;
    let j = (i + 1) % n;
    let h = (i - 1 + n) % n;
    let k = (j + 1) % n;

    let p1 = pts[i];
    let p2 = pts[j];

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) return points;

    let tx = dx / len;
    let ty = dy / len;
    let nx = isCCW ? ty : -ty;
    let ny = isCCW ? -tx : tx;

    let ox = p1.x + d * nx;
    let oy = p1.y + d * ny;

    let prevDx = p1.x - pts[h].x;
    let prevDy = p1.y - pts[h].y;
    let prevLen = Math.hypot(prevDx, prevDy);
    let prevTx = prevLen > 1e-6 ? prevDx / prevLen : 0;
    let prevTy = prevLen > 1e-6 ? prevDy / prevLen : 0;

    let denom1 = prevTx * ty - prevTy * tx;
    if (Math.abs(denom1) > 1e-5) {
        let dX = ox - pts[h].x;
        let dY = oy - pts[h].y;
        let t1 = (dX * ty - dY * tx) / denom1;
        pts[i] = {
            x: Math.round((pts[h].x + t1 * prevTx) * 1000) / 1000,
            y: Math.round((pts[h].y + t1 * prevTy) * 1000) / 1000
        };
    } else {
        pts[i] = {
            x: Math.round((p1.x + d * nx) * 1000) / 1000,
            y: Math.round((p1.y + d * ny) * 1000) / 1000
        };
    }

    let nextDx = pts[k].x - p2.x;
    let nextDy = pts[k].y - p2.y;
    let nextLen = Math.hypot(nextDx, nextDy);
    let nextTx = nextLen > 1e-6 ? nextDx / nextLen : 0;
    let nextTy = nextLen > 1e-6 ? nextDy / nextLen : 0;

    let denom2 = tx * nextTy - ty * nextTx;
    if (Math.abs(denom2) > 1e-5) {
        let dX = pts[k].x - ox;
        let dY = pts[k].y - oy;
        let t2 = (dX * nextTy - dY * nextTx) / denom2;
        pts[j] = {
            x: Math.round((ox + t2 * tx) * 1000) / 1000,
            y: Math.round((oy + t2 * ty) * 1000) / 1000
        };
    } else {
        pts[j] = {
            x: Math.round((p2.x + d * nx) * 1000) / 1000,
            y: Math.round((p2.y + d * ny) * 1000) / 1000
        };
    }

    let minX = Math.min(...pts.map(p => p.x));
    let minY = Math.min(...pts.map(p => p.y));
    if (minX < 0 || minY < 0) {
        let shiftX = minX < 0 ? -minX : 0;
        let shiftY = minY < 0 ? -minY : 0;
        pts = pts.map(p => ({
            x: Math.round((p.x + shiftX) * 1000) / 1000,
            y: Math.round((p.y + shiftY) * 1000) / 1000
        }));
    }

    return pts;
}

function applyPolygonOffset(d) {
    if (!polygonPoints || polygonPoints.length < 3) {
        showWarning("ต้องมีจุดอย่างน้อย 3 จุดจึงจะออฟเซ็ตได้");
        return;
    }
    saveCadState();
    let newPts = polyOffsetPolygon(polygonPoints, d);
    
    let minX = Math.min(...newPts.map(p => p.x));
    let minY = Math.min(...newPts.map(p => p.y));
    if (minX < 0 || minY < 0) {
        let shiftX = minX < 0 ? -minX : 0;
        let shiftY = minY < 0 ? -minY : 0;
        newPts = newPts.map(p => ({
            x: Math.round((p.x + shiftX) * 1000) / 1000,
            y: Math.round((p.y + shiftY) * 1000) / 1000
        }));
    }

    polygonPoints = newPts;
    setDrawingMode(false);
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
    calculate();
    showWarning(`📐 ออฟเซ็ตขอบหลังคาทุกด้าน ${d >= 0 ? '+' : ''}${d.toFixed(2)} ม. เรียบร้อย`);
}

function applySingleEdgeOffset(edgeIndex, d) {
    if (!polygonPoints || polygonPoints.length < 3 || edgeIndex < 0 || edgeIndex >= polygonPoints.length) return;
    saveCadState();
    polygonPoints = polyOffsetSingleEdge(polygonPoints, edgeIndex, d);
    cadOffsetSelectingEdge = false;
    cadHoveredEdge = -1;
    setDrawingMode(false);
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
    calculate();
    let p1 = polygonPoints[edgeIndex];
    let p2 = polygonPoints[(edgeIndex + 1) % polygonPoints.length];
    let len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    showWarning(`✓ ออฟเซ็ตเส้นด้านที่ ${edgeIndex + 1} (ยาว ${len.toFixed(2)} ม.) ระยะ ${d >= 0 ? '+' : ''}${d.toFixed(2)} ม. เรียบร้อย`);
}

// ปรับเปลี่ยนความยาวของเส้นด้านที่กำหนด (Adjust Edge Length)
function applyEdgeLength(edgeIndex, newLen) {
    if (!polygonPoints || polygonPoints.length < 2 || isNaN(newLen) || newLen <= 0) return;
    let n = polygonPoints.length;
    if (edgeIndex < 0 || edgeIndex >= n) return;

    saveCadState();
    let i = edgeIndex;
    let j = (i + 1) % n;
    let p1 = polygonPoints[i];
    let p2 = polygonPoints[j];

    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let oldLen = Math.hypot(dx, dy);
    if (oldLen < 1e-6) return;

    let angle = Math.atan2(dy, dx);
    let targetX = Math.round((p1.x + newLen * Math.cos(angle)) * 1000) / 1000;
    let targetY = Math.round((p1.y + newLen * Math.sin(angle)) * 1000) / 1000;

    polygonPoints[j] = { x: targetX, y: targetY };

    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    if (calcData.calculated) calculate();

    showWarning(`✓ ปรับความยาวเส้นด้านที่ ${edgeIndex + 1} จาก ${oldLen.toFixed(2)} ม. เป็น ${newLen.toFixed(2)} ม. เรียบร้อย`);
}

function startCadOffsetCommand() {
    if (!polygonPoints || polygonPoints.length < 3) {
        showWarning("ต้องมีจุดอย่างน้อย 3 จุดก่อนจึงจะใช้คำสั่ง OFFSET ได้");
        return;
    }
    cadOffsetSelectingEdge = true;
    selectedEdgeForOffset = -1;
    cadHoveredEdge = -1;
    setDrawingMode(false);
    showWarning("📐 OFFSET: เลื่อนเมาส์ไปชี้เส้นที่ต้องการ แล้วคลิกเลือกเส้น (หรือกด Esc เพื่อยกเลิก)");
    updateCadStatusText();
    redrawCadStudio();
    redrawPolyEditor();
}

// ------------------------------------------------------------
// ระบบนำเข้ารูปภาพ / PDF แบบแปลน & CALIBRATE SCALE
// ------------------------------------------------------------

function toggleCadFloatingBgPanel(show) {
    if (show === undefined) {
        cadFloatingBgPanelVisible = !cadFloatingBgPanelVisible;
    } else {
        cadFloatingBgPanelVisible = !!show;
    }
    updateCadBgControlUI();
}

function triggerCadBgUpload() {
    if (cadStudioOpen && cadBgImage.img && !cadFloatingBgPanelVisible) {
        toggleCadFloatingBgPanel(true);
        showWarning("🖼️ เปิดแถบควบคุมแบบแปลน");
        return;
    }
    let input = document.getElementById('cadBgFileInput');
    if (input) {
        input.value = '';
        input.click();
    }
}

function handleCadBgFileSelect(evt) {
    const file = evt.target.files[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        loadCadBgPdf(file);
    } else if (file.type.startsWith('image/')) {
        loadCadBgImage(file);
    } else {
        showWarning("⚠️ กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WEBP) หรือไฟล์ PDF");
    }
}

function loadCadBgImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let aspect = img.naturalWidth / img.naturalHeight;
            let initW = 12; // ขนาดเริ่มต้น 12 เมตร
            let initH = initW / aspect;

            cadBgImage = {
                img: img,
                x: 0,
                y: initH,
                width: initW,
                height: initH,
                opacity: 0.55,
                visible: true,
                locked: true,
                aspectRatio: aspect,
                fileName: file.name,
                pdfDoc: null,
                pdfPage: 1,
                pdfTotalPages: 1
            };

            cadFloatingBgPanelVisible = true;
            updateCadBgControlUI();
            redrawPolyEditor();
            if (cadStudioOpen) {
                cadZoomExtents();
                redrawCadStudio();
            }
            showWarning(`🖼️ โหลดภาพ ${file.name} สำเร็จ! กดปุ่ม "📏 Calibrate" เพื่อตั้งสเกลเมตรจริงตามแบบ`);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function loadCadBgPdf(file) {
    if (!window.pdfjsLib) {
        showWarning("⚠️ กำลังโหลดระบบอ่าน PDF กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        cadBgImage.pdfDoc = pdf;
        cadBgImage.pdfPage = 1;
        cadBgImage.pdfTotalPages = pdf.numPages;
        cadBgImage.fileName = file.name;
        cadFloatingBgPanelVisible = true;

        await renderPdfPageToBg(1);
        showWarning(`📄 โหลด PDF: ${file.name} (หน้า 1/${pdf.numPages}) สำเร็จ! กด "📏 Calibrate" เพื่อตั้งสเกล`);
    } catch (err) {
        console.error("PDF loading error:", err);
        showWarning("⚠️ ไม่สามารถเปิดไฟล์ PDF นี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ PDF ที่สมบูรณ์");
    }
}

async function renderPdfPageToBg(pageNum) {
    if (!cadBgImage.pdfDoc) return;
    try {
        const page = await cadBgImage.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // High-res 2x

        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const ctx = offCanvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        let aspect = viewport.width / viewport.height;
        let initW = 14;
        let initH = initW / aspect;

        cadBgImage.img = offCanvas;
        cadBgImage.pdfPage = pageNum;
        cadBgImage.aspectRatio = aspect;
        cadBgImage.x = 0;
        cadBgImage.y = initH;
        cadBgImage.width = initW;
        cadBgImage.height = initH;
        cadBgImage.visible = true;
        cadBgImage.locked = true;

        updateCadBgControlUI();
        redrawPolyEditor();
        if (cadStudioOpen) {
            cadZoomExtents();
            redrawCadStudio();
        }
    } catch (err) {
        console.error("PDF page render error:", err);
    }
}

function changeCadPdfPage(delta) {
    if (!cadBgImage.pdfDoc) return;
    let target = cadBgImage.pdfPage + delta;
    if (target >= 1 && target <= cadBgImage.pdfTotalPages) {
        renderPdfPageToBg(target);
    }
}

function goToCadPdfPage(val) {
    if (!cadBgImage.pdfDoc) return;
    let pageNum = parseInt(val);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= cadBgImage.pdfTotalPages) {
        renderPdfPageToBg(pageNum);
    } else {
        updateCadBgControlUI();
    }
}

function startCadCalibrateScale() {
    if (!cadBgImage.img) {
        showWarning("⚠️ กรุณานำเข้ารูปภาพหรือ PDF แบบแปลนก่อนตั้งสเกล");
        return;
    }
    // ถ้ากำลัง Calibrate อยู่ ให้คลิกเพื่อปิด/ยกเลิกโหมด Calibrate ได้ทันที
    if (cadCalibrateState.active) {
        cancelCadCalibrate();
        setDrawingMode(true);
        showWarning("⏹️ ปิดโหมด Calibrate เรียบร้อย (กลับสู่โหมดวาดเส้น Line)");
        return;
    }
    cadCalibrateState = {
        active: true,
        step: 1,
        pt1: null,
        pt2: null
    };
    setDrawingMode(false);
    showWarning("📏 CALIBRATE: คลิก 'จุดที่ 1' บนเส้นบอกขนาดในแบบแปลน (กด Calibrate อีกครั้งหรือกด Esc เพื่อปิด)");
    updateCadStatusText();
    updateCadBgControlUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function handleCalibratePointClick(worldPt) {
    if (cadCalibrateState.step === 1) {
        cadCalibrateState.pt1 = { x: worldPt.x, y: worldPt.y };
        cadCalibrateState.step = 2;
        showWarning("📏 CALIBRATE: คลิก 'จุดที่ 2' (กด Shift หรือ F8 เพื่อล็อกราบ/ดิ่ง, ปล่อยเพื่อลากเส้นอิสระ)");
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    } else if (cadCalibrateState.step === 2) {
        cadCalibrateState.pt2 = { x: worldPt.x, y: worldPt.y };
        let pt1 = cadCalibrateState.pt1;
        let pt2 = cadCalibrateState.pt2;
        let currentDist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);

        cadOpenCalibrateDialog(currentDist);
    }
}

function cadOpenCalibrateDialog(currentDist) {
    let overlay = document.getElementById('cadDialogOverlay');
    let titleEl = document.getElementById('cadDialogTitle');
    let descEl = document.getElementById('cadDialogDesc');
    let inputEl = document.getElementById('cadDialogInput');
    let tagsEl = document.getElementById('cadDialogTags');
    let unitEl = document.getElementById('cadDialogUnit');

    cadActivePromptType = 'calibrate';

    if (!overlay || !titleEl || !inputEl || !tagsEl) {
        let val = prompt(`📏 CALIBRATE: ระบุระยะจริงระหว่าง 2 จุดนี้ (เมตร) [ระยะปัจจุบัน ${currentDist.toFixed(2)} ม.]:`, currentDist.toFixed(2));
        if (val !== null) {
            applyCalibrateScale(parseFloat(val));
        } else {
            cancelCadCalibrate();
        }
        return;
    }

    overlay.style.display = 'flex';
    titleEl.innerHTML = '📏 CALIBRATE (ปรับสเกลภาพจากระยะจริง)';
    descEl.innerText = `ระบุระยะจริงระหว่าง 2 จุดที่คุณคลิกบนแบบแปลน (ระยะเดิมคือ ${currentDist.toFixed(2)} ม.)`;
    inputEl.value = currentDist.toFixed(2);
    if (unitEl) unitEl.innerText = 'เมตร';

    tagsEl.innerHTML = '';
    let presets = [
        { label: '3.00 ม.', val: 3.00 },
        { label: '4.00 ม.', val: 4.00 },
        { label: '5.00 ม.', val: 5.00 },
        { label: '6.00 ม.', val: 6.00 },
        { label: '8.00 ม.', val: 8.00 },
        { label: '10.00 ม.', val: 10.00 },
        { label: '12.00 ม.', val: 12.00 }
    ];
    presets.forEach(p => {
        let btn = document.createElement('button');
        btn.className = 'cad-quick-tag';
        btn.type = 'button';
        btn.innerText = p.label;
        btn.onclick = () => { inputEl.value = p.val; cadSubmitPrompt(); };
        tagsEl.appendChild(btn);
    });

    let actionsEl = overlay.querySelector('.cad-dialog-actions');
    if (actionsEl) {
        actionsEl.innerHTML = `
            <button type="button" class="btn-small" onclick="cadClosePrompt()" style="background:#27272a; color:#cbd5e1; border:1px solid #3f3f46; padding:6px 14px; border-radius:6px; font-size:0.82rem;">ยกเลิก (Esc)</button>
            <button type="button" class="cad-btn-apply" onclick="cadSubmitPrompt()" style="padding:6px 18px; font-size:0.85rem;">✓ ปรับสเกลจริง</button>
        `;
    }
    inputEl.style.display = 'block';
    if (unitEl) unitEl.style.display = 'inline';
    inputEl.focus();
    inputEl.select();
}

function applyCalibrateScale(realDistance) {
    if (!cadCalibrateState.pt1 || !cadCalibrateState.pt2 || isNaN(realDistance) || realDistance <= 0) {
        cancelCadCalibrate();
        return;
    }
    let pt1 = cadCalibrateState.pt1;
    let pt2 = cadCalibrateState.pt2;
    let measuredDist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
    if (measuredDist < 1e-4) {
        showWarning("⚠️ จุดที่ 1 และ 2 อยู่ใกล้กันเกินไป กรุณาลองใหม่อีกครั้ง");
        cancelCadCalibrate();
        return;
    }

    let scaleRatio = realDistance / measuredDist;

    // ขยายขนาดภาพโดยอิงจุด pt1 เป็นจุดตรึง
    cadBgImage.width *= scaleRatio;
    cadBgImage.height *= scaleRatio;
    cadBgImage.x = pt1.x - (pt1.x - cadBgImage.x) * scaleRatio;
    cadBgImage.y = pt1.y + (cadBgImage.y - pt1.y) * scaleRatio;

    cancelCadCalibrate();
    cadFloatingBgPanelVisible = false;
    updateCadBgControlUI();
    setDrawingMode(true);
    showWarning(`✓ ปรับสเกลภาพแบบแปลนเป็น ${realDistance.toFixed(2)} ม. เรียบร้อย! ซ่อนแถบควบคุมเพื่อเคลียร์หน้าจอและเปิดโหมดวาดเส้น (Line) พร้อมใช้งานทันที`);
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
}

function cancelCadCalibrate() {
    cadCalibrateState = { active: false, step: 0, pt1: null, pt2: null };
    updateCadStatusText();
    updateCadBgControlUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

// ------------------------------------------------------------
// เครื่องมือวัดระยะ (MEASURE / DISTANCE TOOL - DI)
// ------------------------------------------------------------

function startCadMeasure() {
    if (cadMeasureState.active) {
        cancelCadMeasure();
        setDrawingMode(true);
        showWarning("⏹️ ปิดเครื่องมือวัดระยะ (กลับสู่โหมดวาดเส้น LINE)");
        return;
    }
    cancelCadArc();
    cancelCadCalibrate();
    cadOffsetSelectingEdge = false;

    cadMeasureState = {
        active: true,
        step: 1,
        pt1: null,
        pt2: null,
        result: null
    };
    setDrawingMode(false);
    showWarning("📏 MEASURE (วัดระยะ): คลิก 'จุดที่ 1' ที่ต้องการวัด (กดปุ่ม DI อีกครั้งหรือกด Esc เพื่อปิด)");
    updateCadStatusText();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function cancelCadMeasure() {
    cadMeasureState = {
        active: false,
        step: 0,
        pt1: null,
        pt2: null,
        result: null
    };
    updateCadStatusText();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function handleMeasurePointClick(worldPt) {
    if (cadMeasureState.step === 1) {
        cadMeasureState.pt1 = { x: worldPt.x, y: worldPt.y };
        cadMeasureState.step = 2;
        cadMeasureState.result = null;
        showWarning("📏 MEASURE: คลิก 'จุดที่ 2' (กด Shift หรือ F8 เพื่อล็อกราบ/ดิ่ง, ปล่อยเพื่อวัดระยะอิสระ)");
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    } else if (cadMeasureState.step === 2) {
        cadMeasureState.pt2 = { x: worldPt.x, y: worldPt.y };
        let pt1 = cadMeasureState.pt1;
        let pt2 = cadMeasureState.pt2;
        let dist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
        let dx = Math.abs(pt2.x - pt1.x);
        let dy = Math.abs(pt2.y - pt1.y);
        let angle = (Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI + 360) % 360;

        cadMeasureState.result = { dist, dx, dy, angle };
        cadMeasureState.step = 0; // measurement complete, result remains visible
        showWarning(`📐 ผลวัดระยะ: ระยะตรง ${dist.toFixed(3)} ม. | ระยะราบ ΔX: ${dx.toFixed(3)} ม. | ระยะดิ่ง ΔY: ${dy.toFixed(3)} ม. | มุม: ${angle.toFixed(1)}°`);
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    }
}

// ------------------------------------------------------------
// เครื่องมือวาดเส้นโค้ง 3 จุด (3-POINT ARC TOOL - A / ARC)
// ------------------------------------------------------------

function calculate3PointArc(p1, p2, p3) {
    if (!p1 || !p2 || !p3) return null;
    let d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(d) < 1e-6) {
        return null; // 3 จุดอยู่ในแนวเส้นตรงเดียวกัน
    }
    let p1Sq = p1.x * p1.x + p1.y * p1.y;
    let p2Sq = p2.x * p2.x + p2.y * p2.y;
    let p3Sq = p3.x * p3.x + p3.y * p3.y;

    let cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
    let cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
    let radius = Math.hypot(p1.x - cx, p1.y - cy);

    let a1 = Math.atan2(p1.y - cy, p1.x - cx);
    let a2 = Math.atan2(p2.y - cy, p2.x - cx);
    let a3 = Math.atan2(p3.y - cy, p3.x - cx);

    function normalizeAngle(angle) {
        while (angle < 0) angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
        return angle;
    }

    let diff2 = normalizeAngle(a2 - a1);
    let diff3 = normalizeAngle(a3 - a1);

    let counterClockwise = (diff2 < diff3);
    let totalAngle = counterClockwise ? diff3 : (2 * Math.PI - diff3);
    let arcLength = radius * totalAngle;
    let chordWidth = Math.hypot(p3.x - p1.x, p3.y - p1.y);

    return {
        cx, cy, radius, a1, a2, a3, counterClockwise, totalAngle, arcLength, chordWidth
    };
}

function generateArcPoints(p1, p2, p3, maxSegmentDist = 0.35) {
    let arc = calculate3PointArc(p1, p2, p3);
    if (!arc) {
        return [{ x: p1.x, y: p1.y }, { x: p3.x, y: p3.y }];
    }
    let pts = [];
    let count = Math.max(8, Math.min(36, Math.ceil(arc.arcLength / maxSegmentDist)));
    for (let i = 0; i <= count; i++) {
        let t = i / count;
        let ang;
        if (arc.counterClockwise) {
            ang = arc.a1 + t * arc.totalAngle;
        } else {
            ang = arc.a1 - t * arc.totalAngle;
        }
        pts.push({
            x: Math.round((arc.cx + arc.radius * Math.cos(ang)) * 1000) / 1000,
            y: Math.round((arc.cy + arc.radius * Math.sin(ang)) * 1000) / 1000
        });
    }
    return pts;
}

function startCadArc() {
    if (cadArcState.active) {
        cancelCadArc();
        showWarning("⏹️ ยกเลิกคำสั่ง ARC (กลับสู่โหมดวาดเส้นตรง LINE)");
        return;
    }
    cancelCadMeasure();
    cancelCadCalibrate();
    cadOffsetSelectingEdge = false;

    // ปิดโหมด Line ชั่วคราวเพื่อให้เคอร์เซอร์และ HUD แสดงผลเป็นโหมด ARC 100%
    polyDrawingMode = false;
    let btnCadLine = document.getElementById('cadBtnLine');
    if (btnCadLine) {
        btnCadLine.classList.remove('active');
        btnCadLine.style.backgroundColor = '';
        btnCadLine.style.color = '';
    }
    let btnInlineLine = document.getElementById('btnToggleDrawMode');
    if (btnInlineLine) {
        btnInlineLine.classList.remove('active');
        btnInlineLine.innerHTML = '✏️ วาดเส้น (L)';
        btnInlineLine.style.background = '#f0fdf4';
        btnInlineLine.style.color = '#16a34a';
        btnInlineLine.style.borderColor = '#86efac';
    }

    if (polygonPoints.length > 0) {
        let lastPt = polygonPoints[polygonPoints.length - 1];
        cadArcState = {
            active: true,
            step: 2,
            pt1: { x: lastPt.x, y: lastPt.y },
            pt2: null,
            pt3: null
        };
        showWarning(`⌒ ARC: เริ่มส่วนโค้งต่อจากจุด P${polygonPoints.length} (${lastPt.x.toFixed(2)}, ${lastPt.y.toFixed(2)}) ➔ คลิก 'จุดยอดโค้ง/จุดผ่าน'`);
    } else {
        cadArcState = {
            active: true,
            step: 1,
            pt1: null,
            pt2: null,
            pt3: null
        };
        showWarning("⌒ ARC (3-Point): คลิก 'จุดที่ 1' จุดเริ่มส่วนโค้งบนผืนผ้าใบ");
    }

    updateCadStatusText();
    updateCadArcUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function cancelCadArc() {
    cadArcState = { active: false, step: 0, pt1: null, pt2: null, pt3: null };
    updateCadStatusText();
    updateCadArcUI();
    setDrawingMode(true);
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function updateCadArcUI() {
    let btn1 = document.getElementById('cadBtnArc');
    if (btn1) {
        btn1.classList.toggle('active', cadArcState.active);
        if (cadArcState.active) {
            btn1.style.setProperty('background', '#0891b2', 'important');
            btn1.style.setProperty('color', '#ffffff', 'important');
            btn1.style.setProperty('box-shadow', '0 0 12px rgba(6, 182, 212, 0.7)', 'important');
            btn1.innerText = '✕ ออก Arc (A)';
        } else {
            btn1.style.removeProperty('background');
            btn1.style.removeProperty('box-shadow');
            btn1.style.color = '#06b6d4';
            btn1.innerText = '⌒ Arc (A)';
        }
    }
    let btn2 = document.getElementById('inlineBtnArc');
    if (btn2) {
        btn2.classList.toggle('active', cadArcState.active);
        if (cadArcState.active) {
            btn2.style.setProperty('background', '#0891b2', 'important');
            btn2.style.setProperty('border-color', '#0891b2', 'important');
            btn2.style.setProperty('color', '#ffffff', 'important');
            btn2.innerText = '✕ ออก Arc';
        } else {
            btn2.style.removeProperty('background');
            btn2.style.removeProperty('border-color');
            btn2.style.color = '#0891b2';
            btn2.innerText = '⌒ ส่วนโค้ง (A)';
        }
    }
}

function handleArcPointClick(worldPt) {
    if (!worldPt) return;
    if (cadArcState.step === 1) {
        cadArcState.pt1 = { x: worldPt.x, y: worldPt.y };
        cadArcState.step = 2;
        showWarning(`⌒ ARC: บันทึกจุดที่ 1 (${worldPt.x.toFixed(2)}, ${worldPt.y.toFixed(2)}) แล้ว ➔ คลิก 'จุดที่ 2' (จุดยอดโค้ง หรือจุดผ่าน)`);
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    } else if (cadArcState.step === 2) {
        let p1 = cadArcState.pt1;
        if (Math.hypot(worldPt.x - p1.x, worldPt.y - p1.y) < 0.01) {
            showWarning("⚠️ จุดที่ 2 ต้องไม่อยู่ที่เดียวกับจุดที่ 1 กรุณาคลิกเลือกจุดยอดโค้ง");
            return;
        }
        cadArcState.pt2 = { x: worldPt.x, y: worldPt.y };
        cadArcState.step = 3;
        showWarning(`⌒ ARC: บันทึกจุดที่ 2 (${worldPt.x.toFixed(2)}, ${worldPt.y.toFixed(2)}) แล้ว ➔ คลิก 'จุดที่ 3' (จุดสิ้นสุดส่วนโค้ง)`);
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    } else if (cadArcState.step === 3) {
        let p1 = cadArcState.pt1;
        let p2 = cadArcState.pt2;
        let p3 = { x: worldPt.x, y: worldPt.y };

        if (Math.hypot(p3.x - p1.x, p3.y - p1.y) < 0.01 || Math.hypot(p3.x - p2.x, p3.y - p2.y) < 0.01) {
            showWarning("⚠️ จุดที่ 3 ต้องไม่อยู่ที่เดียวกับจุดที่ 1 หรือ 2 กรุณาคลิกเลือกจุดปลายโค้ง");
            return;
        }

        cadArcState.pt3 = p3;

        let arcPts = generateArcPoints(p1, p2, p3);
        if (arcPts && arcPts.length > 0) {
            saveCadState();
            if (polygonPoints.length === 0) {
                for (let i = 0; i < arcPts.length; i++) {
                    polygonPoints.push(arcPts[i]);
                }
            } else {
                let last = polygonPoints[polygonPoints.length - 1];
                // ถ้าจุด p1 เชื่อมต่อกับจุดเดิม (ระยะ < 0.20m) ให้เชื่อมต่อจุดต่อๆ ไป
                if (Math.hypot(p1.x - last.x, p1.y - last.y) < 0.20) {
                    for (let i = 1; i < arcPts.length; i++) {
                        polygonPoints.push(arcPts[i]);
                    }
                } else {
                    for (let i = 0; i < arcPts.length; i++) {
                        polygonPoints.push(arcPts[i]);
                    }
                }
            }
            renderPointList();
            showWarning(`✓ วาดเส้นโค้งสำเร็จ (${arcPts.length} จุดย่อย)! สามารถวาดเส้นต่อ หรือกด C เพื่อปิดรูปทรง`);
        }

        cancelCadArc();
        setDrawingMode(true);
        if (calcData.calculated) calculate();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    }
}

// ------------------------------------------------------------
// ระบบเส้นไกด์ไลน์ช่วยร่างแบบ (CAD Guidelines / Construction Lines / XLINE)
// ------------------------------------------------------------

function startCadGuide() {
    if (cadGuideState.active) {
        cancelCadGuide();
        showWarning("⏹️ ยกเลิกคำสั่งไกด์ไลน์ (Guideline)");
        return;
    }
    cancelCadArc();
    cancelCadMeasure();
    cancelCadCalibrate();
    cadOffsetSelectingEdge = false;
    polyDrawingMode = false;

    let btnCadLine = document.getElementById('cadBtnLine');
    if (btnCadLine) {
        btnCadLine.classList.remove('active');
        btnCadLine.style.backgroundColor = '';
        btnCadLine.style.color = '';
    }
    let btnInlineLine = document.getElementById('btnToggleDrawMode');
    if (btnInlineLine) {
        btnInlineLine.classList.remove('active');
        btnInlineLine.innerHTML = '✏️ วาดเส้น (L)';
        btnInlineLine.style.background = '#f0fdf4';
        btnInlineLine.style.color = '#16a34a';
        btnInlineLine.style.borderColor = '#86efac';
    }

    cadGuideState = {
        active: true,
        step: 1,
        pt1: null,
        pt2: null
    };

    cadShowGuides = true;
    updateCadStatusText();
    updateCadGuideUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();

    showWarning("📐 GUIDELINE (XLINE): คลิก 'จุดที่ 1' เพื่อวางแนวเส้นไกด์ไลน์ (กด Shift/F8 เพื่อล็อกแนวราบ/ดิ่ง 90°)");
}

function cancelCadGuide() {
    cadGuideState = { active: false, step: 0, pt1: null, pt2: null };
    updateCadStatusText();
    updateCadGuideUI();
    setDrawingMode(true);
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function updateCadGuideUI() {
    let btn1 = document.getElementById('cadBtnGuide');
    if (btn1) {
        btn1.classList.toggle('active', cadGuideState.active);
        if (cadGuideState.active) {
            btn1.style.setProperty('background', '#f59e0b', 'important');
            btn1.style.setProperty('color', '#000000', 'important');
            btn1.style.setProperty('font-weight', '700', 'important');
            btn1.style.setProperty('box-shadow', '0 0 12px rgba(245, 158, 11, 0.7)', 'important');
            btn1.innerText = '✕ ออกไกด์ (G)';
        } else {
            btn1.style.removeProperty('background');
            btn1.style.removeProperty('box-shadow');
            btn1.style.color = '#f59e0b';
            btn1.innerText = '📐 ไกด์ (G)';
        }
    }
    let btn2 = document.getElementById('inlineBtnGuide');
    if (btn2) {
        btn2.classList.toggle('active', cadGuideState.active);
        if (cadGuideState.active) {
            btn2.style.setProperty('background', '#f59e0b', 'important');
            btn2.style.setProperty('color', '#000000', 'important');
            btn2.style.setProperty('font-weight', '700', 'important');
            btn2.innerText = '✕ ออกไกด์';
        } else {
            btn2.style.removeProperty('background');
            btn2.style.color = '#b45309';
            btn2.innerText = '📐 ไกด์ (G)';
        }
    }
    let clearInline = document.getElementById('inlineBtnClearGuides');
    if (clearInline) {
        clearInline.style.display = cadGuideLines.length > 0 ? 'inline-block' : 'none';
    }
    let visBtn = document.getElementById('cadBtnGuideVis');
    if (visBtn) {
        visBtn.classList.toggle('active', cadShowGuides);
        visBtn.innerText = cadShowGuides ? '👁️ ไกด์' : '👁️ ไกด์ (ซ่อน)';
        visBtn.style.color = cadShowGuides ? '#ffffff' : '#a1a1aa';
    }
}

function handleGuidePointClick(worldPt) {
    if (!worldPt) return;

    if (cadGuideState.step === 1) {
        cadGuideState.pt1 = { x: worldPt.x, y: worldPt.y };
        cadGuideState.step = 2;
        showWarning(`📐 GUIDELINE: บันทึกจุดที่ 1 (${worldPt.x.toFixed(2)}, ${worldPt.y.toFixed(2)}) แล้ว ➔ คลิก 'จุดที่ 2' กำหนดทิศทาง`);
        updateCadStatusText();
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    } else if (cadGuideState.step === 2) {
        let p1 = cadGuideState.pt1;
        let p2 = { x: worldPt.x, y: worldPt.y };

        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 0.05) {
            showWarning("⚠️ จุดที่ 2 ต้องไม่อยู่ที่เดียวกับจุดที่ 1");
            return;
        }

        let isOrtho = isShiftPressed || cadOrtho || orthoModeActive;
        if (isOrtho) {
            let dx = Math.abs(p2.x - p1.x);
            let dy = Math.abs(p2.y - p1.y);
            if (dx >= dy) {
                p2 = { x: p2.x, y: p1.y };
            } else {
                p2 = { x: p1.x, y: p2.y };
            }
        }

        addCadGuideLine(p1, p2);
        showWarning(`✓ เพิ่มเส้นไกด์ไลน์เรียบร้อย (รวม ${cadGuideLines.length} เส้น)!`);

        cancelCadGuide();
        setDrawingMode(true);
        redrawPolyEditor();
        if (cadStudioOpen) redrawCadStudio();
    }
}

function addCadGuideLine(p1, p2) {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len = Math.hypot(dx, dy);
    if (len < 0.001) return;

    let type = '2pt';
    let label = '';

    if (Math.abs(dy) < 0.001) {
        type = 'h';
        label = `ไกด์แนวนอน Y=${p1.y.toFixed(2)}m`;
        dx = 1; dy = 0;
    } else if (Math.abs(dx) < 0.001) {
        type = 'v';
        label = `ไกด์แนวดิ่ง X=${p1.x.toFixed(2)}m`;
        dx = 0; dy = 1;
    } else {
        let angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 180;
        label = `ไกด์เอียง ${angleDeg.toFixed(1)}°`;
        // Normalize direction vector
        dx /= len;
        dy /= len;
    }

    cadGuideLines.push({
        id: Date.now() + Math.random(),
        p1: { x: p1.x, y: p1.y },
        p2: { x: p2.x, y: p2.y },
        dx: dx,
        dy: dy,
        type: type,
        label: label
    });

    updateCadGuideUI();
}

function toggleCadGuidesVisibility() {
    cadShowGuides = !cadShowGuides;
    updateCadGuideUI();
    showWarning(cadShowGuides ? "👁️ แสดงเส้นไกด์ไลน์ทั้งหมด" : "👁️ ซ่อนเส้นไกด์ไลน์");
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function clearCadGuides() {
    let count = cadGuideLines.length;
    cadGuideLines = [];
    cancelCadGuide();
    updateCadGuideUI();
    showWarning(`🗑️ ลบเส้นไกด์ไลน์ทั้งหมด (${count} เส้น) เรียบร้อย`);
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

// คำนวณจุดฉายที่ใกล้ที่สุดบนเส้นไกด์ไลน์
function getClosestPointOnGuide(g, px, py) {
    if (g.type === 'h') {
        return { x: px, y: g.p1.y };
    }
    if (g.type === 'v') {
        return { x: g.p1.x, y: py };
    }
    let vx = g.dx;
    let vy = g.dy;
    let t = (px - g.p1.x) * vx + (py - g.p1.y) * vy;
    return {
        x: g.p1.x + t * vx,
        y: g.p1.y + t * vy
    };
}

// คำนวณจุดตัดระหว่างเส้นไกด์ไลน์ 2 เส้น
function getGuidesIntersection(g1, g2) {
    let dCross = g1.dx * g2.dy - g1.dy * g2.dx;
    if (Math.abs(dCross) < 1e-5) return null; // ขนานกัน ไม่มีจุดตัด

    let t = ((g2.p1.x - g1.p1.x) * g2.dy - (g2.p1.y - g1.p1.y) * g2.dx) / dCross;
    return {
        x: g1.p1.x + t * g1.dx,
        y: g1.p1.y + t * g1.dy
    };
}

// คำนวณจุดตัดระหว่างเส้นไกด์ไลน์กับเส้นขอบรูปหลายเหลี่ยม (Guideline x Polygon Edge Intersection)
function getGuidePolygonEdgeIntersection(g, p1, p2) {
    let vx = p2.x - p1.x;
    let vy = p2.y - p1.y;
    let dCross = g.dx * vy - g.dy * vx;
    if (Math.abs(dCross) < 1e-7) return null; // ขนานกัน

    let u = (g.dy * (p1.x - g.p1.x) - g.dx * (p1.y - g.p1.y)) / dCross;
    if (u >= -0.0001 && u <= 1.0001) {
        return {
            x: Math.round((p1.x + u * vx) * 1000) / 1000,
            y: Math.round((p1.y + u * vy) * 1000) / 1000
        };
    }
    return null;
}

// คำนวณจุดฉายที่ใกล้ที่สุดบนส่วนของเส้นตรง (Closest Point on Segment / Nearest OSNAP)
function getClosestPointOnSegment(px, py, p1, p2) {
    let vx = p2.x - p1.x;
    let vy = p2.y - p1.y;
    let lenSq = vx * vx + vy * vy;
    if (lenSq < 1e-9) return { x: p1.x, y: p1.y, distSq: Math.hypot(px - p1.x, py - p1.y) };
    let t = ((px - p1.x) * vx + (py - p1.y) * vy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    let cx = p1.x + t * vx;
    let cy = p1.y + t * vy;
    return {
        x: Math.round(cx * 1000) / 1000,
        y: Math.round(cy * 1000) / 1000,
        distSq: (px - cx) * (px - cx) + (py - cy) * (py - cy)
    };
}

function setCadBgOpacity(val) {
    cadBgImage.opacity = parseFloat(val);
    let slider1 = document.getElementById('cadBgOpacitySlider');
    let slider2 = document.querySelector('#inlineBgControlBar input[type="range"]');
    if (slider1) slider1.value = val;
    if (slider2) slider2.value = val;
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function toggleCadBgLock() {
    cadBgImage.locked = !cadBgImage.locked;
    updateCadBgControlUI();
    if (cadBgImage.locked) {
        showWarning("🔒 ล็อกตำแหน่งภาพแบบแปลนแล้ว (คลิกวาดเส้นทับได้สะดวก)");
    } else {
        showWarning("🔓 ปลดล็อกภาพแล้ว (คุณสามารถคลิกลากย้ายตำแหน่งภาพบนจอได้)");
    }
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function toggleCadBgVisibility() {
    cadBgImage.visible = !cadBgImage.visible;
    updateCadBgControlUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function removeCadBgImage() {
    cadBgImage = {
        img: null,
        x: 0,
        y: 10,
        width: 10,
        height: 10,
        opacity: 0.55,
        visible: true,
        locked: true,
        aspectRatio: 1,
        fileName: '',
        pdfDoc: null,
        pdfPage: 1,
        pdfTotalPages: 1
    };
    cancelCadCalibrate();
    updateCadBgControlUI();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    showWarning("🗑️ ลบภาพพื้นหลังแบบแปลนเรียบร้อย");
}

function updateCadBgControlUI() {
    let hasBg = !!cadBgImage.img;
    let inlineBar = document.getElementById('inlineBgControlBar');
    let floatingPanel = document.getElementById('cadFloatingBgPanel');
    let floatingPill = document.getElementById('cadFloatingBgPill');
    let btnCalibrate = document.getElementById('cadBtnCalibrate');
    let floatBtnCal = document.getElementById('cadFloatingBtnCalibrate');
    let inlineBtnCal = document.getElementById('inlineBtnCalibrate');

    if (inlineBar) inlineBar.style.display = hasBg ? 'flex' : 'none';
    if (floatingPanel) floatingPanel.style.display = (hasBg && cadFloatingBgPanelVisible) ? 'flex' : 'none';
    if (floatingPill) floatingPill.style.display = (hasBg && !cadFloatingBgPanelVisible) ? 'flex' : 'none';
    if (btnCalibrate) {
        btnCalibrate.style.display = hasBg ? 'inline-block' : 'none';
        btnCalibrate.classList.toggle('active', cadCalibrateState.active);
        btnCalibrate.innerText = cadCalibrateState.active ? '✕ ออก Calibrate' : '📏 Calibrate';
        btnCalibrate.style.color = cadCalibrateState.active ? '#f87171' : '#f59e0b';
    }
    if (floatBtnCal) {
        floatBtnCal.classList.toggle('active', cadCalibrateState.active);
        floatBtnCal.innerText = cadCalibrateState.active ? '✕ ออกจาก Calibrate' : '📏 Calibrate สเกล';
        floatBtnCal.style.color = cadCalibrateState.active ? '#f87171' : '#f59e0b';
    }
    if (inlineBtnCal) {
        inlineBtnCal.innerText = cadCalibrateState.active ? '✕ ออก Calibrate' : '📏 Calibrate';
        inlineBtnCal.style.background = cadCalibrateState.active ? '#fee2e2' : '#fef3c7';
        inlineBtnCal.style.color = cadCalibrateState.active ? '#b91c1c' : '#d97706';
    }

    if (!hasBg) return;

    let fname = cadBgImage.fileName || 'แบบแปลน';
    let inlineName = document.getElementById('inlineBgFileName');
    let floatTitle = document.getElementById('cadFloatingBgTitle');
    if (inlineName) inlineName.innerText = `📄 ${fname}`;
    if (floatTitle) floatTitle.innerText = `🖼️ ${fname}`;

    // Lock buttons
    let lockIcon = cadBgImage.locked ? '🔒 ล็อก' : '🔓 ย้ายได้';
    let inlineLock = document.getElementById('inlineBtnBgLock');
    let floatLock = document.getElementById('cadBtnBgLock');
    if (inlineLock) {
        inlineLock.innerText = lockIcon;
        inlineLock.style.background = cadBgImage.locked ? '#f1f5f9' : '#fef3c7';
        inlineLock.style.color = cadBgImage.locked ? '#475569' : '#d97706';
    }
    if (floatLock) {
        floatLock.innerText = lockIcon;
        floatLock.classList.toggle('active', cadBgImage.locked);
    }

    // PDF page navigation
    let isPdf = !!cadBgImage.pdfDoc;
    let inlinePdfNav = document.getElementById('inlinePdfPageNav');
    let floatPdfNav = document.getElementById('cadPdfPageNav');
    if (inlinePdfNav) inlinePdfNav.style.display = isPdf ? 'inline-flex' : 'none';
    if (floatPdfNav) floatPdfNav.style.display = isPdf ? 'inline-flex' : 'none';
    if (isPdf) {
        let pInput1 = document.getElementById('inlinePdfPageInput');
        let pTotal1 = document.getElementById('inlinePdfTotalPages');
        let pInput2 = document.getElementById('cadPdfPageInput');
        let pTotal2 = document.getElementById('cadPdfTotalPages');

        if (pInput1) {
            pInput1.value = cadBgImage.pdfPage;
            pInput1.max = cadBgImage.pdfTotalPages;
        }
        if (pTotal1) pTotal1.innerText = `/ ${cadBgImage.pdfTotalPages}`;
        if (pInput2) {
            pInput2.value = cadBgImage.pdfPage;
            pInput2.max = cadBgImage.pdfTotalPages;
        }
        if (pTotal2) pTotal2.innerText = `/ ${cadBgImage.pdfTotalPages}`;
    }

    // Visibility button
    let btnVis = document.getElementById('cadBtnBgVis');
    if (btnVis) {
        btnVis.innerText = cadBgImage.visible ? '👁️' : '🙈';
        btnVis.classList.toggle('active', cadBgImage.visible);
    }
}

// 2. MIRROR (พลิกกลับด้านรูปทรง)
function polyMirrorPolygon(axis = 'x') {
    if (!polygonPoints || polygonPoints.length < 3) {
        showWarning("ต้องมีจุดอย่างน้อย 3 จุดจึงจะพลิกด้านได้");
        return;
    }
    saveCadState();
    let minX = Math.min(...polygonPoints.map(p => p.x));
    let maxX = Math.max(...polygonPoints.map(p => p.x));
    let minY = Math.min(...polygonPoints.map(p => p.y));
    let maxY = Math.max(...polygonPoints.map(p => p.y));

    let newPts = [];
    if (axis === 'y') {
        polygonPoints.forEach(p => {
            newPts.push({ x: p.x, y: Math.round((minY + maxY - p.y) * 1000) / 1000 });
        });
    } else {
        polygonPoints.forEach(p => {
            newPts.push({ x: Math.round((minX + maxX - p.x) * 1000) / 1000, y: p.y });
        });
    }
    polygonPoints = newPts.reverse();
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    calculate();
    showWarning(`🪞 พลิกกลับด้านรูปทรง (${axis === 'y' ? 'บน-ล่าง' : 'ซ้าย-ขวา'}) เรียบร้อย`);
}

// 3. ROTATE (หมุนรูปทรง)
function polyRotatePolygon(angleDeg) {
    if (!polygonPoints || polygonPoints.length < 3) {
        showWarning("ต้องมีจุดอย่างน้อย 3 จุดจึงจะหมุนได้");
        return;
    }
    saveCadState();
    let n = polygonPoints.length;
    let cx = polygonPoints.reduce((acc, p) => acc + p.x, 0) / n;
    let cy = polygonPoints.reduce((acc, p) => acc + p.y, 0) / n;

    let rad = angleDeg * Math.PI / 180;
    let cosA = Math.cos(rad);
    let sinA = Math.sin(rad);

    let newPts = polygonPoints.map(p => {
        let dx = p.x - cx;
        let dy = p.y - cy;
        return {
            x: Math.round((cx + dx * cosA - dy * sinA) * 1000) / 1000,
            y: Math.round((cy + dx * sinA + dy * cosA) * 1000) / 1000
        };
    });

    let minX = Math.min(...newPts.map(p => p.x));
    let minY = Math.min(...newPts.map(p => p.y));
    if (minX < 0 || minY < 0) {
        let shiftX = minX < 0 ? -minX : 0;
        let shiftY = minY < 0 ? -minY : 0;
        newPts = newPts.map(p => ({
            x: Math.round((p.x + shiftX) * 1000) / 1000,
            y: Math.round((p.y + shiftY) * 1000) / 1000
        }));
    }

    polygonPoints = newPts;
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
    calculate();
    showWarning(`🔄 หมุนรูปทรง ${angleDeg}° เรียบร้อย`);
}

// 4. SCALE (ย่อ/ขยายสเกล)
function polyScalePolygon(factor) {
    if (!polygonPoints || polygonPoints.length < 3 || factor <= 0) return;
    saveCadState();
    let n = polygonPoints.length;
    let cx = polygonPoints.reduce((acc, p) => acc + p.x, 0) / n;
    let cy = polygonPoints.reduce((acc, p) => acc + p.y, 0) / n;

    let newPts = polygonPoints.map(p => ({
        x: Math.round((cx + (p.x - cx) * factor) * 1000) / 1000,
        y: Math.round((cy + (p.y - cy) * factor) * 1000) / 1000
    }));

    let minX = Math.min(...newPts.map(p => p.x));
    let minY = Math.min(...newPts.map(p => p.y));
    if (minX < 0 || minY < 0) {
        let shiftX = minX < 0 ? -minX : 0;
        let shiftY = minY < 0 ? -minY : 0;
        newPts = newPts.map(p => ({
            x: Math.round((p.x + shiftX) * 1000) / 1000,
            y: Math.round((p.y + shiftY) * 1000) / 1000
        }));
    }

    polygonPoints = newPts;
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
    calculate();
    showWarning(`🔍 ปรับสเกลรูปทรง ${factor}x เรียบร้อย`);
}

// 5. MOVE (เลื่อนพิกัด)
function polyMovePolygon(dx, dy) {
    if (!polygonPoints || polygonPoints.length === 0) return;
    saveCadState();
    polygonPoints = polygonPoints.map(p => ({
        x: Math.round((p.x + dx) * 1000) / 1000,
        y: Math.round((p.y + dy) * 1000) / 1000
    }));
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    calculate();
}

// ------------------------------------------------------------
// ตัวจัดการหน้าต่างและป้อนคำสั่ง AutoCAD (Prompt & Command Line)
// ------------------------------------------------------------

function cadOpenPrompt(type, edgeIndex) {
    cadActivePromptType = type;
    if (edgeIndex !== undefined && edgeIndex >= 0) {
        selectedEdgeForOffset = edgeIndex;
    }
    let overlay = document.getElementById('cadDialogOverlay');
    let titleEl = document.getElementById('cadDialogTitle');
    let descEl = document.getElementById('cadDialogDesc');
    let inputEl = document.getElementById('cadDialogInput');
    let tagsEl = document.getElementById('cadDialogTags');
    let unitEl = document.getElementById('cadDialogUnit');

    if (!overlay || !titleEl || !inputEl || !tagsEl) {
        if (type === 'offset') {
            let promptMsg = (selectedEdgeForOffset >= 0) ?
                `📐 OFFSET เส้นด้านที่ ${selectedEdgeForOffset + 1}: ระบุระยะยื่นชายคา (ม.) เช่น 0.60 หรือ 1.00` :
                "📐 OFFSET: ระบุระยะยื่นชายคา / ออฟเซ็ตขอบ (ม.) เช่น 0.60 หรือ 1.00";
            let val = prompt(promptMsg, "0.60");
            if (val !== null) {
                let dist = parseFloat(val) || 0.60;
                if (selectedEdgeForOffset >= 0) applySingleEdgeOffset(selectedEdgeForOffset, dist);
                else applyPolygonOffset(dist);
            }
        } else if (type === 'rotate') {
            let val = prompt("🔄 ROTATE: ระบุองศาที่ต้องการหมุน (เช่น 90 หรือ 45)", "90");
            if (val !== null) polyRotatePolygon(parseFloat(val) || 90);
        } else if (type === 'scale') {
            let val = prompt("🔍 SCALE: ระบุอัตราส่วนสเกลคูณ (เช่น 1.2 หรือ 0.8)", "1.2");
            if (val !== null) polyScalePolygon(parseFloat(val) || 1.2);
        }
        return;
    }

    overlay.style.display = 'flex';
    tagsEl.innerHTML = '';

    if (type === 'offset') {
        let isSingle = (selectedEdgeForOffset >= 0 && selectedEdgeForOffset < polygonPoints.length);
        let edgeLenStr = "";
        if (isSingle) {
            let p1 = polygonPoints[selectedEdgeForOffset];
            let p2 = polygonPoints[(selectedEdgeForOffset + 1) % polygonPoints.length];
            let l = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            edgeLenStr = ` (ยาว ${l.toFixed(2)} ม.)`;
            titleEl.innerHTML = `📐 OFFSET เส้นด้านที่ ${selectedEdgeForOffset + 1}${edgeLenStr}`;
            descEl.innerText = `ระบุระยะยื่นชายคาของเส้นด้านที่ ${selectedEdgeForOffset + 1} (+) ออกนอก, (-) หดเข้า`;
        } else {
            titleEl.innerHTML = '📐 คำสั่ง OFFSET (ออฟเซ็ตขอบ/ชายคายื่น)';
            descEl.innerText = 'คลิกเลือกเส้นที่ต้องการบนภาพวาด หรือระบุระยะด้านล่างเพื่อออฟเซ็ต';
        }
        inputEl.value = '0.60';
        if (unitEl) unitEl.innerText = 'เมตร';
        
        let presets = [
            { label: '+0.50 ม.', val: 0.50 },
            { label: '+0.60 ม. (ชายคา)', val: 0.60 },
            { label: '+0.80 ม.', val: 0.80 },
            { label: '+1.00 ม. (กันสาด)', val: 1.00 },
            { label: '+1.20 ม.', val: 1.20 },
            { label: '-0.50 ม. (หดเข้า)', val: -0.50 }
        ];
        presets.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'cad-quick-tag';
            btn.type = 'button';
            btn.innerText = p.label;
            btn.onclick = () => { inputEl.value = p.val; cadSubmitPrompt(isSingle ? 'single' : 'all'); };
            tagsEl.appendChild(btn);
        });

        let actionsEl = overlay.querySelector('.cad-dialog-actions');
        if (actionsEl) {
            if (isSingle) {
                actionsEl.innerHTML = `
                    <button type="button" class="btn-small" onclick="cadClosePrompt()" style="background:#27272a; color:#cbd5e1; border:1px solid #3f3f46; padding:6px 12px; border-radius:6px; font-size:0.82rem;">ยกเลิก (Esc)</button>
                    <button type="button" class="btn-small" onclick="cadSubmitPrompt('all')" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.82rem;" title="ออฟเซ็ตทุกด้านรอบรูป">🌐 ทุกด้านรอบรูป</button>
                    <button type="button" class="cad-btn-apply" onclick="cadSubmitPrompt('single')" style="padding:6px 16px; font-size:0.85rem;" title="ออฟเซ็ตเฉพาะเส้นที่เลือก">✓ ออฟเซ็ตเฉพาะเส้นนี้</button>
                `;
            } else {
                actionsEl.innerHTML = `
                    <button type="button" class="btn-small" onclick="cadClosePrompt()" style="background:#27272a; color:#cbd5e1; border:1px solid #3f3f46; padding:6px 14px; border-radius:6px; font-size:0.82rem;">ยกเลิก (Esc)</button>
                    <button type="button" class="cad-btn-apply" onclick="cadSubmitPrompt('all')" style="padding:6px 18px; font-size:0.85rem;">✓ ตกลง (Enter)</button>
                `;
            }
        }
    } else if (type === 'rotate') {
        titleEl.innerHTML = '🔄 คำสั่ง ROTATE (หมุนรูปทรง)';
        descEl.innerText = 'ระบุองศาที่ต้องการหมุนรอบจุดกึ่งกลาง (ทวนเข็มนาฬิกา)';
        inputEl.value = '90';
        if (unitEl) unitEl.innerText = 'องศา (°)';

        let presets = [
            { label: '90° (หมุนขวา)', val: 90 },
            { label: '180° (กลับหัว)', val: 180 },
            { label: '270° (หมุนซ้าย)', val: 270 },
            { label: '45° (ทแยง)', val: 45 }
        ];
        presets.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'cad-quick-tag';
            btn.type = 'button';
            btn.innerText = p.label;
            btn.onclick = () => { inputEl.value = p.val; cadSubmitPrompt(); };
            tagsEl.appendChild(btn);
        });
    } else if (type === 'scale') {
        titleEl.innerHTML = '🔍 คำสั่ง SCALE (ปรับขนาดรูปทรง)';
        descEl.innerText = 'ระบุอัตราส่วนสเกลคูณขยายหรือย่อขนาด';
        inputEl.value = '1.2';
        if (unitEl) unitEl.innerText = 'เท่า';

        let presets = [
            { label: '0.8x (ย่อ)', val: 0.8 },
            { label: '1.2x (ขยาย)', val: 1.2 },
            { label: '1.5x', val: 1.5 },
            { label: '2.0x (เท่าตัว)', val: 2.0 }
        ];
        presets.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'cad-quick-tag';
            btn.type = 'button';
            btn.innerText = p.label;
            btn.onclick = () => { inputEl.value = p.val; cadSubmitPrompt(); };
            tagsEl.appendChild(btn);
        });
    } else if (type === 'mirror') {
        titleEl.innerHTML = '🪞 คำสั่ง MIRROR (พลิกกลับด้านรูปทรง)';
        descEl.innerText = 'เลือกแกนที่ต้องการพลิกกลับด้าน';
        inputEl.style.display = 'none';
        if (unitEl) unitEl.style.display = 'none';

        let presets = [
            { label: '↔️ พลิกซ้าย-ขวา (Flip Horizontal)', action: () => { polyMirrorPolygon('x'); cadClosePrompt(); } },
            { label: '↕️ พลิกบน-ล่าง (Flip Vertical)', action: () => { polyMirrorPolygon('y'); cadClosePrompt(); } }
        ];
        presets.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'cad-quick-tag';
            btn.type = 'button';
            btn.style.padding = '8px 14px';
            btn.style.fontSize = '0.85rem';
            btn.innerText = p.label;
            btn.onclick = p.action;
            tagsEl.appendChild(btn);
        });
    } else if (type === 'edge_edit') {
        let isSingle = (selectedEdgeForOffset >= 0 && selectedEdgeForOffset < polygonPoints.length);
        if (!isSingle) return;
        let p1 = polygonPoints[selectedEdgeForOffset];
        let p2 = polygonPoints[(selectedEdgeForOffset + 1) % polygonPoints.length];
        let curLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        titleEl.innerHTML = `📐 แก้ไขระยะเส้นด้านที่ ${selectedEdgeForOffset + 1} (P${selectedEdgeForOffset + 1} ➔ P${((selectedEdgeForOffset + 1) % polygonPoints.length) + 1})`;
        descEl.innerText = `ความยาวปัจจุบัน: ${curLen.toFixed(2)} เมตร | ระบุความยาวใหม่ หรือเลือกระยะด่วน`;
        inputEl.value = curLen.toFixed(2);
        if (unitEl) unitEl.innerText = 'เมตร';

        let presets = [
            { label: '6.00 ม.', val: 6.00 },
            { label: '8.00 ม.', val: 8.00 },
            { label: '10.00 ม.', val: 10.00 },
            { label: '12.00 ม.', val: 12.00 },
            { label: '15.00 ม.', val: 15.00 },
            { label: '19.00 ม.', val: 19.00 }
        ];
        presets.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'cad-quick-tag';
            btn.type = 'button';
            btn.innerText = p.label;
            btn.onclick = () => { inputEl.value = p.val; cadSubmitPrompt('length'); };
            tagsEl.appendChild(btn);
        });

        let actionsEl = overlay.querySelector('.cad-dialog-actions');
        if (actionsEl) {
            actionsEl.innerHTML = `
                <button type="button" class="btn-small" onclick="cadClosePrompt()" style="background:#27272a; color:#cbd5e1; border:1px solid #3f3f46; padding:6px 12px; border-radius:6px; font-size:0.82rem;">ยกเลิก (Esc)</button>
                <button type="button" class="btn-small" onclick="cadOpenPrompt('offset', ${selectedEdgeForOffset})" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.82rem;" title="ออฟเซ็ตเส้นนี้">📐 ออฟเซ็ตเส้นนี้...</button>
                <button type="button" class="cad-btn-apply" onclick="cadSubmitPrompt('length')" style="padding:6px 16px; font-size:0.85rem;" title="เปลี่ยนความยาวเส้น">✓ บันทึกความยาว (Enter)</button>
            `;
        }
    }

    if (type !== 'mirror') {
        inputEl.style.display = 'block';
        if (unitEl) unitEl.style.display = 'inline';
        inputEl.focus();
        inputEl.select();
    }
}

function cadClosePrompt() {
    let overlay = document.getElementById('cadDialogOverlay');
    if (overlay) overlay.style.display = 'none';
    if (cadActivePromptType === 'calibrate') {
        cancelCadCalibrate();
        setDrawingMode(true);
    }
    cadActivePromptType = null;
    cadOffsetSelectingEdge = false;
    cadHoveredEdge = -1;
    updateCadStatusText();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function cadSubmitPrompt(forceMode) {
    let inputEl = document.getElementById('cadDialogInput');
    let val = inputEl ? parseFloat(inputEl.value) : NaN;

    if (cadActivePromptType === 'edge_edit' || forceMode === 'length') {
        if (!isNaN(val) && val > 0 && selectedEdgeForOffset >= 0) {
            applyEdgeLength(selectedEdgeForOffset, val);
        }
    } else if (cadActivePromptType === 'offset') {
        if (!isNaN(val) && val !== 0) {
            if (forceMode === 'single' && selectedEdgeForOffset >= 0) {
                applySingleEdgeOffset(selectedEdgeForOffset, val);
            } else if (forceMode === 'all' || selectedEdgeForOffset === -1) {
                applyPolygonOffset(val);
            } else if (selectedEdgeForOffset >= 0) {
                applySingleEdgeOffset(selectedEdgeForOffset, val);
            } else {
                applyPolygonOffset(val);
            }
        }
    } else if (cadActivePromptType === 'rotate') {
        if (!isNaN(val)) polyRotatePolygon(val);
    } else if (cadActivePromptType === 'scale') {
        if (!isNaN(val) && val > 0) polyScalePolygon(val);
    } else if (cadActivePromptType === 'calibrate') {
        let overlay = document.getElementById('cadDialogOverlay');
        if (overlay) overlay.style.display = 'none';
        cadActivePromptType = null;
        if (!isNaN(val) && val > 0) {
            applyCalibrateScale(val);
            return;
        } else {
            cancelCadCalibrate();
        }
    }
    cadClosePrompt();
}

function cadExecuteCommandLine(cmd) {
    if (!cmd) return;
    cmd = cmd.trim().toUpperCase();

    if (cmd === 'O' || cmd === 'OFFSET') {
        startCadOffsetCommand();
    } else if (cmd === 'A' || cmd === 'ARC' || cmd === 'ARC3P') {
        startCadArc();
    } else if (cmd === 'COORD' || cmd === 'COORDS' || cmd === 'ID' || cmd === 'POS') {
        toggleCadCoords();
    } else if (cmd === 'DI' || cmd === 'DIST' || cmd === 'MEASURE' || cmd === 'D') {
        startCadMeasure();
    } else if (cmd === 'G' || cmd === 'GUIDE' || cmd === 'XL' || cmd === 'XLINE') {
        startCadGuide();
    } else if (cmd === 'CG' || cmd === 'CLEARGUIDE' || cmd === 'CLEARGUIDES') {
        clearCadGuides();
    } else if (cmd === 'CAL' || cmd === 'CALIBRATE' || cmd === 'SCALEIMAGE') {
        startCadCalibrateScale();
    } else if (cmd === 'IMG' || cmd === 'IMAGE' || cmd === 'PDF' || cmd === 'IMPORT') {
        triggerCadBgUpload();
    } else if (cmd === 'MI' || cmd === 'MIRROR') {
        cadOpenPrompt('mirror');
    } else if (cmd === 'RO' || cmd === 'ROTATE') {
        cadOpenPrompt('rotate');
    } else if (cmd === 'SC' || cmd === 'SCALE') {
        cadOpenPrompt('scale');
    } else if (cmd === 'M' || cmd === 'MOVE') {
        let shift = prompt("MOVE: ระบุระยะเลื่อน dX, dY (ม.) เช่น 1.0, 0.5", "1.0, 0.0");
        if (shift) {
            let parts = shift.split(',').map(s => parseFloat(s.trim()));
            polyMovePolygon(parts[0] || 0, parts[1] || 0);
        }
    } else if (cmd === 'Z' || cmd === 'ZE' || cmd === 'ZOOM') {
        cadZoomExtents();
        showWarning("🔍 ซูมพอดีจอ (Zoom Extents)");
    } else if (cmd === 'L' || cmd === 'PL' || cmd === 'LINE' || cmd === 'PLINE') {
        setDrawingMode(true);
        showWarning("✏️ เริ่มคำสั่ง LINE");
    } else if (cmd === 'C' || cmd === 'CLOSE') {
        polyCloseShape();
    } else if (cmd === 'E' || cmd === 'DEL' || cmd === 'ERASE' || cmd === 'CLEAR') {
        clearPoints();
    } else if (cmd === 'U' || cmd === 'UNDO') {
        cadUndo();
    } else if (cmd === 'REDO') {
        cadRedo();
    } else if (cmd === 'F8' || cmd === 'ORTHO') {
        toggleCadOrtho();
    } else if (cmd.startsWith('SEAM') || cmd.startsWith('START') || cmd.startsWith('X ') || cmd === 'SEAM' || cmd === 'START') {
        let parts = cmd.split(/\s+/);
        if (parts.length > 1) {
            let val = parseFloat(parts[1]);
            if (!isNaN(val)) {
                polyStartSeamX = Math.round(val * 100) / 100;
                showWarning(`📍 ตั้งแนวเริ่มมุงที่ X = ${polyStartSeamX.toFixed(2)} ม. เรียบร้อย`);
                redrawCadStudio();
                redrawPolyEditor();
                calculate();
            } else {
                showWarning("⚠️ กรุณาระบุตัวเลขพิกัด X เช่น SEAM 7.00 หรือ X 7.00");
            }
        } else {
            togglePickStartMode(true);
        }
    } else {
        showWarning(`ไม่พบคำสั่ง: ${cmd} (ลองใช้ G, O, MI, RO, SC, L, C, ZE, U, E, SEAM)`);
    }
}

function setDrawingMode(active) {
    if (active) {
        if (cadArcState.active) {
            cadArcState = { active: false, step: 0, pt1: null, pt2: null, pt3: null };
            updateCadArcUI();
        }
        if (cadGuideState.active) {
            cadGuideState = { active: false, step: 0, pt1: null, pt2: null };
            updateCadGuideUI();
        }
        if (cadMeasureState.active) {
            cadMeasureState = { active: false, step: 0, pt1: null, pt2: null, result: null };
        }
    }
    polyDrawingMode = active;
    if (!polyDrawingMode) {
        polyHover = null;
    }
    
    let btnCadLine = document.getElementById('cadBtnLine');
    if (btnCadLine) {
        btnCadLine.classList.toggle('active', polyDrawingMode);
        btnCadLine.style.backgroundColor = polyDrawingMode ? '#2563eb' : '';
        btnCadLine.style.color = polyDrawingMode ? '#ffffff' : '';
    }

    let btnInlineLine = document.getElementById('btnToggleDrawMode');
    if (btnInlineLine) {
        btnInlineLine.classList.toggle('active', polyDrawingMode);
        btnInlineLine.innerHTML = polyDrawingMode ? '⏹️ จบวาด (Esc)' : '✏️ วาดเส้น (L)';
        btnInlineLine.style.background = polyDrawingMode ? '#fee2e2' : '#f0fdf4';
        btnInlineLine.style.color = polyDrawingMode ? '#dc2626' : '#16a34a';
        btnInlineLine.style.borderColor = polyDrawingMode ? '#fca5a5' : '#86efac';
    }

    updateCadStatusText();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function toggleDrawingMode() {
    setDrawingMode(!polyDrawingMode);
    if (polyDrawingMode) {
        showWarning("✏️ เริ่มคำสั่ง LINE (คลิกเพื่อวางจุด หรือพิมพ์ระยะแล้ว Enter)");
    } else {
        showWarning("⏹️ จบคำสั่งวาดเส้น (Exit LINE command)");
    }
}

// ------------------------------------------------------------
// 1. INLINE PREVIEW CANVAS FUNCTIONS
// ------------------------------------------------------------

function polyFitView() {
    const c = document.getElementById('polyDrawCanvas');
    if (!c) return;
    let step = getPolyStep();
    let pts = polygonPoints.slice();
    if (polyHover && polyDrawingMode) pts.push(polyHover);

    let minX = 0, minY = 0, maxX = step * 8, maxY = step * 8;
    if (pts.length > 0) {
        minX = Math.min(...pts.map(p => p.x));
        minY = Math.min(...pts.map(p => p.y));
        maxX = Math.max(...pts.map(p => p.x));
        maxY = Math.max(...pts.map(p => p.y));
    } else if (cadBgImage.img) {
        minX = cadBgImage.x;
        minY = 0;
        maxX = cadBgImage.x + cadBgImage.width;
        maxY = cadBgImage.height;
    }
    let spanX = Math.max(maxX - minX, step * 4);
    let spanY = Math.max(maxY - minY, step * 4);

    const margin = 45;
    let scale = Math.min((c.width - margin * 2) / spanX, (c.height - margin * 2) / spanY);
    scale = Math.min(scale, 55 / step);
    scale = Math.max(scale, 4);
    polyView = {
        scale: scale,
        ox: margin + ((c.width - margin * 2) - spanX * scale) / 2 - minX * scale,
        oy: c.height - margin - ((c.height - margin * 2) - spanY * scale) / 2 + minY * scale
    };
}

function polyToScreen(p) {
    return { x: p.x * polyView.scale + polyView.ox, y: polyView.oy - p.y * polyView.scale };
}

let polyInlineSnapType = null;
let polyInlineSnapPt = null;

function polyScreenToWorld(sx, sy, shiftKey, snapToGrid = true) {
    let step = getPolyStep();
    let wx = (sx - polyView.ox) / polyView.scale;
    let wy = (polyView.oy - sy) / polyView.scale;
    
    let gx = snapToGrid ? Math.round(wx / step) * step : wx;
    let gy = snapToGrid ? Math.round(wy / step) * step : wy;

    let alignThresholdWorld = 14 / polyView.scale;
    let trackedGuides = [];
    let snappedAlignX = false;
    let snappedAlignY = false;
    polyInlineSnapType = null;
    polyInlineSnapPt = null;

    // รวมการค้นหา OSNAP หาจุดที่ใกล้เคอร์เซอร์ที่สุด (Nearest Best Snap Candidate)
    if (snapToGrid && draggingPointIndex === -1 && !isDraggingStartSeam) {
        let bestSnapPt = null;
        let bestSnapType = null;
        let bestDist = Infinity;

        // A. จุดตัดระหว่างเส้นไกด์ 2 เส้น
        if (cadShowGuides && cadGuideLines.length > 0) {
            for (let i = 0; i < cadGuideLines.length; i++) {
                for (let j = i + 1; j < cadGuideLines.length; j++) {
                    let pInt = getGuidesIntersection(cadGuideLines[i], cadGuideLines[j]);
                    if (pInt) {
                        let sInt = polyToScreen(pInt);
                        let d = Math.hypot(sx - sInt.x, sy - sInt.y);
                        if (d < 16 && d < bestDist) {
                            bestDist = d;
                            bestSnapPt = { x: Math.round(pInt.x * 1000) / 1000, y: Math.round(pInt.y * 1000) / 1000 };
                            bestSnapType = 'guideIntersection';
                        }
                    }
                }
            }

            // B. จุดตัดระหว่างเส้นไกด์ กับ เส้นขอบหลังคา (Guideline x Edge Intersection)
            if (polygonPoints.length >= 2) {
                let edgeCount = polygonPoints.length;
                if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
                for (let i = 0; i < cadGuideLines.length; i++) {
                    let g = cadGuideLines[i];
                    for (let k = 0; k < edgeCount; k++) {
                        let p1 = polygonPoints[k];
                        let p2 = polygonPoints[(k + 1) % polygonPoints.length];
                        let pInt = getGuidePolygonEdgeIntersection(g, p1, p2);
                        if (pInt) {
                            let sInt = polyToScreen(pInt);
                            let d = Math.hypot(sx - sInt.x, sy - sInt.y);
                            if (d < 16 && d < bestDist) {
                                bestDist = d;
                                bestSnapPt = { x: Math.round(pInt.x * 1000) / 1000, y: Math.round(pInt.y * 1000) / 1000 };
                                bestSnapType = 'guideEdgeIntersection';
                            }
                        }
                    }
                }
            }
        }

        // C. จุดมุม (Endpoint Snap)
        if (polygonPoints.length > 0) {
            for (let i = 0; i < polygonPoints.length; i++) {
                let p = polygonPoints[i];
                let s = polyToScreen(p);
                let d = Math.hypot(sx - s.x, sy - s.y);
                if (d < 16 && d < bestDist) {
                    bestDist = d;
                    bestSnapPt = { x: p.x, y: p.y };
                    bestSnapType = 'endpoint';
                }
            }

            // D. จุดกึ่งกลางด้าน (Midpoint Snap)
            let edgeCount = polygonPoints.length;
            if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
            for (let i = 0; i < edgeCount; i++) {
                let p1 = polygonPoints[i];
                let p2 = polygonPoints[(i + 1) % polygonPoints.length];
                let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                let s = polyToScreen(mid);
                let d = Math.hypot(sx - s.x, sy - s.y);
                if (d < 16 && d < bestDist) {
                    bestDist = d;
                    bestSnapPt = { x: Math.round(mid.x * 1000) / 1000, y: Math.round(mid.y * 1000) / 1000 };
                    bestSnapType = 'midpoint';
                }
            }
        }

        // ถ้ามีจุด Discrete Point ที่อยู่ในระยะ Snap ให้เลือกจุดนั้นก่อนเสมอ
        if (bestSnapPt) {
            polyInlineSnapType = bestSnapType;
            polyInlineSnapPt = bestSnapPt;
            return bestSnapPt;
        }

        // 2. Continuous Linear Entities: เส้นไกด์ และ เส้นขอบหลังคา (Linear / Nearest Snaps)
        let bestLinearPt = null;
        let bestLinearType = null;
        let bestLinearDist = Infinity;

        // E. Snap บนแนวเส้นไกด์ (On Guideline Snap)
        if (cadShowGuides && cadGuideLines.length > 0) {
            for (let i = 0; i < cadGuideLines.length; i++) {
                let g = cadGuideLines[i];
                let pClose = getClosestPointOnGuide(g, wx, wy);
                let sClose = polyToScreen(pClose);
                let d = Math.hypot(sx - sClose.x, sy - sClose.y);
                if (d < 14 && d < bestLinearDist) {
                    bestLinearDist = d;
                    bestLinearPt = { x: Math.round(pClose.x * 1000) / 1000, y: Math.round(pClose.y * 1000) / 1000 };
                    bestLinearType = 'guideLine';
                }
            }
        }

        // F. Snap จุดใดก็ได้บนเส้นขอบรูปทรง (AutoCAD Nearest OSNAP)
        if (polygonPoints.length >= 2) {
            let edgeCount = polygonPoints.length;
            if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
            for (let k = 0; k < edgeCount; k++) {
                let p1 = polygonPoints[k];
                let p2 = polygonPoints[(k + 1) % polygonPoints.length];
                let res = getClosestPointOnSegment(wx, wy, p1, p2);
                let sRes = polyToScreen(res);
                let d = Math.hypot(sx - sRes.x, sy - sRes.y);
                if (d < 14 && d < bestLinearDist) {
                    bestLinearDist = d;
                    bestLinearPt = { x: res.x, y: res.y };
                    bestLinearType = 'nearestEdge';
                }
            }
        }

        if (bestLinearPt) {
            polyInlineSnapType = bestLinearType;
            polyInlineSnapPt = bestLinearPt;
            return bestLinearPt;
        }
    }

    if (polygonPoints.length > 0 && draggingPointIndex === -1 && !isDraggingStartSeam) {
        // 3. Alignment tracking guides
        for (let i = 0; i < polygonPoints.length; i++) {
            let p = polygonPoints[i];
            if (!snappedAlignX && Math.abs(wx - p.x) <= alignThresholdWorld) {
                gx = p.x;
                snappedAlignX = true;
                trackedGuides.push({
                    type: 'vertical',
                    from: { x: p.x, y: p.y },
                    target: { x: p.x, y: gy },
                    label: `⫛ ตรงแนว X กับ P${i + 1} (${p.x.toFixed(2)}ม.)`
                });
            }
            if (!snappedAlignY && Math.abs(wy - p.y) <= alignThresholdWorld) {
                gy = p.y;
                snappedAlignY = true;
                trackedGuides.push({
                    type: 'horizontal',
                    from: { x: p.x, y: p.y },
                    target: { x: gx, y: p.y },
                    label: `⫛ ตรงแนว Y กับ P${i + 1} (${p.y.toFixed(2)}ม.)`
                });
            }
        }
    }

    let useOrtho = shiftKey || isShiftPressed || orthoModeActive;
    if (useOrtho && polygonPoints.length > 0 && draggingPointIndex === -1 && !isDraggingStartSeam && !cadArcState.active && !cadMeasureState.active && !cadCalibrateState.active) {
        let last = polygonPoints[polygonPoints.length - 1];
        let dx = Math.abs(wx - last.x);
        let dy = Math.abs(wy - last.y);
        if (dx >= dy) {
            gy = last.y;
            gx = snapToGrid ? Math.round(wx / step) * step : wx;
        } else {
            gx = last.x;
            gy = snapToGrid ? Math.round(wy / step) * step : wy;
        }
    }

    polyInlineTrackingGuides = trackedGuides;
    return { x: Math.round(gx * 1000) / 1000, y: Math.round(gy * 1000) / 1000 };
}

function polyCanvasPos(evt) {
    const c = document.getElementById('polyDrawCanvas');
    const r = c.getBoundingClientRect();
    return {
        x: (evt.clientX - r.left) * (c.width / r.width),
        y: (evt.clientY - r.top) * (c.height / r.height)
    };
}

function initPolyEditor() {
    const c = document.getElementById('polyDrawCanvas');
    if (!c) return;

    if (c.clientWidth > 0 && c.width !== c.clientWidth) {
        c.width = c.clientWidth;
        c.height = c.clientHeight > 0 ? c.clientHeight : 270;
    }

    if (polyEditorBound) { redrawPolyEditor(); return; }
    polyEditorBound = true;

    window.addEventListener('keydown', function(e) {
        let activeEl = document.activeElement;
        let isTypingInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');

        // Ctrl+Z (Undo) / Ctrl+Y (Redo)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            cadUndo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            cadRedo();
            return;
        }

        if (e.key === 'Shift') {
            isShiftPressed = true;
            if (cadStudioOpen) {
                cadHover = cadCalculateSnapAndWorld(cadMouseScreen.x, cadMouseScreen.y, true);
                updateCadStatusText();
                redrawCadStudio();
            } else if (currentMode === 'polygon' && lastMousePos) {
                polyHover = polyScreenToWorld(lastMousePos.x, lastMousePos.y, true);
                redrawPolyEditor();
            }
        } else if (e.key === 'F8') {
            e.preventDefault();
            toggleCadOrtho();
        } else if (e.key === 'Escape') {
            let promptOverlay = document.getElementById('cadDialogOverlay');
            if (promptOverlay && promptOverlay.style.display === 'flex') {
                cadClosePrompt();
                return;
            }
            if (cadArcState.active) {
                cancelCadArc();
                showWarning("⏹️ ยกเลิกคำสั่ง ARC วาดเส้นโค้ง");
                return;
            }
            if (cadGuideState.active) {
                cancelCadGuide();
                showWarning("⏹️ ยกเลิกคำสั่ง GUIDELINE ไกด์ไลน์");
                return;
            }
            if (cadMeasureState.active) {
                cancelCadMeasure();
                showWarning("⏹️ ยกเลิกคำสั่งวัดระยะ");
                return;
            }
            if (cadCalibrateState.active) {
                cancelCadCalibrate();
                showWarning("⏹️ ยกเลิกคำสั่ง CALIBRATE สเกล");
                return;
            }
            if (cadOffsetSelectingEdge) {
                cadOffsetSelectingEdge = false;
                cadHoveredEdge = -1;
                showWarning("⏹️ ยกเลิกคำสั่ง OFFSET");
                updateCadStatusText();
                redrawPolyEditor();
                if (cadStudioOpen) redrawCadStudio();
                return;
            }
            if (polyDrawingMode) {
                setDrawingMode(false);
                showWarning("⏹️ จบคำสั่งวาดเส้น (Exit LINE command)");
            } else if (polyPickStartMode) {
                togglePickStartMode(false);
            } else if (cadStudioOpen) {
                closeCadStudio();
            }
        } else if (!isTypingInput) {
            let k = e.key.toLowerCase();
            if (k === 'a') {
                e.preventDefault();
                startCadArc();
            } else if (k === 'g') {
                e.preventDefault();
                startCadGuide();
            } else if (k === 'd') {
                e.preventDefault();
                startCadMeasure();
            } else if (k === 'o') {
                e.preventDefault();
                startCadOffsetCommand();
            } else if (k === 'l') {
                e.preventDefault();
                setDrawingMode(true);
                showWarning("✏️ เริ่มคำสั่ง LINE (คลิกเพื่อวางจุด หรือพิมพ์ระยะแล้ว Enter)");
            } else if (k === 'c' && polyDrawingMode && polygonPoints.length >= 3) {
                e.preventDefault();
                polyCloseShape();
            } else if (k === 'u') {
                e.preventDefault();
                cadUndo();
            } else if (k === 'r') {
                e.preventDefault();
                cadOpenPrompt('rotate');
            } else if (k === 'm') {
                e.preventDefault();
                cadOpenPrompt('mirror');
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (cadStudioOpen) {
                let distInput = document.getElementById('cadDirectDistInput');
                let cmdInput = document.getElementById('cadCommandLineInput');
                if (distInput && activeEl === distInput) {
                    cadApplyDirectDistance();
                } else if (cmdInput && activeEl === cmdInput) {
                    cadExecuteCommandLine(cmdInput.value);
                    cmdInput.value = '';
                } else if (polyDrawingMode) {
                    if (polygonPoints.length >= 3) {
                        polyCloseShape();
                    } else {
                        setDrawingMode(false);
                        showWarning("⏹️ จบคำสั่งวาดเส้น");
                    }
                }
            } else if (currentMode === 'polygon' && polyDrawingMode && !isTypingInput) {
                if (polygonPoints.length >= 3) {
                    polyCloseShape();
                } else {
                    setDrawingMode(false);
                }
            }
        }
    });

    window.addEventListener('keyup', function(e) {
        if (e.key === 'Shift') {
            isShiftPressed = false;
            let orthoActive = document.getElementById('cadBtnOrtho')?.classList.contains('active') || false;
            cadOrtho = orthoActive;
            if (cadStudioOpen) {
                cadHover = cadCalculateSnapAndWorld(cadMouseScreen.x, cadMouseScreen.y, orthoActive);
                updateCadStatusText();
                redrawCadStudio();
            } else if (currentMode === 'polygon' && lastMousePos) {
                polyHover = polyScreenToWorld(lastMousePos.x, lastMousePos.y, false);
                redrawPolyEditor();
            }
        }
    });

    c.addEventListener('mousemove', function (evt) {
        const pos = polyCanvasPos(evt);
        lastMousePos = pos;
        isShiftPressed = evt.shiftKey;

        // 1. กำลังลากเส้นแนวเริ่มมุง
        if (isDraggingStartSeam) {
            let p = polyScreenToWorld(pos.x, pos.y, false, false);
            // Auto-Snap เข้าหาจุดมุม
            if (polygonPoints.length > 0) {
                for (let pt of polygonPoints) {
                    if (Math.abs(p.x - pt.x) < 0.30) {
                        p.x = pt.x;
                        break;
                    }
                }
            }
            polyStartSeamX = Math.round(p.x * 100) / 100;
            redrawPolyEditor();
            if (calcData.calculated && currentMode === 'polygon') calculate();
            return;
        }

        // 2. กำลังลากจุดมุม
        if (draggingPointIndex >= 0 && draggingPointIndex < polygonPoints.length) {
            const p = polyScreenToWorld(pos.x, pos.y, false);
            polygonPoints[draggingPointIndex] = p;
            renderPointList();
            redrawPolyEditor();
            if (calcData.calculated && currentMode === 'polygon') calculate();
            return;
        }

        if (polyDrawingMode || cadArcState.active || cadMeasureState.active || cadCalibrateState.active) {
            polyHover = polyScreenToWorld(pos.x, pos.y, evt.shiftKey);
        } else {
            polyHover = null;
        }
        
        // ตรวจสอบเมาส์อยู่ใกล้แนวเริ่มมุงหรือไม่
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : (polygonPoints[0]?.x || 0);
        let sSeamX = seamX * polyView.scale + polyView.ox;
        let isNearSeam = polygonPoints.length >= 3 && Math.abs(pos.x - sSeamX) < 14;

        polyHoveredPointIdx = -1;
        for (let i = 0; i < polygonPoints.length; i++) {
            let s = polyToScreen(polygonPoints[i]);
            if (Math.hypot(pos.x - s.x, pos.y - s.y) < 10) {
                polyHoveredPointIdx = i;
                break;
            }
        }

        // ตรวจสอบเมาส์อยู่ใกล้เส้นขอบใดเพื่อไฮไลต์ (เมื่อไม่ได้กำลังวาดเส้น หรือเมื่อกดคำสั่ง OFFSET)
        if (!polyDrawingMode && !cadCalibrateState.active && !cadMeasureState.active && !cadArcState.active && !cadGuideState.active && !polyPickStartMode) {
            cadHoveredEdge = findHoveredEdge(pos.x, pos.y, polyToScreen);
        } else {
            cadHoveredEdge = -1;
        }

        if (polyPickStartMode) {
            c.style.cursor = 'crosshair';
        } else if (cadArcState.active || cadGuideState.active || cadMeasureState.active || cadCalibrateState.active) {
            c.style.cursor = 'crosshair';
        } else if (isNearSeam) {
            c.style.cursor = 'ew-resize';
        } else if (polyHoveredPointIdx >= 0) {
            c.style.cursor = 'grab';
        } else if (cadHoveredEdge >= 0 && !polyDrawingMode) {
            c.style.cursor = 'pointer';
        } else if (polyDrawingMode) {
            c.style.cursor = 'crosshair';
        } else {
            c.style.cursor = 'default';
        }
        redrawPolyEditor();
    });

    c.addEventListener('mousedown', function (evt) {
        if (evt.button !== 0) return;
        if (cadArcState.active || cadGuideState.active || cadMeasureState.active || cadCalibrateState.active || polyPickStartMode) {
            return;
        }
        const pos = polyCanvasPos(evt);

        // ตรวจสอบคลิกโดนแนวเริ่มมุงเพื่อลาก
        if (polygonPoints.length >= 3) {
            let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : (polygonPoints[0]?.x || 0);
            let sSeamX = seamX * polyView.scale + polyView.ox;
            if (Math.abs(pos.x - sSeamX) < 14) {
                isDraggingStartSeam = true;
                c.style.cursor = 'ew-resize';
                return;
            }
        }

        // ตรวจสอบคลิกลากจุดมุม
        for (let i = 0; i < polygonPoints.length; i++) {
            let s = polyToScreen(polygonPoints[i]);
            if (Math.hypot(pos.x - s.x, pos.y - s.y) < 10) {
                if (i === 0 && polygonPoints.length >= 3 && polyDrawingMode) continue;
                draggingPointIndex = i;
                c.style.cursor = 'grabbing';
                break;
            }
        }
    });

    window.addEventListener('mouseup', function () {
        if (isDraggingStartSeam) {
            isDraggingStartSeam = false;
            c.style.cursor = polyDrawingMode ? 'crosshair' : 'default';
            redrawPolyEditor();
            if (calcData.calculated && currentMode === 'polygon') calculate();
        }
        if (draggingPointIndex >= 0) {
            draggingPointIndex = -1;
            c.style.cursor = polyDrawingMode ? 'crosshair' : 'default';
            saveCadState();
            redrawPolyEditor();
            if (calcData.calculated && currentMode === 'polygon') calculate();
        }
    });

    c.addEventListener('mouseleave', function () {
        if (draggingPointIndex === -1 && !isDraggingStartSeam) {
            polyHover = null;
            if (!cadOffsetSelectingEdge) cadHoveredEdge = -1;
            redrawPolyEditor();
        }
    });

    c.addEventListener('click', function (evt) {
        if (draggingPointIndex >= 0 || isDraggingStartSeam) return;

        // โหมดคลิกเลือกจุดเริ่มมุง (Pick Start Seam Mode)
        if (polyPickStartMode && polygonPoints.length >= 3) {
            const pos = polyCanvasPos(evt);
            let p = polyScreenToWorld(pos.x, pos.y, false, false);
            for (let pt of polygonPoints) {
                let s = polyToScreen(pt);
                if (Math.hypot(pos.x - s.x, pos.y - s.y) < 18) {
                    p.x = pt.x;
                    break;
                }
            }
            polyStartSeamX = Math.round(p.x * 100) / 100;
            togglePickStartMode(false);
            showWarning(`📍 ตั้งแนวเริ่มมุงที่ X = ${polyStartSeamX.toFixed(2)} ม. เรียบร้อย`);
            redrawPolyEditor();
            if (cadStudioOpen) redrawCadStudio();
            calculate();
            return;
        }

        // ถ้าอยู่ในโหมดสร้างเส้นไกด์ไลน์ (GUIDELINE)
        if (cadGuideState.active) {
            const pos = polyCanvasPos(evt);
            let p = polyScreenToWorld(pos.x, pos.y, evt.shiftKey);
            handleGuidePointClick(p);
            return;
        }

        // ถ้าอยู่ในโหมดวาดเส้นโค้ง (ARC)
        if (cadArcState.active) {
            const pos = polyCanvasPos(evt);
            let p = polyScreenToWorld(pos.x, pos.y, evt.shiftKey);
            handleArcPointClick(p);
            return;
        }

        // ถ้าอยู่ในโหมดวัดระยะ (MEASURE)
        if (cadMeasureState.active) {
            const pos = polyCanvasPos(evt);
            let p = polyScreenToWorld(pos.x, pos.y, evt.shiftKey);
            let finalPt = p;
            if (cadMeasureState.step === 2 && cadMeasureState.pt1) {
                let isOrtho = evt.shiftKey || isShiftPressed || orthoModeActive;
                if (isOrtho) {
                    let dx = Math.abs(p.x - cadMeasureState.pt1.x);
                    let dy = Math.abs(p.y - cadMeasureState.pt1.y);
                    if (dx >= dy) finalPt = { x: p.x, y: cadMeasureState.pt1.y };
                    else finalPt = { x: cadMeasureState.pt1.x, y: p.y };
                }
            }
            handleMeasurePointClick(finalPt);
            return;
        }

        // ถ้าอยู่ในโหมด Calibrate ปรับสเกลภาพ
        if (cadCalibrateState.active) {
            const pos = polyCanvasPos(evt);
            let wx = (pos.x - polyView.ox) / polyView.scale;
            let wy = (polyView.oy - pos.y) / polyView.scale;
            let raw = { x: Math.round(wx * 1000) / 1000, y: Math.round(wy * 1000) / 1000 };
            let finalPt = raw;
            if (cadCalibrateState.step === 2 && cadCalibrateState.pt1) {
                let isOrtho = evt.shiftKey || isShiftPressed || orthoModeActive;
                if (isOrtho) {
                    let dx = Math.abs(raw.x - cadCalibrateState.pt1.x);
                    let dy = Math.abs(raw.y - cadCalibrateState.pt1.y);
                    if (dx >= dy) finalPt = { x: raw.x, y: cadCalibrateState.pt1.y };
                    else finalPt = { x: cadCalibrateState.pt1.x, y: raw.y };
                }
            }
            handleCalibratePointClick(finalPt);
            return;
        }
        
        // ถ้าอยู่ในโหมดเลือกเส้นออฟเซ็ต และคลิกโดนเส้นขอบ
        if (cadOffsetSelectingEdge && cadHoveredEdge >= 0 && polygonPoints.length >= 3) {
            let edgeIdx = cadHoveredEdge;
            cadOpenPrompt('offset', edgeIdx);
            return;
        }

        // ถ้าไม่ได้อยู่ในโหมดวาดเส้น (Selection / Edit Mode):
        if (!polyDrawingMode) {
            // 1. ถ้าคลิกโดนเส้นขอบ -> เปิดหน้าต่างแก้ไขความยาวเส้น
            if (cadHoveredEdge >= 0 && cadHoveredEdge < polygonPoints.length && polygonPoints.length >= 2) {
                selectedEdgeForOffset = cadHoveredEdge;
                cadOpenPrompt('edge_edit', cadHoveredEdge);
                return;
            }
            if (polygonPoints.length === 0) {
                setDrawingMode(true);
            } else {
                return;
            }
        }

        const pos = polyCanvasPos(evt);
        const p = polyScreenToWorld(pos.x, pos.y, evt.shiftKey);

        if (polygonPoints.length >= 3) {
            let first = polyToScreen(polygonPoints[0]);
            if (Math.hypot(pos.x - first.x, pos.y - first.y) < 14) {
                polyCloseShape();
                return;
            }
        }

        let last = polygonPoints[polygonPoints.length - 1];
        if (last && last.x === p.x && last.y === p.y) return;

        saveCadState();
        polygonPoints.push(p);
        renderPointList();
        redrawPolyEditor();
        if (calcData.calculated && currentMode === 'polygon') calculate();
    });

    c.addEventListener('dblclick', function () {
        openCadStudio();
    });

    redrawPolyEditor();
}

function togglePickStartMode(forceState) {
    polyPickStartMode = (forceState !== undefined) ? forceState : !polyPickStartMode;
    
    let btns = [document.getElementById('btnPickStartPoint'), document.getElementById('cadBtnPickStart')];
    btns.forEach(b => {
        if (b) {
            b.classList.toggle('active', polyPickStartMode);
            b.style.backgroundColor = polyPickStartMode ? '#16a34a' : '';
            b.style.color = polyPickStartMode ? '#ffffff' : '';
        }
    });

    if (polyPickStartMode) {
        showWarning("📍 คลิกบนภาพวาดหรือคลิกที่จุดมุมหลังคา เพื่อตั้งเป็นแนวเริ่มมุงแผ่นแรก");
    }
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function toggleOrthoMode() {
    orthoModeActive = !orthoModeActive;
    let btn = document.getElementById('btnOrthoMode');
    if (btn) {
        btn.classList.toggle('active', orthoModeActive);
        btn.style.backgroundColor = orthoModeActive ? '#2563eb' : '';
        btn.style.color = orthoModeActive ? '#ffffff' : '';
    }
    if (polyHover && lastMousePos && polyDrawingMode) {
        polyHover = polyScreenToWorld(lastMousePos.x, lastMousePos.y, false);
        redrawPolyEditor();
    }
}

function polyCloseShape() {
    if (polygonPoints.length < 3) {
        showWarning("ต้องมีจุดอย่างน้อย 3 จุดจึงจะปิดรูปทรงได้");
        return;
    }
    saveCadState();
    setDrawingMode(false);
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    calculate();
    showWarning("✓ ปิดรูปทรงหลังคาเรียบร้อย (จบคำสั่ง LINE)");
}

function clearPoints() {
    saveCadState();
    polygonPoints = [];
    polyStartSeamX = null;
    setDrawingMode(true);
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
    if (calcData.calculated && currentMode === 'polygon') calculate();
    showWarning("🗑️ ล้างจุดพิกัดทั้งหมดเรียบร้อย");
}

function loadPolyPreset(type) {
    saveCadState();
    if (type === 'gable') {
        polygonPoints = [
            { x: 0, y: 0 },
            { x: 4.0, y: 7.0 },
            { x: 8.0, y: 0 }
        ];
        polyStartSeamX = 0;
    } else if (type === 'rect') {
        polygonPoints = [
            { x: 0, y: 0 },
            { x: 0, y: 10.0 },
            { x: 3.75, y: 10.0 },
            { x: 3.75, y: 0 }
        ];
        polyStartSeamX = 0;
    } else if (type === 'rightTri') {
        polygonPoints = [
            { x: 0, y: 0 },
            { x: 0, y: 5.0 },
            { x: 6.0, y: 0 }
        ];
        polyStartSeamX = 0;
    } else if (type === 'trapezoid') {
        polygonPoints = [
            { x: 0, y: 0 },
            { x: 0, y: 3.0 },
            { x: 6.0, y: 6.0 },
            { x: 6.0, y: 0 }
        ];
        polyStartSeamX = 0;
    } else if (type === 'lshape') {
        polygonPoints = [
            { x: 0, y: 0 },
            { x: 0, y: 6.0 },
            { x: 3.0, y: 6.0 },
            { x: 3.0, y: 3.0 },
            { x: 6.0, y: 3.0 },
            { x: 6.0, y: 0 }
        ];
        polyStartSeamX = 0;
    }
    setDrawingMode(false); // ปิดโหมดวาดเส้น ไม่ให้มีเส้นตามเมาส์
    renderPointList();
    redrawPolyEditor();
    if (cadStudioOpen) {
        cadZoomExtents();
        redrawCadStudio();
    }
    calculate();
}

function redrawPolyEditor() {
    const c = document.getElementById('polyDrawCanvas');
    if (!c || (c.offsetParent === null && document.getElementById('inputs-polygon').style.display === 'none')) return;
    
    if (c.clientWidth > 0 && c.width !== c.clientWidth) {
        c.width = c.clientWidth;
        c.height = c.clientHeight > 0 ? c.clientHeight : 270;
    }
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    let step = getPolyStep();

    polyFitView();

    // 1. พื้นหลัง + กริด
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 1.1 ภาพพื้นหลังแบบแปลน / PDF Underlay ใน Canvas ย่อ
    if (cadBgImage.img && cadBgImage.visible) {
        ctx.save();
        ctx.globalAlpha = cadBgImage.opacity;
        // พิกัด World Y ในระบบ (cadBgImage.x, cadBgImage.y)
        let sTL = polyToScreen({ x: cadBgImage.x, y: cadBgImage.y });
        let sW = cadBgImage.width * polyView.scale;
        let sH = cadBgImage.height * polyView.scale;
        ctx.drawImage(cadBgImage.img, sTL.x, sTL.y, sW, sH);

        // ถ้าปลดล็อกอยู่ ให้แสดงกรอบประสีฟ้า
        if (!cadBgImage.locked) {
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(sTL.x, sTL.y, sW, sH);
        }
        ctx.restore();
    }

    ctx.lineWidth = 1;
    let labelEvery = Math.max(1, Math.round(1 / step));

    let stepPx = step * polyView.scale;
    let startGX = Math.floor((0 - polyView.ox) / stepPx);
    let endGX = Math.ceil((w - polyView.ox) / stepPx);
    let startGY = Math.floor((polyView.oy - h) / stepPx);
    let endGY = Math.ceil((polyView.oy - 0) / stepPx);

    for (let i = startGX; i <= endGX; i++) {
        let sx = polyView.ox + i * stepPx;
        ctx.strokeStyle = (i % labelEvery === 0) ? '#cbd5e1' : '#f1f5f9';
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
        if (i % labelEvery === 0) {
            ctx.fillStyle = '#94a3b8'; ctx.font = '10px Sarabun'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText((i * step).toFixed(step < 1 ? 1 : 0), sx, h - 14);
        }
    }
    for (let j = startGY; j <= endGY; j++) {
        let sy = polyView.oy - j * stepPx;
        ctx.strokeStyle = (j % labelEvery === 0) ? '#cbd5e1' : '#f1f5f9';
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
        if (j % labelEvery === 0) {
            ctx.fillStyle = '#94a3b8'; ctx.font = '10px Sarabun'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText((j * step).toFixed(step < 1 ? 1 : 0), 4, sy);
        }
    }

    // 2. เส้นรูปหลายเหลี่ยม
    if (polygonPoints.length > 0) {
        ctx.beginPath();
        polygonPoints.forEach((p, i) => {
            let s = polyToScreen(p);
            if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        if (polygonPoints.length >= 3) ctx.closePath();
        ctx.fillStyle = 'rgba(59,130,246,0.07)';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // 3. เส้น Preview (เฉพาะเมื่ออยู่ในโหมดวาดเส้น polyDrawingMode)
        if (polyDrawingMode && polyHover && draggingPointIndex === -1 && !isDraggingStartSeam && !polyPickStartMode) {
            let last = polyToScreen(polygonPoints[polygonPoints.length - 1]);
            let hv = polyToScreen(polyHover);
            
            let isLocked = isShiftPressed || orthoModeActive;
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = isLocked ? '#16a34a' : '#3b82f6';
            ctx.lineWidth = isLocked ? 2 : 1.5;
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(hv.x, hv.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let lastWorld = polygonPoints[polygonPoints.length - 1];
            let dist = Math.hypot(polyHover.x - lastWorld.x, polyHover.y - lastWorld.y);
            if (dist > 0.01) {
                let midX = (last.x + hv.x) / 2;
                let midY = (last.y + hv.y) / 2;
                let lockText = "";
                if (isLocked) {
                    if (Math.abs(polyHover.y - lastWorld.y) < 0.001) lockText = " [🔒 ล็อกราบ]";
                    else lockText = " [🔒 ล็อกดิ่ง]";
                }
                let badgeText = `${dist.toFixed(2)} ม.${lockText}`;
                
                ctx.font = 'bold 11px Sarabun';
                let tm = ctx.measureText(badgeText);
                ctx.fillStyle = isLocked ? 'rgba(22, 163, 74, 0.95)' : 'rgba(30, 41, 59, 0.85)';
                ctx.beginPath();
                ctx.roundRect(midX - tm.width / 2 - 6, midY - 18, tm.width + 12, 20, 4);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, midX, midY - 8);
            }
        }

        // ไฮไลต์เส้นขอบที่เมาส์ชี้ (Edge Hover Highlight)
        if ((cadOffsetSelectingEdge || !polyDrawingMode) && polygonPoints.length >= 2 && cadHoveredEdge >= 0 && cadHoveredEdge < polygonPoints.length && draggingPointIndex === -1 && !isDraggingStartSeam && !polyPickStartMode && !cadCalibrateState.active && !cadMeasureState.active) {
            let p1 = polygonPoints[cadHoveredEdge];
            let p2 = polygonPoints[(cadHoveredEdge + 1) % polygonPoints.length];
            let s1 = polyToScreen(p1);
            let s2 = polyToScreen(p2);
            let edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();

            [s1, s2].forEach(s => {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 5.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            let midX = (s1.x + s2.x) / 2;
            let midY = (s1.y + s2.y) / 2;
            let badgeText = cadOffsetSelectingEdge ?
                `📐 ด้านที่ ${cadHoveredEdge + 1}: ${edgeLen.toFixed(2)} ม. (คลิกเพื่อออฟเซ็ต)` :
                `📐 ด้านที่ ${cadHoveredEdge + 1}: ${edgeLen.toFixed(2)} ม. (คลิกเพื่อปรับระยะ/ออฟเซ็ต)`;
            ctx.font = 'bold 11px Sarabun';
            let tm = ctx.measureText(badgeText);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 6, midY - 22, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, midX, midY - 12);
            ctx.restore();
        }
    }

    // 3.0 เส้นไกด์ไลน์ช่วยร่างแบบ (Construction Lines / XLINE ใน Canvas ย่อ)
    if (cadShowGuides && cadGuideLines.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([6, 5]);

        cadGuideLines.forEach((g) => {
            if (g.type === 'h') {
                let sy = polyToScreen({ x: 0, y: g.p1.y }).y;
                ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();

                ctx.font = 'bold 9px Sarabun';
                ctx.fillStyle = '#d97706';
                ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                ctx.fillText(`📐 ไกด์ Y=${g.p1.y.toFixed(2)}m`, 10, sy - 2);
            } else if (g.type === 'v') {
                let sx = polyToScreen({ x: g.p1.x, y: 0 }).x;
                ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();

                ctx.font = 'bold 9px Sarabun';
                ctx.fillStyle = '#d97706';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(`📐 ไกด์ X=${g.p1.x.toFixed(2)}m`, sx + 3, 10);
            } else {
                let bigD = 2000;
                let s1 = polyToScreen({ x: g.p1.x - g.dx * bigD, y: g.p1.y - g.dy * bigD });
                let s2 = polyToScreen({ x: g.p1.x + g.dx * bigD, y: g.p1.y + g.dy * bigD });
                ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
            }
        });
        ctx.restore();
    }

    // 3.1 เส้นไกด์ Auto-Snap ตรงแนว (Object Snap Tracking Guides)
    if (polyDrawingMode && polyInlineTrackingGuides && polyInlineTrackingGuides.length > 0 && draggingPointIndex === -1 && !isDraggingStartSeam && !polyPickStartMode) {
        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        polyInlineTrackingGuides.forEach(g => {
            let sFrom = polyToScreen(g.from);
            let sTarget = polyToScreen(g.target);

            ctx.beginPath();
            ctx.moveTo(sFrom.x, sFrom.y);
            ctx.lineTo(sTarget.x, sTarget.y);
            ctx.stroke();

            // กล่องสัญลักษณ์สแนปตรงแนว
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(sFrom.x - 3, sFrom.y - 3, 6, 6);

            let midX = (sFrom.x + sTarget.x) / 2;
            let midY = (sFrom.y + sTarget.y) / 2;
            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(g.label);
            ctx.fillStyle = 'rgba(240, 253, 244, 0.95)';
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY - 16, tm.width + 8, 16, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#166534';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(g.label, midX, midY - 8);
        });
        ctx.restore();
    }

    // 3.2 เส้นไกด์ Calibration (การตั้งสเกลจริง) ใน Canvas ย่อ
    if (cadCalibrateState.active && cadCalibrateState.pt1) {
        ctx.save();
        let pt1 = cadCalibrateState.pt1;
        let s1 = polyToScreen({ x: pt1.x, y: pt1.y });
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        let isOrtho = isShiftPressed || orthoModeActive;
        let rawTarget = (cadCalibrateState.pt2) ? cadCalibrateState.pt2 : (polyHover ? polyHover : pt1);
        let targetPt = rawTarget;
        let lockMode = 'free';

        if (isOrtho && !cadCalibrateState.pt2) {
            let dx = Math.abs(rawTarget.x - pt1.x);
            let dy = Math.abs(rawTarget.y - pt1.y);
            if (dx >= dy) {
                targetPt = { x: rawTarget.x, y: pt1.y };
                lockMode = 'horizontal';
            } else {
                targetPt = { x: pt1.x, y: rawTarget.y };
                lockMode = 'vertical';
            }
        }

        let sTarget = polyToScreen({ x: targetPt.x, y: targetPt.y });

        ctx.beginPath();
        ctx.arc(sTarget.x, sTarget.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = isOrtho ? '#22c55e' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isOrtho ? '#22c55e' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(sTarget.x, sTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);

        let distNow = Math.hypot(targetPt.x - pt1.x, targetPt.y - pt1.y);
        let midX = (s1.x + sTarget.x) / 2;
        let midY = (s1.y + sTarget.y) / 2;
        let lockText = isOrtho ? (lockMode === 'horizontal' ? " [ราบ]" : " [ดิ่ง]") : " [อิสระ]";
        let calText = `${distNow.toFixed(2)} ม.${lockText}`;

        ctx.font = 'bold 10px Sarabun';
        let tm = ctx.measureText(calText);
        ctx.fillStyle = isOrtho ? 'rgba(22, 163, 74, 0.95)' : 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(midX - tm.width / 2 - 4, midY - 16, tm.width + 8, 16, 3);
        ctx.fill();
        ctx.fillStyle = isOrtho ? '#ffffff' : '#000000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(calText, midX, midY - 8);
        ctx.restore();
    }

    // 3.3 เครื่องมือวัดระยะ (Measure Distance Tool) ใน Canvas ย่อ
    if (cadMeasureState.active || cadMeasureState.result) {
        ctx.save();
        if (cadMeasureState.step === 1 || (!cadMeasureState.pt1 && !cadMeasureState.result)) {
            if (polyHover) {
                let sHover = polyToScreen(polyHover);
                ctx.beginPath();
                ctx.arc(sHover.x, sHover.y, 6, 0, 2 * Math.PI);
                ctx.strokeStyle = '#059669';
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }
        } else {
            let pt1 = cadMeasureState.pt1;
            let isOrtho = isShiftPressed || orthoModeActive;
            let rawTarget = (cadMeasureState.pt2) ? cadMeasureState.pt2 : (polyHover ? polyHover : pt1);
            let targetPt = rawTarget;
            let lockMode = 'free';

            if (isOrtho && !cadMeasureState.pt2) {
                let dx = Math.abs(rawTarget.x - pt1.x);
                let dy = Math.abs(rawTarget.y - pt1.y);
                if (dx >= dy) {
                    targetPt = { x: rawTarget.x, y: pt1.y };
                    lockMode = 'horizontal';
                } else {
                    targetPt = { x: pt1.x, y: rawTarget.y };
                    lockMode = 'vertical';
                }
            }

            let s1 = polyToScreen({ x: pt1.x, y: pt1.y });
            let sTarget = polyToScreen({ x: targetPt.x, y: targetPt.y });

            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 4.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#059669';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(sTarget.x, sTarget.y, 4.5, 0, 2 * Math.PI);
            ctx.fillStyle = isOrtho ? '#059669' : '#0284c7';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = isOrtho ? '#059669' : '#0284c7';
            ctx.lineWidth = 2;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(sTarget.x, sTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let dist = Math.hypot(targetPt.x - pt1.x, targetPt.y - pt1.y);
            let dx = Math.abs(targetPt.x - pt1.x);
            let dy = Math.abs(targetPt.y - pt1.y);

            let midX = (s1.x + sTarget.x) / 2;
            let midY = (s1.y + sTarget.y) / 2;
            let lockText = isOrtho ? (lockMode === 'horizontal' ? " [ราบ]" : " [ดิ่ง]") : "";
            let mText = `📐 ${dist.toFixed(2)}m (ΔX:${dx.toFixed(2)}, ΔY:${dy.toFixed(2)})${lockText}`;

            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(mText);
            ctx.fillStyle = isOrtho ? 'rgba(5, 150, 105, 0.95)' : 'rgba(2, 132, 199, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY - 16, tm.width + 8, 16, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(mText, midX, midY - 8);
        }
        ctx.restore();
    }

    // 3.3 เส้นพรีวิวเครื่องมือวาดส่วนโค้ง (3-POINT ARC PREVIEW ใน Canvas ย่อ)
    if (cadArcState.active) {
        ctx.save();
        if (cadArcState.step === 1 || !cadArcState.pt1) {
            if (polyHover) {
                let sHover = polyToScreen(polyHover);
                ctx.beginPath();
                ctx.arc(sHover.x, sHover.y, 6, 0, 2 * Math.PI);
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2;
                ctx.stroke();

                let badge = "⌒ คลิก 'จุดที่ 1' จุดเริ่มโค้ง";
                ctx.font = 'bold 10px Sarabun';
                let tm = ctx.measureText(badge);
                ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
                ctx.beginPath();
                ctx.roundRect(sHover.x + 8, sHover.y - 10, tm.width + 10, 18, 3);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(badge, sHover.x + 13, sHover.y);
            }
        } else if (cadArcState.step === 2) {
            let p1 = cadArcState.pt1;
            let s1 = polyToScreen(p1);
            let sHover = polyHover ? polyToScreen(polyHover) : s1;

            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.8;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(sHover.x, sHover.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let dist = polyHover ? Math.hypot(polyHover.x - p1.x, polyHover.y - p1.y) : 0;
            let badge = `⌒ จุดยอดโค้ง P2 (${dist.toFixed(2)}m)`;
            let midX = (s1.x + sHover.x) / 2;
            let midY = (s1.y + sHover.y) / 2;

            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY - 16, tm.width + 8, 16, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 8);
        } else if (cadArcState.step === 3 && cadArcState.pt1 && cadArcState.pt2) {
            let p1 = cadArcState.pt1;
            let p2 = cadArcState.pt2;
            let p3 = polyHover ? polyHover : p2;

            let s1 = polyToScreen(p1);
            let s2 = polyToScreen(p2);
            let s3 = polyToScreen(p3);

            [s1, s2].forEach((s, idx) => {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = idx === 0 ? '#0284c7' : '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            ctx.beginPath();
            ctx.arc(s3.x, s3.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            let arcPts = generateArcPoints(p1, p2, p3);
            if (arcPts && arcPts.length > 1) {
                ctx.beginPath();
                arcPts.forEach((pt, idx) => {
                    let s = polyToScreen(pt);
                    if (idx === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
                });
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2.4;
                ctx.stroke();
            }

            let arcInfo = calculate3PointArc(p1, p2, p3);
            let badge = arcInfo ? `⌒ R:${arcInfo.radius.toFixed(2)}m (ยาว ${arcInfo.arcLength.toFixed(2)}m)` : `⌒ ส่วนโค้ง`;
            let midX = (s1.x + s3.x) / 2;
            let midY = (s1.y + s3.y) / 2;

            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY - 18, tm.width + 8, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 9);
        }
        ctx.restore();
    }

    // 3.5 เส้นพรีวิวเครื่องมือวางเส้นไกด์ไลน์ (GUIDELINE PREVIEW ใน Canvas ย่อ)
    if (cadGuideState.active) {
        ctx.save();
        if (cadGuideState.step === 1 || !cadGuideState.pt1) {
            let cur = polyHover || { x: 0, y: 0 };
            let sHover = polyToScreen(cur);
            ctx.beginPath();
            ctx.arc(sHover.x, sHover.y, 7, 0, 2 * Math.PI);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();

            let badge = "📐 คลิก 'จุดที่ 1' วางเส้นไกด์";
            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sHover.x + 10, sHover.y - 8, tm.width + 10, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, sHover.x + 15, sHover.y + 1);
        } else if (cadGuideState.step === 2 && cadGuideState.pt1) {
            let p1 = cadGuideState.pt1;
            let isOrtho = isShiftPressed || orthoModeActive;
            let p2 = polyHover || p1;
            if (isOrtho) {
                let dx = Math.abs(p2.x - p1.x);
                let dy = Math.abs(p2.y - p1.y);
                if (dx >= dy) p2 = { x: p2.x, y: p1.y };
                else p2 = { x: p1.x, y: p2.y };
            }

            let s1 = polyToScreen(p1);
            let s2 = polyToScreen(p2);

            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let len = Math.hypot(dx, dy);
            if (len > 0.01) {
                let normDx = dx / len;
                let normDy = dy / len;
                let bigD = 2000;
                let sStart = polyToScreen({ x: p1.x - normDx * bigD, y: p1.y - normDy * bigD });
                let sEnd = polyToScreen({ x: p1.x + normDx * bigD, y: p1.y + normDy * bigD });

                ctx.beginPath();
                ctx.setLineDash([6, 5]);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.8;
                ctx.moveTo(sStart.x, sStart.y);
                ctx.lineTo(sEnd.x, sEnd.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            let angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 180;
            let badge = `📐 ไกด์: ${angleDeg.toFixed(1)}° (คลิกจุดที่ 2)`;
            let midX = (s1.x + s2.x) / 2;
            let midY = (s1.y + s2.y) / 2;

            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 4, midY - 18, tm.width + 8, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 9);
        }
        ctx.restore();
    }

    // 4. เส้นแนวเริ่มมุงแบบคลิกลากได้ (Start Seam Line & Draggable Badge)
    if (polygonPoints.length >= 3) {
        let minX = Math.min(...polygonPoints.map(p => p.x));
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : minX;
        let sSeamX = seamX * polyView.scale + polyView.ox;

        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(sSeamX, 0);
        ctx.lineTo(sSeamX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge ด้ามจับ
        let badgeText = `📍 เริ่มมุง X: ${seamX.toFixed(2)} ม.`;
        ctx.font = 'bold 10px Sarabun';
        let btm = ctx.measureText(badgeText);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.roundRect(sSeamX - btm.width / 2 - 6, h - 22, btm.width + 12, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, sSeamX, h - 13);
        ctx.restore();
    }

    // 5. จุดพิกัด
    let totalInlinePts = polygonPoints.length;
    polygonPoints.forEach((p, i) => {
        let s = polyToScreen(p);
        let isHovered = (polyHoveredPointIdx === i);

        ctx.beginPath();
        let ptRadius = (totalInlinePts > 16) ? 3.5 : 4.5;
        ctx.arc(s.x, s.y, ptRadius, 0, 2 * Math.PI);
        ctx.fillStyle = (i === 0) ? '#16a34a' : (isHovered ? '#f59e0b' : '#2563eb');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (isHovered) {
            let tipText = `P${i + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
            ctx.font = 'bold 10px Sarabun';
            let tm = ctx.measureText(tipText);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.beginPath();
            ctx.roundRect(s.x + 6, s.y - 18, tm.width + 8, 16, 3);
            ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(tipText, s.x + 10, s.y - 10);
        } else if (cadShowCoords) {
            let showThisPoint = (totalInlinePts <= 16) || (i === 0 || i === totalInlinePts - 1 || i % 4 === 0);
            if (showThisPoint) {
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 9px Sarabun';
                ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                ctx.fillText(`P${i + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, s.x + 5, s.y - 3);
            }
        }
    });

    // 6. วงแหวนปิดรูปทรง (เฉพาะเมื่ออยู่ในโหมดวาดเส้น)
    if (polyDrawingMode && polygonPoints.length >= 3 && polyHover && draggingPointIndex === -1 && !isDraggingStartSeam && !polyPickStartMode) {
        let first = polyToScreen(polygonPoints[0]);
        let hv = polyToScreen(polyHover);
        if (Math.hypot(hv.x - first.x, hv.y - first.y) < 14) {
            ctx.beginPath();
            ctx.arc(first.x, first.y, 11, 0, 2 * Math.PI);
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // 6.1 OSNAP Markers in Inline Preview
    if (polyInlineSnapType && polyInlineSnapPt) {
        let sSnap = polyToScreen(polyInlineSnapPt);
        if (polyInlineSnapType === 'endpoint') {
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            let sz = 8;
            ctx.strokeRect(sSnap.x - sz / 2, sSnap.y - sz / 2, sz, sz);
        } else if (polyInlineSnapType === 'midpoint') {
            ctx.beginPath();
            ctx.moveTo(sSnap.x, sSnap.y - 7);
            ctx.lineTo(sSnap.x - 7, sSnap.y + 6);
            ctx.lineTo(sSnap.x + 7, sSnap.y + 6);
            ctx.closePath();
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(22, 163, 74, 0.25)';
            ctx.fill();
        } else if (polyInlineSnapType === 'guideIntersection' || polyInlineSnapType === 'guideEdgeIntersection') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.6;
            let sz = 6;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y + sz);
            ctx.moveTo(sSnap.x + sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x - sz, sSnap.y + sz);
            ctx.stroke();
        } else if (polyInlineSnapType === 'nearestEdge') {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2.2;
            let sz = 5;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x - sz, sSnap.y + sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y + sz);
            ctx.closePath();
            ctx.stroke();
        } else if (polyInlineSnapType === 'guideLine') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.2;
            let sz = 5;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y); ctx.lineTo(sSnap.x + sz, sSnap.y);
            ctx.moveTo(sSnap.x, sSnap.y - sz); ctx.lineTo(sSnap.x, sSnap.y + sz);
            ctx.stroke();
        }
    }

    // 6.15 พรีวิวแนวเริ่มมุงแบบเรียลไทม์ (Live Start Seam Pick Preview in Inline)
    if (polyPickStartMode && polygonPoints.length >= 3 && polyHover) {
        let cur = polyHover;
        let sSeamX = cur.x * polyView.scale + polyView.ox;

        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(sSeamX, 0);
        ctx.lineTo(sSeamX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        let sPt = polyToScreen(cur);
        ctx.beginPath();
        ctx.arc(sPt.x, sPt.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#16a34a';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        let badge = `📍 คลิกตั้งแนวเริ่มมุง X: ${cur.x.toFixed(2)} ม.`;
        if (polyInlineSnapType === 'guideEdgeIntersection') badge += ` (จุดตัดไกด์)`;
        else if (polyInlineSnapType === 'guideLine') badge += ` (บนไกด์)`;
        else if (polyInlineSnapType === 'nearestEdge') badge += ` (บนขอบหลังคา)`;
        else if (polyInlineSnapType === 'endpoint') badge += ` (จุดมุม)`;
        else if (polyInlineSnapType === 'midpoint') badge += ` (จุดกึ่งกลาง)`;

        ctx.font = 'bold 10px Sarabun';
        let tm = ctx.measureText(badge);
        ctx.fillStyle = 'rgba(22, 163, 74, 0.95)';
        ctx.beginPath();
        ctx.roundRect(sPt.x + 8, sPt.y - 10, tm.width + 12, 20, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(badge, sPt.x + 14, sPt.y);
        ctx.restore();
    }

    // 6.2 ตัวบ่งชี้ขณะลากย้ายจุดมุม (Dragging Vertex HUD)
    if (draggingPointIndex >= 0 && draggingPointIndex < polygonPoints.length) {
        let p = polygonPoints[draggingPointIndex];
        let s = polyToScreen(p);
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        let dragLabel = `📍 P${draggingPointIndex + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
        ctx.font = 'bold 10px Sarabun';
        let tm = ctx.measureText(dragLabel);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(s.x - tm.width / 2 - 4, s.y - 24, tm.width + 8, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(dragLabel, s.x, s.y - 16);
        ctx.restore();
    }

    if (polygonPoints.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '13px Sarabun';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🖱️ คลิกวางจุดมุม หรือกดปุ่ม ⛶ ขยายเต็มจอ สไตล์ AutoCAD ด้านบน', w / 2, h / 2);
    }
}

// ------------------------------------------------------------
// 2. AUTOCAD 2D FULL-SCREEN STUDIO ENGINE
// ------------------------------------------------------------

function openCadStudio() {
    const modal = document.getElementById('cadStudioModal');
    if (!modal) return;
    modal.style.display = 'flex';
    cadStudioOpen = true;

    initCadStudioCanvas();
    cadZoomExtents();
    redrawCadStudio();
    updateCadStatusText();
}

function closeCadStudio() {
    const modal = document.getElementById('cadStudioModal');
    if (modal) modal.style.display = 'none';
    cadStudioOpen = false;
    redrawPolyEditor();
    if (calcData.calculated) calculate();
}

function applyCadStudio() {
    closeCadStudio();
    calculate();
    showWarning("✓ อัปเดตรูปทรงและคำนวณผลลัพธ์เรียบร้อย");
}

function initCadStudioCanvas() {
    const canvas = document.getElementById('cadStudioCanvas');
    const wrapper = document.getElementById('cadCanvasWrapper');
    if (!canvas || !wrapper) return;

    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;

    if (cadEventsBound) return;
    cadEventsBound = true;

    window.addEventListener('resize', () => {
        if (cadStudioOpen) {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            redrawCadStudio();
        }
    });

    // Pan ด้วยลูกกลิ้ง หรือคลิกขวา หรือ Spacebar
    canvas.addEventListener('mousedown', function(evt) {
        const rect = canvas.getBoundingClientRect();
        cadMouseScreen = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };

        if (evt.button === 1 || evt.button === 2 || (evt.button === 0 && evt.spaceKey)) {
            evt.preventDefault();
            cadPan.isPanning = true;
            cadPan.startX = evt.clientX;
            cadPan.startY = evt.clientY;
            cadPan.startOx = cadView.ox;
            cadPan.startOy = cadView.oy;
            canvas.style.cursor = 'grab';
            return;
        }

        if (evt.button === 0) {
            // ถ้าอยู่ในโหมด Arc, Guide, Measure, Calibrate, PickStart ไม่ให้เริ่มลากเส้น/ย้ายจุด เพื่อให้คลิกวางตำแหน่งได้อย่างแม่นยำ
            if (cadArcState.active || cadGuideState.active || cadMeasureState.active || cadCalibrateState.active || polyPickStartMode) {
                return;
            }

            // เช็คว่าคลิกโดนแนวเริ่มมุงเพื่อลากหรือไม่
            if (polygonPoints.length >= 3) {
                let minX = Math.min(...polygonPoints.map(p => p.x));
                let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : minX;
                let sSeamX = seamX * cadView.scale + cadView.ox;
                if (Math.abs(cadMouseScreen.x - sSeamX) < 14) {
                    cadDraggingStartSeam = true;
                    canvas.style.cursor = 'ew-resize';
                    return;
                }
            }

            // เช็คว่าคลิกโดนจุดมุมเดิมเพื่อลากหรือไม่
            for (let i = 0; i < polygonPoints.length; i++) {
                let s = cadWorldToScreen(polygonPoints[i].x, polygonPoints[i].y);
                if (Math.hypot(evt.clientX - s.x, evt.clientY - s.y) < 14) {
                    if (i === 0 && polygonPoints.length >= 3 && polyDrawingMode) continue;
                    cadDraggingIndex = i;
                    cadDragStartPos = { x: polygonPoints[i].x, y: polygonPoints[i].y };
                    canvas.style.cursor = 'grabbing';
                    return;
                }
            }
            
            // เช็คว่าคลิกลากย้ายภาพพื้นหลัง (เมื่อปลดล็อก)
            if (!cadBgImage.locked && cadBgImage.img && !polyDrawingMode && !cadCalibrateState.active) {
                let world = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
                if (world.x >= cadBgImage.x && world.x <= cadBgImage.x + cadBgImage.width &&
                    world.y <= cadBgImage.y && world.y >= cadBgImage.y - cadBgImage.height) {
                    cadDraggingBgImage = true;
                    cadBgDragStart = { mouseX: world.x, mouseY: world.y, imgX: cadBgImage.x, imgY: cadBgImage.y };
                    canvas.style.cursor = 'move';
                    return;
                }
            }
        }
    });

    window.addEventListener('mousemove', function(evt) {
        if (!cadStudioOpen) return;
        const canvas = document.getElementById('cadStudioCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        cadMouseScreen = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        isShiftPressed = evt.shiftKey;

        if (cadPan.isPanning) {
            cadView.ox = cadPan.startOx + (evt.clientX - cadPan.startX);
            cadView.oy = cadPan.startOy + (evt.clientY - cadPan.startY);
            redrawCadStudio();
            return;
        }

        // ลากย้ายตำแหน่งภาพแบบแปลน
        if (cadDraggingBgImage) {
            let world = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
            let dx = world.x - cadBgDragStart.mouseX;
            let dy = world.y - cadBgDragStart.mouseY;
            cadBgImage.x = Math.round((cadBgDragStart.imgX + dx) * 100) / 100;
            cadBgImage.y = Math.round((cadBgDragStart.imgY + dy) * 100) / 100;
            redrawCadStudio();
            redrawPolyEditor();
            return;
        }

        // ลากแนวเริ่มมุงใน CAD พร้อม Auto-Snap จุดมุม
        if (cadDraggingStartSeam) {
            let world = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
            for (let pt of polygonPoints) {
                if (Math.abs(world.x - pt.x) < 0.30) {
                    world.x = pt.x;
                    break;
                }
            }
            polyStartSeamX = Math.round(world.x * 100) / 100;
            redrawCadStudio();
            if (calcData.calculated) calculate();
            return;
        }

        if (cadDraggingIndex >= 0 && cadDraggingIndex < polygonPoints.length) {
            let world = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
            let isOrtho = evt.shiftKey || isShiftPressed || cadOrtho;
            let finalX = world.x;
            let finalY = world.y;

            if (isOrtho && cadDragStartPos) {
                let dx = Math.abs(world.x - cadDragStartPos.x);
                let dy = Math.abs(world.y - cadDragStartPos.y);
                if (dx >= dy) finalY = cadDragStartPos.y;
                else finalX = cadDragStartPos.x;
            } else if (cadSnap) {
                let snap = cadCalculateSnapAndWorld(cadMouseScreen.x, cadMouseScreen.y, evt.shiftKey);
                finalX = snap.x;
                finalY = snap.y;
            }

            polygonPoints[cadDraggingIndex] = { x: Math.round(finalX * 1000) / 1000, y: Math.round(finalY * 1000) / 1000 };
            renderPointList();
            redrawCadStudio();
            redrawPolyEditor();
            return;
        }

        // ตรวจสอบ hover ด้ามจับแนวเริ่มมุง
        let isNearSeam = false;
        if (polygonPoints.length >= 3) {
            let minX = Math.min(...polygonPoints.map(p => p.x));
            let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : minX;
            let sSeamX = seamX * cadView.scale + cadView.ox;
            isNearSeam = Math.abs(cadMouseScreen.x - sSeamX) < 14;
        }

        // ตรวจสอบ hover เส้นขอบใน CAD (เมื่อไม่ได้กำลังวาดเส้น หรือเมื่อกดเรียกคำสั่ง OFFSET)
        if (!polyDrawingMode && !cadCalibrateState.active && !cadMeasureState.active && !cadArcState.active && !cadGuideState.active && !polyPickStartMode) {
            cadHoveredEdge = findHoveredEdge(cadMouseScreen.x, cadMouseScreen.y, cadWorldToScreen);
        } else {
            cadHoveredEdge = -1;
        }

        if (polyPickStartMode) {
            canvas.style.cursor = 'crosshair';
        } else if (cadCalibrateState.active) {
            canvas.style.cursor = 'crosshair';
        } else if (isNearSeam) {
            canvas.style.cursor = 'ew-resize';
        } else if (cadHoveredEdge >= 0 && !polyDrawingMode) {
            canvas.style.cursor = 'pointer';
        } else if (!cadBgImage.locked && cadBgImage.img && !polyDrawingMode) {
            let world = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
            let insideBg = world.x >= cadBgImage.x && world.x <= cadBgImage.x + cadBgImage.width &&
                           world.y <= cadBgImage.y && world.y >= cadBgImage.y - cadBgImage.height;
            canvas.style.cursor = insideBg ? 'move' : 'crosshair';
        } else {
            canvas.style.cursor = 'crosshair';
        }

        // คำนวณ Snap และพิกัด World
        cadHover = cadCalculateSnapAndWorld(cadMouseScreen.x, cadMouseScreen.y, evt.shiftKey);
        updateCadStatusText();
        redrawCadStudio();
    });

    window.addEventListener('mouseup', function(evt) {
        if (cadPan.isPanning) {
            cadPan.isPanning = false;
            canvas.style.cursor = 'crosshair';
        }
        if (cadDraggingBgImage) {
            cadDraggingBgImage = false;
            canvas.style.cursor = 'crosshair';
            redrawCadStudio();
            redrawPolyEditor();
        }
        if (cadDraggingStartSeam) {
            cadDraggingStartSeam = false;
            canvas.style.cursor = 'crosshair';
            redrawCadStudio();
            if (calcData.calculated) calculate();
        }
        if (cadDraggingIndex >= 0) {
            cadDraggingIndex = -1;
            cadDragStartPos = null;
            canvas.style.cursor = 'crosshair';
            saveCadState();
            if (calcData.calculated) calculate();
            redrawCadStudio();
            redrawPolyEditor();
        }
    });

    // Zoom ด้วยลูกกลิ้งเมาส์ ณ ตำแหน่งเคอร์เซอร์
    canvas.addEventListener('wheel', function(evt) {
        evt.preventDefault();
        const rect = canvas.getBoundingClientRect();
        let sx = evt.clientX - rect.left;
        let sy = evt.clientY - rect.top;

        let wx = (sx - cadView.ox) / cadView.scale;
        let wy = (cadView.oy - sy) / cadView.scale;

        let zoomFactor = evt.deltaY < 0 ? 1.15 : 0.85;
        let newScale = Math.max(4, Math.min(cadView.scale * zoomFactor, 800));

        cadView.scale = newScale;
        cadView.ox = sx - wx * newScale;
        cadView.oy = sy + wy * newScale;

        redrawCadStudio();
    }, { passive: false });

    // คลิกเพื่อวางจุด, ปิดรูปทรง, หรือเลือกเส้นออฟเซ็ต/แก้ไขระยะ
    canvas.addEventListener('click', function(evt) {
        if (cadPan.isPanning || cadDraggingIndex >= 0 || cadDraggingStartSeam || cadDraggingBgImage) return;

        const rect = canvas.getBoundingClientRect();
        let sx = evt.clientX - rect.left;
        let sy = evt.clientY - rect.top;
        cadMouseScreen = { x: sx, y: sy };

        // โหมดคลิกเลือกจุดเริ่มมุง (Pick Start Seam Mode)
        if (polyPickStartMode && polygonPoints.length >= 3) {
            let world = cadScreenToWorld(sx, sy, false);
            for (let pt of polygonPoints) {
                let s = cadWorldToScreen(pt.x, pt.y);
                if (Math.hypot(sx - s.x, sy - s.y) < 18) {
                    world.x = pt.x;
                    break;
                }
            }
            polyStartSeamX = Math.round(world.x * 100) / 100;
            togglePickStartMode(false);
            showWarning(`📍 ตั้งแนวเริ่มมุงที่ X = ${polyStartSeamX.toFixed(2)} ม. เรียบร้อย`);
            redrawCadStudio();
            redrawPolyEditor();
            calculate();
            return;
        }

        // ถ้าอยู่ในโหมดสร้างเส้นไกด์ไลน์ (GUIDELINE)
        if (cadGuideState.active) {
            let p = { x: cadHover.x, y: cadHover.y };
            handleGuidePointClick(p);
            return;
        }

        // ถ้าอยู่ในโหมดวาดเส้นโค้ง (ARC)
        if (cadArcState.active) {
            let p = { x: cadHover.x, y: cadHover.y };
            handleArcPointClick(p);
            return;
        }

        // ถ้าอยู่ในโหมดวัดระยะ (MEASURE)
        if (cadMeasureState.active) {
            let p = { x: cadHover.x, y: cadHover.y };
            let finalPt = p;
            if (cadMeasureState.step === 2 && cadMeasureState.pt1) {
                let isOrtho = evt.shiftKey || isShiftPressed || cadOrtho;
                if (isOrtho) {
                    let dx = Math.abs(p.x - cadMeasureState.pt1.x);
                    let dy = Math.abs(p.y - cadMeasureState.pt1.y);
                    if (dx >= dy) finalPt = { x: p.x, y: cadMeasureState.pt1.y };
                    else finalPt = { x: cadMeasureState.pt1.x, y: p.y };
                }
            }
            handleMeasurePointClick(finalPt);
            return;
        }

        // ถ้าอยู่ในโหมด Calibrate ปรับสเกลภาพแบบแปลน
        if (cadCalibrateState.active) {
            let raw = cadScreenToWorld(cadMouseScreen.x, cadMouseScreen.y, false);
            let finalPt = raw;
            if (cadCalibrateState.step === 2 && cadCalibrateState.pt1) {
                let isOrtho = evt.shiftKey || isShiftPressed || cadOrtho;
                if (isOrtho) {
                    let dx = Math.abs(raw.x - cadCalibrateState.pt1.x);
                    let dy = Math.abs(raw.y - cadCalibrateState.pt1.y);
                    if (dx >= dy) finalPt = { x: raw.x, y: cadCalibrateState.pt1.y };
                    else finalPt = { x: cadCalibrateState.pt1.x, y: raw.y };
                }
            }
            handleCalibratePointClick(finalPt);
            return;
        }

        // ถ้าอยู่ในโหมดเลือกเส้นออฟเซ็ต และคลิกโดนเส้นขอบ
        if (cadOffsetSelectingEdge && cadHoveredEdge >= 0 && polygonPoints.length >= 3) {
            let edgeIdx = cadHoveredEdge;
            cadOpenPrompt('offset', edgeIdx);
            return;
        }

        // ถ้าไม่ได้อยู่ในโหมดวาดเส้น (Selection / Edit Mode):
        if (!polyDrawingMode) {
            // 1. ถ้าคลิกโดนเส้นขอบ -> เปิดหน้าต่างแก้ไขความยาวเส้น/ออฟเซ็ต
            if (cadHoveredEdge >= 0 && cadHoveredEdge < polygonPoints.length && polygonPoints.length >= 2) {
                selectedEdgeForOffset = cadHoveredEdge;
                cadOpenPrompt('edge_edit', cadHoveredEdge);
                return;
            }
            if (polygonPoints.length === 0) {
                setDrawingMode(true);
            } else {
                return;
            }
        }

        // ถ้าคลิกใกล้จุดแรก = ปิดรูปทรง
        if (polygonPoints.length >= 3 && cadHover.snapType === 'firstPoint') {
            polyCloseShape();
            return;
        }

        let p = { x: cadHover.x, y: cadHover.y };
        let last = polygonPoints[polygonPoints.length - 1];
        if (last && last.x === p.x && last.y === p.y) return;

        saveCadState();
        polygonPoints.push(p);
        renderPointList();
        redrawCadStudio();
        if (calcData.calculated) calculate();
    });

    canvas.addEventListener('contextmenu', function(evt) {
        evt.preventDefault();
        if (cadOffsetSelectingEdge) {
            cadOffsetSelectingEdge = false;
            cadHoveredEdge = -1;
            showWarning("⏹️ ยกเลิกคำสั่ง OFFSET");
            updateCadStatusText();
            redrawCadStudio();
        } else if (polyDrawingMode) {
            if (polygonPoints.length >= 3) {
                polyCloseShape();
            } else {
                setDrawingMode(false);
                showWarning("⏹️ จบคำสั่งวาดเส้น");
            }
        }
    });

    let directInput = document.getElementById('cadDirectDistInput');
    if (directInput) {
        directInput.addEventListener('keydown', function(evt) {
            if (evt.key === 'Enter') {
                cadApplyDirectDistance();
            } else if (evt.key === 'Escape') {
                let hud = document.getElementById('cadDynamicHud');
                if (hud) hud.style.display = 'none';
                canvas.focus();
            }
        });
    }

    let cmdInput = document.getElementById('cadCommandLineInput');
    if (cmdInput) {
        cmdInput.addEventListener('keydown', function(evt) {
            if (evt.key === 'Enter') {
                cadExecuteCommandLine(this.value);
                this.value = '';
            } else if (evt.key === 'Escape') {
                this.value = '';
                this.blur();
                canvas.focus();
            }
        });
    }

    // Direct Distance Entry (พิมพ์ตัวเลขบนคีย์บอร์ด)
    window.addEventListener('keypress', function(e) {
        if (!cadStudioOpen || polyPickStartMode) return;
        let char = e.key;
        let activeEl = document.activeElement;

        if (/[0-9.]/.test(char) && activeEl !== document.getElementById('cadDirectDistInput') && activeEl !== document.getElementById('cadCommandLineInput') && activeEl !== document.getElementById('cadDialogInput')) {
            if (!polyDrawingMode) {
                setDrawingMode(true);
            }
            let hud = document.getElementById('cadDynamicHud');
            let input = document.getElementById('cadDirectDistInput');
            if (hud && input) {
                hud.style.display = 'flex';
                hud.style.left = (cadMouseScreen.x + 16) + 'px';
                hud.style.top = (cadMouseScreen.y + 16) + 'px';
                input.value = char;
                input.focus();
                e.preventDefault();
            }
        }
    });
}

function cadWorldToScreen(wx, wy) {
    return {
        x: wx * cadView.scale + cadView.ox,
        y: cadView.oy - wy * cadView.scale // แกน Y ขึ้นด้านบนแบบ CAD
    };
}

function cadScreenToWorld(sx, sy, snapGrid = true) {
    let step = getPolyStep();
    let wx = (sx - cadView.ox) / cadView.scale;
    let wy = (cadView.oy - sy) / cadView.scale;

    if (snapGrid && cadSnap) {
        wx = Math.round(wx / step) * step;
        wy = Math.round(wy / step) * step;
    }
    return { x: Math.round(wx * 1000) / 1000, y: Math.round(wy * 1000) / 1000 };
}

function cadCalculateSnapAndWorld(sx, sy, shiftKey) {
    let rawWorld = {
        x: (sx - cadView.ox) / cadView.scale,
        y: (cadView.oy - sy) / cadView.scale
    };
    rawWorld.x = Math.round(rawWorld.x * 1000) / 1000;
    rawWorld.y = Math.round(rawWorld.y * 1000) / 1000;

    let isOrtho = cadOrtho || shiftKey || isShiftPressed;
    let step = getPolyStep();
    let gx = cadSnap ? Math.round(rawWorld.x / step) * step : rawWorld.x;
    let gy = cadSnap ? Math.round(rawWorld.y / step) * step : rawWorld.y;

    // 1. ตรวจสอบ Snap จุดแรก (Endpoint / Close Shape - เฉพาะโหมดวาดเส้นเมื่อมี 3 จุดขึ้นไป)
    if (cadSnap && polyDrawingMode && polygonPoints.length >= 3) {
        let firstScr = cadWorldToScreen(polygonPoints[0].x, polygonPoints[0].y);
        if (Math.hypot(sx - firstScr.x, sy - firstScr.y) < 18) {
            return {
                x: polygonPoints[0].x,
                y: polygonPoints[0].y,
                snapType: 'firstPoint',
                snapPt: polygonPoints[0],
                rawX: rawWorld.x,
                rawY: rawWorld.y
            };
        }
    }

    // 2. ถ้า Ortho เปิดอยู่ (Shift ค้าง หรือ F8) -> บังคับล็อกแนวราบหรือดิ่ง 90° ขนานกับจุดสุดท้าย (เฉพาะเมื่อวาดเส้น Line ปกติ)
    if (isOrtho && polygonPoints.length > 0 && cadDraggingIndex === -1 && !cadDraggingStartSeam && !cadArcState.active && !cadMeasureState.active && !cadCalibrateState.active) {
        let last = polygonPoints[polygonPoints.length - 1];
        let dx = Math.abs(rawWorld.x - last.x);
        let dy = Math.abs(rawWorld.y - last.y);
        if (dx >= dy) {
            // ล็อกแนวราบ (Horizontal): y เท่ากับ last.y แน่นอน 100%
            gy = last.y;
            gx = cadSnap ? Math.round(rawWorld.x / step) * step : rawWorld.x;
        } else {
            // ล็อกแนวดิ่ง (Vertical): x เท่ากับ last.x แน่นอน 100%
            gx = last.x;
            gy = cadSnap ? Math.round(rawWorld.y / step) * step : rawWorld.y;
        }

        return {
            x: Math.round(gx * 1000) / 1000,
            y: Math.round(gy * 1000) / 1000,
            snapType: 'ortho',
            snapPt: { x: gx, y: gy },
            rawX: rawWorld.x,
            rawY: rawWorld.y,
            trackingGuides: []
        };
    }

    // 3. รวมการค้นหา OSNAP หาจุดที่ใกล้เคอร์เซอร์ที่สุด (Discrete Point Snaps first)
    if (cadSnap && cadDraggingIndex === -1 && !cadDraggingStartSeam) {
        let bestDiscreteSnap = null;
        let bestDiscreteDist = Infinity;

        // A. จุดตัดระหว่างเส้นไกด์ 2 เส้น (Guideline x Guideline Intersection)
        if (cadShowGuides && cadGuideLines.length > 0) {
            for (let i = 0; i < cadGuideLines.length; i++) {
                for (let j = i + 1; j < cadGuideLines.length; j++) {
                    let pInt = getGuidesIntersection(cadGuideLines[i], cadGuideLines[j]);
                    if (pInt) {
                        let sInt = cadWorldToScreen(pInt.x, pInt.y);
                        let d = Math.hypot(sx - sInt.x, sy - sInt.y);
                        if (d < 16 && d < bestDiscreteDist) {
                            bestDiscreteDist = d;
                            bestDiscreteSnap = {
                                x: Math.round(pInt.x * 1000) / 1000,
                                y: Math.round(pInt.y * 1000) / 1000,
                                snapType: 'guideIntersection',
                                snapPt: pInt,
                                label: '✖ จุดตัดเส้นไกด์ (Intersection)',
                                rawX: rawWorld.x,
                                rawY: rawWorld.y,
                                trackingGuides: []
                            };
                        }
                    }
                }
            }

            // B. จุดตัดระหว่างเส้นไกด์ กับ เส้นขอบหลังคา (Guideline x Polygon Edge Intersection)
            if (polygonPoints.length >= 2) {
                let edgeCount = polygonPoints.length;
                if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
                for (let i = 0; i < cadGuideLines.length; i++) {
                    let g = cadGuideLines[i];
                    for (let k = 0; k < edgeCount; k++) {
                        let p1 = polygonPoints[k];
                        let p2 = polygonPoints[(k + 1) % polygonPoints.length];
                        let pInt = getGuidePolygonEdgeIntersection(g, p1, p2);
                        if (pInt) {
                            let sInt = cadWorldToScreen(pInt.x, pInt.y);
                            let d = Math.hypot(sx - sInt.x, sy - sInt.y);
                            if (d < 16 && d < bestDiscreteDist) {
                                bestDiscreteDist = d;
                                bestDiscreteSnap = {
                                    x: Math.round(pInt.x * 1000) / 1000,
                                    y: Math.round(pInt.y * 1000) / 1000,
                                    snapType: 'guideEdgeIntersection',
                                    snapPt: pInt,
                                    label: `✖ จุดตัดเส้นไกด์กับขอบหลังคา (X=${pInt.x.toFixed(2)}m)`,
                                    rawX: rawWorld.x,
                                    rawY: rawWorld.y,
                                    trackingGuides: []
                                };
                            }
                        }
                    }
                }
            }
        }

        // C. จุดมุม (Endpoint Snap)
        if (polygonPoints.length > 0) {
            for (let i = 0; i < polygonPoints.length; i++) {
                let p = polygonPoints[i];
                let scr = cadWorldToScreen(p.x, p.y);
                let d = Math.hypot(sx - scr.x, sy - scr.y);
                if (d < 16 && d < bestDiscreteDist) {
                    bestDiscreteDist = d;
                    bestDiscreteSnap = {
                        x: p.x,
                        y: p.y,
                        snapType: (polyDrawingMode && i === 0 && polygonPoints.length >= 3) ? 'firstPoint' : 'endpoint',
                        snapPt: p,
                        vertexIndex: i,
                        label: `□ จุดมุม P${i + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
                        rawX: rawWorld.x,
                        rawY: rawWorld.y,
                        trackingGuides: []
                    };
                }
            }

            // D. จุดกึ่งกลางด้าน (Midpoint Snap)
            let edgeCount = polygonPoints.length;
            if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
            for (let i = 0; i < edgeCount; i++) {
                let p1 = polygonPoints[i];
                let p2 = polygonPoints[(i + 1) % polygonPoints.length];
                let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                let scr = cadWorldToScreen(mid.x, mid.y);
                let d = Math.hypot(sx - scr.x, sy - scr.y);
                if (d < 16 && d < bestDiscreteDist) {
                    bestDiscreteDist = d;
                    bestDiscreteSnap = {
                        x: Math.round(mid.x * 1000) / 1000,
                        y: Math.round(mid.y * 1000) / 1000,
                        snapType: 'midpoint',
                        snapPt: mid,
                        edgeIndex: i,
                        label: `▲ กึ่งกลางด้านที่ ${i + 1}`,
                        rawX: rawWorld.x,
                        rawY: rawWorld.y,
                        trackingGuides: []
                    };
                }
            }
        }

        // ถ้ามีจุด Discrete Point ที่อยู่ในระยะ Snap ให้เลือกจุดนั้นก่อนเสมอ
        if (bestDiscreteSnap) return bestDiscreteSnap;

        // 4. Continuous Linear Entities: เส้นไกด์ และ เส้นขอบหลังคา (Linear / Nearest Snaps)
        let bestLinearSnap = null;
        let bestLinearDist = Infinity;

        // E. Snap บนแนวเส้นไกด์ (On Guideline Snap)
        if (cadShowGuides && cadGuideLines.length > 0) {
            for (let i = 0; i < cadGuideLines.length; i++) {
                let g = cadGuideLines[i];
                let pClose = getClosestPointOnGuide(g, rawWorld.x, rawWorld.y);
                let sClose = cadWorldToScreen(pClose.x, pClose.y);
                let d = Math.hypot(sx - sClose.x, sy - sClose.y);
                if (d < 14 && d < bestLinearDist) {
                    bestLinearDist = d;
                    bestLinearSnap = {
                        x: Math.round(pClose.x * 1000) / 1000,
                        y: Math.round(pClose.y * 1000) / 1000,
                        snapType: 'guideLine',
                        snapPt: pClose,
                        label: `⫛ ${g.label}`,
                        rawX: rawWorld.x,
                        rawY: rawWorld.y,
                        trackingGuides: []
                    };
                }
            }
        }

        // F. Snap จุดใดก็ได้บนเส้นขอบรูปทรง (AutoCAD Nearest OSNAP)
        if (polygonPoints.length >= 2) {
            let edgeCount = polygonPoints.length;
            if (polyDrawingMode && polygonPoints.length < 3) edgeCount = polygonPoints.length - 1;
            for (let k = 0; k < edgeCount; k++) {
                let p1 = polygonPoints[k];
                let p2 = polygonPoints[(k + 1) % polygonPoints.length];
                let res = getClosestPointOnSegment(rawWorld.x, rawWorld.y, p1, p2);
                let sRes = cadWorldToScreen(res.x, res.y);
                let d = Math.hypot(sx - sRes.x, sy - sRes.y);
                if (d < 14 && d < bestLinearDist) {
                    bestLinearDist = d;
                    bestLinearSnap = {
                        x: res.x,
                        y: res.y,
                        snapType: 'nearestEdge',
                        snapPt: res,
                        label: `⧖ บนเส้นขอบหลังคา (X=${res.x.toFixed(2)}m, Y=${res.y.toFixed(2)}m)`,
                        rawX: rawWorld.x,
                        rawY: rawWorld.y,
                        trackingGuides: []
                    };
                }
            }
        }

        if (bestLinearSnap) return bestLinearSnap;
    }

    // 5. Auto-Snap Alignment Tracking (สแนปตรงแนวแกน X และ Y กับจุดอื่นๆ ที่วาดไว้แล้ว)
    let alignThresholdWorld = 14 / cadView.scale;
    let trackedGuides = [];
    let snappedAlignX = false;
    let snappedAlignY = false;

    if (cadSnap && polygonPoints.length > 0 && cadDraggingIndex === -1 && !cadDraggingStartSeam) {
        for (let i = 0; i < polygonPoints.length; i++) {
            let p = polygonPoints[i];

            // Auto-Snap แกน X ให้ตรงแนวกับจุดมุมอื่น (Vertical Tracking Line)
            if (!snappedAlignX && Math.abs(rawWorld.x - p.x) <= alignThresholdWorld) {
                gx = p.x;
                snappedAlignX = true;
                trackedGuides.push({
                    type: 'vertical',
                    from: { x: p.x, y: p.y },
                    target: { x: p.x, y: gy },
                    label: `⫛ ตรงแนว X กับ P${i + 1} (${p.x.toFixed(2)}m)`
                });
            }

            // Auto-Snap แกน Y ให้ตรงแนวกับจุดมุมอื่น (Horizontal Tracking Line)
            if (!snappedAlignY && Math.abs(rawWorld.y - p.y) <= alignThresholdWorld) {
                gy = p.y;
                snappedAlignY = true;
                trackedGuides.push({
                    type: 'horizontal',
                    from: { x: p.x, y: p.y },
                    target: { x: gx, y: p.y },
                    label: `⫛ ตรงแนว Y กับ P${i + 1} (${p.y.toFixed(2)}m)`
                });
            }
        }
    }

    return {
        x: Math.round(gx * 1000) / 1000,
        y: Math.round(gy * 1000) / 1000,
        snapType: (snappedAlignX || snappedAlignY) ? 'alignTracking' : (cadSnap ? 'grid' : null),
        snapPt: { x: gx, y: gy },
        rawX: rawWorld.x,
        rawY: rawWorld.y,
        trackingGuides: trackedGuides
    };
}

function cadApplyDirectDistance() {
    let input = document.getElementById('cadDirectDistInput');
    let hud = document.getElementById('cadDynamicHud');
    if (!input || !hud) return;

    let dist = parseFloat(input.value);
    input.value = '';
    hud.style.display = 'none';

    if (isNaN(dist) || dist <= 0) return;

    saveCadState();
    if (polygonPoints.length === 0) {
        polygonPoints.push({ x: 0, y: 0 });
        polygonPoints.push({ x: dist, y: 0 });
    } else {
        let last = polygonPoints[polygonPoints.length - 1];
        let angle = Math.atan2(cadHover.rawY - last.y, cadHover.rawX - last.x);

        let isOrtho = cadOrtho || isShiftPressed;
        if (isOrtho) {
            let deg = (angle * 180 / Math.PI + 360) % 360;
            if (deg >= 315 || deg < 45) angle = 0;
            else if (deg >= 45 && deg < 135) angle = Math.PI / 2;
            else if (deg >= 135 && deg < 225) angle = Math.PI;
            else angle = -Math.PI / 2;
        }

        let nextX = Math.round((last.x + dist * Math.cos(angle)) * 1000) / 1000;
        let nextY = Math.round((last.y + dist * Math.sin(angle)) * 1000) / 1000;
        polygonPoints.push({ x: nextX, y: nextY });
    }

    renderPointList();
    redrawCadStudio();
}

function cadZoomExtents() {
    const canvas = document.getElementById('cadStudioCanvas');
    if (!canvas) return;

    let pts = polygonPoints.slice();
    if (pts.length === 0) {
        pts = [{ x: 0, y: 0 }, { x: 8, y: 6 }];
    }

    let minX = Math.min(...pts.map(p => p.x));
    let maxX = Math.max(...pts.map(p => p.x));
    let minY = Math.min(...pts.map(p => p.y));
    let maxY = Math.max(...pts.map(p => p.y));

    let spanX = Math.max(maxX - minX, 4);
    let spanY = Math.max(maxY - minY, 4);

    let margin = 80;
    let scaleX = (canvas.width - margin * 2) / spanX;
    let scaleY = (canvas.height - margin * 2) / spanY;
    let scale = Math.min(scaleX, scaleY);
    scale = Math.max(10, Math.min(scale, 120));

    cadView.scale = scale;
    cadView.ox = margin + ((canvas.width - margin * 2) - spanX * scale) / 2 - minX * scale;
    cadView.oy = canvas.height - margin - ((canvas.height - margin * 2) - spanY * scale) / 2 + minY * scale;

    redrawCadStudio();
}

function toggleCadOrtho() {
    cadOrtho = !cadOrtho;
    let btn = document.getElementById('cadBtnOrtho');
    if (btn) btn.classList.toggle('active', cadOrtho);
    updateCadStatusText();
    redrawCadStudio();
}

function toggleCadSnap() {
    cadSnap = !cadSnap;
    let btn = document.getElementById('cadBtnSnap');
    if (btn) btn.classList.toggle('active', cadSnap);
    redrawCadStudio();
}

function toggleCadGrid() {
    cadGrid = !cadGrid;
    let btn = document.getElementById('cadBtnGrid');
    if (btn) btn.classList.toggle('active', cadGrid);
    redrawCadStudio();
}

function toggleCadSheetOverlay() {
    cadOverlay = !cadOverlay;
    let btn = document.getElementById('cadBtnOverlay');
    if (btn) btn.classList.toggle('active', cadOverlay);
    redrawCadStudio();
}

function toggleCadCoords(force) {
    cadShowCoords = (force !== undefined) ? force : !cadShowCoords;
    let btn1 = document.getElementById('cadBtnCoords');
    if (btn1) {
        btn1.classList.toggle('active', cadShowCoords);
        btn1.innerText = cadShowCoords ? '📍 พิกัด (เปิด)' : '📍 พิกัด (ปิด)';
        btn1.style.color = cadShowCoords ? '#38bdf8' : '';
    }
    let btn2 = document.getElementById('inlineBtnCoords');
    if (btn2) {
        btn2.style.background = cadShowCoords ? '#e0f2fe' : '#f1f5f9';
        btn2.style.borderColor = cadShowCoords ? '#bae6fd' : '#cbd5e1';
        btn2.style.color = cadShowCoords ? '#0284c7' : '#64748b';
        btn2.innerText = cadShowCoords ? '📍 พิกัด (เปิด)' : '📍 พิกัด (ปิด)';
    }
    let coordEl = document.getElementById('cadCoordDisplay');
    if (coordEl) {
        coordEl.style.display = cadShowCoords ? 'inline' : 'none';
    }
    showWarning(cadShowCoords ? "📍 เปิดแสดงพิกัดบนจุด (Coordinates ON)" : "📍 ปิดซ่อนพิกัดบนจุดเพื่อเคลียร์หน้าจอ (Coordinates OFF)");
    redrawPolyEditor();
    if (cadStudioOpen) redrawCadStudio();
}

function toggleCadTheme() {
    cadTheme = (cadTheme === 'dark') ? 'light' : 'dark';
    redrawCadStudio();
}

function updateCadStatusText() {
    let coordEl = document.getElementById('cadCoordDisplay');
    let dimEl = document.getElementById('cadDimDisplay');
    let countEl = document.getElementById('cadPointsCount');
    let cmdEl = document.getElementById('cadStatusAction');

    if (coordEl) coordEl.innerText = `X: ${cadHover.x.toFixed(3)} m | Y: ${cadHover.y.toFixed(3)} m`;
    if (countEl) countEl.innerText = `${polygonPoints.length} จุด`;

    if (polygonPoints.length > 0 && dimEl && polyDrawingMode) {
        let last = polygonPoints[polygonPoints.length - 1];
        let dist = Math.hypot(cadHover.x - last.x, cadHover.y - last.y);
        let angle = Math.atan2(cadHover.y - last.y, cadHover.x - last.x) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        dimEl.innerText = `ความยาว: ${dist.toFixed(2)} m < ${angle.toFixed(1)}°`;
    } else if (dimEl) {
        dimEl.innerText = "";
    }

    if (cmdEl) {
        if (cadGuideState.active) {
            cmdEl.innerText = (cadGuideState.step === 1) ?
                "📐 GUIDELINE (XLINE): คลิก 'จุดที่ 1' เพื่อวางแนวเส้นไกด์ไลน์ (กด Shift เพื่อล็อกราบ/ดิ่ง 90°)" :
                "📐 GUIDELINE: คลิก 'จุดที่ 2' เพื่อกำหนดทิศทางเส้นไกด์ไลน์ (กด Esc เพื่อยกเลิก)";
        } else if (cadArcState.active) {
            cmdEl.innerText = (cadArcState.step === 1) ?
                "⌒ ARC (3-Point): คลิก 'จุดที่ 1' จุดเริ่มส่วนโค้ง (กด Esc เพื่อยกเลิก)" :
                ((cadArcState.step === 2) ?
                    "⌒ ARC: คลิก 'จุดที่ 2' (จุดยอดโค้งสูงสุด หรือจุดผ่านบนความโค้ง)" :
                    "⌒ ARC: คลิก 'จุดที่ 3' (จุดสิ้นสุดส่วนโค้ง เพื่อสร้างเส้นโค้ง)");
        } else if (cadMeasureState.active) {
            cmdEl.innerText = (cadMeasureState.step === 1) ?
                "📐 MEASURE: คลิก 'จุดที่ 1' เพื่อเริ่มวัดระยะ (หรือกด Esc เพื่อยกเลิก)" :
                "📐 MEASURE: คลิก 'จุดที่ 2' (กด Shift หรือ F8 เพื่อล็อกราบ/ดิ่ง, ปล่อยเพื่อวัดอิสระ, กด Esc เพื่อออก)";
        } else if (cadCalibrateState.active) {
            cmdEl.innerText = (cadCalibrateState.step === 1) ?
                "📏 CALIBRATE: คลิก 'จุดที่ 1' บนเส้นบอกขนาดในแบบแปลน (เช่น เสา A)" :
                "📏 CALIBRATE: คลิก 'จุดที่ 2' บนเส้นบอกขนาด (กด Shift เพื่อล็อกราบ/ดิ่ง, ปล่อยเพื่อวัดอิสระ)";
        } else if (polyPickStartMode) {
            cmdEl.innerText = "📍 คลิกบนภาพวาด หรือคลิกที่จุดมุมหลังคา เพื่อตั้งเป็นแนวเริ่มมุงแผ่นแรก";
        } else if (cadOffsetSelectingEdge) {
            cmdEl.innerText = (cadHoveredEdge >= 0) ?
                `📐 OFFSET: คลิกเลือกเส้นด้านที่ ${cadHoveredEdge + 1} เพื่อตั้งระยะยื่นชายคา` :
                "📐 OFFSET: นำเมาส์ไปคลิกเลือกเส้นที่ต้องการออฟเซ็ต (กด Esc เพื่อยกเลิก)";
        } else if (polyDrawingMode) {
            if (cadHover.snapType === 'firstPoint') {
                cmdEl.innerText = "🎯 คลิกเพื่อปิดรูปทรงหลังคา (Close Polygon) หรือกด C / Enter";
            } else if (cadHover.snapType === 'alignTracking') {
                cmdEl.innerText = "🧲 Auto-Snap: ตรงแนวกับจุดมุมเดิม (Tracking Guide) · คลิกเพื่อวางจุด";
            } else if (polygonPoints.length === 0) {
                cmdEl.innerText = "LINE - คลิกบนจอเพื่อวางจุดเริ่ม หรือพิมพ์ระยะแล้วกด Enter";
            } else {
                cmdEl.innerText = `LINE - จุดที่ ${polygonPoints.length + 1} · คลิกวางจุด หรือพิมพ์ระยะแล้วกด Enter (กด Esc เพื่อจบ หรือ C เพื่อปิดรูปทรง)`;
            }
        } else {
            cmdEl.innerText = "READY - กด 'L' วาดเส้น · กด 'DI' วัดระยะ · กด 'O' ออฟเซ็ต · หรือคลิกลากจุดมุม";
        }
    }
}

// ------------------------------------------------------------
// 3. RENDER AUTOCAD CANVAS (FULL-SCREEN CAD VIEW)
// ------------------------------------------------------------

function redrawCadStudio() {
    const canvas = document.getElementById('cadStudioCanvas');
    if (!canvas || !cadStudioOpen) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const isDark = (cadTheme === 'dark');
    const bgCol = isDark ? '#121214' : '#ffffff';
    const gridMinor = isDark ? '#1a1a1e' : '#f1f5f9';
    const gridMajor = isDark ? '#27272a' : '#cbd5e1';
    const axisXCol = isDark ? '#ef4444' : '#dc2626';
    const axisYCol = isDark ? '#22c55e' : '#16a34a';

    // 1. พื้นหลัง
    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, w, h);

    // 1.1 ภาพพื้นหลังแบบแปลน / PDF Underlay
    if (cadBgImage.img && cadBgImage.visible) {
        ctx.save();
        ctx.globalAlpha = cadBgImage.opacity;
        let sTL = cadWorldToScreen(cadBgImage.x, cadBgImage.y);
        let sW = cadBgImage.width * cadView.scale;
        let sH = cadBgImage.height * cadView.scale;

        ctx.drawImage(cadBgImage.img, sTL.x, sTL.y, sW, sH);

        // ถ้าปลดล็อกอยู่ ให้แสดงกรอบประสีฟ้าและคำแนะนำ
        if (!cadBgImage.locked) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([8, 5]);
            ctx.strokeRect(sTL.x, sTL.y, sW, sH);

            ctx.fillStyle = 'rgba(2, 132, 199, 0.9)';
            ctx.beginPath();
            ctx.roundRect(sTL.x + 8, sTL.y + 8, 180, 24, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Sarabun';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText("✋ คลิกค้างเพื่อลากย้ายแบบแปลน", sTL.x + 14, sTL.y + 20);
        }
        ctx.restore();
    }

    // 2. เส้นกริดสไตล์ CAD (Grid Lines & Axes)
    if (cadGrid) {
        let step = getPolyStep();
        let stepPx = step * cadView.scale;

        let startGX = Math.floor((0 - cadView.ox) / stepPx);
        let endGX = Math.ceil((w - cadView.ox) / stepPx);
        let startGY = Math.floor((cadView.oy - h) / stepPx);
        let endGY = Math.ceil((cadView.oy - 0) / stepPx);

        let majorEvery = Math.max(1, Math.round(1 / step));

        ctx.lineWidth = 1;
        for (let i = startGX; i <= endGX; i++) {
            let sx = cadView.ox + i * stepPx;
            ctx.strokeStyle = (i === 0) ? axisYCol : ((i % majorEvery === 0) ? gridMajor : gridMinor);
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();

            if (i % majorEvery === 0 && Math.abs(i) > 0) {
                ctx.fillStyle = isDark ? '#71717a' : '#94a3b8';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText((i * step).toFixed(step < 1 ? 1 : 0), sx, cadView.oy + 4);
            }
        }

        for (let j = startGY; j <= endGY; j++) {
            let sy = cadView.oy - j * stepPx;
            ctx.strokeStyle = (j === 0) ? axisXCol : ((j % majorEvery === 0) ? gridMajor : gridMinor);
            ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();

            if (j % majorEvery === 0 && Math.abs(j) > 0) {
                ctx.fillStyle = isDark ? '#71717a' : '#94a3b8';
                ctx.font = '10px monospace';
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillText((j * step).toFixed(step < 1 ? 1 : 0), cadView.ox - 6, sy);
            }
        }
    }

    // 2.5 เส้นไกด์ไลน์ช่วยร่างแบบ (CAD Guidelines / Construction Lines / XLINE)
    if (cadShowGuides && cadGuideLines.length > 0) {
        ctx.save();
        ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([8, 6]);

        cadGuideLines.forEach((g) => {
            if (g.type === 'h') {
                let sy = cadWorldToScreen(0, g.p1.y).y;
                ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();

                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
                ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                ctx.fillText(`📐 ไกด์ Y=${g.p1.y.toFixed(2)}m`, 14, sy - 3);
            } else if (g.type === 'v') {
                let sx = cadWorldToScreen(g.p1.x, 0).x;
                ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();

                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(`📐 ไกด์ X=${g.p1.x.toFixed(2)}m`, sx + 4, 14);
            } else {
                let bigD = 2000;
                let s1 = cadWorldToScreen(g.p1.x - g.dx * bigD, g.p1.y - g.dy * bigD);
                let s2 = cadWorldToScreen(g.p1.x + g.dx * bigD, g.p1.y + g.dy * bigD);
                ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();

                let sCenter = cadWorldToScreen(g.p1.x, g.p1.y);
                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
                ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(`📐 ${g.label}`, sCenter.x, sCenter.y - 4);
            }
        });
        ctx.restore();
    }

    // 3. จำลองแผ่นเมทัลชีททับบน CAD (Live Sheet Layout Overlay)
    if (cadOverlay && polygonPoints.length >= 3) {
        let profileSelect = document.getElementById('sheetProfile');
        let sheetW = 0.76;
        if (profileSelect && profileSelect.value && !profileSelect.value.startsWith("custom")) {
            sheetW = parseFloat(profileSelect.value.split("|")[0]) || 0.76;
        }

        let minX = Math.min(...polygonPoints.map(p => p.x));
        let maxX = Math.max(...polygonPoints.map(p => p.x));
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : minX;

        let leftK = Math.floor((minX - seamX) / sheetW);
        let rightK = Math.ceil((maxX - seamX) / sheetW);

        ctx.save();
        ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([7, 5]);

        for (let k = leftK; k < rightK; k++) {
            let x_start = seamX + k * sheetW;
            let x_end = seamX + (k + 1) * sheetW;

            let bounds = getPolygonYBoundsInInterval(polygonPoints, x_start, x_end);
            if (bounds.length > 0.01) {
                let pTopL = cadWorldToScreen(x_start, bounds.yMax);
                let pBotR = cadWorldToScreen(x_end, bounds.yMin);
                ctx.strokeRect(pTopL.x, pTopL.y, pBotR.x - pTopL.x, pBotR.y - pTopL.y);

                // ลูกศรสองหัวสีเขียว
                let midX = (pTopL.x + pBotR.x) / 2;
                drawPolygonSheetArrow(ctx, midX, pBotR.y, pTopL.y, bounds.length.toFixed(2), '#00c800');
            }
        }
        ctx.restore();

        // วาดเส้นแนวเริ่มมุงใน CAD
        let sSeamX = seamX * cadView.scale + cadView.ox;
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(sSeamX, 0);
        ctx.lineTo(sSeamX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // ด้ามจับแนวเริ่มมุง
        let badgeText = `📍 เริ่มมุง X: ${seamX.toFixed(2)} ม. (ลากได้)`;
        ctx.font = 'bold 11px monospace';
        let btm = ctx.measureText(badgeText);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.roundRect(sSeamX - btm.width / 2 - 8, h - 30, btm.width + 16, 22, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, sSeamX, h - 19);
        ctx.restore();
    }

    // 4. เส้นรูปทรงหลังคา (Roof Polygon Boundary)
    if (polygonPoints.length > 0) {
        ctx.beginPath();
        polygonPoints.forEach((p, idx) => {
            let s = cadWorldToScreen(p.x, p.y);
            if (idx === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        if (polygonPoints.length >= 3) ctx.closePath();

        ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)';
        ctx.fill();
        ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // เส้นไกด์ Rubberband ไปยังเคอร์เซอร์ (เฉพาะเมื่อกำลังอยู่ในโหมดวาดเส้น polyDrawingMode)
        if (polyDrawingMode && cadDraggingIndex === -1 && !cadDraggingStartSeam && !polyPickStartMode) {
            let last = polygonPoints[polygonPoints.length - 1];
            let sLast = cadWorldToScreen(last.x, last.y);
            let sHover = cadWorldToScreen(cadHover.x, cadHover.y);

            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = (cadOrtho || isShiftPressed) ? '#22c55e' : '#facc15';
            ctx.lineWidth = 1.8;
            ctx.moveTo(sLast.x, sLast.y);
            ctx.lineTo(sHover.x, sHover.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // ป้ายบอกความยาวและมุม HUD
            let dist = Math.hypot(cadHover.x - last.x, cadHover.y - last.y);
            if (dist > 0.01) {
                let midX = (sLast.x + sHover.x) / 2;
                let midY = (sLast.y + sHover.y) / 2;
                let isOrtho = cadOrtho || isShiftPressed;
                let lockTag = isOrtho ?
                    (Math.abs(cadHover.y - last.y) < 0.001 ? " [🔒 ล็อกราบ]" : " [🔒 ล็อกดิ่ง]") :
                    " [กด Shift เพื่อล็อกฉาก]";
                let badgeText = `📏 ${dist.toFixed(2)} ม.${lockTag}`;

                ctx.font = 'bold 12px monospace';
                let tm = ctx.measureText(badgeText);
                ctx.fillStyle = isOrtho ? 'rgba(6, 95, 70, 0.95)' : (isDark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.95)');
                ctx.strokeStyle = isOrtho ? '#22c55e' : (isDark ? '#38bdf8' : '#0284c7');
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.roundRect(midX - tm.width / 2 - 8, midY - 22, tm.width + 16, 22, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = isOrtho ? '#ffffff' : (isDark ? '#38bdf8' : '#0f172a');
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, midX, midY - 11);
            }
        }

        // ไฮไลต์เส้นขอบที่เมาส์ชี้ใน CAD (Edge Hover Highlight)
        if ((cadOffsetSelectingEdge || !polyDrawingMode) && polygonPoints.length >= 2 && cadHoveredEdge >= 0 && cadHoveredEdge < polygonPoints.length && cadDraggingIndex === -1 && !cadDraggingStartSeam && !polyPickStartMode && !cadCalibrateState.active && !cadMeasureState.active) {
            let p1 = polygonPoints[cadHoveredEdge];
            let p2 = polygonPoints[(cadHoveredEdge + 1) % polygonPoints.length];
            let s1 = cadWorldToScreen(p1.x, p1.y);
            let s2 = cadWorldToScreen(p2.x, p2.y);
            let edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();

            // วาดจุดปลายทั้งสองของเส้นที่เลือกให้ชัดเจน
            [s1, s2].forEach(s => {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 6.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            let midX = (s1.x + s2.x) / 2;
            let midY = (s1.y + s2.y) / 2;
            let badgeText = cadOffsetSelectingEdge ?
                `📐 ด้านที่ ${cadHoveredEdge + 1}: ${edgeLen.toFixed(2)} ม. (คลิกเพื่อออฟเซ็ตเส้นนี้)` :
                `📐 ด้านที่ ${cadHoveredEdge + 1}: ${edgeLen.toFixed(2)} ม. (คลิกเพื่อปรับแก้ระยะ/ออฟเซ็ต)`;
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badgeText);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 24, tm.width + 16, 22, 4);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, midX, midY - 13);
            ctx.restore();
        }
    }

    // 5. จุดมุมรูปทรง (Vertices & Labels)
    let totalCadPts = polygonPoints.length;
    polygonPoints.forEach((p, idx) => {
        let s = cadWorldToScreen(p.x, p.y);
        let isHovered = Math.hypot(cadMouseScreen.x - s.x, cadMouseScreen.y - s.y) < 14;

        ctx.beginPath();
        let ptRadius = (totalCadPts > 16) ? 4 : 5.5;
        ctx.arc(s.x, s.y, ptRadius, 0, 2 * Math.PI);
        ctx.fillStyle = (idx === 0) ? '#22c55e' : (isHovered ? '#f59e0b' : '#0284c7');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 1. ถ้าเอาเมาส์ชี้ที่จุด ให้แสดงพิกัดของจุดนั้นทันที
        if (isHovered) {
            let tipText = `P${idx + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(tipText);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(s.x + 8, s.y - 20, tm.width + 12, 18, 3);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(tipText, s.x + 14, s.y - 11);
        }
        // 2. ถ้าเปิดโหมดแสดงพิกัด (cadShowCoords = true)
        else if (cadShowCoords) {
            let showThisPoint = (totalCadPts <= 16) || (idx === 0 || idx === totalCadPts - 1 || idx % 4 === 0);
            if (showThisPoint) {
                ctx.fillStyle = isDark ? '#f4f4f5' : '#0f172a';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                ctx.fillText(`P${idx + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, s.x + 6, s.y - 3);
            }
        }
        // 3. ถ้าปิดโหมดแสดงพิกัด (cadShowCoords = false) -> ไม่วาดข้อความใดๆ บนจุดเลย ทำให้เส้นโค้งและมุมสะอาด 100%
    });

    // 6. Object Snap Indicators (OSNAP Markers)
    if (cadSnap && cadHover.snapType) {
        let sSnap = cadWorldToScreen(cadHover.x, cadHover.y);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;

        if (cadHover.snapType === 'endpoint' || (polyDrawingMode && cadHover.snapType === 'firstPoint')) {
            let sz = 10;
            ctx.strokeRect(sSnap.x - sz / 2, sSnap.y - sz / 2, sz, sz);
            if (polyDrawingMode && cadHover.snapType === 'firstPoint') {
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 12px Sarabun';
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText("🎯 คลิกเพื่อปิดรูปทรง (Close)", sSnap.x + 12, sSnap.y);
            }
        } else if (cadHover.snapType === 'midpoint') {
            ctx.beginPath();
            ctx.moveTo(sSnap.x, sSnap.y - 8);
            ctx.lineTo(sSnap.x - 8, sSnap.y + 7);
            ctx.lineTo(sSnap.x + 8, sSnap.y + 7);
            ctx.closePath();
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.fill();

            let edgeIdx = (cadHover.edgeIndex !== undefined) ? (cadHover.edgeIndex + 1) : '';
            let label = edgeIdx ? `▲ Midpoint (กึ่งกลางด้านที่ ${edgeIdx})` : `▲ Midpoint (กึ่งกลางเส้น)`;
            ctx.font = 'bold 12px Sarabun';
            let tm = ctx.measureText(label);
            ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sSnap.x + 12, sSnap.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(label, sSnap.x + 18, sSnap.y);
        } else if (cadHover.snapType === 'guideEdgeIntersection' || cadHover.snapType === 'guideIntersection') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.8;
            let sz = 7;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y + sz);
            ctx.moveTo(sSnap.x + sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x - sz, sSnap.y + sz);
            ctx.stroke();

            let label = cadHover.label || '✖ จุดตัดเส้นไกด์';
            ctx.font = 'bold 12px Sarabun';
            let tm = ctx.measureText(label);
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sSnap.x + 12, sSnap.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(label, sSnap.x + 18, sSnap.y);
        } else if (cadHover.snapType === 'nearestEdge') {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2.4;
            let sz = 6;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y - sz);
            ctx.lineTo(sSnap.x - sz, sSnap.y + sz);
            ctx.lineTo(sSnap.x + sz, sSnap.y + sz);
            ctx.closePath();
            ctx.stroke();

            let label = cadHover.label || '⧖ บนเส้นขอบหลังคา';
            ctx.font = 'bold 12px Sarabun';
            let tm = ctx.measureText(label);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sSnap.x + 12, sSnap.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(label, sSnap.x + 18, sSnap.y);
        } else if (cadHover.snapType === 'guideLine') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.4;
            let sz = 6;
            ctx.beginPath();
            ctx.moveTo(sSnap.x - sz, sSnap.y); ctx.lineTo(sSnap.x + sz, sSnap.y);
            ctx.moveTo(sSnap.x, sSnap.y - sz); ctx.lineTo(sSnap.x, sSnap.y + sz);
            ctx.stroke();

            let label = cadHover.label || '⫛ บนเส้นไกด์';
            ctx.font = 'bold 12px Sarabun';
            let tm = ctx.measureText(label);
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sSnap.x + 12, sSnap.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(label, sSnap.x + 18, sSnap.y);
        }
    }

    // 6.05 ตัวบ่งชี้ขณะลากย้ายจุดมุมใน CAD Studio (Dragging Vertex HUD)
    if (cadDraggingIndex >= 0 && cadDraggingIndex < polygonPoints.length) {
        let p = polygonPoints[cadDraggingIndex];
        let s = cadWorldToScreen(p.x, p.y);
        let n = polygonPoints.length;
        let pPrev = polygonPoints[(cadDraggingIndex - 1 + n) % n];
        let pNext = polygonPoints[(cadDraggingIndex + 1) % n];
        let d1 = Math.hypot(p.x - pPrev.x, p.y - pPrev.y);
        let d2 = Math.hypot(p.x - pNext.x, p.y - pNext.y);

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        let dragLabel = `📍 P${cadDraggingIndex + 1} (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) | ด้านก่อน: ${d1.toFixed(2)}ม. | ด้านถัดไป: ${d2.toFixed(2)}ม.`;
        ctx.font = 'bold 11px monospace';
        let dtm = ctx.measureText(dragLabel);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(s.x - dtm.width / 2 - 8, s.y - 30, dtm.width + 16, 22, 4);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(dragLabel, s.x, s.y - 19);
        ctx.restore();
    }

    // 6.1 Object Snap Tracking Alignment Guides (เส้นไกด์ตรงแนวสไตล์ CAD)
    if (polyDrawingMode && cadHover && cadHover.trackingGuides && cadHover.trackingGuides.length > 0 && cadDraggingIndex === -1 && !cadDraggingStartSeam && !polyPickStartMode) {
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);

        cadHover.trackingGuides.forEach(g => {
            let sFrom = cadWorldToScreen(g.from.x, g.from.y);
            let sTarget = cadWorldToScreen(g.target.x, g.target.y);

            ctx.beginPath();
            ctx.moveTo(sFrom.x, sFrom.y);
            ctx.lineTo(sTarget.x, sTarget.y);
            ctx.stroke();

            // กล่องสัญลักษณ์สแนปตรงแนว
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(sFrom.x - 3.5, sFrom.y - 3.5, 7, 7);

            let midX = (sFrom.x + sTarget.x) / 2;
            let midY = (sFrom.y + sTarget.y) / 2;
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(g.label);
            ctx.fillStyle = isDark ? 'rgba(20, 83, 45, 0.94)' : 'rgba(240, 253, 244, 0.96)';
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 6, midY - 20, tm.width + 12, 19, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isDark ? '#86efac' : '#166534';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(g.label, midX, midY - 10);
        });
        ctx.restore();
    }

    // 6.2 เส้นไกด์ Calibration (การตั้งสเกลจริง)
    if (cadCalibrateState.active) {
        ctx.save();
        if (cadCalibrateState.step === 1 || !cadCalibrateState.pt1) {
            let sHover = cadWorldToScreen(cadHover.rawX, cadHover.rawY);
            ctx.beginPath();
            ctx.arc(sHover.x, sHover.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();

            let badge = "📏 คลิกจุดที่ 1 บนแบบแปลนเพื่อเริ่ม Calibrate";
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sHover.x + 12, sHover.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, sHover.x + 18, sHover.y);
        } else {
            let pt1 = cadCalibrateState.pt1;
            let s1 = cadWorldToScreen(pt1.x, pt1.y);

            let isOrtho = cadOrtho || isShiftPressed;
            let rawTarget = (cadCalibrateState.pt2) ? cadCalibrateState.pt2 : { x: cadHover.rawX, y: cadHover.rawY };
            let targetPt = rawTarget;
            let lockMode = 'free';

            if (isOrtho && !cadCalibrateState.pt2) {
                let dx = Math.abs(rawTarget.x - pt1.x);
                let dy = Math.abs(rawTarget.y - pt1.y);
                if (dx >= dy) {
                    targetPt = { x: rawTarget.x, y: pt1.y };
                    lockMode = 'horizontal';
                } else {
                    targetPt = { x: pt1.x, y: rawTarget.y };
                    lockMode = 'vertical';
                }
            }

            let sTarget = cadWorldToScreen(targetPt.x, targetPt.y);

            // จุดที่ 1
            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // จุดที่ 2
            ctx.beginPath();
            ctx.arc(sTarget.x, sTarget.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = isOrtho ? '#22c55e' : '#f59e0b';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // เส้นเชื่อม
            ctx.beginPath();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = isOrtho ? '#22c55e' : '#f59e0b';
            ctx.lineWidth = 2.2;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(sTarget.x, sTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let distNow = Math.hypot(targetPt.x - pt1.x, targetPt.y - pt1.y);
            let angleDeg = Math.atan2(targetPt.y - pt1.y, targetPt.x - pt1.x) * 180 / Math.PI;
            if (angleDeg < 0) angleDeg += 360;

            let lockText = isOrtho ?
                (lockMode === 'horizontal' ? " [🔒 ล็อกราบ]" : " [🔒 ล็อกดิ่ง]") :
                " [🔓 เส้นอิสระ (กด Shift หรือ F8 เพื่อล็อกฉาก)]";

            let calText = `📏 ${distNow.toFixed(2)} ม. < ${angleDeg.toFixed(1)}°${lockText}`;
            let midX = (s1.x + sTarget.x) / 2;
            let midY = (s1.y + sTarget.y) / 2;

            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(calText);
            ctx.fillStyle = isOrtho ? 'rgba(22, 163, 74, 0.96)' : 'rgba(245, 158, 11, 0.96)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 22, tm.width + 16, 22, 4);
            ctx.fill();
            ctx.fillStyle = isOrtho ? '#ffffff' : '#000000';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(calText, midX, midY - 11);
        }
        ctx.restore();
    }

    // 6.3 เส้นบอกระยะเครื่องมือวัดระยะ (MEASURE / DISTANCE TOOL)
    if (cadMeasureState.active || cadMeasureState.result) {
        ctx.save();
        if (cadMeasureState.step === 1 || (!cadMeasureState.pt1 && !cadMeasureState.result)) {
            let sHover = cadWorldToScreen(cadHover.rawX, cadHover.rawY);
            ctx.beginPath();
            ctx.arc(sHover.x, sHover.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.stroke();

            let badge = "📐 คลิกจุดที่ 1 เพื่อเริ่มวัดระยะ";
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sHover.x + 12, sHover.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, sHover.x + 18, sHover.y);
        } else {
            let pt1 = cadMeasureState.pt1;
            let isOrtho = cadOrtho || isShiftPressed;
            let rawTarget = (cadMeasureState.pt2) ? cadMeasureState.pt2 : { x: cadHover.rawX, y: cadHover.rawY };
            let targetPt = rawTarget;
            let lockMode = 'free';

            if (isOrtho && !cadMeasureState.pt2) {
                let dx = Math.abs(rawTarget.x - pt1.x);
                let dy = Math.abs(rawTarget.y - pt1.y);
                if (dx >= dy) {
                    targetPt = { x: rawTarget.x, y: pt1.y };
                    lockMode = 'horizontal';
                } else {
                    targetPt = { x: pt1.x, y: rawTarget.y };
                    lockMode = 'vertical';
                }
            }

            let s1 = cadWorldToScreen(pt1.x, pt1.y);
            let sTarget = cadWorldToScreen(targetPt.x, targetPt.y);

            // จุดที่ 1
            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // จุดที่ 2
            ctx.beginPath();
            ctx.arc(sTarget.x, sTarget.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = isOrtho ? '#10b981' : '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // เส้นเชื่อมระยะทางตรง (Direct Distance)
            ctx.beginPath();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = isOrtho ? '#10b981' : '#06b6d4';
            ctx.lineWidth = 2.2;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(sTarget.x, sTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let dist = Math.hypot(targetPt.x - pt1.x, targetPt.y - pt1.y);
            let dx = Math.abs(targetPt.x - pt1.x);
            let dy = Math.abs(targetPt.y - pt1.y);
            let angleDeg = (Math.atan2(targetPt.y - pt1.y, targetPt.x - pt1.x) * 180 / Math.PI + 360) % 360;

            // เส้นสามเหลี่ยมบอกระยะราบ ΔX และระยะดิ่ง ΔY
            if (dx > 0.05 && dy > 0.05 && !isOrtho) {
                let sCorner = cadWorldToScreen(targetPt.x, pt1.y);
                ctx.save();
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.6)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(sCorner.x, sCorner.y);
                ctx.lineTo(sTarget.x, sTarget.y);
                ctx.stroke();

                ctx.font = '10px monospace';
                ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
                ctx.textAlign = 'center';
                ctx.fillText(`ΔX: ${dx.toFixed(3)}m`, (s1.x + sCorner.x) / 2, sCorner.y + 12);
                ctx.textAlign = 'left';
                ctx.fillText(`ΔY: ${dy.toFixed(3)}m`, sCorner.x + 6, (sCorner.y + sTarget.y) / 2);
                ctx.restore();
            }

            // ป้ายบอกผลการวัดระยะหลัก
            let midX = (s1.x + sTarget.x) / 2;
            let midY = (s1.y + sTarget.y) / 2;
            let lockTag = isOrtho ? (lockMode === 'horizontal' ? " [🔒 ราบ]" : " [🔒 ดิ่ง]") : " [🔓 อิสระ]";
            let mainText = `📐 ระยะ: ${dist.toFixed(3)} ม. | ΔX: ${dx.toFixed(3)}m | ΔY: ${dy.toFixed(3)}m (${angleDeg.toFixed(1)}°)${lockTag}`;

            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(mainText);
            ctx.fillStyle = isOrtho ? 'rgba(6, 95, 70, 0.95)' : 'rgba(15, 23, 42, 0.95)';
            ctx.strokeStyle = isOrtho ? '#10b981' : '#06b6d4';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 24, tm.width + 16, 22, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(mainText, midX, midY - 13);
        }
        ctx.restore();
    }

    // 6.4 เส้นพรีวิวเครื่องมือวาดส่วนโค้ง (3-POINT ARC PREVIEW)
    if (cadArcState.active) {
        ctx.save();
        if (cadArcState.step === 1 || !cadArcState.pt1) {
            let sHover = cadWorldToScreen(cadHover.x, cadHover.y);
            ctx.beginPath();
            ctx.arc(sHover.x, sHover.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.stroke();

            let badge = "⌒ ARC: คลิก 'จุดที่ 1' จุดเริ่มส่วนโค้ง";
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sHover.x + 12, sHover.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, sHover.x + 18, sHover.y);
        } else if (cadArcState.step === 2) {
            let p1 = cadArcState.pt1;
            let s1 = cadWorldToScreen(p1.x, p1.y);
            let sHover = cadWorldToScreen(cadHover.x, cadHover.y);

            // จุดที่ 1
            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // เส้นเชื่อมตรงไปยังเมาส์ (จุดยอดโค้ง)
            ctx.beginPath();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.8;
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(sHover.x, sHover.y);
            ctx.stroke();
            ctx.setLineDash([]);

            let dist = Math.hypot(cadHover.x - p1.x, cadHover.y - p1.y);
            let badge = `⌒ จุดยอดโค้ง/จุดผ่าน P2 (${dist.toFixed(2)}m) · คลิกเพื่อวาง`;
            let midX = (s1.x + sHover.x) / 2;
            let midY = (s1.y + sHover.y) / 2;

            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 22, tm.width + 16, 22, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 11);
        } else if (cadArcState.step === 3 && cadArcState.pt1 && cadArcState.pt2) {
            let p1 = cadArcState.pt1;
            let p2 = cadArcState.pt2;
            let p3 = { x: cadHover.x, y: cadHover.y };

            let s1 = cadWorldToScreen(p1.x, p1.y);
            let s2 = cadWorldToScreen(p2.x, p2.y);
            let s3 = cadWorldToScreen(p3.x, p3.y);

            // จุด P1 และ P2
            [s1, s2].forEach((s, idx) => {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 6, 0, 2 * Math.PI);
                ctx.fillStyle = idx === 0 ? '#0284c7' : '#f59e0b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // จุด P3 (เมาส์)
            ctx.beginPath();
            ctx.arc(s3.x, s3.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            let arcPts = generateArcPoints(p1, p2, p3);
            if (arcPts && arcPts.length > 1) {
                ctx.beginPath();
                arcPts.forEach((pt, idx) => {
                    let s = cadWorldToScreen(pt.x, pt.y);
                    if (idx === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
                });
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2.8;
                ctx.stroke();
            }

            let arcInfo = calculate3PointArc(p1, p2, p3);
            let badge = "";
            if (arcInfo) {
                badge = `⌒ ARC · รัศมี R: ${arcInfo.radius.toFixed(2)}m | โค้งยาว: ${arcInfo.arcLength.toFixed(2)}m | กว้าง: ${arcInfo.chordWidth.toFixed(2)}m (คลิกเพื่อจบส่วนโค้ง)`;
            } else {
                let dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);
                badge = `⌒ ARC (เส้นตรง): ${dist.toFixed(2)}m (คลิกเพื่อจบ)`;
            }

            let midX = (s1.x + s3.x) / 2;
            let midY = (s1.y + s3.y) / 2;

            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(8, 145, 178, 0.95)';
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 26, tm.width + 16, 24, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 14);
        }
        ctx.restore();
    }

    // 6.5 พรีวิวเครื่องมือวางเส้นไกด์ไลน์ (GUIDELINE PREVIEW)
    if (cadGuideState.active) {
        ctx.save();
        if (cadGuideState.step === 1 || !cadGuideState.pt1) {
            let sHover = cadWorldToScreen(cadHover.x, cadHover.y);
            ctx.beginPath();
            ctx.arc(sHover.x, sHover.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.stroke();

            let badge = "📐 GUIDELINE: คลิก 'จุดที่ 1' วางแนวเส้นไกด์ไลน์";
            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sHover.x + 12, sHover.y - 10, tm.width + 12, 20, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, sHover.x + 18, sHover.y);
        } else if (cadGuideState.step === 2 && cadGuideState.pt1) {
            let p1 = cadGuideState.pt1;
            let isOrtho = isShiftPressed || cadOrtho;
            let p2 = { x: cadHover.x, y: cadHover.y };
            if (isOrtho) {
                let dx = Math.abs(p2.x - p1.x);
                let dy = Math.abs(p2.y - p1.y);
                if (dx >= dy) p2 = { x: p2.x, y: p1.y };
                else p2 = { x: p1.x, y: p2.y };
            }

            let s1 = cadWorldToScreen(p1.x, p1.y);
            let s2 = cadWorldToScreen(p2.x, p2.y);

            ctx.beginPath();
            ctx.arc(s1.x, s1.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let len = Math.hypot(dx, dy);
            let badge = "";
            if (len > 0.01) {
                let normDx = dx / len;
                let normDy = dy / len;
                let bigD = 2000;
                let sStart = cadWorldToScreen(p1.x - normDx * bigD, p1.y - normDy * bigD);
                let sEnd = cadWorldToScreen(p1.x + normDx * bigD, p1.y + normDy * bigD);

                ctx.beginPath();
                ctx.setLineDash([8, 6]);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.moveTo(sStart.x, sStart.y);
                ctx.lineTo(sEnd.x, sEnd.y);
                ctx.stroke();
                ctx.setLineDash([]);

                let angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 180;
                badge = `📐 GUIDELINE · ทิศทาง: ${angleDeg.toFixed(1)}° (คลิกเพื่อวางเส้นไกด์)`;
            } else {
                badge = "📐 GUIDELINE: ลากเมาส์เพื่อกำหนดทิศทาง";
            }

            ctx.font = 'bold 11px monospace';
            let tm = ctx.measureText(badge);
            let midX = (s1.x + s2.x) / 2;
            let midY = (s1.y + s2.y) / 2;
            ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
            ctx.beginPath();
            ctx.roundRect(midX - tm.width / 2 - 8, midY - 24, tm.width + 16, 22, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(badge, midX, midY - 13);
        }
        ctx.restore();
    }

    // 6.6 พรีวิวแนวเริ่มมุงแบบเรียลไทม์เมื่ออยู่ในโหมด polyPickStartMode
    if (polyPickStartMode && polygonPoints.length >= 3) {
        let snap = cadCalculateSnapAndWorld(cadMouseScreen.x, cadMouseScreen.y, isShiftPressed);
        let sSeamX = snap.x * cadView.scale + cadView.ox;

        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sSeamX, 0);
        ctx.lineTo(sSeamX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // วาดจุด Snap บน Canvas
        let sPt = cadWorldToScreen(snap.x, snap.y);
        ctx.beginPath();
        ctx.arc(sPt.x, sPt.y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        let badge = `📍 คลิกตั้งแนวเริ่มมุงที่ X = ${snap.x.toFixed(2)} ม.`;
        if (snap.label) badge += ` (${snap.label})`;
        else if (snap.snapType === 'endpoint') badge += ` (จุดมุม)`;
        else if (snap.snapType === 'midpoint') badge += ` (จุดกึ่งกลาง)`;

        ctx.font = 'bold 12px Sarabun';
        let tm = ctx.measureText(badge);
        ctx.fillStyle = 'rgba(22, 163, 74, 0.96)';
        ctx.beginPath();
        ctx.roundRect(sPt.x + 12, sPt.y - 12, tm.width + 16, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(badge, sPt.x + 20, sPt.y);
        ctx.restore();
    }

    // 7. เส้นเล็งเป้ากากบาท AutoCAD (Full Crosshair Cursor)
    let cx = cadMouseScreen.x;
    let cy = cadMouseScreen.y;
    ctx.strokeStyle = isDark ? 'rgba(161, 161, 170, 0.45)' : 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1;

    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    let ap = 6;
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.strokeRect(cx - ap, cy - ap, ap * 2, ap * 2);
}

// ------------------------------------------------------------
// GLOBAL WINDOW EXPORTS (สำหรับเรียกใช้จาก HTML onClick และโมดูลอื่นๆ)
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
    window.startCadArc = startCadArc;
    window.cancelCadArc = cancelCadArc;
    window.handleArcPointClick = handleArcPointClick;
    window.setDrawingMode = setDrawingMode;
    window.toggleDrawingMode = toggleDrawingMode;
    window.openCadStudio = openCadStudio;
    window.closeCadStudio = closeCadStudio;
    window.startCadMeasure = startCadMeasure;
    window.cancelCadMeasure = cancelCadMeasure;
    window.startCadCalibrateScale = startCadCalibrateScale;
    window.cancelCadCalibrate = cancelCadCalibrate;
    window.toggleCadOrtho = toggleCadOrtho;
    window.toggleCadSnap = toggleCadSnap;
    window.toggleCadGrid = toggleCadGrid;
    window.toggleCadCoords = toggleCadCoords;
    window.toggleCadSheetOverlay = toggleCadSheetOverlay;
    window.togglePickStartMode = togglePickStartMode;
    window.cadZoomExtents = cadZoomExtents;
    window.cadUndo = cadUndo;
    window.cadRedo = cadRedo;
    window.polyCloseShape = polyCloseShape;
    window.clearPoints = clearPoints;
    window.loadPolyPreset = loadPolyPreset;
    window.startCadOffsetCommand = startCadOffsetCommand;
    window.startCadGuide = startCadGuide;
    window.cancelCadGuide = cancelCadGuide;
    window.handleGuidePointClick = handleGuidePointClick;
    window.addCadGuideLine = addCadGuideLine;
    window.toggleCadGuidesVisibility = toggleCadGuidesVisibility;
    window.clearCadGuides = clearCadGuides;
    window.cadCalculateSnapAndWorld = cadCalculateSnapAndWorld;

    window.addPoint = addPoint;

    Object.defineProperty(window, 'cadGuideLines', {
        get: () => cadGuideLines,
        set: (v) => { cadGuideLines = v; }
    });
    Object.defineProperty(window, 'cadGuideState', {
        get: () => cadGuideState,
        set: (v) => { cadGuideState = v; }
    });
    Object.defineProperty(window, 'cadShowGuides', {
        get: () => cadShowGuides,
        set: (v) => { cadShowGuides = v; }
    });
    Object.defineProperty(window, 'polygonPoints', {
        get: () => polygonPoints,
        set: (v) => { polygonPoints = v; }
    });
    Object.defineProperty(window, 'polyDrawingMode', {
        get: () => polyDrawingMode,
        set: (v) => { polyDrawingMode = v; }
    });
    Object.defineProperty(window, 'cadArcState', {
        get: () => cadArcState,
        set: (v) => { cadArcState = v; }
    });
    Object.defineProperty(window, 'cadMeasureState', {
        get: () => cadMeasureState,
        set: (v) => { cadMeasureState = v; }
    });
    Object.defineProperty(window, 'cadView', {
        get: () => cadView,
        set: (v) => { cadView = v; }
    });
    Object.defineProperty(window, 'cadSnap', {
        get: () => cadSnap,
        set: (v) => { cadSnap = v; }
    });
    Object.defineProperty(window, 'cadOrtho', {
        get: () => cadOrtho,
        set: (v) => { cadOrtho = v; }
    });
    Object.defineProperty(window, 'polyPickStartMode', {
        get: () => polyPickStartMode,
        set: (v) => { polyPickStartMode = v; }
    });
    Object.defineProperty(window, 'polyStartSeamX', {
        get: () => polyStartSeamX,
        set: (v) => { polyStartSeamX = v; }
    });
    window.cadWorldToScreen = cadWorldToScreen;
    window.cadScreenToWorld = cadScreenToWorld;
    window.polyToScreen = polyToScreen;
    window.polyScreenToWorld = polyScreenToWorld;
}

