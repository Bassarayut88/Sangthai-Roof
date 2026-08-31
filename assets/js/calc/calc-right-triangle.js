// ============================================================
// โมดูลคำนวณ: สามเหลี่ยมมุมฉาก (Right Triangle)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcRightTriangle(C) {
            document.getElementById('labelLength').innerText = "ความยาวตัดรวม (Total)";
            let base = parseFloat(document.getElementById('rightTriBase').value) || 0;
            let height = parseFloat(document.getElementById('rightTriHeight').value) || 0;
            
            if(base === 0 || height === 0) { showWarning("⚠️ กรุณากรอกฐานและสูง"); return false; }

            let eff_base = base;
            let eff_height = height;
            C.baseWidth = eff_base;

            let areaPlan = 0.5 * eff_base * eff_height;
            C.geometricArea = areaPlan * C.secVal; 
            
            C.sheetCount = Math.ceil(eff_base / C.sheetW);
            
            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            let currentTotalLen = 0;

            for(let i=1; i<=C.sheetCount; i++) {
                let x_start = (i-1) * C.sheetW;
                let x_end = i * C.sheetW; 
                let h_max = eff_height * (1 - (x_start / eff_base));
                let cut_len = (h_max * C.secVal); 

                currentTotalLen += cut_len;

                let row = `<tr>
                    <td>L${i}</td>
                    <td>${x_start.toFixed(2)} - ${x_end.toFixed(2)}</td>
                    <td style="font-weight:bold; color:var(--primary-color);">${cut_len.toFixed(2)}</td>
                </tr>`;
                tbody.innerHTML += row;
                
                C.sheetData.push({ id: `L${i}`, x: x_start, w: C.sheetW, len: cut_len }); 
            }

            C.totalLinearMeter = currentTotalLen;
            C.billableArea = C.totalLinearMeter * C.sheetW;
            
            let vertSloped = eff_height * C.secVal;
            let hypSloped = Math.sqrt(Math.pow(eff_base, 2) + Math.pow(vertSloped, 2));
            C.flashingLen = vertSloped + eff_base + hypSloped; 

            drawRightTriangle(eff_base, eff_height, base, height, C.sheetData);
            
            document.getElementById('print-type').innerText = "สามเหลี่ยม (มุมฉาก)";
            document.getElementById('print-slope-h').innerText = `สูง ${eff_height.toFixed(2)} ม. / ${C.angle}°`;
            document.getElementById('print-width').innerText = eff_base.toFixed(2) + " (ฐานรวม)";
            document.getElementById('print-run').innerText = "-";
            document.getElementById('outLength').innerText = C.totalLinearMeter.toFixed(2) + " ม.";
            
            let formulaHtml = `
                <div class="formula-line"><span>1. ระยะ (Dimension):</span> <span class="formula-val">ฐาน ${eff_base.toFixed(2)} / สูง ${eff_height.toFixed(2)}</span></div>
                <div class="formula-line"><span>2. ตัวคูณองศา (${C.angle}°):</span> <span class="formula-val">Sec(${C.angle}°) = ${C.secVal.toFixed(4)}</span></div>
                <div class="formula-line"><span>3. พื้นที่จริง (Real Area):</span> <span class="formula-val">(0.5 × ${eff_base} × ${eff_height}) × ${C.secVal.toFixed(3)} = ${C.geometricArea.toFixed(2)} ตร.ม.</span></div>
                <div class="formula-line"><span>4. พื้นที่ขาย (Billable):</span> <span class="formula-val">ความยาวตัดรวม (${C.totalLinearMeter.toFixed(2)}) × หน้ากว้าง (${C.sheetW}) = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
            `;
            document.getElementById('formulaContent').innerHTML = formulaHtml;
            document.getElementById('cuttingFormula').style.display = 'block';
            document.getElementById('cuttingSheetList').style.display = 'block';
            document.getElementById('cutListDesc').innerText = "(เริ่มปูแผ่นจากฝั่งซ้ายที่ยาวสุด)";
    return true;
}
