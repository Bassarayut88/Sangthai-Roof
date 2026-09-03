// ============================================================
// โมดูลคำนวณ: ทรงจั่ว/เพิงแหงน (Slope)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcSlope(C) {
            document.getElementById('labelLength').innerText = "ความยาวแผ่นตัด";
            let width = parseFloat(document.getElementById('roofWidth').value) || 0;
            let run = parseFloat(document.getElementById('roofRun').value) || 0;
            if(width === 0 || run === 0) { showWarning("⚠️ กรุณากรอกขนาดให้ครบถ้วน"); return false; }
            
            C.baseWidth = width;

            let totalHorizontalRun = run + C.overhang;
            let slopeLength = totalHorizontalRun * C.secVal;
            C.totalLen = slopeLength; 
            
            C.geometricArea = width * slopeLength;
            
            C.sheetCount = Math.ceil(width / C.sheetW);
            C.totalLinearMeter = C.totalLen * C.sheetCount;
            C.billableArea = C.totalLinearMeter * C.sheetW;
            
            C.flashingLen = width + (C.totalLen * 2);

            drawRoof(run, C.angle, C.overhang, C.totalLen, false);
            
            document.getElementById('print-type').innerText = "ทรงจั่ว/เพิงแหงน";
            document.getElementById('print-slope-h').innerText = C.angle + " องศา";
            document.getElementById('print-width').innerText = width;
            document.getElementById('print-run').innerText = run;
            document.getElementById('outLength').innerText = C.totalLen.toFixed(2) + " ม.";
    return true;
}
