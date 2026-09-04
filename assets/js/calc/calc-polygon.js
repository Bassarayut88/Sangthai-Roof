// ============================================================
// โมดูลคำนวณ: หลายเหลี่ยมจากพิกัด (Polygon Calculation Module)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// รองรับการเลือกจุดเริ่มมุง (ซ้าย, ขวา, กึ่งกลาง, กำหนดระยะ Offset เอง)
// คำนวณความยาวตัดแผ่น, พื้นที่ขาย, พื้นที่จริง, รายการตัดแผ่น (Cutting List)
// ============================================================

// ฟังก์ชันเสริม: หาขอบเขต [yMin, yMax] ของรูปหลายเหลี่ยมในช่วงแผ่น [x_start, x_end]
function getPolygonYBoundsInInterval(points, x_start, x_end) {
    let minY = Infinity;
    let maxY = -Infinity;
    let foundInside = false;

    // 1. ตรวจสอบจุดมุมของรูปหลายเหลี่ยมที่อยู่ภายในช่วง [x_start, x_end]
    for (let p of points) {
        if (p.x >= x_start - 0.0001 && p.x <= x_end + 0.0001) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
            foundInside = true;
        }
    }

    // 2. ตรวจสอบจุดตัดของเส้นขอบรูปหลายเหลี่ยมกับระนาบ x_start และ x_end
    for (let i = 0; i < points.length; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];
        
        if (Math.abs(p1.x - p2.x) < 0.00001) continue; // ข้ามเส้นตั้งตรง

        // จุดตัดที่ x_start
        if ((p1.x <= x_start && p2.x >= x_start) || (p2.x <= x_start && p1.x >= x_start)) {
            let y = p1.y + (p2.y - p1.y) * (x_start - p1.x) / (p2.x - p1.x);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundInside = true;
        }

        // จุดตัดที่ x_end
        if ((p1.x <= x_end && p2.x >= x_end) || (p2.x <= x_end && p1.x >= x_end)) {
            let y = p1.y + (p2.y - p1.y) * (x_end - p1.x) / (p2.x - p1.x);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundInside = true;
        }
    }
    
    if (!foundInside || minY === Infinity || maxY === -Infinity) {
        return { yMin: 0, yMax: 0, length: 0 };
    }
    return { yMin: minY, yMax: maxY, length: Math.max(0, maxY - minY) }; 
}

