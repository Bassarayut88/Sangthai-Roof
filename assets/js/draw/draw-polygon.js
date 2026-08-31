// ============================================================
// วาดภาพหลายเหลี่ยมจากพิกัด (Polygon 2D Visualizer)
// สไตล์มาตรฐาน:
//   · เส้นประสีดำ (Dashed Lines) แสดงกรอบสั่งตัดของแต่ละแผ่น
//   · เส้นทึบสีดำเข้ม (Solid Black Line) แสดงแนวขอบรูปทรงหลังคาจริง
//   · เส้นลูกศรสองหัวสีเขียว (Bright Green Double-Arrow) แสดงความยาวตัดแต่ละแผ่น
//   · หมายเลขแผ่น (1, 2, 3, 4, 5...) เรียงอยู่ด้านล่างอย่างเป็นระเบียบ
//   · สัญลักษณ์ลูกศรเขียวบอกจุดเริ่มมุง (Start Alignment Marker) ตรงตามแบบ
// ============================================================

function drawPolygon(points, sheetData = [], startSide = 'left') {
    const canvas = document.getElementById('roofCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // วาดกริดพื้นหลังเบาๆ สบายตา
    drawGrid(ctx, w, h);
    
    if (!points || points.length < 3) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Sarabun';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('กรุณากำหนดจุดมุมหลังคาอย่างน้อย 3 จุดในแถบด้านซ้าย', w / 2, h / 2);
        return;
    }
    
    // 1. หา Bounding Box รวมของรูปทรงและแผ่น
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    if (sheetData && sheetData.length > 0) {
        sheetData.forEach(s => {
            if (s.len > 0) {
                if (s.x < minX) minX = s.x;
                if (s.x + s.w > maxX) maxX = s.x + s.w;
                if (s.yMin < minY) minY = s.yMin;
                if (s.yMax > maxY) maxY = s.yMax;
            }
        });
    }
    
    let totalW = maxX - minX;
    let totalH = maxY - minY;
    if (totalW <= 0) totalW = 1;
    if (totalH <= 0) totalH = 1;
    
    const padX = 65;
    const padTop = 45;
    const padBottom = 92;
    const availW = w - padX * 2;
    const availH = h - (padTop + padBottom);
    const scale = Math.min(availW / totalW, availH / totalH);
    
    const drawW = totalW * scale;
    const drawH = totalH * scale;
    const startX = (w - drawW) / 2;
    const startY = padTop + (availH - drawH) / 2;

    const toSX = (x) => startX + (x - minX) * scale;
    // แกน Y ในระบบหลังคา: Y=0 คือชายคาล่าง, Y สูงขึ้นคือยอด/ลึก
    // เพื่อให้ภาพแสดง Y=0 อยู่ด้านล่างและ Y สูงอยู่ด้านบน
    const toSY = (y) => startY + drawH - (y - minY) * scale;

    // 2. วาดกรอบแผ่นเส้นประสีดำ (Dashed Sheet Bounding Boxes) - ตรงตาม Image 1 และ 2
    if (sheetData && sheetData.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 5]);

        sheetData.forEach(sheet => {
            if (sheet.len <= 0) return;
            let sx1 = toSX(sheet.x);
            let sx2 = toSX(sheet.x + sheet.w);
            let syTop = toSY(sheet.yMax);
            let syBot = toSY(sheet.yMin);
            
            let rectW = sx2 - sx1;
            let rectH = syBot - syTop;
            ctx.strokeRect(sx1, syTop, rectW, rectH);
        });
        ctx.restore();
    }
    
    // 3. วาดเส้นขอบรูปทรงหลังคาจริง (Solid Black Polygon Outline)
    ctx.save();
    ctx.beginPath();
    points.forEach((p, i) => {
        let px = toSX(p.x);
        let py = toSY(p.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.closePath();
    
    // ไฮไลต์พื้นผิวหลังคาโปร่งแสง
    ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    
    // 4. วาดเส้นลูกศรสองหัวสีเขียว + ตัวเลขความยาวตัดแผ่น (Green Dimension Arrows)
    if (sheetData && sheetData.length > 0) {
        sheetData.forEach((sheet, index) => {
            if (sheet.len <= 0) return;
            let sx1 = toSX(sheet.x);
            let sx2 = toSX(sheet.x + sheet.w);
            let centerX = (sx1 + sx2) / 2;
            
            let syTop = toSY(sheet.yMax);
            let syBot = toSY(sheet.yMin);
            
            // วาดเส้นลูกศรสองหัวสีเขียว
            drawPolygonSheetArrow(ctx, centerX, syBot, syTop, sheet.len.toFixed(2), '#00c800');
            
            // หมายเลขแผ่นด้านล่าง (1, 2, 3, 4, 5...) - ตรงตาม Image 1
            let numY = syBot + 16;
            let sheetNum = sheet.index || (index + 1);
            
            ctx.save();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 12px Sarabun';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // halo สีขาวเพื่อให้อ่านง่าย
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.strokeText(String(sheetNum), centerX, numY);
            ctx.fillText(String(sheetNum), centerX, numY);
            ctx.restore();
        });

        // 5. วาดสัญลักษณ์ลูกศรเขียวและเส้นแนวเริ่มมุง (Start Alignment Marker & Draggable Handle)
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : minX;
        let sSeamX = toSX(seamX);
        let sBotY = startY + drawH;
        let sTopY = startY;

        // เส้นประแนวเริ่มมุงสีเขียว (Start Seam Line)
        ctx.save();
        ctx.strokeStyle = '#00c800';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sSeamX, sBotY + 28);
        ctx.lineTo(sSeamX, sTopY - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // ด้ามจับ/ป้ายบอกจุดเริ่มมุง (Start Handle Badge - วางแถวล่าง ไม่บังตัวเลขแผ่น)
        let handleY = sBotY + 44;
        let badgeText = (startSide === 'right') 
            ? `[ 📍 แผ่นที่ 1 เริ่มมุง (⬅️ ไปทางซ้าย) X: ${seamX.toFixed(2)} ม. ]`
            : `[ 📍 แผ่นที่ 1 เริ่มมุง (➡️ ไปทางขวา) X: ${seamX.toFixed(2)} ม. ]`;

        ctx.font = 'bold 11px Sarabun';
        let btm = ctx.measureText(badgeText);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.roundRect(sSeamX - btm.width / 2 - 8, handleY - 10, btm.width + 16, 21, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, sSeamX, handleY + 1);

        // ลูกศรชี้ขึ้นจากป้ายเริ่มมุงไปยังขอบล่าง
        drawStartMarkerArrow(ctx, sSeamX, handleY - 10, sBotY + 2, '#00c800');
        ctx.restore();
    }

    // 6. จุดมุมรูปทรง (Vertices)
    ctx.fillStyle = '#0f172a';
    points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(toSX(p.x), toSY(p.y), 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
    
    // แถบข้อมูลสรุปด้านล่างภาพ
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.font = '13px Sarabun';
    ctx.textAlign = 'left';
    ctx.fillText(`📐 รูปทรง ${points.length} จุดมุม | กว้างรวม ${totalW.toFixed(2)} ม. × ลึก ${totalH.toFixed(2)} ม. | จำนวนแผ่น: ${sheetData ? sheetData.filter(s => s.len > 0).length : 0} แผ่น`, startX, startY + drawH + 74);
    ctx.restore();

    polyRoofCanvasView = { startX, startY, drawW, drawH, scale, minX, minY, maxX, maxY };
    window.polyRoofCanvasView = polyRoofCanvasView;
    initRoofCanvasInteractions();
}

let polyRoofCanvasView = null;
let isDraggingRoofStartSeam = false;
let roofCanvasBound = false;

function initRoofCanvasInteractions() {
    const canvas = document.getElementById('roofCanvas');
    if (!canvas || roofCanvasBound) return;
    roofCanvasBound = true;

    canvas.addEventListener('mousemove', function(evt) {
        if (currentMode !== 'polygon' || !polyRoofCanvasView) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (evt.clientY - rect.top) * (canvas.height / rect.height);

        let view = polyRoofCanvasView;
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : view.minX;
        let sSeamX = view.startX + (seamX - view.minX) * view.scale;
        let sBotY = view.startY + view.drawH;
        let handleY = sBotY + 44;

        if (isDraggingRoofStartSeam) {
            let worldX = view.minX + (mouseX - view.startX) / view.scale;
            // Snap to nearest vertex X
            if (polygonPoints && polygonPoints.length > 0) {
                for (let p of polygonPoints) {
                    if (Math.abs(worldX - p.x) < 0.2) {
                        worldX = p.x;
                        break;
                    }
                }
            }
            polyStartSeamX = Math.round(worldX * 100) / 100;
            calculate();
            return;
        }

        // ตรวจสอบ hover ด้ามจับหรือแนวเริ่มมุง
        let isOverHandle = (Math.abs(mouseX - sSeamX) < 140 && Math.abs(mouseY - handleY) < 15);
        let isOverLine = (Math.abs(mouseX - sSeamX) < 15 && mouseY >= view.startY - 15 && mouseY <= handleY + 15);

        if (isOverHandle || isOverLine) {
            canvas.style.cursor = 'ew-resize';
        } else if (polyPickStartMode) {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mousedown', function(evt) {
        if (currentMode !== 'polygon' || !polyRoofCanvasView || evt.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (evt.clientY - rect.top) * (canvas.height / rect.height);

        let view = polyRoofCanvasView;
        let seamX = (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) ? polyStartSeamX : view.minX;
        let sSeamX = view.startX + (seamX - view.minX) * view.scale;
        let sBotY = view.startY + view.drawH;
        let handleY = sBotY + 44;

        if (polyPickStartMode) {
            let worldX = view.minX + (mouseX - view.startX) / view.scale;
            // Snap to nearest vertex
            if (polygonPoints && polygonPoints.length > 0) {
                for (let p of polygonPoints) {
                    if (Math.abs(worldX - p.x) < 0.3) {
                        worldX = p.x;
                        break;
                    }
                }
            }
            polyStartSeamX = Math.round(worldX * 100) / 100;
            polyPickStartMode = false;
            let btn = document.getElementById('btnPickStartPoint');
            if (btn) btn.classList.remove('active');
            calculate();
            return;
        }

        let isOverHandle = (Math.abs(mouseX - sSeamX) < 140 && Math.abs(mouseY - handleY) < 15);
        let isOverLine = (Math.abs(mouseX - sSeamX) < 15 && mouseY >= view.startY - 15 && mouseY <= handleY + 15);

        if (isOverHandle || isOverLine) {
            isDraggingRoofStartSeam = true;
            canvas.style.cursor = 'ew-resize';
        }
    });

    window.addEventListener('mouseup', function() {
        if (isDraggingRoofStartSeam) {
            isDraggingRoofStartSeam = false;
            canvas.style.cursor = 'default';
        }
    });
}

// ฟังก์ชันวาดเส้นลูกศรสองหัวและตัวเลขความยาวแผ่น (สีเขียวสดใส)
function drawPolygonSheetArrow(ctx, x, yBottom, yTop, text, color = '#00c800') {
    let arrowLen = Math.abs(yBottom - yTop);
    if (arrowLen < 12) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;

    // เส้นแกนกลาง
    ctx.beginPath();
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x, yTop);
    ctx.stroke();

    // หัวลูกศรล่างและบน
    let head = Math.min(7, arrowLen / 3);
    
    // ลูกศรบน (ชี้ขึ้น)
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x - 3.5, yTop + head);
    ctx.lineTo(x + 3.5, yTop + head);
    ctx.closePath();
    ctx.fill();

    // ลูกศรล่าง (ชี้ลง)
    ctx.beginPath();
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x - 3.5, yBottom - head);
    ctx.lineTo(x + 3.5, yBottom - head);
    ctx.closePath();
    ctx.fill();

    // ตัวเลขบอกความยาวแผ่นตัด (หมุน 90 องศาแนวตั้ง)
    let midY = (yBottom + yTop) / 2;
    ctx.save();
    ctx.translate(x, midY);
    ctx.rotate(-Math.PI / 2);

    ctx.font = 'bold 12px Sarabun';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // ขอบขาวรอบตัวเลข (Halo)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, -3);

    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, 0, -3);
    ctx.restore();

    ctx.restore();
}

// ฟังก์ชันวาดลูกศรเขียวบอกจุดเริ่มมุง (Start Alignment Marker)
function drawStartMarkerArrow(ctx, x, yFrom, yTo, color = '#00c800') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, yFrom);
    ctx.lineTo(x, yTo);
    ctx.stroke();

    // หัวลูกศรชี้ขึ้น
    let head = 8;
    ctx.beginPath();
    ctx.moveTo(x, yTo);
    ctx.lineTo(x - 4.5, yTo + head);
    ctx.lineTo(x + 4.5, yTo + head);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

