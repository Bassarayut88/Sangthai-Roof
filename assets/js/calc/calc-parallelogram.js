// ============================================================
// โมดูลคำนวณ: สี่เหลี่ยมด้านขนาน (Parallelogram)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcParallelogram(C) {
            document.getElementById('labelLength').innerText = "ความยาวแผ่นตัด";
            let width = parseFloat(document.getElementById('paraWidth').value) || 0;
            let run = parseFloat(document.getElementById('paraRun').value) || 0;
            let skew = parseFloat(document.getElementById('paraSkew').value) || 0;

            if(width === 0 || run === 0) { showWarning("⚠️ กรุณากรอกขนาดให้ครบถ้วน"); return false; }
            
            C.baseWidth = width;

            let totalHorizontalRun = run + C.overhang;
            let slopeLength = totalHorizontalRun * C.secVal;
            C.totalLen = slopeLength;
            C.geometricArea = width * slopeLength;
            
            C.sheetCount = Math.ceil(width / C.sheetW);
            
            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            let currentTotalLen = 0;

            let layFromRight = skew < 0; 
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
                
                let cut_len = slopeLength;
                currentTotalLen += cut_len;

                let label = listHeader + i;
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
            
            let realSideLen = Math.sqrt(Math.pow(totalHorizontalRun * C.secVal, 2) + Math.pow(skew, 2));
            C.flashingLen = (width * 2) + (realSideLen * 2); 

            drawParallelogram(width, run, skew, C.overhang, C.sheetData);
            
            document.getElementById('print-type').innerText = "สี่เหลี่ยมด้านขนาน";
            document.getElementById('print-slope-h').innerText = `${C.angle}°`;
            document.getElementById('print-width').innerText = `${width} (กว้าง)`;
            document.getElementById('outLength').innerText = C.totalLen.toFixed(2) + " ม.";

            document.getElementById('cuttingSheetList').style.display = 'block';
            document.getElementById('cutListDesc').innerText = `(ปูแผ่นเริ่มจากฝั่ง${layFromRight ? 'ขวา' : 'ซ้าย'})`;
    return true;
}