function calcPolygon(C) {
    document.getElementById('labelLength').innerText = "ความยาวตัดรวม (Total)";
    
    if (!polygonPoints || polygonPoints.length < 3) {
        showWarning("⚠️ กรุณากำหนดจุดมุมหลังคาอย่างน้อย 3 จุด");
        return false;
    }
    
    // 1. คำนวณพื้นที่ระนาบด้วยสูตร Shoelace Formula
    let areaPlan = 0;
    for (let i = 0; i < polygonPoints.length; i++) {
        let j = (i + 1) % polygonPoints.length;
        areaPlan += polygonPoints[i].x * polygonPoints[j].y;
        areaPlan -= polygonPoints[j].x * polygonPoints[i].y;
    }
    areaPlan = Math.abs(areaPlan) / 2;
    
    C.geometricArea = areaPlan * C.secVal;
    
    // 2. หา Bounding Box ของรูปทรง
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    polygonPoints.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    
    let totalWidth = maxX - minX;
    C.baseWidth = totalWidth;

    // 3. กำหนดจุดและทิศทางเริ่มมุงแผ่น
    let startSideEl = document.getElementById('polyStartSide');
    let startSide = startSideEl ? startSideEl.value : 'left';
    
    let offsetEl = document.getElementById('polyStartOffset');
    let customOffset = offsetEl ? (parseFloat(offsetEl.value) || 0) : 0;

    // ถ้า polyStartSeamX ยังไม่ถูกกำหนด ให้ใช้ค่าเริ่มต้นตามด้านที่เลือก + offset
    if (polyStartSeamX === null || isNaN(polyStartSeamX)) {
        if (startSide === 'right') {
            polyStartSeamX = maxX - customOffset;
        } else if (startSide === 'center') {
            polyStartSeamX = (minX + maxX) / 2 + customOffset;
        } else {
            polyStartSeamX = minX + customOffset;
        }
    }
    C.startSeamX = polyStartSeamX;

    // อัปเดตตัวเลขแสดงผลใน UI
    let startSeamDisplay = document.getElementById('polyStartSeamDisplay');
    if (startSeamDisplay) {
        startSeamDisplay.innerText = `X = ${polyStartSeamX.toFixed(2)} ม.`;
    }

    // คำนวณช่วงแผ่นทั้งหมดที่ครอบคลุม [minX, maxX] โดยอิงแนวรอยต่อ polyStartSeamX
    let leftK = Math.floor((minX - polyStartSeamX) / C.sheetW);
    let rightK = Math.ceil((maxX - polyStartSeamX) / C.sheetW);

    let allStrips = [];
    for (let k = leftK; k < rightK; k++) {
        let x_start = Math.round((polyStartSeamX + k * C.sheetW) * 1000) / 1000;
        let x_end = Math.round((polyStartSeamX + (k + 1) * C.sheetW) * 1000) / 1000;
        allStrips.push({ k: k, x_start: x_start, x_end: x_end });
    }

    // กรองเฉพาะแผ่นที่มีชิ้นส่วนอยู่ในรูปหลายเหลี่ยม
    let activeStrips = [];
    for (let s of allStrips) {
        let bounds = getPolygonYBoundsInInterval(polygonPoints, s.x_start, s.x_end);
        if (bounds.length > 0.001) {
            activeStrips.push({
                k: s.k,
                x_start: s.x_start,
                x_end: s.x_end,
                yMin: bounds.yMin,
                yMax: bounds.yMax,
                rawLen: bounds.length,
                cutLen: bounds.length * C.secVal
            });
        }
    }

    // กำหนดหมายเลขแผ่น (Index) ตามทิศทางการมุง
    if (startSide === 'right') {
        // เรียงจากขวาไปซ้าย
        activeStrips.reverse();
        activeStrips.forEach((s, idx) => { s.index = idx + 1; });
    } else {
        // เรียงจากซ้ายไปขวา
        activeStrips.forEach((s, idx) => { s.index = idx + 1; });
    }

    let tbody = document.getElementById('sheetListBody');
    tbody.innerHTML = "";
    let currentTotalLen = 0;
    C.sheetData = [];

    for (let s of activeStrips) {
        currentTotalLen += s.cutLen;

        let row = `<tr>
            <td><strong>แผ่นที่ ${s.index}</strong></td>
            <td>${Math.min(s.x_start, s.x_end).toFixed(2)} - ${Math.max(s.x_start, s.x_end).toFixed(2)}</td>
            <td style="color:#008000; font-weight:bold;">${s.cutLen.toFixed(2)}</td>
        </tr>`;
        tbody.innerHTML += row;

        C.sheetData.push({
            id: `L${s.index}`,
            index: s.index,
            x: s.x_start,
            w: C.sheetW,
            len: s.cutLen,
            yMin: s.yMin,
            yMax: s.yMax
        });
    }
    
    C.sheetCount = C.sheetData.length;
    C.totalLinearMeter = currentTotalLen; 
    C.billableArea = C.totalLinearMeter * C.sheetW;
    
    // คำนวณความยาวเส้นรอบรูป (Perimeter / Flashing)
    let perimeter = 0;
    for (let i = 0; i < polygonPoints.length; i++) {
        let j = (i + 1) % polygonPoints.length;
        let p1 = polygonPoints[i];
        let p2 = polygonPoints[j];
        let dy = Math.abs(p2.y - p1.y);
        let dx = Math.abs(p2.x - p1.x);
        let dReal = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy * C.secVal, 2));
        perimeter += dReal;
    }
    C.flashingLen = perimeter;
    
    // วาดภาพจำลองผลลัพธ์
    drawPolygon(polygonPoints, C.sheetData, startSide);
    
    // อัปเดตข้อมูลสรุป
    document.getElementById('print-type').innerText = "หลายเหลี่ยม (พิกัด)";
    document.getElementById('print-slope-h').innerText = `${C.angle}°`;
    document.getElementById('print-width').innerText = `${totalWidth.toFixed(2)} (กว้างรวม)`;
    document.getElementById('outLength').innerText = C.totalLinearMeter.toFixed(2) + " ม.";
    document.getElementById('outCount').innerText = C.sheetCount + " แผ่น";
    
    let formulaHtml = `
        <div class="formula-line"><span>1. พื้นที่ระนาบ (Plan Area):</span> <span class="formula-val">${areaPlan.toFixed(2)} ตร.ม.</span></div>
        <div class="formula-line"><span>2. พื้นที่จริง (Real Area):</span> <span class="formula-val">${areaPlan.toFixed(2)} × ${C.secVal.toFixed(3)} = ${C.geometricArea.toFixed(2)} ตร.ม.</span></div>
        <div class="formula-line"><span>3. พื้นที่ขาย (Billable):</span> <span class="formula-val">รวมความยาวแผ่นจริง (${C.totalLinearMeter.toFixed(2)} ม.) × หน้ากว้าง (${C.sheetW} ม.) = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
        <div class="formula-line"><span>4. แนวการมุงแผ่น:</span> <span class="formula-val">${startSide === 'right' ? 'เริ่มจากขวาสุด → ซ้าย' : (startSide === 'center' ? 'เริ่มจากกึ่งกลาง/ยอดจั่ว' : 'เริ่มจากซ้ายสุด → ขวา')} (รวม ${C.sheetCount} แผ่น)</span></div>
    `;
    document.getElementById('formulaContent').innerHTML = formulaHtml;
    document.getElementById('cuttingFormula').style.display = 'block';
    document.getElementById('cuttingSheetList').style.display = 'block';
    document.getElementById('cutListDesc').innerText = (startSide === 'right')
        ? "(ประเมินการปูแผ่นจากขวาสุดไปซ้ายสุด)"
        : (startSide === 'center' ? "(ประเมินการปูแผ่นเริ่มจากกึ่งกลาง)" : "(ประเมินการปูแผ่นจากซ้ายสุดไปขวาสุด)");
    
    return true;
}

