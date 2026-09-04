// ============================================================
// โมดูลคำนวณ: สี่เหลี่ยมด้านไม่เท่า (Irregular)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcIrregular(C) {
            document.getElementById('labelLength').innerText = "ความยาวตัดรวม (Total)";
            let width = parseFloat(document.getElementById('irrWidth').value) || 0;
            let hTL = parseFloat(document.getElementById('irrHTL').value) || 0;
            let hTR = parseFloat(document.getElementById('irrHTR').value) || 0;
            let hBL = parseFloat(document.getElementById('irrHBL').value) || 0;
            let hBR = parseFloat(document.getElementById('irrHBR').value) || 0;

            if(width === 0) { showWarning("⚠️ กรุณากรอกความกว้าง"); return false; }
            
            C.baseWidth = width;

            let areaPlan = width * ((hTL + hTR) - (hBL + hBR)) / 2;
            C.geometricArea = areaPlan * C.secVal;

            C.sheetCount = Math.ceil(width / C.sheetW);
            
            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            let currentTotalLen = 0;

            let leftHeight = hTL - hBL;
            let rightHeight = hTR - hBR;
            let layFromRight = rightHeight > leftHeight;
            let listHeader = layFromRight ? "R" : "L";

            for(let i=1; i<=C.sheetCount; i++) {
                let x_start, x_end;
                
                if (layFromRight) {
                    x_end = width - (i-1) * C.sheetW;
                    x_start = width - i * C.sheetW;
                } else {
                    x_start = (i-1) * C.sheetW;
                    x_end = i * C.sheetW;
                }
                
                let yt_start = hTL + (hTR - hTL) * (x_start / width);
                let yt_end = hTL + (hTR - hTL) * (x_end / width);
                
                let yb_start = hBL + (hBR - hBL) * (x_start / width);
                let yb_end = hBL + (hBR - hBL) * (x_end / width);
                
                let y_top_max = Math.max(yt_start, yt_end);
                let y_bot_min = Math.min(yb_start, yb_end);
                
                let raw_len = y_top_max - y_bot_min;
                let cut_len = (raw_len * C.secVal);

                currentTotalLen += cut_len;

                let label = listHeader + i;
                let row = `<tr>
                    <td>${label}</td>
                    <td>${x_start.toFixed(2)} - ${x_end.toFixed(2)}</td>
                    <td style="font-weight:bold; color:var(--primary-color);">${cut_len.toFixed(2)}</td>
                </tr>`;
                tbody.innerHTML += row;
                
                C.sheetData.push({ 
                    id: label, 
                    x: x_start, 
                    w: C.sheetW, 
                    len: cut_len,
                    yTop: y_top_max, 
                    yBot: y_bot_min
                });
            }

            C.totalLinearMeter = currentTotalLen;
            C.billableArea = C.totalLinearMeter * C.sheetW;
            
            C.flashingLen = (width*2 + hTL + hTR + hBL + hBR) * C.secVal; 

            drawIrregular(width, hTL, hTR, hBL, hBR, C.sheetData);
            
            document.getElementById('print-type').innerText = "สี่เหลี่ยมด้านไม่เท่า";
            document.getElementById('print-slope-h').innerText = `${C.angle}°`;
            document.getElementById('print-width').innerText = `${width} (กว้าง)`;
            document.getElementById('outLength').innerText = C.totalLinearMeter.toFixed(2) + " ม.";
            
            let dirText = layFromRight ? "ขวาไปซ้าย (R)" : "ซ้ายไปขวา (L)";
            let formulaHtml = `
                <div class="formula-line"><span>1. ตัวคูณองศา (${C.angle}°):</span> <span class="formula-val">Sec(${C.angle}°) = ${C.secVal.toFixed(4)}</span></div>
                <div class="formula-line"><span>2. พื้นที่จริง (Real Area):</span> <span class="formula-val">${areaPlan.toFixed(2)} × ${C.secVal.toFixed(3)} = ${C.geometricArea.toFixed(2)} ตร.ม.</span></div>
                <div class="formula-line"><span>3. พื้นที่ขาย (Billable):</span> <span class="formula-val">ความยาวตัดรวม (${C.totalLinearMeter.toFixed(2)}) × หน้ากว้าง (${C.sheetW}) = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
                <div class="formula-line" style="margin-top:10px;"><span style="color:var(--primary-color); font-weight:bold;">* ทิศทางการปูแผ่น:</span> <span class="formula-val" style="color:var(--primary-color);">เริ่มจาก${dirText} (ฝั่งที่ยาวกว่า)</span></div>
            `;
            document.getElementById('formulaContent').innerHTML = formulaHtml;
            document.getElementById('cuttingFormula').style.display = 'block';
            document.getElementById('cuttingSheetList').style.display = 'block';
            document.getElementById('cutListDesc').innerText = `(ปูแผ่นเริ่มจากฝั่ง${layFromRight ? 'ขวา' : 'ซ้าย'}ที่ยาวสุด)`;
    return true;
}
