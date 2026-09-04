// ============================================================
// โมดูลคำนวณ: ทรงสามเหลี่ยม หน้าจั่ว (Triangle)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcTriangle(C) {
            document.getElementById('labelLength').innerText = "ความยาวตัดรวม (Total)";
            let base = parseFloat(document.getElementById('triBase').value) || 0;
            let h_plan = parseFloat(document.getElementById('triHeight').value) || 0;
            if(base===0 || h_plan===0) { showWarning("⚠️ กรุณากรอกฐานและสูง"); return false; }
            
            let eff_h = h_plan + C.overhang;
            let eff_b = base;
            if (h_plan > 0) {
                eff_b = base * (eff_h / h_plan);
            }
            
            C.baseWidth = eff_b;

            let areaPlan = 0.5 * eff_b * eff_h;
            let areaReal = areaPlan * C.secVal; 
            C.geometricArea = areaReal;
            
            let sidePlan = Math.sqrt(Math.pow(eff_b/2, 2) + Math.pow(eff_h, 2));
            let sideReal = sidePlan; 
            if(C.angle > 0) {
                 sideReal = sidePlan * C.secVal; 
            }
            C.flashingLen = sideReal * 2;

            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            let currentTotalLen = 0;
            
            let center = eff_b / 2;
            let sheetCountHalf = Math.ceil(center / C.sheetW);
            C.sheetCount = sheetCountHalf * 2; 
            
            for(let j = sheetCountHalf; j >= 1; j--) {
                let x_end = center - (j-1) * C.sheetW;
                let x_start = center - j * C.sheetW; 
                let h_max = (eff_h / center) * x_end; 
                let cut_len = (h_max * C.secVal); 
                
                currentTotalLen += cut_len;

                let label = "L" + j;
                let row = `<tr>
                    <td>${label}</td>
                    <td>${x_start.toFixed(2)} - ${x_end.toFixed(2)}</td>
                    <td style="font-weight:bold; color:var(--primary-color);">${cut_len.toFixed(2)}</td>
                </tr>`;
                tbody.innerHTML += row;
                
                C.sheetData.push({ id: label, x: x_start, w: C.sheetW, len: cut_len }); 
            }
            
            for(let i = 1; i <= sheetCountHalf; i++) {
                let x_start = center + (i-1) * C.sheetW;
                let x_end = center + i * C.sheetW; 
                
                let h_max = (eff_h / center) * (eff_b - x_start); 
                let cut_len = (h_max * C.secVal); 
                
                currentTotalLen += cut_len;

                let label = "R" + i;
                let row = `<tr>
                    <td>${label}</td>
                    <td>${x_start.toFixed(2)} - ${x_end.toFixed(2)}</td>
                    <td style="font-weight:bold; color:var(--primary-color);">${cut_len.toFixed(2)}</td>
                </tr>`;
                tbody.innerHTML += row;
                
                C.sheetData.push({ id: label, x: x_start, w: C.sheetW, len: cut_len }); 
            }
            
            C.totalLinearMeter = currentTotalLen;
            C.billableArea = C.totalLinearMeter * C.sheetW; 
            
            drawTriangle(eff_b, eff_h, base, h_plan, C.sheetData);
            
            document.getElementById('print-type').innerText = "ทรงสามเหลี่ยม (Triangle)";
            document.getElementById('print-slope-h').innerText = C.angle + " องศา";
            document.getElementById('print-width').innerText = eff_b.toFixed(2) + " (ฐานรวม)";
            document.getElementById('print-run').innerText = eff_h.toFixed(2) + " (สูงรวม)";
            document.getElementById('outLength').innerText = C.totalLinearMeter.toFixed(2) + " ม.";

            let formulaHtml = `
                <div class="formula-line"><span>1. ปรับระยะรวมชายคา (สูง):</span> <span class="formula-val">${h_plan} + ${C.overhang} = ${eff_h.toFixed(2)} ม.</span></div>
                <div class="formula-line"><span>2. ปรับระยะรวมชายคา (ฐาน):</span> <span class="formula-val">${base} × (${eff_h.toFixed(2)}/${h_plan}) = ${eff_b.toFixed(2)} ม.</span></div>
                <div class="formula-line"><span>3. พื้นที่จริง (Real Area):</span> <span class="formula-val">(0.5 × ${eff_b.toFixed(2)} × ${eff_h.toFixed(2)}) × ${C.secVal.toFixed(3)} = ${areaReal.toFixed(2)} ตร.ม.</span></div>
                <div class="formula-line"><span>4. พื้นที่ขาย (Billable):</span> <span class="formula-val">ความยาวตัดรวม (${C.totalLinearMeter.toFixed(2)}) × หน้ากว้าง (${C.sheetW}) = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
            `;
            document.getElementById('formulaContent').innerHTML = formulaHtml;
            document.getElementById('cuttingFormula').style.display = 'block';
            document.getElementById('cuttingSheetList').style.display = 'block';
            document.getElementById('cutListDesc').innerText = "(ปูแผ่นเริ่มจากจุดกึ่งกลาง)";
    return true;
}
